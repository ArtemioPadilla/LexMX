import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminDataService } from '../admin-data-service';

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    origin: 'http://localhost:3000',
    href: 'http://localhost:3000'
  },
  writable: true
});

describe('AdminDataService', () => {
  let service: AdminDataService;
  let fetchMock: any;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Create fresh instance
    service = new AdminDataService();
    
    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    
    // Default successful response
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: 'test' }),
      blob: () => Promise.resolve(new Blob(['test'], { type: 'application/json' }))
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      
      expect(service['initialized']).toBe(true);
    });

    it('should only initialize once', async () => {
      await service.initialize();
      const firstInit = service['initialized'];
      await service.initialize();
      
      expect(service['initialized']).toBe(firstInit);
    });

    it('should handle initialization without errors', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
    });
  });

  describe('getCorpusStats', () => {
    it('should calculate corpus statistics correctly', async () => {
      const mockStats = {
        totalDocuments: 2,
        totalChunks: 3,
        documentsByType: { law: 1, code: 1 },
        documentsByArea: { civil: 1, criminal: 1 },
        lastUpdate: '2024-01-01T00:00:00Z',
        storageSize: 1024000,
        hierarchyDistribution: { 3: 2 }
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats)
      });

      const stats = await service.getCorpusStats();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/corpus/stats'),
        expect.any(Object)
      );
      expect(stats.totalDocuments).toBe(2);
      expect(stats.totalChunks).toBe(3);
      expect(stats.documentsByType).toEqual({ law: 1, code: 1 });
      expect(stats.documentsByArea).toEqual({ civil: 1, criminal: 1 });
      expect(stats.lastUpdate).toBe('2024-01-01T00:00:00Z');
    });

    it('should handle empty corpus', async () => {
      const mockStats = {
        totalDocuments: 0,
        totalChunks: 0,
        documentsByType: {},
        documentsByArea: {},
        lastUpdate: null,
        storageSize: 0,
        hierarchyDistribution: {}
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats)
      });

      const stats = await service.getCorpusStats();

      expect(stats.totalDocuments).toBe(0);
      expect(stats.totalChunks).toBe(0);
      expect(stats.documentsByType).toEqual({});
      expect(stats.documentsByArea).toEqual({});
    });
  });

  describe('deleteDocument', () => {
    it('should delete document from all stores', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, message: 'Document deleted' })
      });

      const progressEvents: any[] = [];
      service.on('progress', (event) => progressEvents.push(event));

      await service.deleteDocument('doc1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/corpus/delete'),
        expect.objectContaining({
          method: 'DELETE'
        })
      );
      
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].stage).toBe('complete');
    });

    it('should handle deletion errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(service.deleteDocument('doc1')).rejects.toThrow('API request failed');
    });
  });

  describe('getEmbeddingsStats', () => {
    it('should return embeddings statistics', async () => {
      const mockStats = {
        totalVectors: 100,
        storageSize: 1024000,
        averageGenerationTime: 50,
        modelsAvailable: ['transformers', 'openai'],
        currentModel: 'transformers',
        indexStatus: 'ready',
        lastUpdate: Date.now()
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats)
      });

      const stats = await service.getEmbeddingsStats();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/embeddings/stats'),
        expect.any(Object)
      );
      expect(stats.totalVectors).toBe(100);
      expect(stats.storageSize).toBe(1024000);
      expect(stats.averageGenerationTime).toBe(50);
      expect(stats.modelsAvailable).toContain('transformers');
      expect(stats.currentModel).toBe('transformers');
    });

    it('should handle vector store errors gracefully', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(service.getEmbeddingsStats()).rejects.toThrow();
    });
  });

  describe('clearEmbeddingsCache', () => {
    it('should clear the vector store', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, message: 'Cache cleared' })
      });

      const progressEvents: any[] = [];
      service.on('progress', (event) => progressEvents.push(event));

      await service.clearEmbeddingsCache();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/embeddings/clear'),
        expect.objectContaining({
          method: 'POST'
        })
      );
      expect(progressEvents.length).toBeGreaterThan(0);
      expect(progressEvents[progressEvents.length - 1].stage).toBe('complete');
    });

    it('should handle clear errors', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Clear failed'
      });

      await expect(service.clearEmbeddingsCache()).rejects.toThrow('API request failed');
    });
  });

  describe('rebuildIndex', () => {
    it('should rebuild the vector index', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          message: 'Index rebuilt',
          documentsProcessed: 10,
          vectorsCreated: 50
        })
      });

      const progressEvents: any[] = [];
      service.on('progress', (event) => progressEvents.push(event));

      await service.rebuildIndex();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/embeddings/generate'),
        expect.objectContaining({
          method: 'POST'
        })
      );
      expect(progressEvents.find(e => e.stage === 'complete')).toBeDefined();
    });
  });

  describe('getQualityStats', () => {
    beforeEach(() => {
      // Mock localStorage
      const localStorageMock = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        clear: vi.fn(),
        removeItem: vi.fn(),
        key: vi.fn(),
        length: 0
      };
      global.localStorage = localStorageMock as any;
    });

    it('should calculate quality statistics', async () => {
      const mockStats = {
        totalQueries: 3,
        failedQueries: 1,
        averageLatency: 150,
        cacheHitRate: 33.33,
        retrievalAccuracy: 66.67,
        testResults: [],
        lastTestRun: null
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats)
      });

      const stats = await service.getQualityStats();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/quality/metrics'),
        expect.any(Object)
      );
      expect(stats.totalQueries).toBe(3);
      expect(stats.failedQueries).toBe(1);
      expect(stats.averageLatency).toBe(150);
      expect(stats.cacheHitRate).toBeCloseTo(33.33, 1);
      expect(stats.retrievalAccuracy).toBeCloseTo(66.67, 1);
    });

    it('should handle empty query history', async () => {
      const mockStats = {
        totalQueries: 0,
        failedQueries: 0,
        averageLatency: 0,
        cacheHitRate: 0,
        retrievalAccuracy: 0,
        testResults: [],
        lastTestRun: null
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats)
      });

      const stats = await service.getQualityStats();

      expect(stats.totalQueries).toBe(0);
      expect(stats.failedQueries).toBe(0);
      expect(stats.averageLatency).toBe(0);
      expect(stats.cacheHitRate).toBe(0);
    });
  });

  describe('logQuery', () => {
    beforeEach(() => {
      const localStorageMock = {
        getItem: vi.fn().mockReturnValue('[]'),
        setItem: vi.fn(),
        clear: vi.fn(),
        removeItem: vi.fn(),
        key: vi.fn(),
        length: 0
      };
      global.localStorage = localStorageMock as any;
    });

    it('should log query to localStorage', () => {
      service.logQuery(100, false, true);

      expect(localStorage.setItem).toHaveBeenCalled();
      const savedData = JSON.parse((localStorage.setItem as any).mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0]).toMatchObject({
        latency: 100,
        failed: false,
        cached: true
      });
    });

    it('should limit history to 1000 entries', () => {
      const largeHistory = Array(1005).fill({ latency: 100, failed: false, cached: false });
      localStorage.getItem = vi.fn().mockReturnValue(JSON.stringify(largeHistory));

      service.logQuery(200, false, false);

      const savedData = JSON.parse((localStorage.setItem as any).mock.calls[0][1]);
      expect(savedData).toHaveLength(1000);
    });
  });

  describe('exportCorpus', () => {
    it('should export corpus as JSON blob', async () => {
      // Create a mock Blob if not available in test environment
      const BlobPolyfill = class Blob {
        constructor(public parts: any[], public options: any = {}) {
          this.type = options.type || '';
          this.size = parts.reduce((acc, part) => acc + part.length, 0);
        }
        type: string;
        size: number;
      };
      
      const BlobConstructor = typeof Blob !== 'undefined' ? Blob : BlobPolyfill;
      const mockBlob = new BlobConstructor(['{"documents":[]}'], { type: 'application/json' });
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(mockBlob),
        json: vi.fn().mockResolvedValue({ data: 'test' })
      });

      const blob = await service.exportCorpus();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/corpus/export'),
        expect.any(Object)
      );
      expect(blob).toBeDefined();
      expect(blob).toHaveProperty('type', 'application/json');
    });
  });

  describe('exportEmbeddings', () => {
    it('should export embeddings as JSON blob', async () => {
      // Create a mock Blob if not available in test environment
      const BlobPolyfill = class Blob {
        constructor(public parts: any[], public options: any = {}) {
          this.type = options.type || '';
          this.size = parts.reduce((acc, part) => acc + part.length, 0);
        }
        type: string;
        size: number;
      };
      
      const BlobConstructor = typeof Blob !== 'undefined' ? Blob : BlobPolyfill;
      const mockBlob = new BlobConstructor(['{"embeddings":[]}'], { type: 'application/json' });
      
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(mockBlob),
        json: vi.fn().mockResolvedValue({ data: 'test' })
      });

      const blob = await service.exportEmbeddings();

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/embeddings/export'),
        expect.any(Object)
      );
      expect(blob).toBeDefined();
      expect(blob).toHaveProperty('type', 'application/json');
    });
  });
});