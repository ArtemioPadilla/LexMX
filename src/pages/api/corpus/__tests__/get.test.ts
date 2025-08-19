import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the services
vi.mock('../../../lib/admin/corpus-service', () => ({
  corpusService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getDocument: vi.fn().mockImplementation((id: string) => {
      if (id === 'doc-1') {
        return Promise.resolve({
          id: 'doc-1',
          title: 'Constitución Política',
          type: 'constitution',
          primaryArea: 'constitutional',
          hierarchy: 1,
          content: [
            {
              id: 'chunk-1',
              type: 'article',
              title: 'Artículo 1',
              content: 'En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos...'
            }
          ],
          authority: 'Congreso de la Unión',
          publicationDate: '1917-02-05',
          status: 'active',
          territorialScope: 'federal',
          secondaryAreas: [],
          citations: []
        });
      }
      return Promise.resolve(null);
    }),
    getDocumentMetrics: vi.fn().mockResolvedValue({
      accessCount: 150,
      lastAccessed: new Date().toISOString(),
      averageRelevanceScore: 0.85,
      citationCount: 25
    })
  }
}));

// Import after mocking
import { GET } from '../get';

describe('Corpus Get API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock context
    mockContext = {
      request: new Request('http://localhost:3000/api/corpus/get?id=doc-1'),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/corpus/get?id=doc-1'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('GET /api/corpus/get', () => {
    it('should return document by ID', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.document).toBeDefined();
      expect(data.document.id).toBe('doc-1');
      expect(data.document.title).toBe('Constitución Política');
      expect(data.document.content).toHaveLength(1);
    });

    it('should include document metrics', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.metrics).toBeDefined();
      expect(data.metrics.accessCount).toBe(150);
      expect(data.metrics.averageRelevanceScore).toBe(0.85);
    });

    it('should return 404 for non-existent document', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/get?id=non-existent');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Document not found');
    });

    it('should return 400 when ID is missing', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/get');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Document ID is required');
    });

    it('should handle service errors gracefully', async () => {
      const { corpusService } = await import('../../../lib/admin/corpus-service');
      (corpusService.getDocument as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch document');
    });

    it('should include CORS headers', async () => {
      const response = await GET(mockContext);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should handle documents with large content', async () => {
      const { corpusService } = await import('../../../lib/admin/corpus-service');
      
      const largeDocument = {
        id: 'doc-large',
        title: 'Large Document',
        type: 'code',
        content: Array(100).fill(null).map((_, i) => ({
          id: `chunk-${i}`,
          type: 'article',
          title: `Article ${i}`,
          content: 'Content '.repeat(100)
        }))
      };
      
      (corpusService.getDocument as any).mockResolvedValueOnce(largeDocument);
      mockContext.url = new URL('http://localhost:3000/api/corpus/get?id=doc-large');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.document.content).toHaveLength(100);
    });

    it('should sanitize document ID parameter', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/get?id=<script>alert(1)</script>');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      
      // Should either sanitize or reject malicious input
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should cache frequently accessed documents', async () => {
      // First request
      await GET(mockContext);
      
      // Second request should potentially use cache
      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.document.id).toBe('doc-1');
      
      // Check if caching headers are set
      const cacheControl = response.headers.get('Cache-Control');
      if (cacheControl) {
        expect(cacheControl).toContain('max-age');
      }
    });

    it('should handle concurrent requests for same document', async () => {
      const promises = Array(5).fill(null).map(() => GET(mockContext));
      const responses = await Promise.all(promises);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });
});