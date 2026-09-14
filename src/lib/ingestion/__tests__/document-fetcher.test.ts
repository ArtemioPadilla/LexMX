import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { DocumentFetcher } from '../document-fetcher';
import type { DocumentRequest } from '@/types/legal';

/** Minimal, fully-typed DocumentRequest fixture; override only what a test cares about. */
function createDocumentRequest(overrides: Partial<DocumentRequest> = {}): DocumentRequest {
  return {
    id: 'test-request',
    title: 'Test Document',
    description: 'Fixture request for DocumentFetcher tests',
    requestedBy: 'test-user',
    type: 'law',
    hierarchy: 3,
    primaryArea: 'civil',
    secondaryAreas: [],
    territorialScope: 'federal',
    sources: [],
    votes: 0,
    voters: [],
    comments: [],
    priority: 'medium',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: false,
    ...overrides
  };
}

/** Reaches into DocumentFetcher's private HTML/XML helpers without `any`. */
interface DocumentFetcherInternals {
  extractHtmlContent(html: string): string;
  decodeHtmlEntities(text: string): string;
  parseXmlContent(xml: string): string;
}

describe('DocumentFetcher', () => {
  let fetcher: DocumentFetcher;
  let fetchMock: Mock;

  beforeEach(() => {
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetcher = new DocumentFetcher();
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
      fetchMock.mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-type': 'text/html'
        }),
        text: async () => '<html><body>Legal content</body></html>'
      });

      const content = await fetcher.fetchFromUrl('https://test.com/document');
      expect(content).toContain('Legal content');
    });

    it('should handle HTTP errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(fetcher.fetchFromUrl('https://test.com/404')).rejects.toThrow('HTTP 404: Not Found');
    });

    it('should check content size limit', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: new Headers({
          'content-length': '20000000' // 20MB
        })
      });

      await expect(
        fetcher.fetchFromUrl('https://test.com/large', { maxSize: 10 * 1024 * 1024 })
      ).rejects.toThrow('Document too large');
    });

    it('should handle timeout', async () => {
      fetchMock.mockRejectedValue(new Error('AbortError'));

      await expect(
        fetcher.fetchFromUrl('https://test.com/slow', { timeout: 100 })
      ).rejects.toThrow();
    });
  });

  describe('fetchFromRequest', () => {
    it('should fetch from URL source', async () => {
      const request = createDocumentRequest({
        id: 'test-1',
        sources: [{
          id: 'source-1',
          type: 'url',
          url: 'https://test.com/doc',
          verified: false,
          isOfficial: false
        }]
      });

      fetchMock.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'Document content'
      });

      const content = await fetcher.fetchFromRequest(request);
      expect(content).toBe('Document content');
    });

    it('should handle PDF upload source', async () => {
      const request = createDocumentRequest({
        id: 'test-2',
        title: 'Uploaded Document',
        sources: [{
          id: 'source-2',
          type: 'pdf_upload',
          content: 'PDF content here',
          filename: 'document.pdf',
          verified: false,
          isOfficial: false
        }]
      });

      const content = await fetcher.fetchFromRequest(request);
      expect(content).toBe('PDF content here');
    });

    it('should throw error when no valid source found', async () => {
      const request = createDocumentRequest({
        id: 'test-3',
        title: 'No Source Document',
        sources: []
      });

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

      const internals = fetcher as unknown as DocumentFetcherInternals;
      const extracted = internals.extractHtmlContent(html);

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
      const internals = fetcher as unknown as DocumentFetcherInternals;
      const decoded = internals.decodeHtmlEntities(encoded);

      expect(decoded).toBe('<div> & "test" \'single\' ñ');
    });

    it('should decode Spanish special characters', () => {
      const encoded = '&aacute;&eacute;&iacute;&oacute;&uacute; &Aacute;&Eacute;&Iacute;&Oacute;&Uacute; &Ntilde;';
      const internals = fetcher as unknown as DocumentFetcherInternals;
      const decoded = internals.decodeHtmlEntities(encoded);

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

      const internals = fetcher as unknown as DocumentFetcherInternals;
      const extracted = internals.parseXmlContent(xml);

      expect(extracted).toContain('Legal Document');
      expect(extracted).toContain('This is the content');
      expect(extracted).not.toContain('<?xml');
      expect(extracted).not.toContain('<document>');
    });
  });

  describe('specialized fetchers', () => {
    it('should construct DOF URL correctly', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => 'DOF content'
      });

      await fetcher.fetchFromDOF('01/01/2024', '12345');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('dof.gob.mx'),
        expect.any(Object)
      );
    });

    it('should construct SCJN URL correctly', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => 'SCJN content'
      });

      await fetcher.fetchFromSCJN('2024/123');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('scjn.gob.mx'),
        expect.any(Object)
      );
    });
  });
});
