import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the qualityTestSuite instance
vi.mock('../../../../lib/admin/quality-test-suite', () => ({
  qualityTestSuite: {
    initialize: vi.fn().mockResolvedValue(undefined),
    runTest: vi.fn().mockImplementation((testId: string) => {
      if (testId === 'citation-art-123') {
        return Promise.resolve({
          testId: 'citation-art-123',
          passed: true,
          score: 0.95,
          duration: 1200,
          details: [
            {
              expectation: { type: 'contains_text', value: 'derecho al trabajo', description: 'Should contain labor rights text' },
              passed: true,
              actualValue: 'Found: derecho al trabajo',
              score: 1.0,
              message: 'Text found successfully'
            }
          ],
          response: {
            answer: 'El artículo 123 constitucional establece el derecho al trabajo...',
            confidence: 0.95,
            sources: ['constitucion-politica-mexico.json'],
            legalArea: 'labor',
            queryType: 'citation'
          },
          timestamp: Date.now()
        });
      }
      if (testId === 'slow-test') {
        return new Promise(resolve => {
          setTimeout(() => resolve({
            testId: 'slow-test',
            passed: false,
            score: 0.2,
            duration: 15000,
            details: [],
            error: 'Test timed out',
            timestamp: Date.now()
          }), 100);
        });
      }
      if (testId === 'error-test') {
        throw new Error('Test execution failed');
      }
      throw new Error('Test not found');
    }),
    runTestsByCategory: vi.fn().mockImplementation((category: string) => {
      if (category === 'citation') {
        return Promise.resolve({
          suiteName: 'citation Tests',
          totalTests: 3,
          passedTests: 2,
          averageScore: 0.75,
          totalDuration: 3600,
          timestamp: Date.now(),
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
              testId: 'citation-art-14',
              passed: true,
              score: 0.88,
              duration: 1100,
              details: [],
              timestamp: Date.now()
            },
            {
              testId: 'citation-art-1',
              passed: false,
              score: 0.42,
              duration: 1300,
              details: [],
              timestamp: Date.now()
            }
          ]
        });
      }
      if (category === 'invalid') {
        throw new Error('Invalid category');
      }
      return Promise.resolve({
        suiteName: `${category} Tests`,
        totalTests: 0,
        passedTests: 0,
        averageScore: 0,
        totalDuration: 0,
        timestamp: Date.now(),
        results: []
      });
    }),
    runAllTests: vi.fn().mockResolvedValue({
      suiteName: 'Mexican Legal Quality Suite',
      totalTests: 15,
      passedTests: 12,
      averageScore: 0.82,
      totalDuration: 18000,
      results: Array.from({ length: 15 }, (_, i) => ({
        testId: `test-${i + 1}`,
        passed: i < 12,
        score: i < 12 ? 0.8 + Math.random() * 0.2 : 0.3 + Math.random() * 0.4,
        duration: 1000 + Math.random() * 1000,
        details: [],
        timestamp: Date.now()
      })),
      timestamp: Date.now()
    }),
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
        id: 'citation-art-14',
        name: 'Artículo 14 Constitucional',
        description: 'Test retrieval accuracy for constitutional article 14',
        category: 'citation',
        query: 'Artículo 14 constitucional',
        timeout: 5000
      }
    ]),
    getCategories: vi.fn().mockReturnValue(['citation']),
    getTestsByCategory: vi.fn().mockImplementation((category: string) => {
      if (category === 'citation') {
        return [
          {
            id: 'citation-art-123',
            name: 'Artículo 123 Constitucional',
            category: 'citation'
          },
          {
            id: 'citation-art-14',
            name: 'Artículo 14 Constitucional',
            category: 'citation'
          }
        ];
      }
      return [];
    })
  }
}));

// Import after mocking
import { POST, GET, OPTIONS } from '../test';

