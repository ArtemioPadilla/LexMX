import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the admin data service to prevent actual API calls
vi.mock('../../../lib/admin/admin-data-service', () => {
  const mockAdminDataService = {
    getCorpusStats: vi.fn().mockResolvedValue({
      totalDocuments: 150,
      totalChunks: 3000,
      totalSize: 20971520,
      documentsByType: {
        law: 50,
        code: 20,
        regulation: 40,
        constitution: 1,
        jurisprudence: 25,
        treaty: 10,
        norm: 4,
      },
      documentsByArea: {
        labor: 30,
        civil: 35,
        criminal: 25,
        constitutional: 20,
        tax: 20,
        commercial: 15,
        administrative: 5,
      },
      lastUpdate: '2024-01-20T10:00:00Z',
    }),
    getEmbeddingsStats: vi.fn().mockResolvedValue({
      totalVectors: 3000,
      dimensions: 384,
      storageSize: 10485760,
      indexStatus: 'ready',
      modelsAvailable: ['all-MiniLM-L6-v2', 'multilingual-e5-small'],
      currentModel: 'all-MiniLM-L6-v2',
      averageGenerationTime: 150,
    }),
    getQualityStats: vi.fn().mockResolvedValue({
      retrievalAccuracy: 85.5,
      averageLatency: 1500,
      corpusCoverage: 92.3,
      userSatisfaction: 4.2,
      totalQueries: 1250,
      failedQueries: 25,
      cacheHitRate: 65.8,
    }),
    clearEmbeddingsCache: vi.fn().mockResolvedValue(undefined),
  };

  return {
    AdminDataService: vi.fn().mockImplementation(() => mockAdminDataService),
    adminDataService: mockAdminDataService,
  };
});

vi.mock('../../../lib/admin/corpus-service', () => ({
  corpusService: {
    getStatistics: vi.fn().mockResolvedValue({
      totalDocuments: 150,
      totalChunks: 3000,
      detailed: true,
      processingTime: 1200,
    }),
  },
}));

vi.mock('../../../lib/admin/embeddings-service', () => ({
  embeddingsService: {
    getStats: vi.fn().mockResolvedValue({
      totalVectors: 3000,
      dimensions: 384,
      storageSize: 10485760,
      indexStatus: 'ready',
      modelsAvailable: ['all-MiniLM-L6-v2'],
      currentModel: 'all-MiniLM-L6-v2',
      averageGenerationTime: 150,
      cacheStats: {
        hits: 850,
        misses: 150,
        size: 200,
      },
    }),
  },
}));

vi.mock('../../../lib/admin/quality-test-suite', () => ({
  qualityTestSuite: {
    getStoredResults: vi.fn().mockReturnValue([
      {
        id: '1',
        timestamp: '2024-01-20T10:00:00Z',
        averageScore: 88.5,
        totalTests: 20,
        passedTests: 18,
        failedTests: 2,
      },
      {
        id: '2',
        timestamp: '2024-01-19T10:00:00Z',
        averageScore: 85.2,
        totalTests: 20,
        passedTests: 17,
        failedTests: 3,
      },
      {
        id: '3',
        timestamp: '2024-01-18T10:00:00Z',
        averageScore: 82.1,
        totalTests: 20,
        passedTests: 16,
        failedTests: 4,
      },
    ]),
  },
}));

// Import the API routes after mocking
import { GET, POST, OPTIONS } from '../stats';

