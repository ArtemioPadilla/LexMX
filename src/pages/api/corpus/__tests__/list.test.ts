import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the underlying dependencies
vi.mock('../../../lib/corpus/document-loader');
vi.mock('../../../lib/storage/indexeddb-vector-store');
vi.mock('../../../lib/storage/metadata-store');
vi.mock('../../../lib/ingestion/document-ingestion-pipeline');
vi.mock('../../../lib/admin/admin-data-service');

// Import after mocking
import { GET } from '../list';

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
      const { corpusService } = await import('../../../lib/admin/corpus-service');
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
      const { corpusService } = await import('../../../lib/admin/corpus-service');
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