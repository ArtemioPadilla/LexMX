/**
 * Post-retrieval ranking rules shared by the engine and the benchmark
 * (`scripts/eval/retrieval.ts`): keep them in sync.
 *
 * - Structural sections (títulos, capítulos) are navigation, not answers.
 * - Transitorios rank below the permanent text they amend.
 */
import type { SearchResult } from '@/types/rag';

export const TRANSITORY_PENALTY = 0.92;
/** Weight of the lexical overlap on top of the cosine score (cosine ≈ 0.85–0.95 for e5). */
export const LEXICAL_WEIGHT = 0.08;
/** Extra boost when the query names an article number that the chunk carries. */
export const ARTICLE_MENTION_BOOST = 0.06;

const STOPWORDS = new Set(['para', 'como', 'sobre', 'entre', 'desde', 'hasta', 'cuando', 'donde', 'este', 'esta', 'estos', 'estas', 'segun', 'según', 'tiene', 'tienen', 'puede', 'pueden', 'debe', 'deben', 'cual', 'cuales', 'cuáles', 'cual', 'quien', 'quién', 'hace', 'hacer', 'dice', 'articulo', 'artículo', 'ley', 'codigo', 'código', 'mexico', 'méxico', 'chile', 'federal', 'nacional']);

function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Content tokens of a query: folded, ≥4 letters, stopwords out, light stemming (plural/verb endings). */
export function queryTerms(query: string): string[] {
  const terms = new Set<string>();
  for (const raw of fold(query).split(/[^a-z0-9ñ]+/)) {
    if (raw.length < 4 || STOPWORDS.has(raw)) continue;
    terms.add(raw.replace(/(?:ciones|cion|es|s)$/, (m) => (raw.length - m.length >= 4 ? '' : m)));
  }
  return [...terms];
}

/** Share of query terms present in the text (prefix match, so "indemniza" hits "indemnización"). */
export function lexicalOverlap(terms: string[], text: string): number {
  if (terms.length === 0) return 0;
  const hay = fold(text);
  let hits = 0;
  for (const t of terms) if (hay.includes(t)) hits++;
  return hits / terms.length;
}

/** "artículo 47", "art. 123", "artículo 17-H" mentioned in the query, normalized. */
export function mentionedArticles(query: string): string[] {
  return [...fold(query).matchAll(/\bart(?:iculo|\.)?\s*(\d+[a-z0-9-]*(?:\s*(?:bis|ter))?)/g)].map((m) => m[1]!.replace(/\s+/g, ' ').trim());
}

/**
 * Re-scores retrieved chunks with lexical evidence: cosine + LEXICAL_WEIGHT ×
 * term overlap, plus a boost when the query names the chunk's article.
 * Call on an over-fetched candidate set; pure and order-independent.
 */
export function rerankLexical(results: SearchResult[], query: string): SearchResult[] {
  const terms = queryTerms(query);
  const mentioned = mentionedArticles(query);
  return results
    .map((r) => {
      let score = r.score + LEXICAL_WEIGHT * lexicalOverlap(terms, r.content);
      const article = fold(r.metadata?.article ?? '').replace(/\s+/g, ' ');
      if (article && mentioned.some((m) => m === article || m.replace(/-/g, '') === article.replace(/-/g, ''))) score += ARTICLE_MENTION_BOOST;
      return { ...r, score };
    })
    .sort((a, b) => b.score - a.score);
}

export function rankCorpusResults(results: SearchResult[]): SearchResult[] {
  return results
    .filter((r) => r.metadata?.contentType === undefined || r.metadata.contentType === 'article')
    .map((r) => (r.metadata?.transitory === true ? { ...r, score: r.score * TRANSITORY_PENALTY } : r))
    .sort((a, b) => b.score - a.score);
}
