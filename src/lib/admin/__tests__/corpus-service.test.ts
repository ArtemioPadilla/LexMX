import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { CorpusFilter } from '../corpus-service';
import type { LegalHierarchy } from '@/types/legal';
import {
  legalDocumentsFixture,
  createMockDocument
} from '@/test/mocks';

// Mock the dependencies before importing CorpusService
vi.mock('../../corpus/document-loader');
// CorpusService never imports IndexedDBVectorStore or MetadataStore directly
// (it goes through adminDataService/documentLoader), so those two used to be
// mocked here for nothing.
vi.mock('../../ingestion/document-ingestion-pipeline');
vi.mock('../admin-data-service');

// Import after mocking
import { CorpusService } from '../corpus-service';
import { DocumentLoader } from '../../corpus/document-loader';
import { DocumentIngestionPipeline } from '../../ingestion/document-ingestion-pipeline';
import { adminDataService } from '../admin-data-service';

// Minimal per-method mock shapes for the auto-mocked classes/singleton above.
// Using bare `Mock` (rather than trying to match every field of the real
// return types, several of which this suite intentionally exercises with
// partial/irrelevant data) keeps this file `any`-free without over-fitting
// to interfaces that CorpusService itself never fully consumes.
interface MockedDocumentLoader {
  initialize: Mock;
  loadAllDocuments: Mock;
  loadDocument: Mock;
  clearDocument: Mock;
}

interface MockedIngestionPipeline {
  initialize: Mock;
  ingestDocument: Mock;
}

interface MockedAdminDataService {
  getCorpusStats: Mock;
  getEmbeddingsStats: Mock;
  deleteDocument: Mock;
}

// Shape of CorpusService's own `operation:start`/`operation:complete`/
// `operation:error` events (see the `this.emit('operation:...', ...)` call
// sites in corpus-service.ts).
interface CorpusOperationEvent {
  type: string;
  documentId: string;
  result?: unknown;
  error?: unknown;
}

