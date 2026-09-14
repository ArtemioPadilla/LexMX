/**
 * Post-retrieval ranking rules shared by the engine and the benchmark
 * (`scripts/eval/retrieval.ts`): keep them in sync.
 *
 * - Structural sections (títulos, capítulos) are navigation, not answers.
 * - Transitorios rank below the permanent text they amend.
 */
import type { SearchResult } from '@/types/rag';

export const TRANSITORY_PENALTY = 0.92;

export function rankCorpusResults(results: SearchResult[]): SearchResult[] {
  return results
    .filter((r) => r.metadata?.contentType === undefined || r.metadata.contentType === 'article')
    .map((r) => (r.metadata?.transitory === true ? { ...r, score: r.score * TRANSITORY_PENALTY } : r))
    .sort((a, b) => b.score - a.score);
}
