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

import { ARTICLE_MENTION_BOOST, LEXICAL_WEIGHT, lexicalOverlap, mentionedArticles, queryTerms, rerankLexical } from '../ranking';

describe('lexical re-ranking', () => {
  it('extracts content terms with light stemming and no stopwords', () => {
    expect(queryTerms('¿Cuáles son las causas de rescisión sin responsabilidad para el patrón?')).toEqual(['causa', 'rescision', 'responsabilidad', 'patron']);
    expect(queryTerms('artículo 47 de la ley')).toEqual([]);
  });

  it('measures overlap by prefix, accent-insensitive', () => {
    const terms = queryTerms('indemnización por años de servicio');
    expect(lexicalOverlap(terms, 'deberá pagar la INDEMNIZACIÓN por años de servicio')).toBe(1);
    expect(lexicalOverlap(terms, 'nada que ver')).toBe(0);
    expect(lexicalOverlap([], 'x')).toBe(0);
  });

  it('finds article numbers named in the query', () => {
    expect(mentionedArticles('qué dice el artículo 47 y el art. 17-H bis')).toEqual(['47', '17-h bis']);
  });

  it('promotes chunks with lexical evidence and the mentioned article', () => {
    const base = { title: 'LFT', type: 'law', legalArea: 'labor', hierarchy: 3, lastUpdated: '' };
    const out = rerankLexical(
      [
        { id: 'a', content: 'Disposiciones generales sobre el trabajo digno.', score: 0.90, metadata: { ...base, article: '2' } },
        { id: 'b', content: 'Son causas de rescisión de la relación de trabajo, sin responsabilidad para el patrón: engañar…', score: 0.88, metadata: { ...base, article: '47' } },
      ],
      '¿Qué dice el artículo 47 sobre las causas de rescisión sin responsabilidad para el patrón?',
    );
    expect(out[0]?.id).toBe('b');
    expect(out[0]?.score).toBeCloseTo(0.88 + LEXICAL_WEIGHT * 1 + ARTICLE_MENTION_BOOST, 5);
    expect(out[1]?.score).toBeCloseTo(0.90, 5);
  });
});
