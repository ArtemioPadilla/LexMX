import { describe, expect, it } from 'vitest';
import { rankCorpusResults, TRANSITORY_PENALTY } from '../ranking';
import type { SearchResult } from '@/types/rag';

const base = { title: 'LFT', type: 'law', legalArea: 'labor', hierarchy: 3, lastUpdated: '2024-01-01' };
const r = (id: string, score: number, extra: Partial<SearchResult['metadata']> = {}): SearchResult => ({ id, content: id, score, metadata: { ...base, ...extra } });

describe('rankCorpusResults', () => {
  it('drops structural sections and keeps articles and untyped results', () => {
    const out = rankCorpusResults([r('t', 0.99, { contentType: 'title' }), r('a', 0.9, { contentType: 'article', article: '47' }), r('legacy', 0.8)]);
    expect(out.map((x) => x.id)).toEqual(['a', 'legacy']);
  });

  it('penalizes transitorios and re-sorts', () => {
    const out = rankCorpusResults([r('trans', 0.9, { contentType: 'article', article: 'Segundo', transitory: true }), r('art', 0.85, { contentType: 'article', article: '9' })]);
    expect(out.map((x) => x.id)).toEqual(['art', 'trans']);
    expect(out[1]?.score).toBeCloseTo(0.9 * TRANSITORY_PENALTY);
  });

  it('does not mutate the input', () => {
    const input = [r('trans', 0.9, { transitory: true })];
    rankCorpusResults(input);
    expect(input[0]?.score).toBe(0.9);
  });
});
