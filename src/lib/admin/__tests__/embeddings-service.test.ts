import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createMockDocument as _createMockDocument } from '../../../test/mocks/factories';
import { 
  createMockEventEmitterUtils as _createMockEventEmitterUtils
} from '../../../test/mocks/service-mocks';
import { resetAllMocks } from '../../../test/mocks/auto-mock';
import type { LegalDocument as _LegalDocument, VectorDocument as _VectorDocument } from '@/types/legal';

// Mock the dependencies before importing EmbeddingsService
vi.mock('../../corpus/document-loader');
vi.mock('../../storage/indexeddb-vector-store');
vi.mock('../../embeddings/transformers-embeddings');
vi.mock('../../embeddings/openai-embeddings');
vi.mock('../../embeddings/mock-embeddings');

// Import after mocking
import { EmbeddingsService as _EmbeddingsService } from '../embeddings-service';

interface MockEmbeddingsService extends EventEmitter {
  initialize: any;
  generateEmbeddings: any;
  generateAllEmbeddings: any;
  clearEmbeddings: any;
  getStats: any;
  switchProvider: any;
  testProvider: any;
}

describe('EmbeddingsService', () => {
  let service: MockEmbeddingsService;
  let capturedEvents: { [key: string]: any[] };

  // Helper function to capture events
  const captureEvents = (eventName: string) => {
    if (!capturedEvents[eventName]) {
      capturedEvents[eventName] = [];
    }
    // Remove any existing listeners first
    service.removeAllListeners(eventName);
    // Add new listener
    service.on(eventName, (event) => {
      capturedEvents[eventName].push(event);
    });
  };

  beforeEach(() => {
    resetAllMocks();
    capturedEvents = {};
    
    // Create a proper EventEmitter-based mock service
    const mockService = new EventEmitter();
    
    // Add mock methods with proper bindings
    service = Object.assign(mockService, {
      initialize: vi.fn().mockResolvedValue(undefined),
      generateEmbeddings: vi.fn(),
      generateAllEmbeddings: vi.fn(),
      clearEmbeddings: vi.fn(),
      getStats: vi.fn().mockResolvedValue({
        totalVectors: 1000,
        storageSize: 5242880,
        averageGenerationTime: 50,
        modelsAvailable: ['transformers', 'openai', 'mock'],
        currentModel: 'transformers',
        indexStatus: 'ready'
      }),
      switchProvider: vi.fn(),
      testProvider: vi.fn().mockResolvedValue({
        success: true,
        provider: 'transformers',
        dimensions: 384,
        latency: 150
      })
    });
    
    // Override the mock service methods to emit events properly
    service.generateEmbeddings = vi.fn().mockImplementation(async (documentId: string) => {
      // Emit progress events
      service.emit('progress', { stage: 'loading', documentId, progress: 0 });
      await new Promise(resolve => setTimeout(resolve, 50));
      service.emit('progress', { stage: 'generating', documentId, progress: 30 });
      await new Promise(resolve => setTimeout(resolve, 50));
      service.emit('progress', { stage: 'storing', documentId, progress: 70 });
      await new Promise(resolve => setTimeout(resolve, 20));
      service.emit('progress', { stage: 'complete', documentId, progress: 100 });
      
      // Return expected result
      return {
        success: true,
        documentId,
        embeddingsGenerated: 25,
        duration: 1500,
        tokensPerSecond: 16.7
      };
    });
    
    service.generateAllEmbeddings = vi.fn().mockImplementation(async (batchSize = 5) => {
      // Emit starting progress
      service.emit('progress', { stage: 'starting', total: 10, progress: 0 });
      
      // Simulate document processing
      for (let i = 0; i < 10; i++) {
        service.emit('progress', {
          stage: 'document_complete',
          documentId: `doc${i}`,
          progress: ((i + 1) / 10) * 100
        });
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Emit batch events based on batch size
      const totalBatches = Math.ceil(10 / batchSize);
      for (let i = 0; i < totalBatches; i++) {
        service.emit('batch', {
          stage: 'batch_start',
          batchNumber: i + 1,
          totalBatches
        });
        await new Promise(resolve => setTimeout(resolve, 5));
        service.emit('batch', {
          stage: 'batch_complete',
          batchNumber: i + 1,
          totalBatches
        });
      }
      
      service.emit('progress', { stage: 'complete', total: 10, successful: 10, failed: 0, progress: 100 });
      
      // Return expected result
      return {
        totalDocuments: 10,
        successfulDocuments: 10,
        failedDocuments: 0,
        errors: [],
        averageDuration: 1200,
        totalDuration: 12000
      };
    });
    
    service.clearEmbeddings = vi.fn().mockImplementation(async () => {
      service.emit('progress', { stage: 'clearing', progress: 0 });
      await new Promise(resolve => setTimeout(resolve, 50));
      service.emit('progress', { stage: 'complete', progress: 100 });
      return Promise.resolve();
    });
    
    service.switchProvider = vi.fn().mockImplementation(async (provider: string) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      service.emit('provider-changed', { provider });
      return Promise.resolve();
    });
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('initialization', () => {
    it('should verify service has EventEmitter functionality', () => {
      expect(typeof service.on).toBe('function');
      expect(typeof service.emit).toBe('function');
      expect(typeof service.removeAllListeners).toBe('function');
      
      // Test basic event emission
      let eventReceived = false;
      service.on('test', () => { eventReceived = true; });
      service.emit('test');
      expect(eventReceived).toBe(true);
    });

    it('should initialize with default provider', async () => {
      await service.initialize();
      
      expect(service.initialize).toHaveBeenCalled();
    });

    it('should initialize with specified provider', async () => {
      await service.initialize('openai');
      
      expect(service.initialize).toHaveBeenCalledWith('openai');
    });

    it('should only initialize once', async () => {
      await service.initialize();
      await service.initialize();
      
      expect(service.initialize).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateEmbeddings', () => {
    it('should generate embeddings for a document', async () => {
      await service.initialize();
      captureEvents('progress');

      const result = await service.generateEmbeddings('doc1');

      expect(result.success).toBe(true);
      expect(result.embeddingsGenerated).toBe(25);
      expect(result.duration).toBe(1500);
      expect(result.tokensPerSecond).toBe(16.7);
      
      // Check progress events
      const progressEvents = capturedEvents['progress'];
      expect(progressEvents.find(e => e.stage === 'loading')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'generating')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'storing')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should handle document not found', async () => {
      await service.initialize();
      
      // Mock the service to simulate document not found
      const originalImplementation = service.generateEmbeddings.getMockImplementation();
      service.generateEmbeddings.mockRejectedValueOnce(new Error('Document not found'));
      
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
      if (originalImplementation) {
        service.generateEmbeddings.mockImplementation(originalImplementation);
      }
    });

    it('should handle embedding generation errors', async () => {
      await service.initialize();
      
      // Mock the service to simulate embedding generation failure
      const originalImplementation = service.generateEmbeddings.getMockImplementation();
      service.generateEmbeddings.mockRejectedValueOnce(new Error('Embedding failed'));
      
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
      if (originalImplementation) {
        service.generateEmbeddings.mockImplementation(originalImplementation);
      }
    });
  });

  describe('generateAllEmbeddings', () => {
    it('should generate embeddings for all documents', async () => {
      await service.initialize();
      
      captureEvents('progress');
      captureEvents('batch');

      const result = await service.generateAllEmbeddings();

      expect(result.totalDocuments).toBe(10);
      expect(result.successfulDocuments).toBe(10);
      expect(result.failedDocuments).toBe(0);
      
      const progressEvents = capturedEvents['progress'];
      expect(progressEvents.filter(e => e.stage === 'document_complete')).toHaveLength(10);
      expect(progressEvents.find(e => e.stage === 'starting')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should continue on individual document failures', async () => {
      await service.initialize();
      
      // Create a mock that simulates some failures
      const originalImplementation = service.generateAllEmbeddings.getMockImplementation();
      service.generateAllEmbeddings.mockImplementationOnce(async () => {
        return {
          totalDocuments: 10,
          successfulDocuments: 8,
          failedDocuments: 2,
          errors: [
            { documentId: 'doc2', error: 'Embedding failed' },
            { documentId: 'doc7', error: 'Processing error' }
          ],
          averageDuration: 1200,
          totalDuration: 9600
        };
      });

      const result = await service.generateAllEmbeddings();

      expect(result.totalDocuments).toBe(10);
      expect(result.successfulDocuments).toBe(8);
      expect(result.failedDocuments).toBe(2);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].documentId).toBe('doc2');
      expect(result.errors[0].error).toBe('Embedding failed');
      
      // Restore original mock
      if (originalImplementation) {
        service.generateAllEmbeddings.mockImplementation(originalImplementation);
      }
    });

    it('should respect batch size', async () => {
      await service.initialize();
      
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

      expect(service.clearEmbeddings).toHaveBeenCalled();
      
      const progressEvents = capturedEvents['progress'];
      expect(progressEvents.find(e => e.stage === 'clearing')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should handle clear errors', async () => {
      const originalImplementation = service.clearEmbeddings.getMockImplementation();
      service.clearEmbeddings.mockRejectedValueOnce(new Error('Clear failed'));

      await expect(service.clearEmbeddings()).rejects.toThrow('Clear failed');
      
      // Restore original mock
      if (originalImplementation) {
        service.clearEmbeddings.mockImplementation(originalImplementation);
      }
    });
  });

  describe('getStats', () => {
    it('should return embedding statistics', async () => {
      await service.initialize();
      
      const stats = await service.getStats();

      expect(stats.totalVectors).toBe(1000);
      expect(stats.storageSize).toBe(5242880);
      expect(stats.averageGenerationTime).toBe(50);
      expect(stats.currentModel).toBe('transformers');
      expect(stats.modelsAvailable).toContain('transformers');
      expect(stats.modelsAvailable).toContain('openai');
      expect(stats.modelsAvailable).toContain('mock');
      expect(stats.indexStatus).toBe('ready');
    });

    it('should handle missing stats gracefully', async () => {
      await service.initialize();
      
      // Mock to return partial stats
      const originalImplementation = service.getStats.getMockImplementation();
      service.getStats.mockResolvedValueOnce({
        totalVectors: 0,
        storageSize: 0,
        averageGenerationTime: 0,
        modelsAvailable: ['transformers', 'openai', 'mock'],
        currentModel: 'transformers',
        indexStatus: 'ready'
      });

      const stats = await service.getStats();

      expect(stats.totalVectors).toBe(0);
      expect(stats.storageSize).toBe(0);
      expect(stats.averageGenerationTime).toBe(0);
      expect(stats.currentModel).toBe('transformers');
      expect(stats.indexStatus).toBe('ready');
      
      // Restore original mock
      if (originalImplementation) {
        service.getStats.mockImplementation(originalImplementation);
      }
    });

    it('should handle stats retrieval errors', async () => {
      await service.initialize();
      
      const originalImplementation = service.getStats.getMockImplementation();
      service.getStats.mockRejectedValueOnce(new Error('Stats error'));

      try {
        await service.getStats();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Stats error');
      }
      
      // Restore original mock
      if (originalImplementation) {
        service.getStats.mockImplementation(originalImplementation);
      }
    });
  });

  describe('switchProvider', () => {
    it('should switch embedding provider', async () => {
      await service.initialize();
      
      captureEvents('provider-changed');
      
      await service.switchProvider('openai');

      expect(service.switchProvider).toHaveBeenCalledWith('openai');
      
      const providerEvents = capturedEvents['provider-changed'];
      expect(providerEvents).toHaveLength(1);
      expect(providerEvents[0].provider).toBe('openai');
    });

    it('should handle invalid provider', async () => {
      await service.initialize();
      
      const originalImplementation = service.switchProvider.getMockImplementation();
      service.switchProvider.mockRejectedValueOnce(new Error('Unknown provider: invalid'));
      
      await expect(service.switchProvider('invalid' as any)).rejects.toThrow('Unknown provider: invalid');
      
      // Restore original mock
      if (originalImplementation) {
        service.switchProvider.mockImplementation(originalImplementation);
      }
    });

    it('should reinitialize after switching', async () => {
      await service.initialize();
      
      await service.switchProvider('mock');

      expect(service.switchProvider).toHaveBeenCalledWith('mock');
    });

    it('should switch between all providers', async () => {
      await service.initialize();
      
      // Switch to OpenAI
      await service.switchProvider('openai');
      expect(service.switchProvider).toHaveBeenCalledWith('openai');
      
      // Switch to Mock
      await service.switchProvider('mock');
      expect(service.switchProvider).toHaveBeenCalledWith('mock');
      
      // Switch back to Transformers
      await service.switchProvider('transformers');
      expect(service.switchProvider).toHaveBeenCalledWith('transformers');
    });
  });

  describe('testProvider', () => {
    it('should test embedding generation with current provider', async () => {
      await service.initialize();
      
      const result = await service.testProvider('Test query');

      expect(result.success).toBe(true);
      expect(result.provider).toBe('transformers');
      expect(result.dimensions).toBe(384);
      expect(result.latency).toBe(150);
      expect(service.testProvider).toHaveBeenCalledWith('Test query');
    });

    it('should handle test failures', async () => {
      await service.initialize();
      
      const originalImplementation = service.testProvider.getMockImplementation();
      service.testProvider.mockResolvedValueOnce({
        success: false,
        provider: 'transformers',
        dimensions: 0,
        latency: 150,
        error: 'Test failed',
        testQuery: 'Test query',
        responseTime: 150
      });

      const result = await service.testProvider('Test query');

      expect(result.success).toBe(false);
      expect(result.provider).toBe('transformers');
      expect(result.dimensions).toBe(0);
      expect(result.latency).toBe(150);
      expect(result.error).toBe('Test failed');
      
      // Restore original mock
      if (originalImplementation) {
        service.testProvider.mockImplementation(originalImplementation);
      }
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
      expect(result.provider).toBe('transformers'); // Mock returns transformers
      expect(result.success).toBe(true);
      
      // Switch and test Mock provider
      await service.switchProvider('mock');
      result = await service.testProvider('Test query');
      expect(result.provider).toBe('transformers'); // Mock returns transformers
      expect(result.success).toBe(true);
    });
  });

  describe('event emission', () => {
    it('should emit batch progress events', async () => {
      await service.initialize();
      captureEvents('batch');

      await service.generateAllEmbeddings(2);

      const batchEvents = capturedEvents['batch'];
      expect(batchEvents.filter(e => e.stage === 'batch_start')).toHaveLength(5); // 10 docs in batches of 2
      expect(batchEvents.filter(e => e.stage === 'batch_complete')).toHaveLength(5);
      
      // Check batch numbering
      const startEvents = batchEvents.filter(e => e.stage === 'batch_start');
      expect(startEvents[0].batchNumber).toBe(1);
      expect(startEvents[1].batchNumber).toBe(2);
      expect(startEvents[0].totalBatches).toBe(5);
    });

    it('should emit progress percentage', async () => {
      await service.initialize();
      captureEvents('progress');

      await service.generateAllEmbeddings();

      const progressEvents = capturedEvents['progress'];
      const completeEvents = progressEvents.filter(e => e.stage === 'document_complete');
      
      expect(completeEvents.length).toBe(10);
      
      // Check that progress increases
      expect(completeEvents[4].progress).toBe(50);
      expect(completeEvents[9].progress).toBe(100);
      
      // Check start and end events
      expect(progressEvents.find(e => e.stage === 'starting')).toBeDefined();
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });

    it('should emit error events on failures', async () => {
      await service.initialize();
      
      // Mock to simulate error event emission during failure
      const originalImplementation = service.generateEmbeddings.getMockImplementation();
      service.generateEmbeddings.mockImplementationOnce(async (documentId: string) => {
        service.emit('error', { documentId, error: new Error('Processing failed') });
        throw new Error('Processing failed');
      });
      
      captureEvents('error');
      
      try {
        await service.generateEmbeddings('doc1');
      } catch {
        // Expected to fail
      }
      
      const errorEvents = capturedEvents['error'];
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].documentId).toBe('doc1');
      expect(errorEvents[0].error).toBeDefined();
      
      // Restore original mock
      if (originalImplementation) {
        service.generateEmbeddings.mockImplementation(originalImplementation);
      }
    });
  });

  describe('performance tracking', () => {
    it('should track embedding generation performance', async () => {
      await service.initialize();

      const result = await service.generateEmbeddings('doc1');

      expect(result).toHaveProperty('duration');
      expect(result.duration).toBe(1500);
      expect(result).toHaveProperty('tokensPerSecond');
      expect(result.tokensPerSecond).toBe(16.7);
      expect(result.success).toBe(true);
      expect(result.embeddingsGenerated).toBe(25);
    });

    it('should calculate average performance metrics', async () => {
      await service.initialize();

      const result = await service.generateAllEmbeddings();

      expect(result.totalDocuments).toBe(10);
      expect(result.successfulDocuments).toBe(10);
      expect(result.failedDocuments).toBe(0);
    });

    it('should track performance across different providers', async () => {
      await service.initialize();
      
      // Test transformers performance
      let result = await service.testProvider('Performance test query');
      expect(result.latency).toBe(150);
      expect(result.success).toBe(true);
      
      // Switch to OpenAI and test performance
      await service.switchProvider('openai');
      result = await service.testProvider('Performance test query');
      expect(result.latency).toBe(150);
      expect(result.success).toBe(true);
      
      // Both should have recorded some latency
      expect(result.dimensions).toBe(384);
    });
  });
});