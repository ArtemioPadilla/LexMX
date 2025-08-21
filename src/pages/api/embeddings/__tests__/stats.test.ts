import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the services
vi.mock('../../../../lib/admin/embeddings-service', () => {
  const mockEmbeddingsService = {
    getStats: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalVectors: 1250,
        totalDocuments: 45,
        averageVectorsPerDocument: 27.8,
        storageSize: 524288, // 512KB
        indexSize: 65536, // 64KB
        model: 'transformers/all-MiniLM-L6-v2',
        dimensions: 384,
        provider: 'transformers',
        lastUpdated: '2024-01-15T10:30:00.000Z',
        performanceMetrics: {
          averageEmbeddingTime: 45,
          averageQueryTime: 12,
          cacheHitRate: 0.75
        }
      });
    })
  };

  return {
    EmbeddingsService: vi.fn().mockImplementation(() => mockEmbeddingsService),
    embeddingsService: mockEmbeddingsService
  };
});

vi.mock('../../../../lib/admin/admin-data-service', () => {
  const mockAdminDataService = {
    getEmbeddingsStats: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalVectors: 1300, // Slightly different to test max logic
        totalDocuments: 45,
        storageSize: 548864, // Slightly larger
        indexedDocuments: 43,
        pendingDocuments: 2,
        errorDocuments: 0,
        lastIndexUpdate: '2024-01-15T11:00:00.000Z',
        indexHealth: 'good',
        memoryUsage: 102400, // 100KB
        diskUsage: 548864
      });
    })
  };

  return {
    AdminDataService: vi.fn().mockImplementation(() => mockAdminDataService),
    adminDataService: mockAdminDataService
  };
});

// Import after mocking
import { GET, OPTIONS } from '../stats';

