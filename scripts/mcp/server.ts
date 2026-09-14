/**
 * LexMX como fuente: servidor MCP local sobre stdio (plan § 11.4 E).
 *
 *   node --experimental-strip-types scripts/mcp/server.ts \
 *     --corpus build/corpus/legal-corpus --embeddings build/corpus/embeddings
 *
 * Expone el corpus abierto a cualquier cliente MCP (Claude Desktop, Cursor,
 * editores) sin nube: `search_corpus` (búsqueda semántica con el mismo
 * modelo del cliente web), `get_article` (texto de un artículo con su
 * enlace oficial) y `list_documents`. Implementa el subconjunto del
 * protocolo que necesitan las herramientas (JSON-RPC 2.0 sobre stdio, con
 * cabeceras Content-Length) sin dependencias adicionales.
 */
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const MODEL = 'Xenova/multilingual-e5-small';
const PROTOCOL_VERSION = '2024-11-05';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const corpusDir = resolve(arg('corpus', 'build/corpus/legal-corpus')!);
const embeddingsDir = resolve(arg('embeddings', 'build/corpus/embeddings')!);
const cacheDir = resolve(arg('cache', join(homedir(), '.cache', 'lexmx-hf'))!);

interface Section { id: string; type: string; number?: string; title?: string; content: string }
interface Doc { id: string; title: string; type: string; hierarchy: number; primaryArea: string; officialUrl?: string; jurisdiction?: string; content: Section[] }
interface Chunk { id: string; doc: string; index: number; embedding: number[] }

const docs = new Map<string, Doc>();
const chunks: Chunk[] = [];

function loadCorpus(): void {
  const meta = JSON.parse(readFileSync(join(corpusDir, 'metadata.json'), 'utf8')) as { documents: Array<{ id: string }> };
  for (const entry of meta.documents) {
    const file = join(corpusDir, `${entry.id}.json`);
    if (existsSync(file)) docs.set(entry.id, JSON.parse(readFileSync(file, 'utf8')) as Doc);
  }
  if (!existsSync(join(embeddingsDir, 'index.json'))) return;
  const index = JSON.parse(readFileSync(join(embeddingsDir, 'index.json'), 'utf8')) as { documents?: Record<string, { file: string }>; batchFiles?: number };
  const files = index.documents ? Object.values(index.documents).map((d) => d.file) : Array.from({ length: index.batchFiles ?? 0 }, (_, i) => `embeddings-${String(i).padStart(3, '0')}.json`);
  for (const file of files) {
    const records = JSON.parse(readFileSync(join(embeddingsDir, file), 'utf8')) as Array<{ id: string; embedding: number[] }>;
    for (const r of records) {
      const docId = r.id.replace(/_chunk_\d+$/, '');
      chunks.push({ id: r.id, doc: docId, index: Number(r.id.slice(r.id.lastIndexOf('_') + 1)), embedding: r.embedding });
    }
  }
}

