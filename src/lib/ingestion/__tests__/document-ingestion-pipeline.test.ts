import { describe, it, expect, vi } from 'vitest';
import {
  DocumentIngestionPipeline,
  type DocumentStore,
  type EmbeddingGenerator,
  type IngestionDocumentFetcher,
  type IngestionProgress,
  type IngestionStoreName
} from '../document-ingestion-pipeline';
import type { DocumentRequest } from '@/types/legal';
import type { EmbeddingVector } from '@/types/embeddings';

/** Minimal, fully-typed DocumentRequest fixture; override only what a test cares about. */
function createRequest(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: 'req-1',
    title: 'Ley de Prueba',
    description: 'Documento de prueba para el pipeline de ingesta',
    requestedBy: 'test-user',
    type: 'law',
    hierarchy: 3,
    primaryArea: 'civil',
    secondaryAreas: [],
    territorialScope: 'federal',
    sources: [{
      id: 'source-1',
      type: 'url',
      url: 'https://www.dof.gob.mx/test-document',
      verified: false,
      isOfficial: true
    }],
    votes: 0,
    voters: [],
    comments: [],
    priority: 'medium',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: false,
    ...overrides
  };
}

const SAMPLE_LAW = `TÍTULO I
Disposiciones Generales

Artículo 1.-
La presente ley es de orden público y de observancia general.
`;

function createFakeEmbeddingManager(): EmbeddingGenerator {
  const fakeVector = (): EmbeddingVector => ({ values: [0.1, 0.2, 0.3], dimensions: 3 });
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    embed: vi.fn().mockResolvedValue(fakeVector()),
    embedBatch: vi.fn().mockImplementation(async (texts: string[]) => texts.map(fakeVector))
  };
}

function createFakeStore(): DocumentStore & { records: Map<string, unknown> } {
  const records = new Map<string, unknown>();
  return {
    records,
    store: vi.fn(async (storeName: IngestionStoreName, key: string, data: unknown) => {
      records.set(`${storeName}:${key}`, data);
    })
  };
}

/** Internals that are still worth unit-testing directly (pure helper logic). */
interface PipelineInternals {
  estimateTokens(text: string): number;
  createBatches<T>(items: T[], batchSize: number): T[][];
}