describe('Embeddings Stats API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/embeddings/stats', {
        method: 'GET'
      }),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/embeddings/stats'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('GET /api/embeddings/stats', () => {
    describe('Basic Statistics', () => {
      it('should return basic embeddings statistics', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.totalVectors).toBe(1250);
        expect(data.data.totalDocuments).toBe(45);
        expect(data.data.averageVectorsPerDocument).toBe(27.8);
        expect(data.data.storageSize).toBe(524288);
        expect(data.data.model).toBe('transformers/all-MiniLM-L6-v2');
        expect(data.data.dimensions).toBe(384);
        expect(data.data.provider).toBe('transformers');
        expect(data.timestamp).toBeDefined();
      });

      it('should include performance metrics', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.performanceMetrics).toBeDefined();
        expect(data.data.performanceMetrics.averageEmbeddingTime).toBe(45);
        expect(data.data.performanceMetrics.averageQueryTime).toBe(12);
        expect(data.data.performanceMetrics.cacheHitRate).toBe(0.75);
      });

      it('should include timestamp', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.timestamp).toBeDefined();
        expect(new Date(data.timestamp)).toBeInstanceOf(Date);
      });
    });

    describe('Detailed Statistics', () => {
      beforeEach(() => {
        mockContext.url = new URL('http://localhost:3000/api/embeddings/stats?detailed=true');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });
      });

      it('should return detailed statistics when requested', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.embeddings).toBeDefined();
        expect(data.data.breakdown).toBeDefined();
        expect(data.data.breakdown.service).toBeDefined();
        expect(data.data.breakdown.admin).toBeDefined();
      });

      it('should combine stats from both services', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.embeddings.totalVectors).toBe(1300); // Max of 1250 and 1300
        expect(data.data.embeddings.storageSize).toBe(548864); // Max of 524288 and 548864
        expect(data.data.embeddings.totalDocuments).toBe(45); // Same from both
      });

      it('should include admin-specific metrics in detailed mode', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.breakdown.admin.indexedDocuments).toBe(43);
        expect(data.data.breakdown.admin.pendingDocuments).toBe(2);
        expect(data.data.breakdown.admin.errorDocuments).toBe(0);
        expect(data.data.breakdown.admin.indexHealth).toBe('good');
        expect(data.data.breakdown.admin.memoryUsage).toBe(102400);
        expect(data.data.breakdown.admin.diskUsage).toBe(548864);
      });

      it('should include service-specific metrics in detailed mode', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.breakdown.service.performanceMetrics).toBeDefined();
        expect(data.data.breakdown.service.model).toBe('transformers/all-MiniLM-L6-v2');
        expect(data.data.breakdown.service.provider).toBe('transformers');
      });

      it('should handle max calculation for conflicting values', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        // Service reports 1250, admin reports 1300, should use max (1300)
        expect(data.data.embeddings.totalVectors).toBe(1300);
        // Service reports 524288, admin reports 548864, should use max (548864)
        expect(data.data.embeddings.storageSize).toBe(548864);
      });
    });

    describe('Query Parameter Handling', () => {
      it('should handle detailed=false', async () => {
        mockContext.url = new URL('http://localhost:3000/api/embeddings/stats?detailed=false');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.breakdown).toBeUndefined(); // Should not include breakdown
        expect(data.data.totalVectors).toBe(1250); // Basic stats only
      });

      it('should handle invalid detailed parameter', async () => {
        mockContext.url = new URL('http://localhost:3000/api/embeddings/stats?detailed=invalid');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.breakdown).toBeUndefined(); // Should treat as false
      });

      it('should handle missing detailed parameter', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.breakdown).toBeUndefined(); // Should default to basic stats
      });
    });

    describe('Empty Embeddings Scenario', () => {
      beforeEach(async () => {
        // Mock empty embeddings scenario
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        
        embeddingsService.getStats.mockResolvedValue({
          totalVectors: 0,
          totalDocuments: 0,
          averageVectorsPerDocument: 0,
          storageSize: 0,
          indexSize: 0,
          model: 'none',
          dimensions: 0,
          provider: 'none',
          lastUpdated: null,
          performanceMetrics: {
            averageEmbeddingTime: 0,
            averageQueryTime: 0,
            cacheHitRate: 0
          }
        });

        adminDataService.getEmbeddingsStats.mockResolvedValue({
          totalVectors: 0,
          totalDocuments: 0,
          storageSize: 0,
          indexedDocuments: 0,
          pendingDocuments: 0,
          errorDocuments: 0,
          lastIndexUpdate: null,
          indexHealth: 'empty',
          memoryUsage: 0,
          diskUsage: 0
        });
      });

      it('should handle empty embeddings database', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.totalVectors).toBe(0);
        expect(data.data.totalDocuments).toBe(0);
        expect(data.data.storageSize).toBe(0);
        expect(data.data.model).toBe('none');
        expect(data.data.provider).toBe('none');
      });

      it('should handle empty embeddings in detailed mode', async () => {
        mockContext.url = new URL('http://localhost:3000/api/embeddings/stats?detailed=true');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.breakdown.admin.indexHealth).toBe('empty');
        expect(data.data.breakdown.admin.indexedDocuments).toBe(0);
      });
    });

    describe('Service Error Handling', () => {
      it('should handle embeddings service error', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.getStats.mockRejectedValue(new Error('Embeddings service unavailable'));

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Embeddings service unavailable');
      });

      it('should handle admin service error in detailed mode', async () => {
        mockContext.url = new URL('http://localhost:3000/api/embeddings/stats?detailed=true');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        // Reset embeddings service to succeed (in case previous test left it in error state)
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.getStats.mockResolvedValue({
          totalVectors: 1250,
          totalDocuments: 45,
          averageVectorsPerDocument: 27.8,
          storageSize: 524288,
          indexSize: 65536,
          model: 'transformers/all-MiniLM-L6-v2',
          dimensions: 384,
          provider: 'transformers',
          lastUpdated: '2024-01-15T10:30:00.000Z',
          performanceMetrics: {
            averageEmbeddingTime: 45,
            averageQueryTime: 12,
            cacheHitRate: 0.75
          }
        });

        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        adminDataService.getEmbeddingsStats.mockRejectedValue(new Error('Admin service unavailable'));

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Admin service unavailable');
      });

      it('should handle generic error', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.getStats.mockRejectedValue('Unexpected error');

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Failed to fetch embeddings statistics');
      });
    });

    describe('CORS Headers', () => {
      it('should include CORS headers in successful response', async () => {
        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should include CORS headers in error response', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.getStats.mockRejectedValue(new Error('Service error'));

        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('OPTIONS /api/embeddings/stats', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/embeddings/stats', {
        method: 'OPTIONS'
      });
    });

    it('should handle OPTIONS request for CORS preflight', async () => {
      const response = await OPTIONS(mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should return no content for OPTIONS', async () => {
      const response = await OPTIONS(mockContext);
      const text = await response.text();

      expect(text).toBe('');
    });
  });
});