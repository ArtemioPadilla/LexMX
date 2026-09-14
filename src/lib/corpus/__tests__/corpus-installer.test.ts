import { describe, expect, it, vi } from 'vitest';
import { CorpusInstaller, type CorpusInstallProgress } from '../corpus-installer';
import type { DocumentLoader } from '../document-loader';
import type { VectorDocument, VectorStore } from '@/types/rag';
import type { LegalDocument } from '@/types/legal';

function doc(id: string, sections = 2): LegalDocument {
  return {
    id,
    title: id.toUpperCase(),
    shortTitle: id,
    type: 'law',
    hierarchy: 3,
    primaryArea: 'labor',
    secondaryAreas: [],
    authority: 'Congreso',
    publicationDate: '2020-01-01',
    status: 'active',
    territorialScope: 'federal',
    applicability: 'Nacional',
    relatedDependencies: [],
    importance: 'high',
    updateFrequency: 'medium',
    content: Array.from({ length: sections }, (_, i) => ({ id: `${id}-${i}`, type: 'article' as const, number: String(i + 1), content: `Artículo ${i + 1}` })),
  };
}

class MemoryStore implements VectorStore {
  docs = new Map<string, VectorDocument>();
  meta = new Map<string, unknown>();
  cleared = 0;
  async initialize(): Promise<void> {}
  async addDocument(d: VectorDocument): Promise<void> { this.docs.set(d.id, d); }
  async addDocuments(ds: VectorDocument[]): Promise<void> { ds.forEach((d) => this.docs.set(d.id, d)); }
  async search(): Promise<never[]> { return []; }
  async getDocument(id: string): Promise<VectorDocument | null> { return this.docs.get(id) ?? null; }
  async clear(): Promise<void> { this.docs.clear(); this.cleared++; }
  async count(): Promise<number> { return this.docs.size; }
  async getMeta<T>(key: string): Promise<T | null> { return (this.meta.get(key) as T) ?? null; }
  async setMeta(key: string, value: unknown): Promise<void> { this.meta.set(key, value); }
  async deleteByPrefix(prefix: string): Promise<number> {
    let n = 0;
    for (const id of [...this.docs.keys()]) if (id.startsWith(prefix)) { this.docs.delete(id); n++; }
    return n;
  }
}

function fakeLoader(ids: string[], version: string, opts: { failing?: string[]; embeddingsFor?: string[] } = {}) {
  const loadDocument = vi.fn(async (id: string) => (opts.failing?.includes(id) ? null : doc(id)));
  const loadDocumentEmbeddings = vi.fn(async (id: string) => {
    const m = new Map<string, number[]>();
    if (!opts.embeddingsFor || opts.embeddingsFor.includes(id)) {
      m.set(`${id}_chunk_0`, [1, 0]);
      m.set(`${id}_chunk_1`, [0, 1]);
    }
    return m;
  });
  const loader = {
    initialize: vi.fn(async () => {}),
    getMetadata: () => ({ version: '2.0.0', buildDate: 'b', totalDocuments: ids.length, documents: ids.map((id) => ({ id, title: id, type: 'law', hierarchy: 3, primaryArea: 'labor', source: '', size: 1, lastUpdated: '' })) }),
    getCorpusVersion: () => version,
    loadDocument,
    loadDocumentEmbeddings,
    toVectorDocuments: (d: LegalDocument, e: Map<string, number[]>) =>
      (d.content ?? []).map((s, i) => ({ id: `${d.id}_chunk_${i}`, content: s.content, embedding: e.get(`${d.id}_chunk_${i}`) ?? [0, 0], metadata: { title: d.title, type: d.type, legalArea: d.primaryArea, hierarchy: d.hierarchy, lastUpdated: '', publicationDate: '', sourceInstitution: '', confidence: 1, version: '1' } })),
  } as unknown as DocumentLoader;
  return { loader, loadDocument, loadDocumentEmbeddings };
}