describe('Quality Test API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/quality/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId: 'citation-art-123' })
      }),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/quality/test'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('POST /api/quality/test', () => {
    describe('Single Test Execution', () => {
      it('should run a single test by ID', async () => {
        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('single');
        expect(data.data.testId).toBe('citation-art-123');
        expect(data.data.result.passed).toBe(true);
        expect(data.data.result.score).toBe(0.95);
        expect(data.data.message).toContain('Test citation-art-123: PASSED (95.0%)');
      });

      it('should handle test not found error', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: 'non-existent' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Test not found');
      });

      it('should handle test execution error', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: 'error-test' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Test execution failed');
      });

      it('should handle timeout scenario', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: 'slow-test' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.result.passed).toBe(false);
        expect(data.data.result.duration).toBeGreaterThan(10000);
      });
    });

    describe('Category Test Execution', () => {
      it('should run tests by category', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'citation' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('category');
        expect(data.data.category).toBe('citation');
        expect(data.data.results.totalTests).toBe(3);
        expect(data.data.results.passedTests).toBe(2);
        expect(data.data.message).toContain('Completed 3 citation tests (2 passed)');
      });

      it('should handle invalid category', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'invalid' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Invalid category');
      });

      it('should handle empty category results', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category: 'empty' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.results.totalTests).toBe(0);
        expect(data.data.results.passedTests).toBe(0);
      });
    });

    describe('Full Suite Execution', () => {
      it('should run all tests in the suite', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runAll: true })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('full_suite');
        expect(data.data.results.totalTests).toBe(15);
        expect(data.data.results.passedTests).toBe(12);
        expect(data.data.results.averageScore).toBe(0.82);
        expect(data.data.message).toContain('Completed 15 tests (12 passed)');
      });

      it('should prioritize runAll over other parameters', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runAll: true, testId: 'citation-art-123', category: 'citation' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('full_suite');
        expect(data.data.results.totalTests).toBe(15);
      });
    });

    describe('Request Validation', () => {
      it('should return 400 when no test parameters provided', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Either testId, category, or runAll=true must be provided');
      });

      it('should handle malformed JSON', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json'
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it('should handle missing request body', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });
    });

    describe('CORS Headers', () => {
      it('should include CORS headers in successful response', async () => {
        const response = await POST(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should include CORS headers in error response', async () => {
        mockContext.request = new Request('http://localhost:3000/api/quality/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ testId: 'error-test' })
        });

        const response = await POST(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('GET /api/quality/test', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/quality/test', {
        method: 'GET'
      });
      mockContext.url = new URL('http://localhost:3000/api/quality/test');
    });

    describe('List Available Tests', () => {
      it('should return all available tests', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.tests).toHaveLength(2);
        expect(data.data.categories).toHaveLength(1);
        expect(data.data.totalTests).toBe(2);
        expect(data.data.testsByCategory).toBeDefined();
        expect(data.data.testsByCategory.citation).toBe(2);
      });

      it('should return tests by category when specified', async () => {
        mockContext.url = new URL('http://localhost:3000/api/quality/test?category=citation');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.category).toBe('citation');
        expect(data.data.tests).toHaveLength(2);
        expect(data.data.count).toBe(2);
      });

      it('should return empty array for non-existent category', async () => {
        mockContext.url = new URL('http://localhost:3000/api/quality/test?category=nonexistent');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.category).toBe('nonexistent');
        expect(data.data.tests).toHaveLength(0);
        expect(data.data.count).toBe(0);
      });

      it('should include test details in response', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        const firstTest = data.data.tests[0];
        expect(firstTest).toHaveProperty('id');
        expect(firstTest).toHaveProperty('name');
        expect(firstTest).toHaveProperty('description');
        expect(firstTest).toHaveProperty('category');
        expect(firstTest).toHaveProperty('query');
        expect(firstTest).toHaveProperty('timeout');
      });
    });

    describe('Error Handling', () => {
      it('should handle service errors gracefully', async () => {
        // Mock a service error
        const { qualityTestSuite } = await import('../../../../lib/admin/quality-test-suite');
        qualityTestSuite.getAvailableTests = vi.fn().mockImplementation(() => {
          throw new Error('Service unavailable');
        });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Service unavailable');
      });
    });

    describe('CORS Headers', () => {
      it('should include CORS headers in GET response', async () => {
        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should include CORS headers in GET error response', async () => {
        const { qualityTestSuite } = await import('../../../../lib/admin/quality-test-suite');
        qualityTestSuite.getAvailableTests = vi.fn().mockImplementation(() => {
          throw new Error('Service error');
        });

        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('OPTIONS /api/quality/test', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/quality/test', {
        method: 'OPTIONS'
      });
    });

    it('should handle OPTIONS request for CORS preflight', async () => {
      const response = await OPTIONS(mockContext);

      expect(response.status).toBe(204);
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