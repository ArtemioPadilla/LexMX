/**
 * Retrieval benchmark over the published corpus layout (plan § 11.4 F).
 *
 *   node --experimental-strip-types scripts/eval/retrieval.ts \
 *     --corpus build/corpus/legal-corpus --embeddings build/corpus/embeddings \
 *     [--cases evals/mx-federal/retrieval.jsonl] [--k 10] [--cache ~/.cache/lexmx-hf]
 *
 * Embeds each query with the same model and pooling as the client
 * (Xenova/multilingual-e5-small, mean, normalized, `query:` prefix), ranks
 * every chunk by cosine similarity and checks whether the expected document
 * and article show up in the top k. Pure Node, no browser, no IndexedDB.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const MODEL = 'Xenova/multilingual-e5-small';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

interface Case { id: string; query: string; expect: { doc: string; article: string }; area?: string }
interface Chunk { id: string; doc: string; article?: string; transitory?: boolean; text: string; embedding: number[] }
import { rerankLexical } from '../../src/lib/rag/ranking.ts';

/** Transitorios rank below the permanent text they amend (mirrors the engine). */
const TRANSITORY_PENALTY = 0.92;
const CANDIDATES = 60;
const LEXICAL = process.env.EVAL_LEXICAL !== '0';
interface CorpusDoc { id: string; content?: Array<{ id?: string; type: string; number?: string; transitory?: boolean; content?: string }> }
interface EmbeddingsIndex { documents?: Record<string, { file: string }>; batchFiles?: number }

const corpusDir = resolve(arg('corpus', 'build/corpus/legal-corpus')!);
const embeddingsDir = resolve(arg('embeddings', 'build/corpus/embeddings')!);
const casesFile = resolve(arg('cases', 'evals/mx-federal/retrieval.jsonl')!);
const k = Number(arg('k', '10'));
const cacheDir = resolve(arg('cache', join(homedir(), '.cache', 'lexmx-hf'))!);
const outDir = resolve(arg('out', 'evals/results')!);

function normalizeArticle(a: string | undefined): string {
  return (a ?? '').toUpperCase().replace(/\s+/g, '').replace(/[°º.]/g, '');
}

