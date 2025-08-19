import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the AdminDataService class
vi.mock('../../../../lib/admin/admin-data-service', () => {
  const mockAdminDataService = {
    getQualityStats: vi.fn().mockResolvedValue({
      totalQueries: 150,
      averageResponseTime: 1800,
      averageRelevanceScore: 0.87,
      topPerformingAreas: ['labor', 'civil', 'constitutional'],
      queryDistribution: {
        citation: 45,
        semantic: 60,
        complex: 30,
        simple: 15
      },
      recentTrends: {
        dailyQueries: [12, 15, 18, 22, 19, 16, 14],
        averageScores: [0.85, 0.86, 0.88, 0.87, 0.89, 0.86, 0.87]
      },
      lastUpdated: '2024-01-15T10:30:00Z'
    })
  };

  return {
    AdminDataService: vi.fn().mockImplementation(() => mockAdminDataService),
    adminDataService: mockAdminDataService
  };
});

// Mock the QualityTestSuite class
vi.mock('../../../../lib/admin/quality-test-suite', () => {
  const mockStoredResults = [
    {
      suiteName: 'Mexican Legal Quality Suite',
      totalTests: 15,
      passedTests: 12,
      averageScore: 0.82,
      totalDuration: 18000,
      results: [
        {
          testId: 'citation-art-123',
          passed: true,
          score: 0.95,
          duration: 1200,
          details: [],
          timestamp: Date.now()
        },
        {
          testId: 'semantic-labor',
          passed: true,
          score: 0.88,
          duration: 1500,
          details: [],
          timestamp: Date.now()
        }
      ],
      timestamp: Date.now()
    },
    {
      suiteName: 'Mexican Legal Quality Suite',
      totalTests: 15,
      passedTests: 10,
      averageScore: 0.78,
      totalDuration: 19500,
      results: [],
      timestamp: Date.now() - 86400000 // 1 day ago
    }
  ];

  const mockQualityTestSuite = {
    getStoredResults: vi.fn().mockReturnValue(mockStoredResults),
    getAvailableTests: vi.fn().mockReturnValue([
      {
        id: 'citation-art-123',
        name: 'Artículo 123 Constitucional',
        description: 'Test retrieval accuracy for constitutional labor article',
        category: 'citation',
        query: 'Artículo 123 constitucional',
        timeout: 5000
      },
      {
        id: 'semantic-labor-rights',
        name: 'Labor Rights Semantic Search',
        description: 'Test semantic understanding of labor law concepts',
        category: 'semantic',
        query: 'derechos laborales trabajadores',
        timeout: 10000
      }
    ]),
    getCategories: vi.fn().mockReturnValue(['citation', 'semantic', 'cross-reference', 'contradiction', 'performance']),
    getTestsByCategory: vi.fn().mockImplementation((category: string) => {
      if (category === 'citation') {
        return [
          { id: 'citation-art-123', name: 'Artículo 123 Constitucional', category: 'citation' },
          { id: 'citation-art-14', name: 'Artículo 14 Constitucional', category: 'citation' }
        ];
      }
      if (category === 'semantic') {
        return [
          { id: 'semantic-labor-rights', name: 'Labor Rights Semantic Search', category: 'semantic' }
        ];
      }
      return [];
    })
  };

  return {
    QualityTestSuite: vi.fn().mockImplementation(() => mockQualityTestSuite),
    qualityTestSuite: mockQualityTestSuite
  };
});