let extractorPromise: Promise<(text: string) => Promise<number[]>> | null = null;
function embedder(): Promise<(text: string) => Promise<number[]>> {
  extractorPromise ??= (async () => {
    const { pipeline, env } = await import('@xenova/transformers');
    env.cacheDir = cacheDir;
    env.allowLocalModels = false;
    const extractor = await pipeline('feature-extraction', MODEL, { quantized: true });
    return async (text: string) => {
      const out = await extractor(`query: ${text}`, { pooling: 'mean', normalize: true });
      return Array.from(out.data as Float32Array);
    };
  })();
  return extractorPromise;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function sectionOf(chunk: Chunk): { doc: Doc; section: Section } | null {
  const doc = docs.get(chunk.doc);
  const section = doc?.content[chunk.index];
  return doc && section ? { doc, section } : null;
}

function citation(doc: Doc, section: Section): string {
  const art = section.type === 'article' && section.number ? `Artículo ${section.number}` : section.title ?? section.id;
  return doc.hierarchy === 1 ? `${art} constitucional` : `${art} de la ${doc.title}`;
}

async function searchCorpus(query: string, limit = 8, documentIds?: string[]): Promise<Array<Record<string, unknown>>> {
  if (chunks.length === 0) throw new Error('No hay embeddings cargados: pasa --embeddings con el directorio generado por corpus:embeddings');
  const q = await (await embedder())(query);
  const filtered = documentIds?.length ? chunks.filter((c) => documentIds.includes(c.doc)) : chunks;
  return filtered
    .map((c) => ({ c, score: dot(q, c.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(Math.max(limit, 1), 25))
    .map(({ c, score }) => {
      const hit = sectionOf(c);
      if (!hit) return { id: c.id, score };
      return {
        id: c.id,
        documentId: hit.doc.id,
        document: hit.doc.title,
        article: hit.section.number,
        citation: citation(hit.doc, hit.section),
        score: Math.round(score * 1000) / 1000,
        excerpt: hit.section.content.slice(0, 600),
        officialUrl: hit.doc.officialUrl,
        jurisdiction: hit.doc.jurisdiction ?? 'mx',
      };
    });
}

function getArticle(documentId: string, article: string): Record<string, unknown> {
  const doc = docs.get(documentId);
  if (!doc) throw new Error(`Documento no encontrado: ${documentId}`);
  const norm = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim();
  const parts = doc.content.filter((s) => s.type === 'article' && s.number && norm(s.number) === norm(article));
  if (parts.length === 0) throw new Error(`Artículo ${article} no encontrado en ${doc.title}`);
  return { documentId: doc.id, document: doc.title, article, citation: citation(doc, parts[0]!), officialUrl: doc.officialUrl, text: parts.map((p) => p.content).join('\n\n') };
}

const TOOLS = [
  {
    name: 'search_corpus',
    description: 'Búsqueda semántica en el corpus legal abierto de LexMX (leyes federales mexicanas). Devuelve artículos con cita y enlace oficial.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number', default: 8 }, documentIds: { type: 'array', items: { type: 'string' } } }, required: ['query'] },
  },
  {
    name: 'get_article',
    description: 'Texto íntegro de un artículo (p. ej. documentId "lft", article "47").',
    inputSchema: { type: 'object', properties: { documentId: { type: 'string' }, article: { type: 'string' } }, required: ['documentId', 'article'] },
  },
  {
    name: 'list_documents',
    description: 'Documentos disponibles en el corpus cargado.',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'search_corpus':
      return searchCorpus(String(args.query ?? ''), Number(args.limit ?? 8), Array.isArray(args.documentIds) ? (args.documentIds as string[]) : undefined);
    case 'get_article':
      return getArticle(String(args.documentId ?? ''), String(args.article ?? ''));
    case 'list_documents':
      return [...docs.values()].map((d) => ({ id: d.id, title: d.title, type: d.type, hierarchy: d.hierarchy, area: d.primaryArea, articles: d.content.filter((s) => s.type === 'article').length, officialUrl: d.officialUrl }));
    default:
      throw new Error(`Herramienta desconocida: ${name}`);
  }
}

interface Request { jsonrpc: '2.0'; id?: number | string | null; method: string; params?: Record<string, unknown> }

async function handle(req: Request): Promise<unknown> {
  switch (req.method) {
    case 'initialize':
      return { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: { name: 'lexmx-corpus', version: '0.1.0' } };
    case 'ping':
      return {};
    case 'tools/list':
      return { tools: TOOLS };
    case 'tools/call': {
      const { name, arguments: args } = (req.params ?? {}) as { name: string; arguments?: Record<string, unknown> };
      try {
        const result = await callTool(name, args ?? {});
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return { content: [{ type: 'text', text: (error as Error).message }], isError: true };
      }
    }
    default:
      throw Object.assign(new Error(`Method not found: ${req.method}`), { code: -32601 });
  }
}

function send(message: unknown): void {
  const body = JSON.stringify(message);
  process.stdout.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
}

function main(): void {
  loadCorpus();
  process.stderr.write(`lexmx-corpus MCP: ${docs.size} documentos, ${chunks.length} chunks\n`);
  let buffer = Buffer.alloc(0);
  process.stdin.on('data', (data: Buffer) => {
    buffer = Buffer.concat([buffer, data]);
    for (;;) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd < 0) break;
      const header = buffer.subarray(0, headerEnd).toString();
      const length = Number(/Content-Length:\s*(\d+)/i.exec(header)?.[1] ?? 0);
      const total = headerEnd + 4 + length;
      if (buffer.length < total) break;
      const body = buffer.subarray(headerEnd + 4, total).toString();
      buffer = buffer.subarray(total);
      let req: Request;
      try {
        req = JSON.parse(body) as Request;
      } catch {
        continue;
      }
      if (req.id === undefined) continue; // notification
      void handle(req)
        .then((result) => send({ jsonrpc: '2.0', id: req.id, result }))
        .catch((error: Error & { code?: number }) => send({ jsonrpc: '2.0', id: req.id, error: { code: error.code ?? -32000, message: error.message } }));
    }
  });
}

main();
