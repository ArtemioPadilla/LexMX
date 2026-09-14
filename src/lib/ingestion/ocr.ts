/**
 * OCR in the browser (plan § 11.4 C) with Tesseract.js, imported lazily so
 * only pages that actually OCR pay for it. Recognition runs in a Web Worker on
 * the device; the worker script, WASM core and language data are fetched
 * once from the library's CDN and cached by the browser. The image itself
 * never leaves the device.
 */

// Type-only: pdfjs-dist stays a dynamic import at runtime.
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type OcrLanguage = 'spa' | 'eng' | 'por' | 'spa+eng';

export interface OcrProgress {
  status: string;
  /** 0..1 */
  progress: number;
  page?: number;
  pages?: number;
}

export interface OcrOptions {
  language?: OcrLanguage;
  onProgress?: (p: OcrProgress) => void;
  /** Render scale for PDF pages; 2 ≈ 144 dpi, enough for printed legal text. */
  scale?: number;
  maxPages?: number;
}

export type OcrImageSource = Blob | HTMLCanvasElement | HTMLImageElement | string;

type Worker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>;

async function createWorker(language: OcrLanguage, onProgress?: (p: OcrProgress) => void): Promise<Worker> {
  const { createWorker } = await import('tesseract.js');
  return createWorker(language, 1, {
    logger: (m: { status: string; progress: number }) => onProgress?.({ status: m.status, progress: m.progress }),
  });
}

/** Recognizes a single image (photo, scan, canvas). */
export async function recognizeImage(source: OcrImageSource, options: OcrOptions = {}): Promise<string> {
  const worker = await createWorker(options.language ?? 'spa', options.onProgress);
  try {
    const result = await worker.recognize(source);
    return cleanOcrText(result.data.text);
  } finally {
    await worker.terminate();
  }
}

/** True when a PDF page's text layer is missing or negligible (scanned page). */
export function needsOcr(pageText: string): boolean {
  return pageText.replace(/\s+/g, '').length < 20;
}

/**
 * OCRs the pages of a PDF that have no usable text layer. `pdfDoc` is a
 * pdfjs document already loaded by the extractor; `pageNumbers` selects which
 * pages to render.
 */
export async function ocrPdfPages(
  pdfDoc: Pick<PDFDocumentProxy, 'getPage'>,
  pageNumbers: number[],
  options: OcrOptions = {},
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (pageNumbers.length === 0 || typeof document === 'undefined') return out;
  const scale = options.scale ?? 2;
  const worker = await createWorker(options.language ?? 'spa', options.onProgress);
  try {
    let done = 0;
    for (const n of pageNumbers.slice(0, options.maxPages ?? 50)) {
      const page = await pdfDoc.getPage(n);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;
      await page.render({ canvasContext: ctx, viewport }).promise;
      const result = await worker.recognize(canvas);
      out.set(n, cleanOcrText(result.data.text));
      done++;
      options.onProgress?.({ status: 'page', progress: done / pageNumbers.length, page: n, pages: pageNumbers.length });
      canvas.width = 0;
      canvas.height = 0;
    }
  } finally {
    await worker.terminate();
  }
  return out;
}

/** Normalizes the usual OCR artifacts in Spanish legal scans. */
export function cleanOcrText(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/(\w)-\n(\p{Ll})/gu, '$1$2') // hyphenated line breaks
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
