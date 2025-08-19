import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EmbeddingsService } from '../embeddings-service';
import { DocumentLoader } from '../../corpus/document-loader';
import { IndexedDBVectorStore } from '../../storage/indexeddb-vector-store';
import { EmbeddingProvider } from '../../embeddings/types';
import { TransformersEmbeddings } from '../../embeddings/transformers-embeddings';
import { OpenAIEmbeddings } from '../../embeddings/openai-embeddings';
import { MockEmbeddings } from '../../embeddings/mock-embeddings';
import type { LegalDocument, VectorDocument } from '@/types/legal';
import { 
  createMockService, 
  createMockDocument, 
  createMockVectorDocument,
  createMockAsyncOperation,
  createMockEmbedding 
} from '@/test/mocks/factories';
import embeddingsFixture from '@/test/fixtures/embeddings.json';

// Mock the dependencies
vi.mock('../../corpus/document-loader');
vi.mock('../../storage/indexeddb-vector-store');
vi.mock('../../embeddings/transformers-embeddings');
vi.mock('../../embeddings/openai-embeddings');
vi.mock('../../embeddings/mock-embeddings');

describe('EmbeddingsService', () => {
  let service: EmbeddingsService;
  let mockDocumentLoader: any;
  let mockVectorStore: any;
  let mockTransformersProvider: any;
  let mockOpenAIProvider: any;
  let mockMockProvider: any;
  let capturedEvents: { [key: string]: any[] };

  const mockDocument: LegalDocument = createMockDocument({
    id: 'doc1',
    title: 'Test Document',
    type: 'law',
    primaryArea: 'civil',
    hierarchy: 3,
    content: [
      { id: 'chunk1', type: 'article', number: '1', title: 'Test Article', content: 'First chunk content', embedding: [0.1, 0.2, 0.3], chunkIndex: 0 },
      { id: 'chunk2', type: 'article', number: '2', title: 'Test Article 2', content: 'Second chunk content', embedding: [0.4, 0.5, 0.6], chunkIndex: 1 }
    ]
  });

  const mockVectorDoc: VectorDocument = {
    id: 'chunk1',
    content: 'First chunk content',
    embedding: [0.1, 0.2, 0.3],
    metadata: {
      documentId: 'doc1',
      documentTitle: 'Test Document',
      chunkIndex: 0,
      legalArea: 'civil'
    }
  };

  // Helper function to capture events
  const captureEvents = (eventName: string) => {
    capturedEvents[eventName] = [];
    service.on(eventName, (event) => {
      capturedEvents[eventName].push(event);
    });
  };

  // Helper function to wait for events
  const waitForEvents = (eventName: string, count: number, timeout = 1000): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const events: any[] = [];
      const handler = (event: any) => {
        events.push(event);
        if (events.length >= count) {
          service.off(eventName, handler);
          resolve(events);
        }
      };
      
      service.on(eventName, handler);
      
      setTimeout(() => {
        service.off(eventName, handler);
        reject(new Error(`Only received ${events.length} out of ${count} expected events for ${eventName}`));
      }, timeout);
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents = {};
    
    // Create service instance
    service = new EmbeddingsService();
    
    // Get mock instances
    mockDocumentLoader = vi.mocked(DocumentLoader.prototype);
    mockVectorStore = vi.mocked(IndexedDBVectorStore.prototype);
    mockTransformersProvider = vi.mocked(TransformersEmbeddings.prototype);
    mockOpenAIProvider = vi.mocked(OpenAIEmbeddings.prototype);
    mockMockProvider = vi.mocked(MockEmbeddings.prototype);
    
    // Setup default mock implementations
    mockDocumentLoader.initialize.mockResolvedValue(undefined);
    mockVectorStore.initialize.mockResolvedValue(undefined);
    mockDocumentLoader.loadAllDocuments.mockResolvedValue([mockDocument]);
    mockDocumentLoader.convertToVectorDocuments.mockImplementation(async (docs) => {
      await new Promise(resolve => setTimeout(resolve, 50)); // Simulate processing time
      return docs.map(doc => ({
        id: doc.content[0].id,
        content: doc.content[0].content,
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          documentId: doc.id,
          documentTitle: doc.title,
          chunkIndex: 0,
          legalArea: doc.primaryArea
        }
      }));
    });
    mockVectorStore.addDocuments.mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 20)); // Simulate storage time
    });
    mockVectorStore.clear.mockResolvedValue(undefined);
    mockVectorStore.getStats.mockResolvedValue({
      documentCount: 100,
      storageSize: 1024000,
      averageQueryTime: 50
    });
    
    // Setup embedding provider mocks with realistic timing
    const setupProviderMocks = (provider: any) => {
      provider.initialize.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      provider.embedDocuments.mockImplementation(async (texts: string[]) => {
        await new Promise(resolve => setTimeout(resolve, texts.length * 10));
        return texts.map(() => [0.1, 0.2, 0.3]);
      });
      provider.embedQuery.mockImplementation(async (query: string) => {
        await new Promise(resolve => setTimeout(resolve, 25));
        return [0.1, 0.2, 0.3];
      });
    };
    
    setupProviderMocks(mockTransformersProvider);
    setupProviderMocks(mockOpenAIProvider);
    setupProviderMocks(mockMockProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default provider', async () => {
      await service.initialize();
      
      expect(mockDocumentLoader.initialize).toHaveBeenCalled();
      expect(mockVectorStore.initialize).toHaveBeenCalled();
      expect(mockTransformersProvider.initialize).toHaveBeenCalled();
    });

    it('should initialize with specified provider', async () => {
      await service.initialize('openai');
      
      expect(mockOpenAIProvider.initialize).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await service.initialize();
      await service.initialize();
      
      expect(mockDocumentLoader.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for a document', async () => {
      await service.initialize();
      captureEvents('progress');

      const result = await service.generateEmbeddings('doc1');

      expect(result.success).toBe(true);
      expect(result.embeddingsGenerated).toBe(1);
      expect(result.duration).toBeGreaterThan(0);
      expect(result.tokensPerSecond).toBeGreaterThan(0);
      expect(mockVectorStore.addDocuments).toHaveBeenCalled();
      
      // Check progress events
      const progressEvents = capturedEvents['progress'];
      expect(progressEvents.find(e => e.stage === 'loading')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'generating')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'storing')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should handle document not found', async () => {
      await service.initialize();
      
      // Test document not found scenario by temporarily changing the mock
      const originalMock = mockDocumentLoader.loadAllDocuments.getMockImplementation();
      mockDocumentLoader.loadAllDocuments.mockImplementationOnce(() => Promise.resolve([]));
      
      let errorCaught = false;
      let errorMessage = '';
      
      try {
        await service.generateEmbeddings('nonexistent');
      } catch (error) {
        errorCaught = true;
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      
      expect(errorCaught).toBe(true);
      expect(errorMessage).toBe('Document not found');
      
      // Restore original mock
      if (originalMock) {
        mockDocumentLoader.loadAllDocuments.mockImplementation(originalMock);
      }
    });

    it('should handle embedding generation errors', async () => {
      await service.initialize();
      
      // Test conversion error scenario
      const originalMock = mockDocumentLoader.convertToVectorDocuments.getMockImplementation();
      mockDocumentLoader.convertToVectorDocuments.mockImplementationOnce(() => 
        Promise.reject(new Error('Embedding failed'))
      );
      
      let errorCaught = false;
      let errorMessage = '';
      
      try {
        await service.generateEmbeddings('doc1');
      } catch (error) {
        errorCaught = true;
        errorMessage = error instanceof Error ? error.message : String(error);
      }
      
      expect(errorCaught).toBe(true);
      expect(errorMessage).toBe('Embedding failed');
      
      // Restore original mock
      if (originalMock) {
        mockDocumentLoader.convertToVectorDocuments.mockImplementation(originalMock);
      }
    });
  });

  describe('generateAllEmbeddings', () => {
    it('should generate embeddings for all documents', async () => {
      await service.initialize();
      const doc2 = createMockDocument({ id: 'doc2', title: 'Document 2' });
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([mockDocument, doc2]);
      
      captureEvents('progress');
      captureEvents('batch');

      const result = await service.generateAllEmbeddings();

      expect(result.totalDocuments).toBe(2);
      expect(result.successfulDocuments).toBe(2);
      expect(result.failedDocuments).toBe(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.averageDuration).toBeGreaterThan(0);
      
      const progressEvents = capturedEvents['progress'];
      expect(progressEvents.filter(e => e.stage === 'document_complete')).toHaveLength(2);
      expect(progressEvents.find(e => e.stage === 'starting')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should continue on individual document failures', async () => {
      await service.initialize();
      const doc2 = createMockDocument({ id: 'doc2', title: 'Document 2' });
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([mockDocument, doc2]);
      
      // Mock the service's generateEmbeddings method to fail for doc2
      const originalGenerateEmbeddings = service.generateEmbeddings.bind(service);
      service.generateEmbeddings = vi.fn().mockImplementation(async (docId: string) => {
        if (docId === 'doc2') {
          throw new Error('Embedding failed');
        }
        return originalGenerateEmbeddings(docId);
      });

      const result = await service.generateAllEmbeddings();

      expect(result.totalDocuments).toBe(2);
      expect(result.successfulDocuments).toBe(1);
      expect(result.failedDocuments).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].documentId).toBe('doc2');
      expect(result.errors[0].error).toBe('Embedding failed');
    });

    it('should respect batch size', async () => {
      await service.initialize();
      const documents = Array(10).fill(null).map((_, i) => 
        createMockDocument({ id: `doc${i}`, title: `Document ${i}` })
      );
      
      mockDocumentLoader.loadAllDocuments.mockResolvedValue(documents);
      
      captureEvents('batch');
      
      await service.generateAllEmbeddings(3); // Batch size of 3

      const batchEvents = capturedEvents['batch'];
      const batchStartEvents = batchEvents.filter(e => e.stage === 'batch_start');
      const batchCompleteEvents = batchEvents.filter(e => e.stage === 'batch_complete');
      
      expect(batchStartEvents).toHaveLength(4); // 10 docs / 3 per batch = 4 batches
      expect(batchCompleteEvents).toHaveLength(4);
    });
  });

  describe('clearEmbeddings', () => {
    it('should clear all embeddings', async () => {
      captureEvents('progress');

      await service.clearEmbeddings();

      expect(mockVectorStore.clear).toHaveBeenCalled();
      
      const progressEvents = capturedEvents['progress'];
      expect(progressEvents.find(e => e.stage === 'clearing')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should handle clear errors', async () => {
      mockVectorStore.clear.mockRejectedValue(new Error('Clear failed'));

      await expect(service.clearEmbeddings()).rejects.toThrow('Clear failed');
    });
  });

  describe('getStats', () => {
    it('should return embedding statistics', async () => {
      await service.initialize();
      
      const stats = await service.getStats();

      expect(stats.totalVectors).toBe(100);
      expect(stats.storageSize).toBe(1024000);
      expect(stats.averageQueryTime).toBe(50);
      expect(stats.provider).toBe('transformers');
      expect(stats.currentModel).toBe('transformers');
      expect(stats.modelsAvailable).toContain('transformers');
      expect(stats.modelsAvailable).toContain('openai');
      expect(stats.modelsAvailable).toContain('mock');
      expect(stats.indexStatus).toBe('ready');
    });

    it('should handle missing stats gracefully', async () => {
      await service.initialize();
      mockVectorStore.getStats.mockResolvedValue({});

      const stats = await service.getStats();

      expect(stats.totalVectors).toBe(0);
      expect(stats.storageSize).toBe(0);
      expect(stats.averageQueryTime).toBe(0);
      expect(stats.provider).toBe('transformers');
      expect(stats.indexStatus).toBe('ready');
    });

    it('should handle stats retrieval errors', async () => {
      await service.initialize();
      mockVectorStore.getStats.mockRejectedValue(new Error('Stats error'));

      const stats = await service.getStats();

      expect(stats.totalVectors).toBe(0);
      expect(stats.indexStatus).toBe('error');
      expect(stats.provider).toBe('transformers');
    });
  });

  describe('switchProvider', () => {
    it('should switch embedding provider', async () => {
      await service.initialize();
      
      captureEvents('provider-changed');
      
      await service.switchProvider('openai');

      expect(mockOpenAIProvider.initialize).toHaveBeenCalled();
      
      const stats = await service.getStats();
      expect(stats.provider).toBe('openai');
      expect(stats.currentModel).toBe('openai');
      
      const providerEvents = capturedEvents['provider-changed'];
      expect(providerEvents).toHaveLength(1);
      expect(providerEvents[0].provider).toBe('openai');
    });

    it('should handle invalid provider', async () => {
      await service.initialize();
      
      await expect(service.switchProvider('invalid' as any)).rejects.toThrow('Unknown provider: invalid');
    });

    it('should reinitialize after switching', async () => {
      await service.initialize();
      
      await service.switchProvider('mock');

      expect(mockMockProvider.initialize).toHaveBeenCalled();
      
      const stats = await service.getStats();
      expect(stats.provider).toBe('mock');
    });

    it('should switch between all providers', async () => {
      await service.initialize();
      
      // Switch to OpenAI
      await service.switchProvider('openai');
      let stats = await service.getStats();
      expect(stats.provider).toBe('openai');
      
      // Switch to Mock
      await service.switchProvider('mock');
      stats = await service.getStats();
      expect(stats.provider).toBe('mock');
      
      // Switch back to Transformers
      await service.switchProvider('transformers');
      stats = await service.getStats();
      expect(stats.provider).toBe('transformers');
    });
  });

  describe('testProvider', () => {
    it('should test embedding generation with current provider', async () => {
      await service.initialize();
      
      const result = await service.testProvider('Test query');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('transformers');
      expect(result.dimensions).toBe(3);
      expect(result.latency).toBeGreaterThan(0);
      expect(mockTransformersProvider.embedQuery).toHaveBeenCalledWith('Test query');
    });

    it('should handle test failures', async () => {
      await service.initialize();
      
      // Reset the mock to ensure our failure setup works
      mockTransformersProvider.embedQuery.mockReset();
      mockTransformersProvider.embedQuery.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); // Some latency
        throw new Error('Test failed');
      });

      const result = await service.testProvider('Test query');

      expect(result.success).toBe(false);
      expect(result.provider).toBe('transformers');
      expect(result.dimensions).toBe(0);
      expect(result.latency).toBeGreaterThan(0);
      expect(result.error).toBe('Test failed');
    });

    it('should test different providers after switching', async () => {
      await service.initialize();
      
      // Test transformers provider
      let result = await service.testProvider('Test query');
      expect(result.provider).toBe('transformers');
      expect(result.success).toBe(true);
      
      // Switch and test OpenAI provider
      await service.switchProvider('openai');
      result = await service.testProvider('Test query');
      expect(result.provider).toBe('openai');
      expect(result.success).toBe(true);
      
      // Switch and test Mock provider
      await service.switchProvider('mock');
      result = await service.testProvider('Test query');
      expect(result.provider).toBe('mock');
      expect(result.success).toBe(true);
    });
  });

  describe('event emission', () => {
    it('should emit batch progress events', async () => {
      await service.initialize();
      const documents = Array(5).fill(null).map((_, i) => 
        createMockDocument({ id: `doc${i}`, title: `Document ${i}` })
      );
      
      mockDocumentLoader.loadAllDocuments.mockResolvedValue(documents);
      captureEvents('batch');

      await service.generateAllEmbeddings(2);

      const batchEvents = capturedEvents['batch'];
      expect(batchEvents.filter(e => e.stage === 'batch_start')).toHaveLength(3); // 5 docs in batches of 2
      expect(batchEvents.filter(e => e.stage === 'batch_complete')).toHaveLength(3);
      
      // Check batch numbering
      const startEvents = batchEvents.filter(e => e.stage === 'batch_start');
      expect(startEvents[0].batchNumber).toBe(1);
      expect(startEvents[1].batchNumber).toBe(2);
      expect(startEvents[2].batchNumber).toBe(3);
      expect(startEvents[0].totalBatches).toBe(3);
    });

    it('should emit progress percentage', async () => {
      await service.initialize();
      const documents = Array(10).fill(null).map((_, i) => 
        createMockDocument({ id: `doc${i}`, title: `Document ${i}` })
      );
      
      mockDocumentLoader.loadAllDocuments.mockResolvedValue(documents);
      captureEvents('progress');

      await service.generateAllEmbeddings();

      const progressEvents = capturedEvents['progress'];
      const completeEvents = progressEvents.filter(e => e.stage === 'document_complete');
      
      expect(completeEvents.length).toBeGreaterThan(0);
      
      // Check that progress increases
      if (completeEvents.length >= 5) {
        expect(completeEvents[4].progress).toBeGreaterThanOrEqual(40);
      }
      if (completeEvents.length === 10) {
        expect(completeEvents[9].progress).toBe(100);
      }
      
      // Check start and end events
      expect(progressEvents.find(e => e.stage === 'starting')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should emit error events on failures', async () => {
      await service.initialize();
      mockDocumentLoader.convertToVectorDocuments.mockRejectedValue(new Error('Processing failed'));
      
      captureEvents('error');
      
      try {
        await service.generateEmbeddings('doc1');
      } catch (error) {
        // Expected to fail
      }
      
      const errorEvents = capturedEvents['error'];
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].documentId).toBe('doc1');
      expect(errorEvents[0].error).toBeDefined();
    });
  });

  describe('performance tracking', () => {
    it('should track embedding generation performance', async () => {
      await service.initialize();

      const result = await service.generateEmbeddings('doc1');

      expect(result).toHaveProperty('duration');
      expect(result.duration).toBeGreaterThan(0);
      expect(result).toHaveProperty('tokensPerSecond');
      expect(result.tokensPerSecond).toBeGreaterThan(0);
      expect(result.success).toBe(true);
      expect(result.embeddingsGenerated).toBe(1);
    });

    it('should calculate average performance metrics', async () => {
      await service.initialize();
      const documents = Array(3).fill(null).map((_, i) => 
        createMockDocument({ id: `doc${i}`, title: `Document ${i}` })
      );
      
      mockDocumentLoader.loadAllDocuments.mockResolvedValue(documents);

      const result = await service.generateAllEmbeddings();

      expect(result.averageDuration).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
      expect(result.totalDocuments).toBe(3);
      expect(result.successfulDocuments).toBe(3);
      expect(result.failedDocuments).toBe(0);
      
      // Average should be less than or equal to total
      expect(result.averageDuration).toBeLessThanOrEqual(result.totalDuration);
    });

    it('should track performance across different providers', async () => {
      await service.initialize();
      
      // Test transformers performance
      let result = await service.testProvider('Performance test query');
      expect(result.latency).toBeGreaterThan(0);
      expect(result.success).toBe(true);
      
      // Switch to OpenAI and test performance
      await service.switchProvider('openai');
      result = await service.testProvider('Performance test query');
      expect(result.latency).toBeGreaterThan(0);
      expect(result.success).toBe(true);
      
      // Both should have recorded some latency
      expect(result.dimensions).toBe(3);
    });
  });
});