describe('DocumentIngestionPipeline', () => {
  describe('constructor', () => {
    it('creates an instance with default config and dependencies', () => {
      const pipeline = new DocumentIngestionPipeline();
      expect(pipeline).toBeInstanceOf(DocumentIngestionPipeline);
    });

    it('accepts custom configuration', () => {
      const pipeline = new DocumentIngestionPipeline({
        chunkSize: 1024,
        chunkOverlap: 100,
        preserveStructure: false,
        generateEmbeddings: false
      });
      expect(pipeline).toBeInstanceOf(DocumentIngestionPipeline);
    });
  });

  describe('ingestFromRequest (end to end, with fakes)', () => {
    it('runs fetching -> parsing -> chunking -> embedding -> storing in order and stores the result', async () => {
      const fetcher: IngestionDocumentFetcher = {
        fetchFromRequest: vi.fn().mockResolvedValue(SAMPLE_LAW)
      };
      const embeddingManager = createFakeEmbeddingManager();
      const store = createFakeStore();
      const pipeline = new DocumentIngestionPipeline({}, { fetcher, embeddingManager, store });

      const seenStages: IngestionProgress['stage'][] = [];
      pipeline.on('progress', (event: IngestionProgress) => {
        expect(event).toHaveProperty('progress');
        expect(event).toHaveProperty('message');
        expect(event).toHaveProperty('timestamp');
        if (seenStages[seenStages.length - 1] !== event.stage) {
          seenStages.push(event.stage);
        }
      });

      const result = await pipeline.ingestFromRequest(createRequest());

      expect(result.success).toBe(true);
      expect(seenStages).toEqual([
        'fetching',
        'parsing',
        'chunking',
        'embedding',
        'storing',
        'complete'
      ]);
      expect(result.documentId).toBeDefined();
      expect(store.records.has(`legal_documents:${result.documentId}`)).toBe(true);
      expect(embeddingManager.embedBatch).toHaveBeenCalled();
    });

    it('reports an error stage and success:false when the fetcher throws', async () => {
      const fetcher: IngestionDocumentFetcher = {
        fetchFromRequest: vi.fn().mockRejectedValue(new Error('network down'))
      };
      const pipeline = new DocumentIngestionPipeline({}, { fetcher });

      const progressEvents: IngestionProgress[] = [];
      pipeline.on('progress', (event: IngestionProgress) => progressEvents.push(event));

      const result = await pipeline.ingestFromRequest(createRequest());

      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('network down');
      expect(progressEvents.at(-1)?.stage).toBe('error');
    });

    it('skips the embedding stage when generateEmbeddings is false', async () => {
      const fetcher: IngestionDocumentFetcher = {
        fetchFromRequest: vi.fn().mockResolvedValue(SAMPLE_LAW)
      };
      const embeddingManager = createFakeEmbeddingManager();
      const store = createFakeStore();
      const pipeline = new DocumentIngestionPipeline(
        { generateEmbeddings: false },
        { fetcher, embeddingManager, store }
      );

      const stages: IngestionProgress['stage'][] = [];
      pipeline.on('progress', (event: IngestionProgress) => stages.push(event.stage));

      const result = await pipeline.ingestFromRequest(createRequest());

      expect(result.success).toBe(true);
      expect(result.embeddings).toBeUndefined();
      expect(embeddingManager.embedBatch).not.toHaveBeenCalled();
      expect(stages).not.toContain('embedding');
    });
  });

  describe('ingestFromUrl', () => {
    it('flags an official Mexican government domain when building the request', async () => {
      let capturedRequest: DocumentRequest | undefined;
      const fetcher: IngestionDocumentFetcher = {
        fetchFromRequest: vi.fn(async (request: DocumentRequest) => {
          capturedRequest = request;
          return SAMPLE_LAW;
        })
      };
      const pipeline = new DocumentIngestionPipeline(
        { generateEmbeddings: false },
        { fetcher, store: createFakeStore() }
      );

      await pipeline.ingestFromUrl('https://www.dof.gob.mx/test-document');

      expect(capturedRequest?.sources[0]?.isOfficial).toBe(true);
    });

    it('flags a non-official domain when building the request', async () => {
      let capturedRequest: DocumentRequest | undefined;
      const fetcher: IngestionDocumentFetcher = {
        fetchFromRequest: vi.fn(async (request: DocumentRequest) => {
          capturedRequest = request;
          return SAMPLE_LAW;
        })
      };
      const pipeline = new DocumentIngestionPipeline(
        { generateEmbeddings: false },
        { fetcher, store: createFakeStore() }
      );

      await pipeline.ingestFromUrl('https://example.com/document');

      expect(capturedRequest?.sources[0]?.isOfficial).toBe(false);
    });
  });

  describe('cancel', () => {
    it('aborts the in-flight fetch signal and the ingestion reports failure', async () => {
      const fetcher: IngestionDocumentFetcher = {
        fetchFromRequest: (_request, options) =>
          new Promise<string>((_resolve, reject) => {
            options?.signal?.addEventListener('abort', () => reject(new Error('aborted by user')));
          })
      };
      const pipeline = new DocumentIngestionPipeline({}, { fetcher });

      const resultPromise = pipeline.ingestFromRequest(createRequest());
      await Promise.resolve(); // let the fetch stage register its abort listener
      pipeline.cancel();

      const result = await resultPromise;
      expect(result.success).toBe(false);
      expect(result.errors?.[0]).toContain('aborted by user');
    });

    it('is a no-op when nothing is in flight', () => {
      const pipeline = new DocumentIngestionPipeline();
      expect(() => pipeline.cancel()).not.toThrow();
    });
  });

  describe('ingestBatch', () => {
    it('processes every request and reports per-document progress', async () => {
      vi.useFakeTimers();
      try {
        const fetcher: IngestionDocumentFetcher = {
          fetchFromRequest: vi.fn().mockResolvedValue(SAMPLE_LAW)
        };
        const pipeline = new DocumentIngestionPipeline(
          { generateEmbeddings: false },
          { fetcher, store: createFakeStore() }
        );

        const batchEvents: Array<{ current: number; total: number }> = [];
        pipeline.on('batch-progress', (event: { current: number; total: number }) =>
          batchEvents.push(event)
        );

        const requests = [createRequest({ id: 'r1' }), createRequest({ id: 'r2' })];
        const resultsPromise = pipeline.ingestBatch(requests);
        await vi.runAllTimersAsync();
        const results = await resultsPromise;

        expect(results).toHaveLength(2);
        expect(results.every(result => result.success)).toBe(true);
        expect(batchEvents.map(event => event.current)).toEqual([1, 2]);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('pure helper methods', () => {
    it('estimates tokens as roughly 1 token per 4 characters', () => {
      const pipeline = new DocumentIngestionPipeline() as unknown as PipelineInternals;
      const text = 'This is a test text with approximately 10 words here.';

      expect(pipeline.estimateTokens(text)).toBe(Math.ceil(text.length / 4));
    });

    it('splits an array into batches of the requested size', () => {
      const pipeline = new DocumentIngestionPipeline() as unknown as PipelineInternals;
      const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      const batches = pipeline.createBatches(items, 3);

      expect(batches).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
    });
  });
});
