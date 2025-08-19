import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the services
vi.mock('../../../../lib/admin/embeddings-service', () => {
  const mockEmbeddingsService = {
    clearEmbeddings: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        clearedVectors: 1250,
        clearedDocuments: 45,
        timeElapsed: 750,
        success: true
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
    clearEmbeddingsCache: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        clearedCacheEntries: 125,
        freedMemory: 51200, // 50KB
        timeElapsed: 150,
        success: true
      });
    }),
    rebuildIndex: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        rebuiltDocuments: 45,
        indexSize: 65536, // 64KB
        timeElapsed: 2500,
        success: true
      });
    })
  };

  return {
    AdminDataService: vi.fn().mockImplementation(() => mockAdminDataService),
    adminDataService: mockAdminDataService
  };
});

// Import after mocking
import { DELETE, POST, OPTIONS } from '../clear';

describe('Embeddings Clear API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/embeddings/clear', {
        method: 'DELETE'
      }),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/embeddings/clear'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('DELETE /api/embeddings/clear', () => {
    describe('Clear All Embeddings (Default)', () => {
      it('should clear all embeddings by default', async () => {
        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('All embeddings cleared successfully');
        expect(data.operation).toBe('clear_all');
      });

      it('should clear all embeddings with empty JSON body', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.operation).toBe('clear_all');
      });

      it('should handle missing JSON body gracefully', async () => {
        // Request without body should not throw error
        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.operation).toBe('clear_all');
      });

      it('should handle malformed JSON body gracefully', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json'
        });

        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.operation).toBe('clear_all');
      });
    });

    describe('Clear Cache Option', () => {
      it('should clear embeddings cache when clearCache=true', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clearCache: true })
        });

        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Embeddings cache cleared successfully');
        expect(data.operation).toBe('clear_cache');
      });

      it('should clear all embeddings when clearCache=false', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clearCache: false })
        });

        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.operation).toBe('clear_all');
      });
    });

    describe('Error Handling', () => {
      it('should handle embeddings service error', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.clearEmbeddings.mockRejectedValue(new Error('Failed to clear embeddings'));

        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Failed to clear embeddings');
      });

      it('should handle admin service error for cache clearing', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clearCache: true })
        });

        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        adminDataService.clearEmbeddingsCache.mockRejectedValue(new Error('Cache clear failed'));

        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Cache clear failed');
      });

      it('should handle generic error', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.clearEmbeddings.mockRejectedValue('Unexpected error');

        const response = await DELETE(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Failed to clear embeddings');
      });
    });

    describe('CORS Headers', () => {
      it('should include CORS headers in successful response', async () => {
        const response = await DELETE(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, POST, DELETE, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should include CORS headers in error response', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.clearEmbeddings.mockRejectedValue(new Error('Service error'));

        const response = await DELETE(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('POST /api/embeddings/clear', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'clear_all' })
      });
    });

    describe('Clear All Operation', () => {
      it('should clear all embeddings with clear_all operation', async () => {
        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('All embeddings cleared successfully');
        expect(data.operation).toBe('clear_all');
      });
    });

    describe('Clear Cache Operation', () => {
      it('should clear embeddings cache with clear_cache operation', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'clear_cache' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Embeddings cache cleared successfully');
        expect(data.operation).toBe('clear_cache');
      });
    });

    describe('Rebuild Index Operation', () => {
      it('should rebuild embeddings index with rebuild_index operation', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'rebuild_index' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.message).toBe('Embeddings index rebuilt successfully');
        expect(data.operation).toBe('rebuild_index');
      });
    });

    describe('Invalid Operations', () => {
      it('should return 400 for invalid operation', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'invalid_operation' })
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid operation. Valid operations: clear_all, clear_cache, rebuild_index');
      });

      it('should return 400 for missing operation', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Invalid operation. Valid operations: clear_all, clear_cache, rebuild_index');
      });

      it('should handle malformed JSON in POST', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
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

    describe('Operation Error Handling', () => {
      it('should handle clear_all operation error', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.clearEmbeddings.mockRejectedValue(new Error('Clear all failed'));

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Clear all failed');
      });

      it('should handle clear_cache operation error', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'clear_cache' })
        });

        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        adminDataService.clearEmbeddingsCache.mockRejectedValue(new Error('Clear cache failed'));

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Clear cache failed');
      });

      it('should handle rebuild_index operation error', async () => {
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'rebuild_index' })
        });

        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        adminDataService.rebuildIndex.mockRejectedValue(new Error('Rebuild index failed'));

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toContain('Rebuild index failed');
      });

      it('should handle generic operation error', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.clearEmbeddings.mockRejectedValue('Unexpected error');

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Failed to perform embeddings operation');
      });
    });

    describe('Progress Events', () => {
      it('should handle operations that might emit progress events', async () => {
        // Mock a long-running operation that might emit progress
        mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operation: 'rebuild_index' })
        });

        const { adminDataService } = await import('../../../../lib/admin/admin-data-service');
        
        // Simulate operation with progress
        adminDataService.rebuildIndex.mockImplementation(() => {
          return new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                rebuiltDocuments: 45,
                indexSize: 65536,
                timeElapsed: 2500,
                success: true,
                progress: [
                  { stage: 'analyzing', progress: 25 },
                  { stage: 'indexing', progress: 75 },
                  { stage: 'completed', progress: 100 }
                ]
              });
            }, 10);
          });
        });

        const response = await POST(mockContext);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.operation).toBe('rebuild_index');
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

      it('should include CORS headers in error POST response', async () => {
        const { embeddingsService } = await import('../../../../lib/admin/embeddings-service');
        embeddingsService.clearEmbeddings.mockRejectedValue(new Error('Service error'));

        const response = await POST(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });
    });
  });

  describe('OPTIONS /api/embeddings/clear', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/embeddings/clear', {
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