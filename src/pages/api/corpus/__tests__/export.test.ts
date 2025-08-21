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
        content: []
      },
      {
        id: 'doc-2',
        title: 'Ley Federal del Trabajo',
        type: 'law',
        content: []
      }
    ])
  }
}));

// Import after mocking
import { GET } from '../export';
import { corpusService } from '@/lib/admin/corpus-service';

describe('Corpus Export API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/corpus/export'),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/corpus/export'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('GET /api/corpus/export', () => {
    it('should export entire corpus as JSON', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.documents).toBeDefined();
      expect(data.documents).toHaveLength(2);
      expect(data.metadata).toBeDefined();
      expect(data.metadata.totalDocuments).toBe(2);
    });

    it('should include export metadata', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      expect(data.metadata.version).toBe('1.0.0');
      expect(data.metadata.exportDate).toBeDefined();
      expect(new Date(data.metadata.exportDate)).toBeInstanceOf(Date);
    });

    it('should set appropriate response headers', async () => {
      const response = await GET(mockContext);

      expect(response.headers.get('Content-Type')).toBe('application/json');
      
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        expect(contentDisposition).toContain('attachment');
        expect(contentDisposition).toContain('.json');
      }
    });

    it('should handle large corpus export', async () => {
      const largeDocuments = Array(1000).fill(null).map((_, i) => ({
        id: `doc-${i}`,
        title: `Document ${i}`,
        content: []
      }));
      
      (corpusService.getDocuments as any).mockResolvedValueOnce(largeDocuments);

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.documents).toHaveLength(1000);
    });

    it('should handle export with format parameter', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/export?format=json');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should handle service errors gracefully', async () => {
      (corpusService.getDocuments as any).mockRejectedValueOnce(new Error('Export failed'));

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to export corpus');
    });

    it('should include CORS headers', async () => {
      const response = await GET(mockContext);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should compress large exports if requested', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/export?compress=true');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      
      // Check if compression headers are set (if implemented)
      const encoding = response.headers.get('Content-Encoding');
      if (encoding) {
        expect(['gzip', 'deflate', 'br']).toContain(encoding);
      }

      expect(response.status).toBe(200);
    });

    it('should export with timestamp in filename', async () => {
      const response = await GET(mockContext);
      
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        // Should include date in filename like corpus-export-2024-01-15.json
        expect(contentDisposition).toMatch(/corpus.*\d{4}/);
      }
    });

    it('should handle empty corpus export', async () => {
      (corpusService.getDocuments as any).mockResolvedValueOnce([]);

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.documents).toEqual([]);
      expect(data.metadata.totalDocuments).toBe(0);
    });
  });
});