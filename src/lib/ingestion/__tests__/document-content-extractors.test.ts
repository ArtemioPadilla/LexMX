import { describe, it, expect, vi } from 'vitest';

// pdfjs-dist and mammoth are loaded lazily (dynamic `import()`) by
// document-content-extractors.ts; vi.mock intercepts dynamic imports the same
// way it intercepts static ones, so these fixtures exercise the real
// extraction/formatting logic without touching the actual heavy libraries.
vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 1,
      getMetadata: vi.fn().mockResolvedValue({
        info: { Title: 'Ley de Prueba', Author: 'Congreso de la Unión' }
      }),
      getPage: vi.fn().mockResolvedValue({
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Artículo 1.', transform: [1, 0, 0, 1, 0, 100] },
            { str: 'Texto de prueba del artículo.', transform: [1, 0, 0, 1, 0, 80] }
          ]
        })
      })
    })
  }),
  GlobalWorkerOptions: { workerSrc: '' }
}));

vi.mock('mammoth', () => ({
  extractRawText: vi.fn().mockResolvedValue({
    value: 'Artículo 1.\nTexto de prueba del documento DOCX.',
    messages: []
  })
}));

import { PDFExtractor, DOCExtractor, ContentExtractor } from '../document-content-extractors';

describe('PDFExtractor', () => {
  it('extracts text and metadata through the (mocked) pdfjs-dist pipeline', async () => {
    const extractor = new PDFExtractor();
    const result = await extractor.extractFromArrayBuffer(new ArrayBuffer(0));

    expect(result.text).toContain('Artículo 1');
    expect(result.text).toContain('Texto de prueba del artículo');
    expect(result.metadata?.title).toBe('Ley de Prueba');
    expect(result.metadata?.author).toBe('Congreso de la Unión');
    expect(result.structure?.pages).toHaveLength(1);
  });

  it('skips metadata extraction when includeMetadata is false', async () => {
    const extractor = new PDFExtractor();
    const result = await extractor.extractFromArrayBuffer(new ArrayBuffer(0), {
      includeMetadata: false
    });

    expect(result.metadata).toBeUndefined();
  });
});

describe('DOCExtractor', () => {
  it('extracts text through the (mocked) mammoth pipeline', async () => {
    const extractor = new DOCExtractor();
    const result = await extractor.extractFromArrayBuffer(new ArrayBuffer(0));

    expect(result.text).toContain('Artículo 1');
    expect(result.text).toContain('Texto de prueba del documento DOCX');
    expect(result.structure?.pages).toHaveLength(1);
  });
});

describe('ContentExtractor', () => {
  const extractor = new ContentExtractor();

  it('routes application/pdf buffers to the PDF extractor', async () => {
    const result = await extractor.extractFromArrayBuffer(new ArrayBuffer(0), 'application/pdf');
    expect(result.text).toContain('Artículo 1');
  });

  it('routes DOCX content types to the DOC extractor', async () => {
    const result = await extractor.extractFromArrayBuffer(
      new ArrayBuffer(0),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    expect(result.text).toContain('Texto de prueba del documento DOCX');
  });

  it('decodes plain text directly, without going through pdfjs-dist or mammoth', async () => {
    const buffer = new TextEncoder().encode('Texto legal plano, sin formato binario.').buffer;

    const result = await extractor.extractFromArrayBuffer(buffer, 'text/plain');

    expect(result.text).toBe('Texto legal plano, sin formato binario.');
    expect(result.metadata?.title).toBe('Plain Text Document');
  });

  it('detects PDF content from its magic bytes when the content type is generic', async () => {
    const pdfSignature = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]); // "%PDF-"
    const result = await extractor.extractFromArrayBuffer(
      pdfSignature.buffer,
      'application/octet-stream'
    );

    expect(result.text).toContain('Artículo 1');
  });
});
