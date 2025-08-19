import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the services
vi.mock('../../../lib/admin/corpus-service', () => ({
  corpusService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    deleteDocument: vi.fn().mockImplementation((id: string) => {
      if (id === 'doc-1') {
        return Promise.resolve({ success: true, message: 'Document deleted' });
      }
      throw new Error('Document not found');
    }),
    getDocument: vi.fn().mockImplementation((id: string) => {
      if (id === 'doc-1') {
        return Promise.resolve({ id: 'doc-1', title: 'Test Document' });
      }
      return Promise.resolve(null);
    })
  }
}));

// Import after mocking
import { DELETE, POST } from '../delete';

describe('Corpus Delete API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/corpus/delete?id=doc-1', {
        method: 'DELETE'
      }),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/corpus/delete?id=doc-1'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('DELETE /api/corpus/delete', () => {
    it('should delete document by ID', async () => {
      const response = await DELETE(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Document deleted successfully');
    });

    it('should return 404 for non-existent document', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/delete?id=non-existent');
      mockContext.request = new Request(mockContext.url.toString(), { method: 'DELETE' });

      const response = await DELETE(mockContext);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 400 when ID is missing', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/delete');
      mockContext.request = new Request(mockContext.url.toString(), { method: 'DELETE' });

      const response = await DELETE(mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Document ID is required');
    });
  });

  describe('POST /api/corpus/delete', () => {
    it('should accept document ID in request body', async () => {
      mockContext.request = new Request('http://localhost:3000/api/corpus/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'doc-1' })
      });

      const response = await POST(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should validate request body', async () => {
      mockContext.request = new Request('http://localhost:3000/api/corpus/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await POST(mockContext);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Document ID is required');
    });
  });
});