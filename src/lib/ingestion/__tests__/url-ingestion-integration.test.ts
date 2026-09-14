// NOTE (Fase 1/3 of docs/INCEPTOR-MIGRATION-ANALYSIS.md): six cases that asserted the
// pre-CORS-aware fetch behaviour and a mocked pdf.js pipeline were removed here; the
// ingestion pipeline gets real unit tests when lib/ingestion is cleaned in Fase 3.
import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { DocumentFetcher } from '../document-fetcher';
import { contentExtractor } from '../document-content-extractors';

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

  // Shared across "Diputados.gob.mx" and "Content Quality Validation" below.
  const testUrls = {
    constitutionPdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
    constitutionDoc: 'https://www.diputados.gob.mx/LeyesBiblio/doc/CPEUM.doc',
    laborLawPdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_120924.pdf',
    civilCodePdf: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CCF.pdf'
  };

  // Mock fetch globally for all tests
  const mockFetch = vi.fn();
  global.fetch = mockFetch;

  beforeEach(() => {
    fetcher = new DocumentFetcher();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mexican Government Sources', () => {
    describe('Diputados.gob.mx', () => {
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
      (pdfjs.getDocument as unknown as Mock).mockReturnValue({
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


});