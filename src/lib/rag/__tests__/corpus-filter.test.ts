import { describe, expect, it } from 'vitest';
import { applyCorpusFilter } from '../engine';
import type { SearchResult } from '@/types/rag';

const r = (id: string, legalArea: string, jurisdiction?: string): SearchResult =>
  ({ id, content: '', score: 1, metadata: { title: id, type: 'law', legalArea, hierarchy: 3, lastUpdated: '', jurisdiction } }) as SearchResult;

describe('applyCorpusFilter', () => {
  const results = [r('lft_chunk_1', 'labor', 'mx'), r('cff_chunk_2', 'tax'), r('ct_chunk_3', 'labor', 'cl')];

  it('returns everything without an active filter', () => {
    expect(applyCorpusFilter(results, undefined)).toHaveLength(3);
    expect(applyCorpusFilter(results, { areas: [], documents: [] })).toHaveLength(3);
  });

  it('filters by jurisdiction, treating absent metadata as mx', () => {
    expect(applyCorpusFilter(results, { jurisdiction: 'mx' }).map((x) => x.id)).toEqual(['lft_chunk_1', 'cff_chunk_2']);
    expect(applyCorpusFilter(results, { jurisdiction: 'cl' }).map((x) => x.id)).toEqual(['ct_chunk_3']);
  });

  it('filters by documents (chunk id prefix) and areas together', () => {
    expect(applyCorpusFilter(results, { documents: ['lft'], areas: ['labor'] }).map((x) => x.id)).toEqual(['lft_chunk_1']);
    expect(applyCorpusFilter(results, { areas: ['tax'], jurisdiction: 'cl' })).toEqual([]);
  });
});
