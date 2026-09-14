#!/usr/bin/env -S node --experimental-strip-types
/**
 * scripts/corpus/build-embeddings.ts — embeddings del corpus con el MISMO modelo
 * que usa el cliente (`Xenova/multilingual-e5-small`, 384 dims, mean pooling,
 * normalizado), para que la búsqueda semántica en el navegador compare vectores
 * comparables. Fase 6 del plan.
 *
 *   node --experimental-strip-types scripts/corpus/build-embeddings.ts \
 *     --corpus public/legal-corpus --out public/embeddings [--batch 1000] [--limit N]
 *
 * Lee cada `<corpus>/<slug>.json`, recorre `content[]` en orden y genera un
 * vector por elemento con el id `${doc.id}_chunk_${i}`: exactamente el id y el
 * texto que `src/lib/corpus/document-loader.ts` (`documentToChunks`) produce en
 * el cliente. Escribe `by-document/<id>.json` (un shard por documento), `index.json` y
 * `embeddings-metadata.json` en el formato que `loadEmbeddings` espera.
 *
 * Los vectores se redondean a 5 decimales (float32 no aporta más precisión útil
 * y el JSON pesa la mitad). El modelo se descarga de Hugging Face la primera vez
 * (~120 MB) y se cachea en `--cache` (por defecto ~/.cache/lexmx-hf).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';

const MODEL = 'Xenova/multilingual-e5-small';
const DIMENSIONS = 384;

interface CorpusDoc {
  id: string;
  title: string;
  type: string;
  hierarchy: number;
  primaryArea: string;
  content: Array<{ id: string; type: string; number?: string; title?: string; content: string; transitory?: boolean }>;
}

interface EmbeddingRecord {
  id: string;
  embedding: number[];
  metadata: {
    documentId: string;
    documentTitle: string;
    type: string;
    hierarchy: number;
    legalArea: string;
    article?: string;
    contentType: string;
    transitory?: boolean;
  };
  tokens: number;
}

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const corpusDir = resolve(arg('corpus', 'public/legal-corpus')!);
const outDir = resolve(arg('out', 'public/embeddings')!);
const limit = Number(arg('limit', '0'));
const cacheDir = resolve(arg('cache', join(homedir(), '.cache', 'lexmx-hf'))!);
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

const round = (v: number) => Math.round(v * 1e5) / 1e5;
const estimateTokens = (text: string) => Math.ceil(text.length / 4);

async function main() {
  const { pipeline, env } = await import('@xenova/transformers');
  env.cacheDir = cacheDir;
  env.allowLocalModels = false;
  const extractor = await pipeline('feature-extraction', MODEL, { quantized: true });

  const files = readdirSync(corpusDir).filter((f) => f.endsWith('.json') && !['index.json', 'metadata.json'].includes(f));
  const records: EmbeddingRecord[] = [];
  let totalChunks = 0;
  const started = Date.now();

  for (const file of files) {
    const doc: CorpusDoc = JSON.parse(readFileSync(join(corpusDir, file), 'utf8'));
    const allSections = Array.isArray(doc.content) ? doc.content : [];
    // Only articles are answers; títulos/capítulos are navigation and used to
    // outrank real articles for short queries. Ids keep the section index so
    // `${doc.id}_chunk_${i}` still maps back to `content[i]`.
    const sections = allSections.map((s, i) => ({ section: s, index: i })).filter(({ section }) => section.type === 'article');
    const texts = sections.map(({ section }) => section.content);
    const docStart = Date.now();
    const vectors: number[][] = [];
    const EMBED_BATCH = 32;
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const slice = texts.slice(i, i + EMBED_BATCH);
      const out = await extractor(slice, { pooling: 'mean', normalize: true });
      const data = out.data as Float32Array;
      for (let j = 0; j < slice.length; j++) {
        vectors.push(Array.from(data.slice(j * DIMENSIONS, (j + 1) * DIMENSIONS), round));
      }
      if (limit && totalChunks + vectors.length >= limit) break;
    }
    sections.forEach(({ section, index }, i) => {
      const vector = vectors[i];
      if (!vector) return;
      records.push({
        id: `${doc.id}_chunk_${index}`,
        embedding: vector,
        metadata: {
          documentId: doc.id,
          documentTitle: doc.title,
          type: doc.type,
          hierarchy: doc.hierarchy,
          legalArea: doc.primaryArea,
          article: section.type === 'article' ? section.number : undefined,
          contentType: section.type,
          ...(section.transitory ? { transitory: true } : {}),
        },
        tokens: estimateTokens(section.content),
      });
    });
    totalChunks += vectors.length;
    console.log(`✓ ${doc.id.padEnd(8)} ${String(vectors.length).padStart(5)} vectores  ${((Date.now() - docStart) / 1000).toFixed(1)}s`);
    if (limit && totalChunks >= limit) break;
  }

  // Layout 2.1: one file per document so the client installs the corpus in
  // shards (plan Fase 6, "carga perezosa por shard"). `batchFiles: 0` tells old
  // loaders there are no monolithic batches; `documents` maps id -> file.
  const byDocument = new Map<string, EmbeddingRecord[]>();
  for (const r of records) {
    const list = byDocument.get(r.metadata.documentId) ?? [];
    list.push(r);
    byDocument.set(r.metadata.documentId, list);
  }
  mkdirSync(join(outDir, 'by-document'), { recursive: true });
  const documents: Record<string, { file: string; count: number }> = {};
  for (const [docId, list] of byDocument) {
    const file = `by-document/${docId}.json`;
    writeFileSync(join(outDir, file), JSON.stringify(list));
    documents[docId] = { file, count: list.length };
  }
  const batches = 0;
  const buildDate = new Date().toISOString();
  writeFileSync(
    join(outDir, 'index.json'),
    JSON.stringify({ version: '2.1.0', layout: 'per-document', provider: MODEL, dimensions: DIMENSIONS, totalEmbeddings: records.length, batchFiles: batches, documents, buildDate }, null, 2),
  );
  writeFileSync(
    join(outDir, 'embeddings-metadata.json'),
    JSON.stringify(
      {
        version: '2.0.0',
        buildDate,
        provider: { model: MODEL, dimensions: DIMENSIONS, maxTokens: 512, pooling: 'mean', normalized: true },
        corpus: { totalDocuments: files.length, totalChunks: records.length, processedChunks: records.length, skippedChunks: 0 },
        processing: { chunking: 'one vector per content section (matches document-loader.documentToChunks)', layout: 'per-document', embedBatch: 32, rounding: 5 },
        usage: { totalTokens: records.reduce((s, r) => s + r.tokens, 0), estimatedCost: 0 },
        quality: { successRate: 100, errors: 0 },
        durationMs: Date.now() - started,
      },
      null,
      2,
    ),
  );
  const bytes = Object.values(documents).reduce((s, d) => s + readFileSync(join(outDir, d.file)).byteLength, 0);
  console.log(`\n${records.length} vectores en ${byDocument.size} documento(s), ${(bytes / 1024 / 1024).toFixed(1)} MB, ${((Date.now() - started) / 1000).toFixed(0)}s → ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
