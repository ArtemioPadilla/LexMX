import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Import after mocking (no services to mock for this endpoint)
import { GET, OPTIONS } from '../export';

describe('Embeddings Export API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/embeddings/export', {
        method: 'GET'
      }),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/embeddings/export'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('GET /api/embeddings/export', () => {
    describe('Export Functionality', () => {
      it('should return export metadata structure', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(response.status).toBe(200);
        expect(data.version).toBe('1.0.0');
        expect(data.exportDate).toBeDefined();
        expect(new Date(data.exportDate)).toBeInstanceOf(Date);
        expect(data.model).toBe('transformers/all-MiniLM-L6-v2');
        expect(data.dimensions).toBe(384);
        expect(data.exportedBy).toBe('LexMX Admin Panel');
      });

      it('should include instructional message about client-side handling', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(response.status).toBe(200);
        expect(data.message).toContain('Embeddings export should be handled client-side due to IndexedDB limitations');
        expect(data.instructions).toContain('Use the admin panel to export embeddings from the browser');
      });

      it('should format export date correctly', async () => {
        const beforeRequest = new Date();
        const response = await GET(mockContext);
        const afterRequest = new Date();
        const data = JSON.parse(await response.text());

        const exportDate = new Date(data.exportDate);
        expect(exportDate.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
        expect(exportDate.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
        expect(data.exportDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      });

      it('should include model specifications', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(response.status).toBe(200);
        expect(data.model).toBe('transformers/all-MiniLM-L6-v2');
        expect(data.dimensions).toBe(384);
        expect(typeof data.dimensions).toBe('number');
        expect(data.dimensions).toBeGreaterThan(0);
      });
    });

    describe('Response Headers', () => {
      it('should include proper Content-Type header', async () => {
        const response = await GET(mockContext);

        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should include download filename in Content-Disposition', async () => {
        const response = await GET(mockContext);
        const contentDisposition = response.headers.get('Content-Disposition');

        expect(contentDisposition).toBeDefined();
        expect(contentDisposition).toContain('attachment');
        expect(contentDisposition).toContain('filename="embeddings-export-');
        expect(contentDisposition).toContain('.json"');
      });

      it('should include current date in filename', async () => {
        const response = await GET(mockContext);
        const contentDisposition = response.headers.get('Content-Disposition');
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

        expect(contentDisposition).toContain(`embeddings-export-${today}.json`);
      });

      it('should include CORS headers', async () => {
        const response = await GET(mockContext);

        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
        expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
      });
    });

    describe('Large Export Handling', () => {
      it('should handle export response efficiently for browser downloads', async () => {
        const response = await GET(mockContext);
        const text = await response.text();

        // Should be properly formatted JSON
        expect(() => JSON.parse(text)).not.toThrow();
        
        // Should be compact enough for browser handling
        const data = JSON.parse(text);
        expect(Object.keys(data)).toContain('version');
        expect(Object.keys(data)).toContain('exportDate');
        expect(Object.keys(data)).toContain('message');
        expect(Object.keys(data)).toContain('instructions');
      });

      it('should provide proper JSON formatting', async () => {
        const response = await GET(mockContext);
        const text = await response.text();

        // Should be formatted with 2-space indentation
        expect(text).toContain('{\n  "version"');
        expect(text).toContain('\n}');
        
        // Verify it's properly formatted JSON
        const parsed = JSON.parse(text);
        const reformatted = JSON.stringify(parsed, null, 2);
        expect(text).toBe(reformatted);
      });
    });

    describe('Server-Side Limitations', () => {
      it('should acknowledge IndexedDB limitations in server environment', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(response.status).toBe(200);
        expect(data.message).toContain('IndexedDB limitations');
        expect(data.instructions).toContain('admin panel');
      });

      it('should provide alternative for client-side export', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(response.status).toBe(200);
        expect(data.instructions).toContain('Use the admin panel to export embeddings from the browser');
      });

      it('should include metadata for export validation', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(response.status).toBe(200);
        expect(data.version).toBeDefined();
        expect(data.model).toBeDefined();
        expect(data.dimensions).toBeDefined();
        expect(data.exportedBy).toBeDefined();
      });
    });

    describe('Error Handling', () => {
      it('should handle unexpected errors gracefully', async () => {
        // Mock Date to throw an error
        const originalDate = global.Date;
        global.Date = class extends Date {
          constructor() {
            throw new Error('Date construction failed');
          }
          static now() {
            throw new Error('Date.now failed');
          }
          toISOString() {
            throw new Error('toISOString failed');
          }
        } as any;

        const response = await GET(mockContext);
        const data = await response.json();

        // Restore Date
        global.Date = originalDate;

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBeTruthy();
      });

      it('should include CORS headers in error responses', async () => {
        // Force an error by mocking JSON.stringify to fail
        const originalStringify = JSON.stringify;
        JSON.stringify = vi.fn().mockImplementation(() => {
          throw new Error('JSON serialization failed');
        });

        const response = await GET(mockContext);

        // Restore JSON.stringify
        JSON.stringify = originalStringify;

        expect(response.status).toBe(500);
        expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      it('should provide fallback error message for non-Error objects', async () => {
        // Mock to throw a non-Error object
        const originalStringify = JSON.stringify;
        JSON.stringify = vi.fn().mockImplementation(() => {
          throw 'String error'; // Non-Error object
        });

        const response = await GET(mockContext);
        const data = await response.json();

        // Restore JSON.stringify
        JSON.stringify = originalStringify;

        expect(response.status).toBe(500);
        expect(data.success).toBe(false);
        expect(data.error).toBe('Failed to export embeddings');
      });
    });

    describe('Export Metadata Validation', () => {
      it('should include all required metadata fields', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        const requiredFields = [
          'version',
          'exportDate',
          'model',
          'dimensions',
          'message',
          'instructions',
          'exportedBy'
        ];

        requiredFields.forEach(field => {
          expect(data).toHaveProperty(field);
          expect(data[field]).toBeDefined();
        });
      });

      it('should have correct data types for metadata fields', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(typeof data.version).toBe('string');
        expect(typeof data.exportDate).toBe('string');
        expect(typeof data.model).toBe('string');
        expect(typeof data.dimensions).toBe('number');
        expect(typeof data.message).toBe('string');
        expect(typeof data.instructions).toBe('string');
        expect(typeof data.exportedBy).toBe('string');
      });

      it('should have sensible default values', async () => {
        const response = await GET(mockContext);
        const data = JSON.parse(await response.text());

        expect(data.version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version
        expect(data.dimensions).toBeGreaterThan(0);
        expect(data.model).toContain('transformers');
        expect(data.exportedBy).toContain('LexMX');
      });
    });
  });

  describe('OPTIONS /api/embeddings/export', () => {
    beforeEach(() => {
      mockContext.request = new Request('http://localhost:3000/api/embeddings/export', {
        method: 'OPTIONS'
      });
    });

    it('should handle OPTIONS request for CORS preflight', async () => {
      const response = await OPTIONS(mockContext);

      expect(response.status).toBe(200);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization');
    });

    it('should return no content for OPTIONS', async () => {
      const response = await OPTIONS(mockContext);
      const text = await response.text();

      expect(text).toBe('');
    });

    it('should only allow GET and OPTIONS methods', async () => {
      const response = await OPTIONS(mockContext);
      const allowedMethods = response.headers.get('Access-Control-Allow-Methods');

      expect(allowedMethods).toBe('GET, OPTIONS');
      expect(allowedMethods).not.toContain('POST');
      expect(allowedMethods).not.toContain('DELETE');
      expect(allowedMethods).not.toContain('PUT');
    });
  });

  describe('Integration Scenarios', () => {
    it('should work as expected when called from admin panel', async () => {
      // Simulate request from admin panel with proper headers
      mockContext.request = new Request('http://localhost:3000/api/embeddings/export', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Origin': 'http://localhost:3000'
        }
      });

      const response = await GET(mockContext);
      const data = JSON.parse(await response.text());

      expect(response.status).toBe(200);
      expect(data.instructions).toContain('admin panel');
      expect(response.headers.get('Content-Disposition')).toContain('attachment');
    });

    it('should handle concurrent export requests', async () => {
      // Simulate multiple concurrent requests
      const requests = Array.from({ length: 5 }, () => GET(mockContext));
      const responses = await Promise.all(requests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.headers.get('Content-Type')).toBe('application/json');
      });

      // Each should have unique export dates (within reasonable tolerance)
      const exportDates = await Promise.all(
        responses.map(async r => {
          const data = JSON.parse(await r.text());
          return new Date(data.exportDate).getTime();
        })
      );

      // All should be within a small time window
      const minTime = Math.min(...exportDates);
      const maxTime = Math.max(...exportDates);
      expect(maxTime - minTime).toBeLessThan(1000); // Within 1 second
    });
  });
});