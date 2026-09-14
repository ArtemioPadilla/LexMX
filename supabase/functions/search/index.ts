// search · public semantic search over the open corpus (plan § 11.9).
// Also the transport behind the hosted MCP server. The caller sends either a
// pre-computed 384-d embedding (local-first clients embed on device with
// Xenova/multilingual-e5-small) or a plain `q`, which is embedded here with
// the Hugging Face Inference API using the SAME model, so results match the
// on-device index.
import { json, preflight, serviceClient } from '../_shared/client.ts';

const MODEL = 'intfloat/multilingual-e5-small';
const DIM = 384;

interface SearchBody {
  q?: string;
  embedding?: number[];
  scopes?: string[];
  limit?: number;
  minSimilarity?: number;
}

async function embed(text: string): Promise<number[]> {
  const token = Deno.env.get('HF_TOKEN');
  if (!token) throw new Error('HF_TOKEN not configured; send `embedding` instead of `q`');
  const res = await fetch(`https://api-inference.huggingface.co/pipeline/feature-extraction/${MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: `query: ${text}`, options: { wait_for_model: true } }),
  });
  if (!res.ok) throw new Error(`embedding failed: ${res.status}`);
  const raw = (await res.json()) as number[] | number[][];
  const vec = Array.isArray(raw[0]) ? meanPool(raw as number[][]) : (raw as number[]);
  return normalize(vec);
}

function meanPool(tokens: number[][]): number[] {
  const out = new Array<number>(tokens[0]?.length ?? 0).fill(0);
  for (const t of tokens) t.forEach((v, i) => (out[i] += v));
  return out.map((v) => v / Math.max(tokens.length, 1));
}

function normalize(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return json({ error: 'invalid JSON' }, 400);
  }

  let embedding = body.embedding;
  if (!embedding) {
    if (!body.q || body.q.trim().length < 3) return json({ error: '`q` or `embedding` required' }, 400);
    try {
      embedding = await embed(body.q.trim());
    } catch (e) {
      return json({ error: (e as Error).message }, 502);
    }
  }
  if (embedding.length !== DIM) return json({ error: `embedding must have ${DIM} dimensions` }, 400);

  const supabase = serviceClient();
  const { data, error } = await supabase.rpc('match_chunks', {
    query_embedding: embedding,
    match_count: Math.min(Math.max(body.limit ?? 8, 1), 50),
    scopes: body.scopes?.length ? body.scopes : null,
    min_similarity: body.minSimilarity ?? 0,
  });
  if (error) return json({ error: error.message }, 500);
  return json({ model: MODEL, results: data }, 200, { 'Cache-Control': 'public, max-age=60' });
});