describe('Admin Stats API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/admin/stats'),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/admin/stats'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1',
    } as APIContext;
  });

  describe('GET /api/admin/stats', () => {
    describe('Comprehensive Statistics', () => {
      it('should return comprehensive admin statistics', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.overview).toBeDefined();
        expect(data.data.corpus.totalDocuments).toBe(150);
        expect(data.data.embeddings.totalVectors).toBe(3000);
        expect(data.data.quality.retrievalAccuracy).toBe(85.5);
        expect(data.data.system).toBeDefined();
        expect(data.timestamp).toBeDefined();
      });

      it('should calculate health score correctly', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(data.data.overview.healthScore).toBeDefined();
        expect(typeof data.data.overview.healthScore).toBe('number');
        expect(data.data.overview.healthScore).toBeGreaterThanOrEqual(0);
        expect(data.data.overview.healthScore).toBeLessThanOrEqual(100);
        expect(data.data.overview.healthScore).toBeGreaterThan(80);
      });

      it('should include system statistics', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(data.data.system).toBeDefined();
        expect(data.data.system.uptime).toBeDefined();
        expect(data.data.system.timestamp).toBeDefined();
        expect(data.data.system.browser).toBeDefined();
      });

      it('should include overview metrics', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        const overview = data.data.overview;
        expect(overview.totalDocuments).toBe(150);
        expect(overview.totalVectors).toBe(3000);
        expect(overview.retrievalAccuracy).toBe(85.5);
        expect(overview.averageLatency).toBe(1500);
      });
    });

    describe('Detailed Statistics', () => {
      it('should include detailed statistics when detailed=true', async () => {
        mockContext.url = new URL('http://localhost:3000/api/admin/stats?detailed=true');
        mockContext.request = new Request(mockContext.url.toString());

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.detailed).toBeDefined();
        expect(data.data.detailed.corpus).toBeDefined();
        expect(data.data.detailed.embeddings).toBeDefined();
        expect(data.data.detailed.testHistory).toBeDefined();
        expect(data.data.detailed.trends).toBeDefined();
      });

      it('should calculate trends correctly', async () => {
        mockContext.url = new URL('http://localhost:3000/api/admin/stats?detailed=true');
        mockContext.request = new Request(mockContext.url.toString());

        const response = await GET(mockContext);
        const data = await response.json();

        const trends = data.data.detailed.trends;
        expect(trends).toBeDefined();
        expect(trends.scoresTrend).toBeDefined();
        expect(trends.passRatesTrend).toBeDefined();
        expect(trends.recentAverageScore).toBeDefined();
        expect(trends.recentAveragePassRate).toBeDefined();

        // Scores are improving (88.5 > 82.1)
        expect(trends.scoresTrend.direction).toBe('improving');
        expect(trends.scoresTrend.magnitude).toBeGreaterThan(0);
      });
    });

    describe('Section-Specific Statistics', () => {
      it('should return corpus section statistics', async () => {
        mockContext.url = new URL('http://localhost:3000/api/admin/stats?section=corpus');
        mockContext.request = new Request(mockContext.url.toString());

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.section).toBe('corpus');
        expect(data.data.totalDocuments).toBe(150);
        expect(data.timestamp).toBeDefined();
      });

      it('should return embeddings section statistics', async () => {
        mockContext.url = new URL('http://localhost:3000/api/admin/stats?section=embeddings');
        mockContext.request = new Request(mockContext.url.toString());

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.section).toBe('embeddings');
        expect(data.data.totalVectors).toBe(3000);
      });

      it('should return quality section statistics', async () => {
        mockContext.url = new URL('http://localhost:3000/api/admin/stats?section=quality');
        mockContext.request = new Request(mockContext.url.toString());

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.section).toBe('quality');
        expect(data.data.retrievalAccuracy).toBe(85.5);
      });

      it('should return detailed section statistics when detailed=true', async () => {
        mockContext.url = new URL('http://localhost:3000/api/admin/stats?section=corpus&detailed=true');
        mockContext.request = new Request(mockContext.url.toString());

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.overview.totalDocuments).toBe(150);
        expect(data.data.detailed).toBeDefined();
        expect(data.data.detailed.detailed).toBe(true);
      });

      it('should return 400 for invalid section', async () => {
        mockContext.url = new URL('http://localhost:3000/api/admin/stats?section=invalid');
        mockContext.request = new Request(mockContext.url.toString());

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid section. Valid sections: corpus, embeddings, quality');
      });
    });

    describe('CORS Headers', () => {
      it('should include CORS headers in successful responses', async () => {
        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('POST /api/admin/stats', () => {
    describe('Health Check Operation', () => {
      it('should perform health check successfully', async () => {
        mockContext.request = new Request('http://localhost:3000/api/admin/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'health_check' }),
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.status).toBeDefined();
        expect(data.data.checks).toBeDefined();
        expect(data.data.checks.corpus).toBeDefined();
        expect(data.data.checks.embeddings).toBeDefined();
        expect(data.data.checks.quality).toBeDefined();
        expect(data.data.checks.storage).toBeDefined();
        expect(data.message).toContain('Health check completed');
        expect(data.timestamp).toBeDefined();
      });

      it('should report healthy status with good metrics', async () => {
        mockContext.request = new Request('http://localhost:3000/api/admin/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'health_check' }),
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(data.data.status).toBe('healthy');
        expect(data.data.checks.corpus.status).toBe('healthy');
        expect(data.data.checks.embeddings.status).toBe('healthy');
        expect(data.data.checks.quality.status).toBe('healthy');
        expect(data.data.checks.storage.status).toBe('healthy');
      });
    });

    describe('Clear Cache Operation', () => {
      it('should clear all caches successfully', async () => {
        mockContext.request = new Request('http://localhost:3000/api/admin/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'clear_all_cache' }),
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('All caches cleared successfully');
        expect(data.timestamp).toBeDefined();
      });
    });

    describe('Invalid Operations', () => {
      it('should return 400 for invalid operation', async () => {
        mockContext.request = new Request('http://localhost:3000/api/admin/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'invalid_operation' }),
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid operation. Valid operations: health_check, clear_all_cache');
      });
    });

    describe('CORS Headers', () => {
      it('should include CORS headers in POST responses', async () => {
        mockContext.request = new Request('http://localhost:3000/api/admin/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'health_check' }),
        });

        const response = await POST(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('OPTIONS /api/admin/stats', () => {
    it('should handle OPTIONS request correctly', async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent requests properly', async () => {
      const promises = Array.from({ length: 3 }, () => GET(mockContext));
      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should validate timestamp consistency', async () => {
      const beforeTime = Date.now();
      const response = await GET(mockContext);
      const afterTime = Date.now();
      const data = await response.json();

      const responseTime = new Date(data.timestamp).getTime();
      expect(responseTime).toBeGreaterThanOrEqual(beforeTime);
      expect(responseTime).toBeLessThanOrEqual(afterTime);
    });

    it('should handle health score calculation edge cases', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      // Health score should be between 0 and 100
      expect(data.data.overview.healthScore).toBeGreaterThanOrEqual(0);
      expect(data.data.overview.healthScore).toBeLessThanOrEqual(100);
      
      // With our good mock data, should be quite high
      expect(data.data.overview.healthScore).toBeGreaterThan(75);
    });
  });
});