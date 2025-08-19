import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the service with exact path matching API import
vi.mock('../../../lib/admin/embeddings-service', () => {
  const mockEmbeddingsService = {
    initialize: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn().mockResolvedValue({
      success: true,
      documentId: 'doc-1',
      embeddingsGenerated: 25,
      duration: 1500,
      tokensPerSecond: 16.7
    }),
    generateAllEmbeddings: vi.fn().mockResolvedValue({
      totalDocuments: 10,
      successfulDocuments: 8,
      failedDocuments: 2,
      errors: [],
      averageDuration: 1500,
      totalDuration: 15000
    }),
    testProvider: vi.fn().mockResolvedValue({
      success: true,
      provider: 'transformers',
      dimensions: 384,
      latency: 150,
      testQuery: 'test query',
      responseTime: 150
    }),
    switchProvider: vi.fn().mockResolvedValue(undefined),
    clearEmbeddings: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      totalVectors: 1000,
      storageSize: 5242880,
      averageGenerationTime: 50,
      modelsAvailable: ['transformers', 'openai', 'mock'],
      currentModel: 'transformers',
      indexStatus: 'ready'
    }),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  };

  return {
    EmbeddingsService: vi.fn().mockImplementation(() => mockEmbeddingsService),
    embeddingsService: mockEmbeddingsService
  };
});

// Import after mocking
import { POST, GET, OPTIONS } from '../generate';

describe('Embeddings Generate API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    // Don't use vi.clearAllMocks() as it clears mock implementations
    // Instead just reset call history for specific mocks if needed

    mockContext = {
      request: new Request('http://localhost:3000/api/embeddings/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: 'doc-1' })
      }),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/embeddings/generate'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('POST /api/embeddings/generate', () => {
    describe('Single Document Generation', () => {
      it('should generate embeddings for a single document', async () => {
        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('single');
        expect(data.data.result.documentId).toBe('doc-1');
        expect(data.data.result.embeddingsGenerated).toBe(25);
        expect(data.message).toContain('Generated 25 embeddings for document doc-1');
      });

      it('should use default provider when not specified', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'doc-1' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        // Default provider is 'transformers'
      });

      it('should use specified provider', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            documentId: 'doc-1',
            provider: 'openai'
          })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('should handle document not found error', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'non-existent' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Document not found');
      });

      it('should handle embedding generation error', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'error-doc' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Failed to generate embeddings for document');
      });
    });

    describe('Batch Generation', () => {
      it('should generate embeddings for all documents', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generateAll: true })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('batch');
        expect(data.data.result.totalDocuments).toBe(10);
        expect(data.data.result.successfulDocuments).toBe(8);
        expect(data.data.result.failedDocuments).toBe(2);
        expect(data.message).toContain('Generated embeddings for 8/10 documents');
      });

      it('should use custom batch size', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            generateAll: true,
            batchSize: 10
          })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.type).toBe('batch');
      });

      it('should use default batch size when not specified', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ generateAll: true })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        // Default batch size is 5
      });

      it('should handle invalid batch size', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            generateAll: true,
            batchSize: 0
          })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Batch size must be at least 1');
      });
    });

    describe('Request Validation', () => {
      it('should return 400 when neither documentId nor generateAll is provided', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Either documentId or generateAll=true must be provided');
      });

      it('should handle malformed JSON', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
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
    });

    describe('Provider Support', () => {
      it('should work with transformers provider', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            documentId: 'doc-1',
            provider: 'transformers'
          })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('should work with openai provider', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            documentId: 'doc-1',
            provider: 'openai'
          })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
      });

      it('should work with mock provider', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            documentId: 'doc-1',
            provider: 'mock'
          })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
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
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documentId: 'error-doc' })
        });

        const response = await POST(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('GET /api/embeddings/generate', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/embeddings/generate?test=Test legal query', {
        method: 'GET'
      });
      mockContext.url = new URL('http://localhost:3000/api/embeddings/generate?test=Test legal query');
    });

    describe('Provider Capabilities Check', () => {
      it('should test provider capabilities with default query', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
          method: 'GET'
        });
        mockContext.url = new URL('http://localhost:3000/api/embeddings/generate');

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.testQuery).toBe('Test legal query');
        expect(data.data.provider).toBe('transformers');
        expect(data.data.embeddingLength).toBe(384);
        expect(data.message).toContain('Test completed with transformers provider');
      });

      it('should test provider capabilities with custom query', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.testQuery).toBe('Test legal query');
        expect(data.data.capabilities).toBeDefined();
        expect(data.data.capabilities.dimensions).toBe(384);
        expect(data.data.capabilities.maxTokens).toBe(512);
      });

      it('should test with specified provider', async () => {
        mockContext.url = new URL('http://localhost:3000/api/embeddings/generate?provider=openai&test=Custom query');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.data.testQuery).toBe('Custom query');
        expect(data.message).toContain('Test completed with openai provider');
      });

      it('should handle provider test failure', async () => {
        mockContext.url = new URL('http://localhost:3000/api/embeddings/generate?test=error query');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Provider test failed');
      });

      it('should include response time metrics', async () => {
        const response = await GET(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.data.responseTime).toBeDefined();
        expect(typeof data.data.responseTime).toBe('number');
        expect(data.data.responseTime).toBeGreaterThan(0);
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
        mockContext.url = new URL('http://localhost:3000/api/embeddings/generate?test=error query');
        mockContext.request = new Request(mockContext.url.toString(), { method: 'GET' });

        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('OPTIONS /api/embeddings/generate', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/embeddings/generate', {
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