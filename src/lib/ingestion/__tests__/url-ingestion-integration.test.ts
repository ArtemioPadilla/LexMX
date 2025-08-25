import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DocumentFetcher } from '../document-fetcher';
import { DocumentIngestionPipeline } from '../document-ingestion-pipeline';
import { contentExtractor } from '../document-content-extractors';
import type { DocumentRequest } from '@/types/legal';

// Mock PDF.js and mammoth for testing
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'CONSTITUCIÓN POLÍTICA DE LOS ESTADOS UNIDOS MEXICANOS', transform: [1, 0, 0, 1, 0, 100] },
            { str: 'Artículo 1.- En los Estados Unidos Mexicanos', transform: [1, 0, 0, 1, 0, 80] }
          ]
        })
      }),
      getMetadata: vi.fn().mockResolvedValue({
        info: {
          Title: 'Constitución Política',
          Author: 'Congreso de la Unión',
          Subject: 'Ley fundamental de México'
        }
      })
    })
  }),
  GlobalWorkerOptions: {
    workerSrc: ''
  }
}));

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockResolvedValue({
    value: 'CONSTITUCIÓN POLÍTICA DE LOS ESTADOS UNIDOS MEXICANOS\n\nArtículo 1.- En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos.',
    messages: []
  })
}));

