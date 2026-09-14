import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../corpus-service', () => {
  const documents = [
    { id: 'a', type: 'law', primaryArea: 'labor', hierarchy: 3, content: [{}, {}], lastUpdated: '2025-01-01T00:00:00.000Z' },
    { id: 'b', type: 'code', primaryArea: 'civil', hierarchy: 3, content: [{}], lastUpdated: '2025-02-01T00:00:00.000Z' },
  ];
  return {
    corpusService: {
      initialize: vi.fn().mockResolvedValue(undefined),
      getDocuments: vi.fn().mockResolvedValue(documents),
      getStatistics: vi.fn().mockResolvedValue({
        byType: { law: 1, code: 1 },
        byArea: { labor: 1, civil: 1 },
        byHierarchy: { 3: 2 },
        averageChunks: 1.5,
        totalSize: 1234,
      }),
      deleteDocument: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock('../embeddings-service', () => ({
  embeddingsService: {
    getStats: vi.fn().mockResolvedValue({
      totalVectors: 42,
      storageSize: 2048,
      averageQueryTime: 12,
      modelsAvailable: ['transformers', 'openai', 'mock'],
      currentModel: 'transformers',
      indexStatus: 'ready',
      provider: 'transformers',
    }),
    clearEmbeddings: vi.fn().mockResolvedValue(undefined),
    generateAllEmbeddings: vi.fn().mockResolvedValue({ totalDocuments: 2, successfulDocuments: 2, failedDocuments: 0 }),
  },
}));

import { AdminDataService } from '../admin-data-service';
import { corpusService } from '../corpus-service';
import { embeddingsService } from '../embeddings-service';

describe('AdminDataService', () => {
  let service: AdminDataService;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    service = new AdminDataService();
  });

  it('aggregates corpus stats from the corpus service', async () => {
    const stats = await service.getCorpusStats();
    expect(stats.totalDocuments).toBe(2);
    expect(stats.totalChunks).toBe(3);
    expect(stats.totalSize).toBe(1234);
    expect(stats.documentsByType).toEqual({ law: 1, code: 1 });
    expect(stats.lastUpdate).toBe('2025-02-01T00:00:00.000Z');
  });

  it('lists documents and deletes through the corpus service', async () => {
    const docs = await service.getDocumentsList();
    expect(docs).toHaveLength(2);
    const progress = vi.fn();
    service.on('progress', progress);
    await service.deleteDocument('a');
    expect(corpusService.deleteDocument).toHaveBeenCalledWith('a');
    expect(progress).toHaveBeenCalledTimes(2);
  });

  it('maps embeddings stats', async () => {
    const stats = await service.getEmbeddingsStats();
    expect(stats.totalVectors).toBe(42);
    expect(stats.indexStatus).toBe('ready');
    expect(stats.averageGenerationTime).toBe(12);
  });

  it('clears and rebuilds embeddings through the embeddings service', async () => {
    await service.clearEmbeddingsCache();
    expect(embeddingsService.clearEmbeddings).toHaveBeenCalled();
    await service.rebuildIndex();
    expect(embeddingsService.generateAllEmbeddings).toHaveBeenCalled();
  });

  it('derives quality stats from the local query history', async () => {
    // The global test setup stubs localStorage with no-op mocks; use a real in-memory store here.
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
        clear: () => store.clear(),
        get length() { return store.size; },
        key: (i: number) => [...store.keys()][i] ?? null,
      },
      writable: true,
      configurable: true,
    });
    service.logQuery(100, false, true);
    service.logQuery(300, true, false);
    const stats = await service.getQualityStats();
    expect(stats.totalQueries).toBe(2);
    expect(stats.failedQueries).toBe(1);
    expect(stats.averageLatency).toBe(200);
    expect(stats.cacheHitRate).toBe(50);
  });

  it('exports the corpus as a JSON blob', async () => {
    const blob = await service.exportCorpus();
    expect(blob.type).toBe('application/json');
    const parsed = JSON.parse(await blob.text());
    expect(parsed.documents).toHaveLength(2);
  });
});
