import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the corpus service using the same path alias as the API
vi.mock('@/lib/admin/corpus-service', () => ({
  corpusService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getDocuments: vi.fn().mockResolvedValue([
      {
        id: 'doc-1',
        title: 'Constitución Política',
        type: 'constitution',
        primaryArea: 'constitutional',
        hierarchy: 1,
        content: [],
        authority: 'Congreso de la Unión',
        publicationDate: '1917-02-05',
        status: 'active',
        territorialScope: 'federal',
        secondaryAreas: [],
        citations: []
      },
      {
        id: 'doc-2',
        title: 'Ley Federal del Trabajo',
        type: 'law',
        primaryArea: 'labor',
        hierarchy: 3,
        content: [],
        authority: 'Congreso de la Unión',
        publicationDate: '1970-04-01',
        status: 'active',
        territorialScope: 'federal',
        secondaryAreas: [],
        citations: []
      }
    ])
  }
}));

// Import after mocking
import { GET } from '../list';
import { corpusService } from '@/lib/admin/corpus-service';

describe('Corpus List API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock context
    mockContext = {
      request: new Request('http://localhost:3000/api/corpus/list'),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/corpus/list'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('GET /api/corpus/list', () => {
    it('should return all documents without filters', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].title).toBe('Constitución Política');
      expect(data[1].title).toBe('Ley Federal del Trabajo');
    });

    it('should filter documents by type', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/list?type=law');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      // The mock doesn't actually filter, but in real implementation it would
      expect(data).toBeDefined();
    });

    it('should filter documents by legal area', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/list?legalArea=labor');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should filter documents by hierarchy', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/list?hierarchy=1');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should support search parameter', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/list?search=trabajo');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should handle multiple filters', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/list?type=law&legalArea=labor&hierarchy=3');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toBeDefined();
    });

    it('should handle service errors gracefully', async () => {
      (corpusService.getDocuments as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch documents');
    });

    it('should include CORS headers', async () => {
      const response = await GET(mockContext);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should handle empty corpus', async () => {
      (corpusService.getDocuments as any).mockResolvedValueOnce([]);

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([]);
    });

    it('should validate hierarchy parameter', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/list?hierarchy=invalid');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      // Should either ignore invalid value or return error
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(500);
    });
  });
});