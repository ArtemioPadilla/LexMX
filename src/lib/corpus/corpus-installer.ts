/**
 * Corpus installer (plan Fase 6, carga perezosa por shard).
 *
 * The published corpus lives at `<base>/legal-corpus/` and
 * `<base>/embeddings/`. Instead of fetching everything on every visit, the
 * installer:
 *   1. compares the served corpus version with what IndexedDB already holds
 *      (`lexmx_vectors` → metadata `corpusVersion`), and skips the network
 *      entirely when they match;
 *   2. otherwise installs document by document (one JSON + one embeddings
 *      shard each), committing progress after every document so an
 *      interrupted install resumes where it stopped;
 *   3. reports progress through a callback (the `$corpusInstall` store feeds
 *      the UI from it).
 */
import type { VectorStore } from '@/types/rag';
import type { DocumentLoader } from './document-loader';

export type CorpusInstallPhase = 'idle' | 'checking' | 'installing' | 'ready' | 'empty' | 'error';

export interface CorpusInstallProgress {
  phase: CorpusInstallPhase;
  /** Documents installed so far (this run plus previous runs). */
  installed: number;
  /** Documents in the served corpus. */
  total: number;
  /** Chunks available for search after this step. */
  chunks: number;
  documentId?: string;
  message?: string;
  /** True when nothing had to be fetched. */
  fromCache?: boolean;
}

export interface CorpusInstallResult {
  status: 'real' | 'empty';
  chunks: number;
  documents: number;
  fromCache: boolean;
  /** True when at least one chunk had no real embedding and got a mock one. */
  mockEmbeddings: boolean;
}

const META_VERSION = 'corpusVersion';
const META_INSTALLED = 'installedDocuments';

export class CorpusInstaller {
  /**
   * @param scope Jurisdiction code of a secondary corpus (e.g. 'cl'). The
   *   Mexican corpus (no scope) keeps the historical metadata keys; scoped
   *   corpora use `corpusVersion:<code>` / `installedDocuments:<code>` and
   *   only ever delete their own chunks, so several corpora share one store.
   */
  constructor(
    private readonly loader: DocumentLoader,
    private readonly store: VectorStore,
    private readonly onProgress: (p: CorpusInstallProgress) => void = () => {},
    private readonly scope?: string,
  ) {}

  private key(base: string): string {
    return this.scope ? `${base}:${this.scope}` : base;
  }

  async ensureInstalled(): Promise<CorpusInstallResult> {
    this.onProgress({ phase: 'checking', installed: 0, total: 0, chunks: 0 });
    await this.loader.initialize();
    const metadata = this.loader.getMetadata();
    const docs = metadata?.documents ?? [];
    const version = this.loader.getCorpusVersion();

    if (docs.length === 0 || !version) {
      this.onProgress({ phase: 'empty', installed: 0, total: 0, chunks: 0, message: 'No hay corpus publicado' });
      return { status: 'empty', chunks: 0, documents: 0, fromCache: false, mockEmbeddings: false };
    }

    const installedVersion = (await this.store.getMeta?.<string>(this.key(META_VERSION))) ?? null;
    let installed = new Set<string>((await this.store.getMeta?.<string[]>(this.key(META_INSTALLED))) ?? []);
    let existingChunks = this.scope ? installed.size : ((await this.store.count?.()) ?? 0);

    if (installedVersion === version && installed.size >= docs.length && existingChunks > 0) {
      this.onProgress({ phase: 'ready', installed: docs.length, total: docs.length, chunks: existingChunks, fromCache: true });
      return { status: 'real', chunks: existingChunks, documents: docs.length, fromCache: true, mockEmbeddings: false };
    }

    if (installedVersion !== null && installedVersion !== version) {
      // A different corpus was published: drop the old vectors so stale
      // articles never rank against current law. A scoped corpus removes
      // only its own documents; the Mexican one owns the store.
      if (this.scope && this.store.deleteByPrefix) {
        for (const id of installed) await this.store.deleteByPrefix(`${id}_chunk_`);
      } else if (!this.scope) {
        await this.store.clear();
      }
      installed = new Set();
      existingChunks = 0;
      await this.store.setMeta?.(this.key(META_INSTALLED), []);
    }
    await this.store.setMeta?.(this.key(META_VERSION), version);

    let chunks = existingChunks;
    let mockEmbeddings = false;
    let failures = 0;
    const pending = docs.filter((d) => !installed.has(d.id));
    for (const meta of pending) {
      this.onProgress({ phase: 'installing', installed: installed.size, total: docs.length, chunks, documentId: meta.id, message: meta.title });
      try {
        const [doc, embeddings] = await Promise.all([
          this.loader.loadDocument(meta.id),
          this.loader.loadDocumentEmbeddings(meta.id),
        ]);
        if (!doc) {
          failures++;
          continue;
        }
        const vectorDocs = this.loader.toVectorDocuments(doc, embeddings);
        if (vectorDocs.some((v) => !embeddings.has(v.id))) mockEmbeddings = true;
        if (this.store.addDocuments) {
          await this.store.addDocuments(vectorDocs);
        } else {
          for (const v of vectorDocs) await this.store.addDocument(v);
        }
        chunks += vectorDocs.length;
        installed.add(meta.id);
        await this.store.setMeta?.(this.key(META_INSTALLED), [...installed]);
      } catch (error) {
        failures++;
        console.warn(`Corpus install: ${meta.id} failed`, error);
      }
    }

    if (installed.size === 0) {
      this.onProgress({ phase: 'error', installed: 0, total: docs.length, chunks, message: 'No se pudo instalar ningún documento' });
      return { status: 'empty', chunks, documents: 0, fromCache: false, mockEmbeddings };
    }
    this.onProgress({
      phase: 'ready',
      installed: installed.size,
      total: docs.length,
      chunks,
      fromCache: pending.length === 0,
      message: failures ? `${failures} documento(s) no se pudieron instalar` : undefined,
    });
    return { status: 'real', chunks, documents: installed.size, fromCache: pending.length === 0, mockEmbeddings };
  }
}