describe('CorpusInstaller', () => {
  it('installs every document once, shard by shard, and reports progress', async () => {
    const store = new MemoryStore();
    const { loader, loadDocument } = fakeLoader(['lft', 'cff'], 'v1');
    const events: CorpusInstallProgress[] = [];
    const result = await new CorpusInstaller(loader, store, (p) => events.push(p)).ensureInstalled();

    expect(result).toEqual({ status: 'real', chunks: 4, documents: 2, fromCache: false, mockEmbeddings: false });
    expect(loadDocument).toHaveBeenCalledTimes(2);
    expect(store.meta.get('corpusVersion')).toBe('v1');
    expect(store.meta.get('installedDocuments')).toEqual(['lft', 'cff']);
    expect(events.map((e) => e.phase)).toEqual(['checking', 'installing', 'installing', 'ready']);
    expect(events.at(-1)).toMatchObject({ installed: 2, total: 2, chunks: 4 });
  });

  it('skips the network when the same version is already installed', async () => {
    const store = new MemoryStore();
    const first = fakeLoader(['lft'], 'v1');
    await new CorpusInstaller(first.loader, store).ensureInstalled();

    const second = fakeLoader(['lft'], 'v1');
    const result = await new CorpusInstaller(second.loader, store).ensureInstalled();
    expect(result.fromCache).toBe(true);
    expect(second.loadDocument).not.toHaveBeenCalled();
  });

  it('resumes a partial install without refetching installed documents', async () => {
    const store = new MemoryStore();
    const partial = fakeLoader(['lft', 'cff'], 'v1', { failing: ['cff'] });
    const r1 = await new CorpusInstaller(partial.loader, store).ensureInstalled();
    expect(r1.documents).toBe(1);

    const retry = fakeLoader(['lft', 'cff'], 'v1');
    const r2 = await new CorpusInstaller(retry.loader, store).ensureInstalled();
    expect(r2.documents).toBe(2);
    expect(retry.loadDocument).toHaveBeenCalledTimes(1);
    expect(retry.loadDocument).toHaveBeenCalledWith('cff');
  });

  it('clears stale vectors when a new corpus version is published', async () => {
    const store = new MemoryStore();
    await new CorpusInstaller(fakeLoader(['lft'], 'v1').loader, store).ensureInstalled();
    const result = await new CorpusInstaller(fakeLoader(['lft'], 'v2').loader, store).ensureInstalled();
    expect(store.cleared).toBe(1);
    expect(store.meta.get('corpusVersion')).toBe('v2');
    expect(result.chunks).toBe(2);
  });

  it('reports empty when nothing is published and flags mock embeddings', async () => {
    const store = new MemoryStore();
    expect((await new CorpusInstaller(fakeLoader([], 'v1').loader, store).ensureInstalled()).status).toBe('empty');
    const r = await new CorpusInstaller(fakeLoader(['lft'], 'v1', { embeddingsFor: [] }).loader, new MemoryStore()).ensureInstalled();
    expect(r.mockEmbeddings).toBe(true);
  });

  it('installs a secondary jurisdiction under scoped keys and only removes its own chunks on a new version', async () => {
    const store = new MemoryStore();
    // Mexican corpus already installed under the historical keys.
    await new CorpusInstaller(fakeLoader(['lft'], 'mx-v1').loader, store).ensureInstalled();
    expect(store.meta.get('corpusVersion')).toBe('mx-v1');

    const cl1 = await new CorpusInstaller(fakeLoader(['cl-ct'], 'cl-v1').loader, store, () => {}, 'cl').ensureInstalled();
    expect(cl1.status).toBe('real');
    expect(store.meta.get('corpusVersion:cl')).toBe('cl-v1');
    expect(store.meta.get('installedDocuments:cl')).toEqual(['cl-ct']);
    expect(store.meta.get('corpusVersion')).toBe('mx-v1');
    expect([...store.docs.keys()].sort()).toEqual(['cl-ct_chunk_0', 'cl-ct_chunk_1', 'lft_chunk_0', 'lft_chunk_1']);

    // New Chilean version: Chilean chunks are replaced, Mexican ones untouched, store never cleared.
    const cl2 = await new CorpusInstaller(fakeLoader(['cl-cpr'], 'cl-v2').loader, store, () => {}, 'cl').ensureInstalled();
    expect(cl2.status).toBe('real');
    expect(store.cleared).toBe(0);
    expect([...store.docs.keys()].sort()).toEqual(['cl-cpr_chunk_0', 'cl-cpr_chunk_1', 'lft_chunk_0', 'lft_chunk_1']);
    expect(store.meta.get('installedDocuments:cl')).toEqual(['cl-cpr']);

    // Same version again: served from cache without refetching.
    const { loader, loadDocument } = fakeLoader(['cl-cpr'], 'cl-v2');
    const cl3 = await new CorpusInstaller(loader, store, () => {}, 'cl').ensureInstalled();
    expect(cl3.fromCache).toBe(true);
    expect(loadDocument).not.toHaveBeenCalled();
  });
});
