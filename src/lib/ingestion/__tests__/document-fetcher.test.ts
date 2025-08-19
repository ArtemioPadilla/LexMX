import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DocumentFetcher } from '../document-fetcher';
import type { DocumentRequest } from '@/types/legal';

// Mock fetch globally
global.fetch = vi.fn();

describe('DocumentFetcher', () => {
  let fetcher: DocumentFetcher;

  beforeEach(() => {
    fetcher = new DocumentFetcher();
    vi.clearAllMocks();
  });

  describe('isOfficialSource', () => {
    it('should recognize official Mexican government domains', () => {
      const officialDomains = [
        'dof.gob.mx',
        'scjn.gob.mx',
        'diputados.gob.mx',
        'senado.gob.mx',
        'sat.gob.mx',
        'imss.gob.mx'
      ];

      officialDomains.forEach(domain => {
        expect(fetcher.isOfficialSource(domain)).toBe(true);
        expect(fetcher.isOfficialSource(`www.${domain}`)).toBe(true);
        expect(fetcher.isOfficialSource(`subdomain.${domain}`)).toBe(true);
      });
    });

    it('should reject non-official domains', () => {
      const unofficialDomains = [
        'example.com',
        'google.com',
        'fake-gob.mx',
        'gob.mx.fake.com'
      ];

      unofficialDomains.forEach(domain => {
        expect(fetcher.isOfficialSource(domain)).toBe(false);
      });
    });
  });

  describe('fetchFromUrl', () => {
    it('should fetch content from URL successfully', async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({
          'content-type': 'text/html'
        }),
        text: async () => '<html><body>Legal content</body></html>'
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const content = await fetcher.fetchFromUrl('https://test.com/document');
      expect(content).toContain('Legal content');
    });

    it('should handle HTTP errors', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(fetcher.fetchFromUrl('https://test.com/404')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should check content size limit', async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({
          'content-length': '20000000' // 20MB
        })
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await expect(
        fetcher.fetchFromUrl('https://test.com/large', { maxSize: 10 * 1024 * 1024 })
      ).rejects.toThrow('Document too large');
    });

    it('should handle timeout', async () => {
      (global.fetch as any).mockRejectedValue(new Error('AbortError'));

      await expect(
        fetcher.fetchFromUrl('https://test.com/slow', { timeout: 100 })
      ).rejects.toThrow();
    });
  });

  describe('fetchFromRequest', () => {
    it('should fetch from URL source', async () => {
      const request: DocumentRequest = {
        id: 'test-1',
        title: 'Test Document',
        type: 'law',
        sources: [{
          id: 'source-1',
          type: 'url',
          url: 'https://test.com/doc',
          verified: false,
          isOfficial: false
        }],
        status: 'pending',
        priority: 5,
        requestedBy: 'user',
        createdAt: new Date().toISOString(),
        hierarchy: 3,
        primaryArea: 'civil'
      };

      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Document content'
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const content = await fetcher.fetchFromRequest(request);
      expect(content).toBe('Document content');
    });

    it('should handle PDF upload source', async () => {
      const request: DocumentRequest = {
        id: 'test-2',
        title: 'Uploaded Document',
        type: 'law',
        sources: [{
          id: 'source-2',
          type: 'pdf_upload',
          content: 'PDF content here',
          filename: 'document.pdf',
          verified: false,
          isOfficial: false
        }],
        status: 'pending',
        priority: 5,
        requestedBy: 'user',
        createdAt: new Date().toISOString(),
        hierarchy: 3,
        primaryArea: 'civil'
      };

      const content = await fetcher.fetchFromRequest(request);
      expect(content).toBe('PDF content here');
    });

    it('should throw error when no valid source found', async () => {
      const request: DocumentRequest = {
        id: 'test-3',
        title: 'No Source Document',
        type: 'law',
        sources: [],
        status: 'pending',
        priority: 5,
        requestedBy: 'user',
        createdAt: new Date().toISOString(),
        hierarchy: 3,
        primaryArea: 'civil'
      };

      await expect(fetcher.fetchFromRequest(request)).rejects.toThrow('No valid source found in request');
    });
  });

  describe('HTML content extraction', () => {
    it('should extract text from HTML', () => {
      const html = `
        <html>
          <head><title>Test</title></head>
          <body>
            <h1>Title</h1>
            <p>Paragraph 1</p>
            <p>Paragraph 2</p>
            <script>console.log('should be removed');</script>
            <style>body { color: red; }</style>
          </body>
        </html>
      `;

      const extracted = (fetcher as any).extractHtmlContent(html);
      
      expect(extracted).toContain('Title');
      expect(extracted).toContain('Paragraph 1');
      expect(extracted).toContain('Paragraph 2');
      expect(extracted).not.toContain('console.log');
      expect(extracted).not.toContain('color: red');
    });
  });

  describe('HTML entity decoding', () => {
    it('should decode common HTML entities', () => {
      const encoded = '&lt;div&gt; &amp; &quot;test&quot; &apos;single&apos; &ntilde;';
      const decoded = (fetcher as any).decodeHtmlEntities(encoded);
      
      expect(decoded).toBe('<div> & "test" \'single\' ñ');
    });

    it('should decode Spanish special characters', () => {
      const encoded = '&aacute;&eacute;&iacute;&oacute;&uacute; &Aacute;&Eacute;&Iacute;&Oacute;&Uacute; &Ntilde;';
      const decoded = (fetcher as any).decodeHtmlEntities(encoded);
      
      expect(decoded).toBe('áéíóú ÁÉÍÓÚ Ñ');
    });
  });

  describe('XML parsing', () => {
    it('should extract text from XML', () => {
      const xml = `
        <?xml version="1.0"?>
        <document>
          <title>Legal Document</title>
          <content>This is the content</content>
        </document>
      `;

      const extracted = (fetcher as any).parseXmlContent(xml);
      
      expect(extracted).toContain('Legal Document');
      expect(extracted).toContain('This is the content');
      expect(extracted).not.toContain('<?xml');
      expect(extracted).not.toContain('<document>');
    });
  });

  describe('specialized fetchers', () => {
    it('should construct DOF URL correctly', async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => 'DOF content'
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await fetcher.fetchFromDOF('01/01/2024', '12345');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('dof.gob.mx'),
        expect.any(Object)
      );
    });

    it('should construct SCJN URL correctly', async () => {
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => 'SCJN content'
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      await fetcher.fetchFromSCJN('2024/123');
      
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('scjn.gob.mx'),
        expect.any(Object)
      );
    });
  });
});