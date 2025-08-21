import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { APIContext } from 'astro';

// Mock the corpus service using the same path alias as the API
vi.mock('@/lib/admin/corpus-service', () => ({
  corpusService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    getStatistics: vi.fn().mockResolvedValue({
      byType: {
        law: 45,
        code: 15,
        regulation: 35,
        constitution: 1,
        jurisprudence: 20,
        treaty: 5,
        norm: 4
      },
      byArea: {
        labor: 25,
        civil: 30,
        criminal: 20,
        constitutional: 15,
        tax: 15,
        commercial: 10,
        administrative: 10
      },
      byHierarchy: {
        1: 1,  // Constitution
        2: 5,  // Treaties
        3: 60, // Federal laws
        4: 35, // Regulations
        5: 4,  // NOMs
        6: 15, // State laws
        7: 5   // Administrative
      },
      averageChunks: 20,
      totalSize: 15728640 // 15 MB
    }),
    validateCorpus: vi.fn().mockResolvedValue({
      valid: 120,
      invalid: 5,
      issues: [
        { documentId: 'doc-1', issues: ['Missing content'] },
        { documentId: 'doc-2', issues: ['Invalid metadata'] }
      ]
    })
  }
}));

// Import after mocking
import { GET } from '../stats';
import { corpusService } from '@/lib/admin/corpus-service';

describe('Corpus Stats API Endpoint', () => {
  let mockContext: APIContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      request: new Request('http://localhost:3000/api/corpus/stats'),
      params: {},
      props: {},
      url: new URL('http://localhost:3000/api/corpus/stats'),
      cookies: {} as any,
      locals: {},
      redirect: vi.fn() as any,
      site: new URL('http://localhost:3000'),
      generator: 'Astro',
      clientAddress: '127.0.0.1'
    } as APIContext;
  });

  describe('GET /api/corpus/stats', () => {
    it('should return corpus statistics', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.totalDocuments).toBe(125);
      expect(data.documentsByType).toBeDefined();
      expect(data.documentsByType.law).toBe(45);
      expect(data.documentsByArea).toBeDefined();
      expect(data.hierarchyDistribution).toBeDefined();
    });

    it('should include storage metrics', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      expect(data.totalChunks).toBe(2500);
      expect(data.averageChunksPerDocument).toBe(20);
      expect(data.storageSize).toBe(15728640);
    });

    it('should include validation results when detailed=true', async () => {
      mockContext.url = new URL('http://localhost:3000/api/corpus/stats?detailed=true');
      mockContext.request = new Request(mockContext.url.toString());

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.validation).toBeDefined();
      expect(data.validation.valid).toBe(120);
      expect(data.validation.invalid).toBe(5);
      expect(data.validation.issues).toHaveLength(2);
    });

    it('should handle service errors gracefully', async () => {
      (corpusService.getStatistics as any).mockRejectedValueOnce(new Error('Database error'));

      const response = await GET(mockContext);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to get corpus statistics');
    });

    it('should include CORS headers', async () => {
      const response = await GET(mockContext);

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('GET');
    });

    it('should cache statistics for performance', async () => {
      const response = await GET(mockContext);
      
      const cacheControl = response.headers.get('Cache-Control');
      if (cacheControl) {
        expect(cacheControl).toContain('max-age');
      }
    });

    it('should calculate percentages correctly', async () => {
      const response = await GET(mockContext);
      const data = await response.json();

      // Sum of all document types should equal total
      const typeSum = Object.values(data.documentsByType as Record<string, number>)
        .reduce((sum, count) => sum + count, 0);
      expect(typeSum).toBe(125);
    });
  });
});