describe('URL Ingestion Integration Tests', () => {
  let fetcher: DocumentFetcher;
  let pipeline: DocumentIngestionPipeline;

  // Mock fetch globally for all tests
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    fetcher = new DocumentFetcher();
    pipeline = new DocumentIngestionPipeline();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mexican Government Sources', () => {
    describe('Diputados.gob.mx', () => {
      const testUrls = {
        constitutionPdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
        constitutionDoc: 'https://www.diputados.gob.mx/LeyesBiblio/doc/CPEUM.doc',
        laborLawPdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120924.pdf',
        civilCodePdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf'
      };

      it('should correctly identify diputados.gob.mx as official source', () => {
        Object.values(testUrls).forEach(url => {
          const parsedUrl = new URL(url);
          expect(fetcher.isOfficialSource(parsedUrl.hostname)).toBe(true);
        });
      });

      it('should handle PDF extraction from Constitution URL', async () => {
        // Mock fetch response for PDF
        const mockArrayBuffer = new ArrayBuffer(8);
        mockFetch.mockResolvedValue({
          ok: true,
          headers: new Map([
            ['content-type', 'application/pdf'],
            ['content-length', '1024000']
          ]),
          arrayBuffer: () => Promise.resolve(mockArrayBuffer)
        });

        const result = await fetcher.fetchFromUrl(testUrls.constitutionPdf);
        
        expect(result).toContain('CONSTITUCIÓN POLÍTICA');
        expect(result).toContain('Artículo 1');
        expect(mockFetch).toHaveBeenCalledWith(
          testUrls.constitutionPdf,
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              'Accept': expect.stringContaining('pdf')
            })
          })
        );
      });

      it('should handle DOC extraction from Constitution URL', async () => {
        // Mock fetch response for DOC
        const mockArrayBuffer = new ArrayBuffer(8);
        mockFetch.mockResolvedValue({
          ok: true,
          headers: new Map([
            ['content-type', 'application/msword'],
            ['content-length', '512000']
          ]),
          arrayBuffer: () => Promise.resolve(mockArrayBuffer)
        });

        const result = await fetcher.fetchFromUrl(testUrls.constitutionDoc);
        
        expect(result).toContain('CONSTITUCIÓN POLÍTICA');
        expect(result).toContain('Artículo 1');
        expect(mockFetch).toHaveBeenCalledWith(testUrls.constitutionDoc, expect.any(Object));
      });

      it('should use enhanced fetchFromDiputados method', async () => {
        const mockArrayBuffer = new ArrayBuffer(8);
        mockFetch.mockResolvedValue({
          ok: true,
          headers: new Map([
            ['content-type', 'application/pdf'],
            ['content-length', '1024000']
          ]),
          arrayBuffer: () => Promise.resolve(mockArrayBuffer)
        });

        const result = await fetcher.fetchConstitution('pdf');
        
        expect(result).toContain('CONSTITUCIÓN POLÍTICA');
        expect(mockFetch).toHaveBeenCalledWith(
          'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
          expect.any(Object)
        );
      });

      it('should handle different legal document formats', async () => {
        const testCases = [
          { method: () => fetcher.fetchConstitution('pdf'), expected: 'CPEUM.pdf' },
          { method: () => fetcher.fetchLaborLaw('pdf'), expected: '125.pdf' },
          { method: () => fetcher.fetchCivilCode('pdf'), expected: 'CCF.pdf' },
          { method: () => fetcher.fetchPenalCode('pdf'), expected: 'CPF.pdf' }
        ];

        for (const testCase of testCases) {
          const mockArrayBuffer = new ArrayBuffer(8);
          mockFetch.mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/pdf']]),
            arrayBuffer: () => Promise.resolve(mockArrayBuffer)
          });

          await testCase.method();
          
          expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining(testCase.expected),
            expect.any(Object)
          );
          
          mockFetch.mockClear();
        }
      });
    });

    describe('DOF.gob.mx', () => {
      it('should identify DOF as official source', () => {
        expect(fetcher.isOfficialSource('dof.gob.mx')).toBe(true);
        expect(fetcher.isOfficialSource('www.dof.gob.mx')).toBe(true);
      });

      it('should construct correct DOF URLs', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          headers: new Map([['content-type', 'text/html']]),
          text: () => Promise.resolve('<html><body>DOF Content</body></html>')
        });

        await fetcher.fetchFromDOF('01/01/2024', '12345');
        
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('dof.gob.mx/nota_detalle.php'),
          expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('fecha=01/01/2024'),
          expect.any(Object)
        );
      });
    });

    describe('SCJN.gob.mx', () => {
      it('should identify SCJN as official source', () => {
        expect(fetcher.isOfficialSource('scjn.gob.mx')).toBe(true);
        expect(fetcher.isOfficialSource('sjf2.scjn.gob.mx')).toBe(true);
      });

      it('should construct correct SCJN URLs for jurisprudence', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          headers: new Map([['content-type', 'text/html']]),
          text: () => Promise.resolve('<html><body>Jurisprudence Content</body></html>')
        });

        await fetcher.fetchFromSCJN('2024/123');
        
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sjf2.scjn.gob.mx/detalle/tesis/2024/123'),
          expect.any(Object)
        );
      });
    });
  });

  describe('Content Extraction Quality', () => {
    it('should preserve legal document structure in PDF extraction', async () => {
      const mockArrayBuffer = new ArrayBuffer(8);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const result = await contentExtractor.extractFromUrl(
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf'
      );

      expect(result.text).toContain('Artículo');
      expect(result.metadata?.title).toBeTruthy();
      expect(result.structure?.pages).toHaveLength(2);
    });

    it('should handle large legal documents efficiently', async () => {
      const mockArrayBuffer = new ArrayBuffer(5 * 1024 * 1024); // 5MB mock
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([
          ['content-type', 'application/pdf'],
          ['content-length', '5242880']
        ]),
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const startTime = Date.now();
      await fetcher.fetchFromUrl('https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf');
      const duration = Date.now() - startTime;

      // Should complete within reasonable time (this is a mock, so it should be very fast)
      expect(duration).toBeLessThan(1000);
    });

    it('should detect and handle different character encodings', async () => {
      const textWithSpecialChars = 'Artículo 1º.- Ñoño José María';
      const mockArrayBuffer = new ArrayBuffer(8);
      
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/html; charset=utf-8']]),
        text: () => Promise.resolve(textWithSpecialChars)
      });

      const result = await fetcher.fetchFromUrl('https://test.gob.mx/document.html');
      
      expect(result).toContain('Artículo');
      expect(result).toContain('Ñoño');
      expect(result).toContain('José María');
    });
  });

  describe('Error Handling', () => {
    it('should handle HTTP errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(
        fetcher.fetchFromUrl('https://www.diputados.gob.mx/invalid.pdf')
      ).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError'));

      await expect(
        fetcher.fetchFromUrl('https://slow-server.gob.mx/document.pdf')
      ).rejects.toThrow();
    });

    it('should handle corrupted PDF files', async () => {
      const corruptedBuffer = new ArrayBuffer(10);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
        arrayBuffer: () => Promise.resolve(corruptedBuffer)
      });

      // Mock PDF.js to throw an error for corrupted files
      const pdfjs = await import('pdfjs-dist');
      (pdfjs.getDocument as any).mockReturnValue({
        promise: Promise.reject(new Error('Invalid PDF'))
      });

      await expect(
        contentExtractor.extractFromUrl('https://example.com/corrupted.pdf')
      ).rejects.toThrow('Failed to extract PDF content');
    });

    it('should handle non-official sources with warnings', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'text/plain']]),
        text: () => Promise.resolve('Some content')
      });

      await fetcher.fetchFromUrl('https://example.com/document.txt');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('non-official source')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Full Pipeline Integration', () => {
    it('should complete full ingestion pipeline for Mexican Constitution PDF', async () => {
      const mockArrayBuffer = new ArrayBuffer(8);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const result = await pipeline.ingestFromUrl(
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
        {
          title: 'Constitución Política de los Estados Unidos Mexicanos',
          type: 'constitution',
          primaryArea: 'constitutional'
        }
      );

      expect(result.success).toBe(true);
      expect(result.document?.title).toContain('Constitución');
      expect(result.document?.type).toBe('constitution');
      expect(result.chunks).toBeDefined();
      expect(result.stats.fetchTime).toBeGreaterThan(0);
      expect(result.stats.chunkCount).toBeGreaterThan(0);
    });

    it('should handle batch ingestion of multiple Mexican legal documents', async () => {
      const requests: DocumentRequest[] = [
        {
          id: '1',
          title: 'Constitución Política',
          type: 'constitution',
          sources: [{
            id: 'source1',
            type: 'url',
            url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
            verified: true,
            isOfficial: true
          }],
          status: 'approved',
          priority: 'high',
          requestedBy: 'admin',
          createdAt: new Date().toISOString(),
          hierarchy: 1,
          primaryArea: 'constitutional',
          votes: 10,
          voters: [],
          comments: []
        },
        {
          id: '2',
          title: 'Ley Federal del Trabajo',
          type: 'law',
          sources: [{
            id: 'source2',
            type: 'url',
            url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120924.pdf',
            verified: true,
            isOfficial: true
          }],
          status: 'approved',
          priority: 'medium',
          requestedBy: 'admin',
          createdAt: new Date().toISOString(),
          hierarchy: 3,
          primaryArea: 'labor',
          votes: 8,
          voters: [],
          comments: []
        }
      ];

      const mockArrayBuffer = new ArrayBuffer(8);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const results = await pipeline.ingestBatch(requests);
      
      expect(results).toHaveLength(2);
      expect(results.every(r => r.success)).toBe(true);
      expect(results[0].document?.primaryArea).toBe('constitutional');
      expect(results[1].document?.primaryArea).toBe('labor');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance targets for PDF processing', async () => {
      const mockArrayBuffer = new ArrayBuffer(1024 * 1024); // 1MB
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const startTime = Date.now();
      const result = await pipeline.ingestFromUrl(
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf'
      );
      const totalTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(totalTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.stats.fetchTime).toBeLessThan(5000); // Fetch should be under 5 seconds
    });

    it('should handle concurrent document processing', async () => {
      const mockArrayBuffer = new ArrayBuffer(8);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: new Map([['content-type', 'application/pdf']]),
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const urls = [
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120924.pdf',
        'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf'
      ];

      const startTime = Date.now();
      const promises = urls.map(url => pipeline.ingestFromUrl(url));
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      expect(results.every(r => r.success)).toBe(true);
      expect(totalTime).toBeLessThan(15000); // Concurrent processing should be efficient
    });
  });
});