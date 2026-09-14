import { describe, it, expect, vi } from 'vitest';
import { BM25Search, HybridSearchEngine } from '../hybrid-search';
import type { VectorStore, SearchResult } from '@/types/rag';

function createFakeVectorStore(searchResults: SearchResult[]): VectorStore {
  return {
    initialize: vi.fn(async () => undefined),
    addDocument: vi.fn(async () => undefined),
    search: vi.fn(async () => searchResults),
    getDocument: vi.fn(async () => null),
    clear: vi.fn(async () => undefined)
  };
}

describe('BM25Search', () => {
  it('ranks documents containing more query terms higher', () => {
    const bm25 = new BM25Search();
    bm25.addDocument('doc-a', 'El contrato civil establece obligaciones entre las partes.', { legalArea: 'civil' });
    bm25.addDocument('doc-b', 'El procedimiento penal es completamente distinto.', { legalArea: 'criminal' });
    // A third, unrelated document keeps the corpus large enough that BM25's
    // IDF term for a word appearing in a single document stays positive
    // (with N=2 and docFreq=1, idf collapses to exactly zero).
    bm25.addDocument('doc-c', 'Normas administrativas sobre trámites municipales diversos.', { legalArea: 'administrative' });

    const results = bm25.search('contrato civil obligaciones');

    expect(results[0]!.id).toBe('doc-a');
    expect(results.find(r => r.id === 'doc-b')).toBeUndefined();
  });
});

describe('HybridSearchEngine — reciprocal rank fusion', () => {
  it('fuses keyword and semantic results, letting a strong keyword match outrank a weaker semantic-only hit', async () => {
    // Semantic search "thinks" doc-b is the best match (rank 0), doc-a second.
    const vectorStore = createFakeVectorStore([
      {
        id: 'doc-b',
        content: 'Contenido sin coincidencia léxica con la consulta.',
        score: 0.9,
        metadata: { title: 'Doc B', type: 'law', legalArea: 'civil', hierarchy: 3, lastUpdated: '2024-01-01' }
      },
      {
        id: 'doc-a',
        content: 'Artículo 10 del contrato civil sobre obligaciones.',
        score: 0.5,
        metadata: { title: 'Doc A', type: 'law', legalArea: 'civil', hierarchy: 3, lastUpdated: '2024-01-01' }
      }
    ]);

    const engine = new HybridSearchEngine(vectorStore);

    // Keyword search only matches doc-a (exact terms from the query).
    await engine.addDocument('doc-a', 'Artículo 10 del contrato civil sobre obligaciones.', [], {
      title: 'Doc A',
      legalArea: 'civil',
      hierarchy: 3
    });
    await engine.addDocument('doc-b', 'Contenido sin coincidencia léxica con la consulta.', [], {
      title: 'Doc B',
      legalArea: 'civil',
      hierarchy: 3
    });
    // Distractor so the BM25 corpus has 3 documents (see BM25Search test above
    // for why 2 documents can zero out the IDF of a single-document term).
    await engine.addDocument('doc-c', 'Normas administrativas sobre trámites municipales diversos.', [], {
      title: 'Doc C',
      legalArea: 'administrative',
      hierarchy: 4
    });

    // 'citation' queries are weighted heavily toward keyword matches (0.7)
    // over semantic ones (0.3), so doc-a's exact keyword hit should win the
    // fusion even though the (fake) semantic search ranked doc-b first.
    const results = await engine.hybridSearch('contrato civil obligaciones', [0.1, 0.2, 0.3], {
      queryType: 'citation'
    });

    expect(results[0]!.id).toBe('doc-a');
    expect(results.map(r => r.id)).toContain('doc-b');
  });

  it('boosts constitutional (hierarchy 1) sources during legal re-ranking, even when they rank slightly behind on raw fusion score', async () => {
    // The fake semantic search ranks law-doc first (rank 0) and
    // constitutional-doc second (rank 1) — a small RRF disadvantage.
    // `legalRerank`'s 1.3x hierarchy-1 boost should be enough to flip that.
    const vectorStore = createFakeVectorStore([
      {
        id: 'law-doc',
        content: 'Disposición de una ley federal ordinaria sobre el tema.',
        score: 0.9,
        metadata: { title: 'Ley Federal', type: 'law', legalArea: 'civil', hierarchy: 3, lastUpdated: '2024-01-01' }
      },
      {
        id: 'constitutional-doc',
        content: 'Disposición constitucional sobre el mismo tema.',
        score: 0.85,
        metadata: { title: 'Constitución', type: 'constitution', legalArea: 'civil', hierarchy: 1, lastUpdated: '2024-01-01' }
      }
    ]);
    const engine = new HybridSearchEngine(vectorStore);

    const results = await engine.hybridSearch('disposición tema', [0.1, 0.2], {});

    expect(results[0]!.id).toBe('constitutional-doc');
  });
});