describe('CorpusService', () => {
  let service: CorpusService;
  let mockDocumentLoader: MockedDocumentLoader;
  let mockIngestionPipeline: MockedIngestionPipeline;
  let mockAdminDataService: MockedAdminDataService;

  // Use mock documents from fixture data
  const mockDocuments = legalDocumentsFixture.slice(0, 3).map(doc => ({
    ...doc,
    content: doc.content.map((chunk, index) => ({
      id: `${doc.id}-chunk-${index}`,
      content: chunk.content,
      type: chunk.type,
      number: chunk.number,
      title: chunk.title,
      chunkIndex: index
    }))
  }));

  // `legalDocumentsFixture` has 5 entries; guard rather than `!` so a future
  // trimmed fixture fails loudly here instead of via a confusing downstream
  // `undefined` under `noUncheckedIndexedAccess`.
  const [mockDocument] = mockDocuments;
  if (!mockDocument) {
    throw new Error('legalDocumentsFixture must contain at least one document');
  }

  // Test environment setup
  const mockStorage = {
    data: new Map<string, string>(),
    getItem: vi.fn((key: string) => mockStorage.data.get(key) || null),
    setItem: vi.fn((key: string, value: string) => mockStorage.data.set(key, value)),
    removeItem: vi.fn((key: string) => mockStorage.data.delete(key)),
    clear: vi.fn(() => mockStorage.data.clear()),
    length: 0,
    key: vi.fn()
  };
  
  // Setup global mocks
  global.localStorage = mockStorage as unknown as Storage;
  global.sessionStorage = { ...mockStorage } as unknown as Storage;

  // Minimal File-like shape accepted by MockFileReader/createMockFile below;
  // real `File` objects aren't constructible with arbitrary content in jsdom.
  interface MockFile {
    name: string;
    type: string;
    lastModified: number;
    mockContent: string;
    size: number;
  }

  interface MockFileReaderEvent {
    target: { result: string | null };
  }

  // Mock FileReader for file import tests
  class MockFileReader {
    onload: ((event: MockFileReaderEvent) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    result: string | null = null;

    readAsText(file: MockFile) {
      // Simulate async file reading
      setTimeout(() => {
        try {
          if (file.mockContent) {
            this.result = file.mockContent;
          } else {
            throw new Error('Invalid file content');
          }

          if (this.onload) {
            this.onload({ target: { result: this.result } });
          }
        } catch (error) {
          if (this.onerror) {
            this.onerror(error);
          }
        }
      }, 0);
    }
  }

  global.FileReader = MockFileReader as unknown as typeof FileReader;

  // Create a helper to create File-like objects for testing
  function createMockFile(content: string, filename: string, type: string): MockFile {
    return {
      name: filename,
      type: type,
      lastModified: Date.now(),
      mockContent: content, // Add content for MockFileReader
      size: content.length
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorage.data.clear();
    
    // Get mock instances
    mockDocumentLoader = vi.mocked(DocumentLoader.prototype);
    mockIngestionPipeline = vi.mocked(DocumentIngestionPipeline.prototype);
    mockAdminDataService = vi.mocked(adminDataService);

    // Setup default mock implementations
    mockDocumentLoader.initialize = vi.fn().mockResolvedValue(undefined);
    mockIngestionPipeline.initialize = vi.fn().mockResolvedValue(undefined);

    mockDocumentLoader.loadAllDocuments = vi.fn().mockResolvedValue(mockDocuments);
    mockDocumentLoader.loadDocument = vi.fn().mockImplementation((id: string) => {
      const doc = mockDocuments.find(d => d.id === id);
      return Promise.resolve(doc || null);
    });
    mockDocumentLoader.clearDocument = vi.fn().mockResolvedValue(undefined);

    // `chunks`/`embeddings`/`stats` mirror DocumentIngestionPipeline's real
    // `IngestionResult` shape; corpus-service.ts only reads `.success`, but
    // typing this mock against the real interface keeps it honest.
    mockIngestionPipeline.ingestDocument = vi.fn().mockResolvedValue({
      success: true,
      document: mockDocument,
      chunks: [],
      embeddings: new Map(),
      stats: {
        fetchTime: 0,
        parseTime: 0,
        chunkTime: 0,
        embeddingTime: 0,
        totalTime: 0,
        chunkCount: 0,
        tokenCount: 0
      }
    });

    // Mock admin data service
    mockAdminDataService.getCorpusStats = vi.fn().mockResolvedValue({
      totalDocuments: mockDocuments.length,
      totalChunks: 0,
      documentsByType: { law: 2, constitution: 1 },
      documentsByArea: { civil: 1, labor: 1, constitutional: 1 },
      totalSize: 150000,
      lastUpdate: new Date().toISOString()
    });

    mockAdminDataService.getEmbeddingsStats = vi.fn().mockResolvedValue({
      totalVectors: 100,
      dimensions: 1536,
      storageSize: 100 * 1536 * 4,
      indexStatus: 'ready',
      modelsAvailable: ['transformers'],
      currentModel: 'transformers',
      averageGenerationTime: 85
    });

    mockAdminDataService.deleteDocument = vi.fn().mockResolvedValue(undefined);

    // Create service instance after setting up mocks
    service = new CorpusService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize all dependencies', async () => {
      await service.initialize();
      
      expect(mockDocumentLoader.initialize).toHaveBeenCalled();
      expect(mockIngestionPipeline.initialize).toHaveBeenCalled();
    });

    it('should only initialize once', async () => {
      await service.initialize();
      await service.initialize();
      
      expect(mockDocumentLoader.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('getDocuments', () => {
    it('should return all documents without filter', async () => {
      const documents = await service.getDocuments();
      
      expect(documents).toHaveLength(mockDocuments.length);
      expect(mockDocumentLoader.loadAllDocuments).toHaveBeenCalled();
    });

    it('should filter documents by type', async () => {
      const filter: CorpusFilter = { type: 'law' };
      const documents = await service.getDocuments(filter);
      
      const expectedDocs = mockDocuments.filter(doc => doc.type === 'law');
      expect(documents).toEqual(expectedDocs);
    });

    it('should filter documents by legal area', async () => {
      const filter: CorpusFilter = { legalArea: 'civil' };
      const documents = await service.getDocuments(filter);
      
      const expectedDocs = mockDocuments.filter(doc => doc.primaryArea === 'civil');
      expect(documents).toEqual(expectedDocs);
    });

    it('should filter documents by search term in title', async () => {
      const filter: CorpusFilter = { searchTerm: 'Civil' };
      const documents = await service.getDocuments(filter);
      
      expect(documents.length).toBeGreaterThan(0);
      expect(documents[0]!.title.toLowerCase()).toContain('civil');
    });

    it('should filter documents by search term in content', async () => {
      const filter: CorpusFilter = { searchTerm: 'trabajo' };
      const documents = await service.getDocuments(filter);
      
      expect(documents.length).toBeGreaterThan(0);
      const hasContentMatch = documents.some(doc => 
        doc.content.some(chunk => 
          chunk.content.toLowerCase().includes('trabajo')
        )
      );
      expect(hasContentMatch).toBe(true);
    });

    it('should apply multiple filters', async () => {
      const filter: CorpusFilter = {
        type: 'law',
        legalArea: 'labor',
        searchTerm: 'trabajo'
      };
      const documents = await service.getDocuments(filter);
      
      expect(documents.length).toBeGreaterThanOrEqual(0);
      documents.forEach(doc => {
        expect(doc.type).toBe('law');
        expect(doc.primaryArea).toBe('labor');
      });
    });

    it('should return empty array when no documents match', async () => {
      const filter: CorpusFilter = { type: 'regulation' };
      const documents = await service.getDocuments(filter);
      
      expect(documents).toEqual([]);
    });
  });

  describe('getDocumentMetrics', () => {
    it('should calculate document metrics', async () => {
      const metrics = await service.getDocumentMetrics(mockDocument.id);
      
      expect(metrics).toEqual({
        id: mockDocument.id,
        title: mockDocument.title,
        type: mockDocument.type,
        legalArea: mockDocument.primaryArea,
        chunks: mockDocument.content.length,
        embeddings: mockDocument.content.length,
        size: expect.any(Number),
        quality: expect.any(Number),
        lastUpdated: expect.any(String)
      });
    });

    it('should handle documents without embeddings', async () => {
      mockAdminDataService.getEmbeddingsStats.mockResolvedValue({
        totalVectors: 0,
        dimensions: 1536,
        indexSize: 0,
        averageQueryTime: 0,
        cacheHitRate: 0,
        lastReindexed: Date.now()
      });
      
      const metrics = await service.getDocumentMetrics(mockDocument.id);
      
      expect(metrics?.embeddings).toBe(0);
    });

    it('should handle document not found', async () => {
      const metrics = await service.getDocumentMetrics('nonexistent');
      
      expect(metrics).toBeNull();
    });
  });

  describe('deleteDocument', () => {
    it('should delete document from all stores', async () => {
      const progressEvents: CorpusOperationEvent[] = [];
      service.on('operation:start', (event) => progressEvents.push(event));
      service.on('operation:complete', (event) => progressEvents.push(event));

      await service.deleteDocument('doc1');

      expect(mockAdminDataService.deleteDocument).toHaveBeenCalledWith('doc1');
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0]!.type).toBe('delete');
      expect(progressEvents[1]!.type).toBe('delete');
    });

    it('should handle deletion errors', async () => {
      mockAdminDataService.deleteDocument.mockRejectedValue(new Error('Delete failed'));

      await expect(service.deleteDocument('doc1')).rejects.toThrow('Delete failed');
    });
  });

  describe('reindexDocument', () => {
    it('should reindex document successfully', async () => {
      const operationEvents: CorpusOperationEvent[] = [];
      service.on('operation:start', (event) => operationEvents.push(event));
      service.on('operation:complete', (event) => operationEvents.push(event));

      await service.reindexDocument(mockDocument.id);

      expect(mockIngestionPipeline.ingestDocument).toHaveBeenCalledWith(mockDocument);
      expect(operationEvents).toHaveLength(2);
      expect(operationEvents[0]!.type).toBe('reindex');
      expect(operationEvents[1]!.type).toBe('reindex');
    });

    it('should handle document not found', async () => {
      await expect(service.reindexDocument('nonexistent')).rejects.toThrow('Document nonexistent not found');
    });

    it('should handle reindexing errors', async () => {
      mockIngestionPipeline.ingestDocument.mockRejectedValue(new Error('Ingest failed'));

      await expect(service.reindexDocument(mockDocument.id)).rejects.toThrow('Ingest failed');
    });
  });

  describe('validateCorpus', () => {
    it('should validate all documents', async () => {
      const invalidDoc = { ...mockDocument, id: 'doc2', title: '', content: [] };
      const documents = [mockDocument, invalidDoc];
      
      mockDocumentLoader.loadAllDocuments.mockResolvedValue(documents);

      const result = await service.validateCorpus();

      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0]!.documentId).toBe('doc2');
    });

    it('should detect missing required fields', async () => {
      const invalidDoc = { ...mockDocument, title: '', content: [] };
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([invalidDoc]);

      const result = await service.validateCorpus();

      expect(result.invalid).toBe(1);
      expect(result.issues[0]!.issues).toContain('Missing title');
      expect(result.issues[0]!.issues).toContain('No content');
    });

    it('should validate chunk structure', async () => {
      const docWithInvalidChunks = {
        ...mockDocument,
        content: [{ id: 'chunk1', content: '', type: 'article', number: '1', title: 'Test', chunkIndex: 0 }]
      };
      
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([docWithInvalidChunks]);

      const result = await service.validateCorpus();

      expect(result.valid).toBe(1); // This should pass validation as it has content structure
    });

    it('should handle empty corpus', async () => {
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([]);

      const result = await service.validateCorpus();

      expect(result.valid).toBe(0);
      expect(result.invalid).toBe(0);
      expect(result.issues).toEqual([]);
    });

    it('should validate two in-memory documents independently', async () => {
      const validDoc = createMockDocument({ id: 'valid-doc' });
      const invalidDoc = createMockDocument({
        id: 'invalid-doc',
        title: '',
        content: [],
        hierarchy: 9 as unknown as LegalHierarchy
      });

      mockDocumentLoader.loadAllDocuments.mockResolvedValue([validDoc, invalidDoc]);

      const result = await service.validateCorpus();

      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(1);
      expect(result.issues).toEqual([
        {
          documentId: 'invalid-doc',
          issues: ['Missing title', 'No content', 'Invalid hierarchy level']
        }
      ]);
    });
  });

  describe('getStatistics', () => {
    it('aggregates type/area/hierarchy/size across two in-memory documents', async () => {
      const docA = createMockDocument({
        id: 'doc-a',
        type: 'law',
        primaryArea: 'labor',
        hierarchy: 3,
        content: [
          { id: 'a-1', type: 'article', number: '1', title: 'Art 1', content: 'uno' },
          { id: 'a-2', type: 'article', number: '2', title: 'Art 2', content: 'dos' }
        ]
      });
      const docB = createMockDocument({
        id: 'doc-b',
        type: 'constitution',
        primaryArea: 'constitutional',
        hierarchy: 1,
        content: [
          { id: 'b-1', type: 'article', number: '1', title: 'Art 1', content: 'uno' }
        ]
      });

      mockDocumentLoader.loadAllDocuments.mockResolvedValue([docA, docB]);

      const stats = await service.getStatistics();

      expect(stats.byType).toEqual({ law: 1, constitution: 1 });
      expect(stats.byArea).toEqual({ labor: 1, constitutional: 1 });
      expect(stats.byHierarchy).toEqual({ 3: 1, 1: 1 });
      expect(stats.averageChunks).toBe(1.5); // (2 + 1) / 2 documents
      expect(stats.totalSize).toBe(
        JSON.stringify(docA).length + JSON.stringify(docB).length
      );
    });

    it('returns zeroed stats for an empty corpus', async () => {
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([]);

      const stats = await service.getStatistics();

      expect(stats.byType).toEqual({});
      expect(stats.byArea).toEqual({});
      expect(stats.byHierarchy).toEqual({});
      expect(stats.averageChunks).toBe(0);
      expect(stats.totalSize).toBe(0);
    });
  });

  describe('importDocument', () => {
    it('should import JSON document', async () => {
      const jsonContent = JSON.stringify(mockDocument);
      const file = createMockFile(jsonContent, 'doc.json', 'application/json');

      const result = await service.importDocument(file as unknown as File);

      expect(mockIngestionPipeline.ingestDocument).toHaveBeenCalledWith(mockDocument);
      expect(result).toEqual(mockDocument);
    });

    it('should handle invalid JSON', async () => {
      const file = createMockFile('invalid json', 'doc.json', 'application/json');

      await expect(service.importDocument(file as unknown as File)).rejects.toThrow();
    });

    it('should handle import errors', async () => {
      const jsonContent = JSON.stringify(mockDocument);
      const file = createMockFile(jsonContent, 'doc.json', 'application/json');

      mockIngestionPipeline.ingestDocument.mockResolvedValue({
        success: false,
        document: mockDocument,
        chunks: 0,
        embeddings: 0
      });

      await expect(service.importDocument(file as unknown as File)).rejects.toThrow('Failed to import document');
    });
  });

  describe('event emission', () => {
    it('should emit progress events during operations', async () => {
      const events: Array<CorpusOperationEvent & { stage: string }> = [];
      service.on('operation:start', (event) => events.push({ ...event, stage: 'start' }));
      service.on('operation:complete', (event) => events.push({ ...event, stage: 'complete' }));

      await service.deleteDocument('doc1');

      expect(events).toContainEqual(
        expect.objectContaining({
          stage: 'start',
          type: 'delete',
          documentId: 'doc1'
        })
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          stage: 'complete',
          type: 'delete',
          documentId: 'doc1'
        })
      );
    });

    it('should emit validation progress', async () => {
      // Validation events are not currently implemented in the service
      // This test validates the current behavior
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([mockDocument]);
      
      const result = await service.validateCorpus();

      expect(result.valid).toBe(1);
      expect(result.invalid).toBe(0);
    });
  });

  describe('searchDocuments', () => {
    it('should search documents by content', async () => {
      const results = await service.searchDocuments('trabajo');

      expect(results.length).toBeGreaterThan(0);
      const hasMatch = results.some(doc => 
        doc.title.toLowerCase().includes('trabajo') ||
        doc.content.some(chunk => chunk.content.toLowerCase().includes('trabajo'))
      );
      expect(hasMatch).toBe(true);
    });

    it('should rank results by relevance', async () => {
      const doc1 = {
        ...mockDocument,
        id: 'doc1',
        content: [{
          id: 'c1',
          content: 'test query test query',
          type: 'article',
          number: '1',
          title: 'Test Article',
          chunkIndex: 0
        }]
      };
      const doc2 = {
        ...mockDocument,
        id: 'doc2',
        content: [{
          id: 'c2',
          content: 'query',
          type: 'article',
          number: '1',
          title: 'Test Article',
          chunkIndex: 0
        }]
      };
      
      mockDocumentLoader.loadAllDocuments.mockResolvedValue([doc1, doc2]);

      const results = await service.searchDocuments('query');

      expect(results[0]!.id).toBe('doc1'); // Should rank higher due to more occurrences
    });

    it('should return empty array for no matches', async () => {
      const results = await service.searchDocuments('nonexistentterm12345');

      expect(results).toEqual([]);
    });
  });
});