function loadChunks(): Chunk[] {
  const index: EmbeddingsIndex = JSON.parse(readFileSync(join(embeddingsDir, 'index.json'), 'utf8'));
  const files = index.documents
    ? Object.values(index.documents).map((d) => d.file)
    : Array.from({ length: index.batchFiles ?? 0 }, (_, i) => `embeddings-${String(i).padStart(3, '0')}.json`);
  const articleOf = new Map<string, string | undefined>();
  const docs = new Set<string>();
  for (const file of files) {
    const records = JSON.parse(readFileSync(join(embeddingsDir, file), 'utf8')) as Array<{ id: string; embedding: number[]; metadata?: { documentId?: string } }>;
    for (const r of records) {
      const docId = r.metadata?.documentId ?? r.id.replace(/_chunk_\d+$/, '');
      docs.add(docId);
      articleOf.set(r.id, undefined);
    }
  }
  // Article numbers come from the corpus documents (chunk i == content[i]).
  const chunks: Chunk[] = [];
  const byDoc = new Map<string, CorpusDoc>();
  for (const docId of docs) {
    const p = join(corpusDir, `${docId}.json`);
    if (existsSync(p)) byDoc.set(docId, JSON.parse(readFileSync(p, 'utf8')));
  }
  for (const file of files) {
    const records = JSON.parse(readFileSync(join(embeddingsDir, file), 'utf8')) as Array<{ id: string; embedding: number[]; metadata?: { documentId?: string; article?: string; contentType?: string; transitory?: boolean } }>;
    for (const r of records) {
      const docId = r.metadata?.documentId ?? r.id.replace(/_chunk_\d+$/, '');
      const idx = Number(r.id.slice(r.id.lastIndexOf('_') + 1));
      const section = byDoc.get(docId)?.content?.[idx];
      const type = r.metadata?.contentType ?? section?.type;
      if (type && type !== 'article') continue; // structural headers are navigation, not answers (build-embeddings skips them too)
      const article = r.metadata?.article ?? (section?.type === 'article' ? section.number : undefined);
      const transitory = r.metadata?.transitory ?? section?.transitory ?? (section?.id?.includes('-trans-') || undefined);
      chunks.push({ id: r.id, doc: docId, article, transitory, text: section?.content ?? '', embedding: r.embedding });
    }
  }
  void articleOf;
  return chunks;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

async function main() {
  const cases: Case[] = readFileSync(casesFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const chunks = loadChunks();
  const available = new Set(chunks.map((c) => `${c.doc}#${normalizeArticle(c.article)}`));
  const availableDocs = new Set(chunks.map((c) => c.doc));
  console.log(`${chunks.length} chunks de ${availableDocs.size} documentos; ${cases.length} casos`);

  const { pipeline, env } = await import('@xenova/transformers');
  env.cacheDir = cacheDir;
  env.allowLocalModels = false;
  const extractor = await pipeline('feature-extraction', MODEL, { quantized: true });

  const results: Array<{ id: string; area?: string; status: 'ok' | 'missing'; docRank: number | null; articleRank: number | null; top: Array<{ doc: string; article?: string; score: number }> }> = [];
  for (const c of cases) {
    const key = `${c.expect.doc}#${normalizeArticle(c.expect.article)}`;
    if (!availableDocs.has(c.expect.doc) || !available.has(key)) {
      results.push({ id: c.id, area: c.area, status: 'missing', docRank: null, articleRank: null, top: [] });
      continue;
    }
    const out = await extractor(`query: ${c.query}`, { pooling: 'mean', normalize: true });
    const q = Array.from(out.data as Float32Array);
    // Cosine over the whole index, then lexical re-ranking of the top candidates (same rules as src/lib/rag/ranking.ts).
    const candidates = chunks.map((ch) => ({ ch, score: dot(q, ch.embedding) * (ch.transitory ? TRANSITORY_PENALTY : 1) })).sort((a, b) => b.score - a.score).slice(0, CANDIDATES);
    const reranked = LEXICAL
      ? rerankLexical(candidates.map((r) => ({ id: r.ch.id, content: r.ch.text, score: r.score, metadata: { title: '', type: 'law', legalArea: '', hierarchy: 3, lastUpdated: '', article: r.ch.article } })), c.query)
      : candidates.map((r) => ({ id: r.ch.id, score: r.score }));
    const byId = new Map(candidates.map((r) => [r.ch.id, r.ch]));
    const ranked = reranked.slice(0, k).map((r) => ({ ch: byId.get(r.id)!, score: r.score }));
    const docRank = ranked.findIndex((r) => r.ch.doc === c.expect.doc);
    const articleRank = ranked.findIndex((r) => r.ch.doc === c.expect.doc && normalizeArticle(r.ch.article) === normalizeArticle(c.expect.article));
    results.push({
      id: c.id,
      area: c.area,
      status: 'ok',
      docRank: docRank >= 0 ? docRank + 1 : null,
      articleRank: articleRank >= 0 ? articleRank + 1 : null,
      top: ranked.slice(0, 5).map((r) => ({ doc: r.ch.doc, article: r.ch.article, score: Math.round(r.score * 1000) / 1000 })),
    });
    const mark = articleRank === 0 ? '✓' : articleRank > 0 ? '~' : docRank >= 0 ? '·' : '✗';
    console.log(`${mark} ${c.id.padEnd(12)} doc@${docRank >= 0 ? docRank + 1 : '-'} art@${articleRank >= 0 ? articleRank + 1 : '-'}`);
  }

  const scored = results.filter((r) => r.status === 'ok');
  const recall = (field: 'docRank' | 'articleRank', n: number) => scored.filter((r) => r[field] !== null && r[field]! <= n).length / Math.max(scored.length, 1);
  const mrr = (field: 'docRank' | 'articleRank') => scored.reduce((s, r) => s + (r[field] ? 1 / r[field]! : 0), 0) / Math.max(scored.length, 1);
  const byArea: Record<string, { cases: number; articleRecall5: number }> = {};
  for (const r of scored) {
    const a = r.area ?? 'general';
    byArea[a] ??= { cases: 0, articleRecall5: 0 };
    byArea[a].cases++;
    if (r.articleRank !== null && r.articleRank <= 5) byArea[a].articleRecall5++;
  }
  for (const a of Object.keys(byArea)) byArea[a]!.articleRecall5 = Math.round((byArea[a]!.articleRecall5 / byArea[a]!.cases) * 1000) / 1000;

  const summary = {
    model: MODEL,
    corpusDocuments: availableDocs.size,
    chunks: chunks.length,
    cases: cases.length,
    scored: scored.length,
    missing: results.filter((r) => r.status === 'missing').map((r) => r.id),
    document: { recallAt1: recall('docRank', 1), recallAt5: recall('docRank', 5), recallAt10: recall('docRank', k), mrr: mrr('docRank') },
    article: { recallAt1: recall('articleRank', 1), recallAt5: recall('articleRank', 5), recallAt10: recall('articleRank', k), mrr: mrr('articleRank') },
    byArea,
    ranAt: new Date().toISOString(),
  };
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${summary.ranAt.slice(0, 19).replace(/[:T]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ summary, results }, null, 2));
  console.log('\n' + JSON.stringify(summary, null, 2));
  console.log(`\n→ ${file}`);

  // One baseline per corpus: --baseline evals/<corpus>/baseline.json (default: the Mexican federal set).
  const baselinePath = resolve(arg('baseline', 'evals/baseline.json')!);
  if (existsSync(baselinePath)) {
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as { articleRecallAt5: number };
    if (summary.article.recallAt5 + 1e-9 < baseline.articleRecallAt5) {
      console.error(`\n✗ recall@5 por artículo bajó: ${summary.article.recallAt5.toFixed(3)} < baseline ${baseline.articleRecallAt5.toFixed(3)}`);
      process.exit(1);
    }
    console.log(`✓ recall@5 por artículo ${summary.article.recallAt5.toFixed(3)} ≥ baseline ${baseline.articleRecallAt5.toFixed(3)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
