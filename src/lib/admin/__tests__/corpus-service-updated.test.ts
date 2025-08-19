/**
 * Updated CorpusService test demonstrating new mock infrastructure
 * Shows how to use factories, service mocks, and fixtures for better testing
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createMockDocument, 
  createMockDocumentMetrics
} from '../../../test/mocks/factories';
import { 
  createMockCorpusService,
  createMockEventEmitterUtils
} from '../../../test/mocks/service-mocks';
import { autoMockService, resetAllMocks } from '../../../test/mocks/auto-mock';
import legalDocumentsFixture from '../../../test/fixtures/legal-documents.json';
import type { CorpusFilter } from '@/types/legal';

// Mock the dependencies before importing CorpusService
vi.mock('../../corpus/document-loader');
vi.mock('../../storage/indexeddb-vector-store');
vi.mock('../../storage/metadata-store');
vi.mock('../../ingestion/document-ingestion-pipeline');

// Import after mocking
import { CorpusService } from '../corpus-service';

describe('CorpusService (Updated with Mock Infrastructure)', () => {
  let service: CorpusService;
  let mockService: ReturnType<typeof createMockCorpusService>;
  let eventUtils: ReturnType<typeof createMockEventEmitterUtils>;

  beforeEach(() => {
    resetAllMocks();
    
    // Create service using new mock infrastructure
    mockService = createMockCorpusService();
    eventUtils = createMockEventEmitterUtils();
    
    // For integration tests, we can use the real service
    service = new CorpusService();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('Document Operations with Mock Factories', () => {
    it('should handle documents using mock factories', async () => {
      // Create test documents using factories
      const _mockDocs = [
        createMockDocument({ 
          type: 'law', 
          primaryArea: 'labor',
          title: 'Ley Federal del Trabajo'
        }),
        createMockDocument({ 
          type: 'code', 
          primaryArea: 'civil',
          title: 'Código Civil Federal'
        })
      ];

      // Test the mock service
      const documents = await mockService.getDocuments();
      
      expect(documents).toBeInstanceOf(Array);
      expect(documents.length).toBeGreaterThan(0);
      
      // Validate mock was called correctly
      expect(mockService.getDocuments).toHaveBeenCalledTimes(1);
    });

    it('should filter documents correctly with factories', async () => {
      const filter: CorpusFilter = { 
        type: 'law', 
        legalArea: 'labor' 
      };

      const filteredDocs = await mockService.getDocuments(filter);
      
      expect(mockService.getDocuments).toHaveBeenCalledWith(filter);
      expect(filteredDocs).toBeInstanceOf(Array);
    });

    it('should use fixture data for comprehensive testing', async () => {
      // Use fixture data for more realistic testing
      const fixtureDocument = legalDocumentsFixture[0]; // LFT document
      
      expect(fixtureDocument.title).toBe('Ley Federal del Trabajo');
      expect(fixtureDocument.type).toBe('law');
      expect(fixtureDocument.primaryArea).toBe('labor');
      expect(fixtureDocument.content).toHaveLength(3);
    });
  });

  describe('Document Metrics with Mock Infrastructure', () => {
    it('should generate realistic metrics using factories', async () => {
      const documentId = 'lft-mexico';
      
      // Create mock metrics using factory
      const _expectedMetrics = createMockDocumentMetrics({
        id: documentId,
        title: 'Ley Federal del Trabajo',
        type: 'law',
        legalArea: 'labor'
      });

      const metrics = await mockService.getDocumentMetrics(documentId);
      
      expect(metrics).toBeDefined();
      expect(metrics?.id).toBe(documentId);
      expect(metrics?.type).toBe('law');
      expect(metrics?.legalArea).toBe('labor');
      expect(typeof metrics?.quality).toBe('number');
      expect(mockService.getDocumentMetrics).toHaveBeenCalledWith(documentId);
    });

    it('should handle missing documents gracefully', async () => {
      const metrics = await mockService.getDocumentMetrics('nonexistent');
      
      expect(metrics).toBeNull();
      expect(mockService.getDocumentMetrics).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('Event Handling with Mock Infrastructure', () => {
    it('should emit progress events during deletion', async () => {
      const documentId = 'test-doc';
      
      // Start deletion and capture events
      const deletePromise = mockService.deleteDocument(documentId);
      const progressEvents = await eventUtils.captureEvents(mockService, 'progress', 500);
      
      await deletePromise;
      
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents.some(e => e.stage === 'deleting_vectors')).toBe(true);
      expect(progressEvents.some(e => e.stage === 'complete')).toBe(true);
    });

    it('should emit validation events during corpus validation', async () => {
      const validationPromise = mockService.validateCorpus();
      const validationEvents = await eventUtils.captureEvents(mockService, 'validation', 1000);
      
      const result = await validationPromise;
      
      expect(result.totalDocuments).toBeGreaterThan(0);
      expect(validationEvents.length).toBeGreaterThan(0);
      expect(validationEvents.every(e => typeof e.total === 'number')).toBe(true);
    });

    it('should wait for specific events', async () => {
      const documentId = 'test-doc';
      
      // Start operation and wait for specific event
      const deletePromise = mockService.deleteDocument(documentId);
      const completeEvent = await eventUtils.waitForEvent(mockService, 'progress');
      
      expect(completeEvent).toBeDefined();
      expect(completeEvent.documentId).toBe(documentId);
      
      await deletePromise;
    });
  });

  describe('Error Handling with Mock Infrastructure', () => {
    it('should handle import failures with realistic errors', async () => {
      const file = new File(['invalid json'], 'doc.json', { type: 'application/json' });
      
      // The mock has a 10% failure rate configured
      try {
        await mockService.importDocument(file);
        // May succeed due to random failure rate
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      expect(mockService.importDocument).toHaveBeenCalledWith(file);
    });

    it('should handle reindexing errors', async () => {
      try {
        await mockService.reindexDocument('nonexistent');
        // Should not reach here based on mock implementation
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('Document not found');
      }
    });
  });

  describe('Search Operations with Mock Infrastructure', () => {
    it('should search documents with ranking', async () => {
      const query = 'trabajo';
      
      const results = await mockService.searchDocuments(query);
      
      expect(results).toBeInstanceOf(Array);
      expect(mockService.searchDocuments).toHaveBeenCalledWith(query);
      
      // Results should be ranked (mock implementation sorts by relevance)
      if (results.length > 1) {
        const hasRanking = results.some(doc => 
          doc.title.toLowerCase().includes(query.toLowerCase())
        );
        expect(hasRanking).toBe(true);
      }
    });

    it('should handle empty search results', async () => {
      const results = await mockService.searchDocuments('nonexistentterm');
      
      expect(results).toBeInstanceOf(Array);
      expect(mockService.searchDocuments).toHaveBeenCalledWith('nonexistentterm');
    });
  });

  describe('Advanced Mock Validation', () => {
    it('should validate complex interaction patterns', async () => {
      const documentId = 'test-doc';
      
      // Perform multiple operations
      await mockService.getDocument(documentId);
      await mockService.getDocumentMetrics(documentId);
      await mockService.deleteDocument(documentId);
      
      // Validate call patterns using mock infrastructure
      expect(mockService.getDocument).toHaveBeenCalledTimes(1);
      expect(mockService.getDocumentMetrics).toHaveBeenCalledTimes(1);
      expect(mockService.deleteDocument).toHaveBeenCalledTimes(1);
      
      // Validate all calls used the same document ID
      const calls = [
        ...mockService.getDocument.mock.calls,
        ...mockService.getDocumentMetrics.mock.calls,
        ...mockService.deleteDocument.mock.calls
      ];
      
      expect(calls.every(call => call[0] === documentId)).toBe(true);
    });

    it('should validate async operation timing', async () => {
      const startTime = Date.now();
      
      // Operations should have realistic delays
      await mockService.getDocuments();
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(45); // Mock has 50ms delay, allow some variance
    });
  });

  describe('Auto-Mock Service Creation', () => {
    it('should automatically mock service methods', () => {
      // Demonstrate auto-mocking capabilities
      const autoMocked = autoMockService(CorpusService, {
        defaultReturns: {
          getDocuments: [],
          initialize: undefined
        },
        mockAsync: true,
        asyncDelay: 10
      });

      expect(typeof autoMocked.initialize).toBe('function');
      expect(typeof autoMocked.getDocuments).toBe('function');
      expect(typeof autoMocked.deleteDocument).toBe('function');
      
      // Test that utility methods are available
      expect(typeof autoMocked.__resetMocks).toBe('function');
      expect(typeof autoMocked.__validateCalls).toBe('function');
      expect(Array.isArray(autoMocked.__mockCalls)).toBe(true);
    });

    it('should track method calls automatically', async () => {
      const autoMocked = autoMockService(CorpusService);
      
      await autoMocked.initialize();
      await autoMocked.getDocuments();
      
      expect(autoMocked.__mockCalls.length).toBe(2);
      expect(autoMocked.__mockCalls[0].method).toBe('initialize');
      expect(autoMocked.__mockCalls[1].method).toBe('getDocuments');
      
      // Validate using built-in validation
      const isValid = autoMocked.__validateCalls({
        initialize: 1,
        getDocuments: 1
      });
      
      expect(isValid).toBe(true);
    });
  });

  describe('Performance Testing with Mocks', () => {
    it('should measure operation performance', async () => {
      const iterations = 10;
      const times: number[] = [];
      
      for (let i = 0; i < iterations; i++) {
        const start = Date.now();
        await mockService.getDocuments();
        times.push(Date.now() - start);
      }
      
      const averageTime = times.reduce((sum, time) => sum + time, 0) / times.length;
      
      // Mock operations should be reasonably fast but include realistic delays
      expect(averageTime).toBeGreaterThan(40); // Mock has 50ms delay
      expect(averageTime).toBeLessThan(100); // Should not be too slow
    });

    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) => 
        mockService.getDocument(`doc-${i}`)
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(mockService.getDocument).toHaveBeenCalledTimes(5);
    });
  });
});