// Mock localStorage for testing
const mockLocalStorage = {
  removeItem: vi.fn(),
  getItem: vi.fn(),
  setItem: vi.fn()
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Import after mocking
import { GET, POST, OPTIONS } from '../metrics';

describe('Quality Metrics API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.removeItem.mockClear();

    mockContext = {
      request: new Request('http://localhost:3000/api/quality/metrics', {
        method: 'GET'
      }),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/quality/metrics'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('GET /api/quality/metrics', () => {
    describe('Basic Metrics', () => {
      it('should return basic quality metrics', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.totalQueries).toBe(150);
        expect(data.data.averageResponseTime).toBe(1800);
        expect(data.data.averageRelevanceScore).toBe(0.87);
        expect(data.data.topPerformingAreas).toEqual(['labor', 'civil', 'constitutional']);
        expect(data.data.lastTestRun).toBeDefined();
        expect(data.data.lastTestRun.passRate).toBe(80); // 12/15 * 100
        expect(data.data.lastTestRun.averageScore).toBe(82); // 0.82 * 100
        expect(data.timestamp).toBeDefined();
      });

      it('should handle case when no test results exist', async () => {
        const { qualityTestSuite } = await import('../../../../lib/admin/quality-test-suite');
        qualityTestSuite.getStoredResults = vi.fn().mockReturnValue([]);

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.lastTestRun).toBeNull();
      });
    });

    describe('Detailed Metrics', () => {
      it('should return detailed metrics when requested', async () => {
        mockContext.url = new URL('http://localhost:3000/api/quality/metrics?detailed=true');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.current).toBeDefined();
        expect(data.data.testInfo).toBeDefined();
        expect(data.data.testInfo.totalAvailableTests).toBe(2);
        expect(data.data.testInfo.categories).toHaveLength(5);
        expect(data.data.testInfo.testsByCategory).toBeDefined();
        expect(data.data.testInfo.testsByCategory.citation).toBe(2);
        expect(data.data.testInfo.testsByCategory.semantic).toBe(1);
        expect(data.data.history).toBeDefined();
        expect(data.data.history.totalRuns).toBe(2);
        expect(data.data.history.latestRun).toBeDefined();
      });

      it('should include historical trends when requested', async () => {
        mockContext.url = new URL('http://localhost:3000/api/quality/metrics?detailed=true&historical=true');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.trends).toBeDefined();
        expect(data.data.trends.scoreProgress).toBeDefined();
        expect(data.data.trends.categoryPerformance).toBeDefined();
        expect(Array.isArray(data.data.trends.scoreProgress)).toBe(true);
        expect(data.data.trends.scoreProgress.length).toBeGreaterThan(0);
      });

      it('should handle no trends when historical=true but insufficient data', async () => {
        const { qualityTestSuite } = await import('../../../../lib/admin/quality-test-suite');
        qualityTestSuite.getStoredResults = vi.fn().mockReturnValue([
          {
            suiteName: 'Test Suite',
            totalTests: 5,
            passedTests: 4,
            averageScore: 0.8,
            totalDuration: 5000,
            results: [],
            timestamp: Date.now()
          }
        ]);

        mockContext.url = new URL('http://localhost:3000/api/quality/metrics?detailed=true&historical=true');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.trends).toBeNull();
      });
    });

    describe('Query Parameters', () => {
      it('should handle detailed=false parameter', async () => {
        mockContext.url = new URL('http://localhost:3000/api/quality/metrics?detailed=false');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.testInfo).toBeUndefined();
        expect(data.data.history).toBeUndefined();
        expect(data.data.trends).toBeUndefined();
      });

      it('should handle historical=false parameter', async () => {
        mockContext.url = new URL('http://localhost:3000/api/quality/metrics?detailed=true&historical=false');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.trends).toBeNull();
      });
    });

    describe('Error Handling', () => {
      it('should handle service errors gracefully', async () => {
        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        adminDataService.getQualityStats = vi.fn().mockRejectedValue(new Error('Service unavailable'));

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Service unavailable');
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
        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        adminDataService.getQualityStats = vi.fn().mockRejectedValue(new Error('Service error'));

        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('POST /api/quality/metrics', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'refresh_metrics' })
      });
    });

    describe('Refresh Metrics Operation', () => {
      it('should refresh quality metrics', async () => {
        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data).toBeDefined();
        expect(data.data.totalQueries).toBe(150);
        expect(data.message).toBe('Quality metrics refreshed successfully');
        expect(data.timestamp).toBeDefined();
      });

      it('should handle refresh metrics service error', async () => {
        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        adminDataService.getQualityStats = vi.fn().mockRejectedValue(new Error('Refresh failed'));

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Refresh failed');
      });
    });

    describe('Reset Query History Operation', () => {
      it('should reset query history', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'reset_query_history' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Query history reset successfully. Metrics will reflect new data on next calculation.');
        expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('lexmx_query_history');
      });

      it('should handle localStorage error gracefully', async () => {
        mockLocalStorage.removeItem.mockImplementation(() => {
          throw new Error('Storage error');
        });

        mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'reset_query_history' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Query history reset successfully. Metrics will reflect new data on next calculation.');
      });
    });

    describe('Invalid Operations', () => {
      it('should handle invalid operation', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'invalid_operation' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid operation. Valid operations: refresh_metrics, reset_query_history');
      });

      it('should handle missing operation', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid operation. Valid operations: refresh_metrics, reset_query_history');
      });
    });

    describe('Request Validation', () => {
      it('should handle malformed JSON', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json'
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it('should handle empty request body', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });
    });

    describe('CORS Headers', () => {
      it('should include CORS headers in successful POST response', async () => {
        const response = await POST(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should include CORS headers in POST error response', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json'
        });

        const response = await POST(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('OPTIONS /api/quality/metrics', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/quality/metrics', {
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