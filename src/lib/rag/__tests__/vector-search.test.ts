import { describe, it, expect, vi } from 'vitest';
import { VectorSearch } from '../vector-search';
import type { EmbeddingManager } from '@/lib/embeddings/embedding-manager';
import type { EmbeddingVector } from '@/types/embeddings';
import type { LegalDocument } from '@/types/legal';

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0);
  const magA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0));
  const magB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0));
  return magA && magB ? dot / (magA * magB) : 0;
}

// A fake embedding manager returning fixed vectors keyed by exact text, so
// the ranking produced by VectorSearch is fully deterministic in tests.
function createFakeEmbeddingManager(vectors: Record<string, number[]>): EmbeddingManager {
  const toVector = (text: string): EmbeddingVector => ({
    values: vectors[text] ?? [0, 0, 0],
    dimensions: 3
  });

  return {
    embed: vi.fn(async (text: string) => toVector(text)),
    embedBatch: vi.fn(async (texts: string[]) => texts.map(toVector)),
    calculateSimilarity: vi.fn((a: EmbeddingVector, b: EmbeddingVector) => cosineSimilarity(a.values, b.values))
  } as unknown as EmbeddingManager;
}

function makeDocument(id: string, articles: Array<{ id: string; number: string; content: string }>): LegalDocument {
  return {
    id,
    title: `Document ${id}`,
    shortTitle: `Document ${id}`,
    type: 'law',
    hierarchy: 3,
    primaryArea: 'civil',
    secondaryAreas: [],
    authority: 'Test Authority',
    publicationDate: '2024-01-01',
    status: 'active',
    territorialScope: 'federal',
    applicability: 'General',
    relatedDependencies: [],
    importance: 'medium',
    updateFrequency: 'medium',
    content: articles.map(a => ({ id: a.id, type: 'article' as const, number: a.number, content: a.content })),
    citations: []
  };
}

describe('VectorSearch', () => {
  it('ranks chunks by cosine similarity to the query, best match first', async () => {
    const closeText = 'Contenido muy relacionado con la consulta.';
    const farText = 'Contenido totalmente distinto y sin relación.';
    const queryText = 'consulta relacionada';

    const embeddingManager = createFakeEmbeddingManager({
      [closeText]: [1, 0, 0],
      [farText]: [0, 1, 0],
      [queryText]: [0.9, 0.1, 0]
    });

    const search = new VectorSearch(embeddingManager, { chunkSize: 512, chunkOverlap: 0, topK: 5, scoreThreshold: 0 });

    await search.indexDocument(makeDocument('doc-close', [{ id: 'a1', number: '1', content: closeText }]));
    await search.indexDocument(makeDocument('doc-far', [{ id: 'a1', number: '1', content: farText }]));

    const results = await search.search(queryText);

    expect(results).toHaveLength(2);
    expect(results[0]!.documentId).toBe('doc-close');
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score);
    expect(results[1]!.documentId).toBe('doc-far');
  });

  it('applies the score threshold to exclude poor matches', async () => {
    const closeText = 'Coincide exactamente con la consulta.';
    const farText = 'No tiene relación alguna con la búsqueda.';
    const queryText = 'coincide exactamente';

    const embeddingManager = createFakeEmbeddingManager({
      [closeText]: [1, 0],
      [farText]: [-1, 0],
      [queryText]: [1, 0]
    });

    const search = new VectorSearch(embeddingManager, { chunkSize: 512, chunkOverlap: 0, topK: 5, scoreThreshold: 0.5 });

    await search.indexDocument(makeDocument('doc-close', [{ id: 'a1', number: '1', content: closeText }]));
    await search.indexDocument(makeDocument('doc-far', [{ id: 'a1', number: '1', content: farText }]));

    const results = await search.search(queryText);

    expect(results).toHaveLength(1);
    expect(results[0]!.documentId).toBe('doc-close');
  });
});
