// Enhanced document content extractors for PDF, DOC, and other formats
// Integrates PDF.js and mammoth.js for proper content extraction
//
// Both libraries are loaded lazily (dynamic `import()`), not at module scope:
// they are only needed when a PDF/DOC actually needs extracting, and pulling
// them in eagerly would ship their (sizeable) parsing code to every caller of
// this module, including ones that only ever handle plain text/HTML.

import { needsOcr, ocrPdfPages, type OcrLanguage, type OcrProgress } from './ocr';

type PdfJsModule = typeof import('pdfjs-dist');
type MammothModule = typeof import('mammoth');

let pdfWorkerConfigured = false;

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjsLib = await import('pdfjs-dist');
  if (!pdfWorkerConfigured && typeof window !== 'undefined') {
    // For browser environment
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
    pdfWorkerConfigured = true;
  }
  return pdfjsLib;
}

async function loadMammoth(): Promise<MammothModule> {
  return import('mammoth');
}

export interface ExtractionOptions {
  preserveFormatting?: boolean;
  extractImages?: boolean;
  maxPages?: number;
  includeMetadata?: boolean;
  /**
   * OCR for PDF pages without a text layer (scans). 'auto' (default) OCRs
   * only pages whose text layer is empty; 'always' OCRs every page; 'never'
   * skips it. Runs on the device via Tesseract.js (see `ocr.ts`).
   */
  ocr?: 'auto' | 'always' | 'never';
  ocrLanguage?: OcrLanguage;
  onOcrProgress?: (p: OcrProgress) => void;
}

export interface ExtractionResult {
  text: string;
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    modificationDate?: string;
    pages?: number;
    keywords?: string;
  };
  structure?: {
    pages: Array<{
      pageNumber: number;
      text: string;
      hasImages?: boolean;
    }>;
  };
}

/**
 * Enhanced PDF extractor using PDF.js
 */
export class PDFExtractor {
  async extractFromArrayBuffer(
    buffer: ArrayBuffer, 
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const {
      includeMetadata = true,
      maxPages = 500, // Reasonable limit for legal documents
      ocr = 'auto'
    } = options;

    try {
      const pdfjsLib = await loadPdfJs();

      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument({
        data: buffer,
        useSystemFonts: true,
        disableFontFace: false
      });
      
      const pdfDoc = await loadingTask.promise;
      const numPages = Math.min(pdfDoc.numPages, maxPages);
      
      const pages: Array<{ pageNumber: number; text: string; hasImages?: boolean }> = [];
      const allText: string[] = [];
      let documentMetadata = {};

      // Extract metadata if requested
      if (includeMetadata) {
        try {
          const metadata = await pdfDoc.getMetadata();
          // pdfjs-dist types the raw PDF info dictionary as `Object`; the actual
          // shape (Title/Author/etc.) is defined by the PDF spec, not by pdfjs-dist's
          // types, so a narrow cast is the only reasonable option here.
          const info = metadata.info as Record<string, string | undefined>;
          documentMetadata = {
            title: info?.Title || '',
            author: info?.Author || '',
            subject: info?.Subject || '',
            creator: info?.Creator || '',
            producer: info?.Producer || '',
            creationDate: info?.CreationDate || '',
            modificationDate: info?.ModDate || '',
            pages: numPages,
            keywords: info?.Keywords || ''
          };
        } catch (error) {
          console.warn('Could not extract PDF metadata:', error);
        }
      }

      // Extract text from each page
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdfDoc.getPage(pageNum);
          const textContent = await page.getTextContent({
            includeMarkedContent: true
          });

          // Build text with proper spacing and formatting
          let pageText = '';
          let lastY = -1;
          let lastX = -1;

          for (const item of textContent.items) {
            if ('str' in item) {
              const currentY = 'transform' in item ? item.transform[5] : 0;
              const currentX = 'transform' in item ? item.transform[4] : 0;
              
              // Add line break if this text is on a new line
              if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
                pageText += '\n';
              }
              // Add space if there's significant horizontal gap
              else if (lastX !== -1 && currentX - lastX > 20) {
                pageText += ' ';
              }
              
              pageText += item.str;
              lastY = currentY;
              lastX = currentX + (item.width || 0);
            }
          }

          // Clean up the extracted text
          pageText = this.cleanPDFText(pageText);
          
          pages.push({
            pageNumber: pageNum,
            text: pageText,
            hasImages: false // TODO: Implement image detection
          });
          
          allText.push(pageText);

        } catch (error) {
          console.error(`Error extracting page ${pageNum}:`, error);
          pages.push({
            pageNumber: pageNum,
            text: `[Error extracting page ${pageNum}]`,
            hasImages: false
          });
        }
      }

      // OCR pages that have no usable text layer (scanned documents).
      if (ocr !== 'never' && typeof document !== 'undefined') {
        const targets = pages.filter((p) => ocr === 'always' || needsOcr(p.text)).map((p) => p.pageNumber);
        if (targets.length > 0) {
          const recognized = await ocrPdfPages(pdfDoc, targets, { language: options.ocrLanguage, onProgress: options.onOcrProgress });
          for (const p of pages) {
            const text = recognized.get(p.pageNumber);
            if (text !== undefined) {
              p.text = text;
              p.hasImages = true;
              allText[p.pageNumber - 1] = text;
            }
          }
        }
      }

      // Combine all text
      let combinedText = allText.join('\n\n');
      
      // Apply additional formatting for legal documents
      combinedText = this.formatLegalText(combinedText);

      return {
        text: combinedText,
        metadata: includeMetadata ? documentMetadata : undefined,
        structure: {
          pages
        }
      };

    } catch (error) {
      console.error('PDF extraction error:', error);
      throw new Error(`Failed to extract PDF content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractFromUrl(url: string, options: ExtractionOptions = {}): Promise<ExtractionResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      return await this.extractFromArrayBuffer(buffer, options);
    } catch (error) {
      throw new Error(`Failed to fetch and extract PDF from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private cleanPDFText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Fix common PDF extraction issues
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Remove page numbers and headers/footers patterns
      .replace(/^\d+\s*$/gm, '')
      .replace(/^Página \d+.*$/gm, '')
      // Fix broken words
      .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')
      .trim();
  }

  private formatLegalText(text: string): string {
    return text
      // Ensure proper spacing around articles
      .replace(/(\n|^)(Artículo|ARTÍCULO|Art\.?)\s*(\d+)/g, '\n\nArtículo $3')
      // Ensure proper spacing around chapters
      .replace(/(\n|^)(Capítulo|CAPÍTULO|Cap\.?)\s*([IVXLCDM]+|\d+)/g, '\n\nCapítulo $3')
      // Ensure proper spacing around titles
      .replace(/(\n|^)(Título|TÍTULO|Tít\.?)\s*([IVXLCDM]+|\d+)/g, '\n\nTítulo $3')
      // Clean up excessive line breaks
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

/**
 * Enhanced DOC/DOCX extractor using mammoth.js
 */
export class DOCExtractor {
  async extractFromArrayBuffer(
    buffer: ArrayBuffer,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const { includeMetadata = true } = options;

    try {
      const mammoth = await loadMammoth();

      // mammoth's extractRawText only accepts the input document; style-map and
      // image-conversion options only apply to convertToHtml, so they are not
      // passed here.
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });

      // Get plain text
      let text = result.value;
      
      // Apply legal document formatting
      text = this.formatLegalText(text);
      
      // Check for conversion warnings
      if (result.messages.length > 0) {
        console.warn('DOC conversion warnings:', result.messages);
      }

      // Basic metadata extraction (limited for DOC files)
      const metadata = includeMetadata ? {
        title: this.extractTitleFromText(text),
        pages: 1, // DOC files don't have page concept like PDFs
      } : undefined;

      return {
        text,
        metadata,
        structure: {
          pages: [{
            pageNumber: 1,
            text: text,
            hasImages: options.extractImages
          }]
        }
      };

    } catch (error) {
      console.error('DOC extraction error:', error);
      throw new Error(`Failed to extract DOC content: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async extractFromUrl(url: string, options: ExtractionOptions = {}): Promise<ExtractionResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const buffer = await response.arrayBuffer();
      return await this.extractFromArrayBuffer(buffer, options);
    } catch (error) {
      throw new Error(`Failed to fetch and extract DOC from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private formatLegalText(text: string): string {
    return text
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Ensure proper spacing around articles
      .replace(/(^|\n)(Artículo|ARTÍCULO|Art\.?)\s*(\d+)/g, '\n\nArtículo $3')
      // Ensure proper spacing around chapters
      .replace(/(^|\n)(Capítulo|CAPÍTULO|Cap\.?)\s*([IVXLCDM]+|\d+)/g, '\n\nCapítulo $3')
      // Ensure proper spacing around titles
      .replace(/(^|\n)(Título|TÍTULO|Tít\.?)\s*([IVXLCDM]+|\d+)/g, '\n\nTítulo $3')
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private extractTitleFromText(text: string): string {
    // Try to find the title in the first few lines
    const lines = text.split('\n').slice(0, 5);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length > 10 && trimmed.length < 200 && !trimmed.match(/^(Artículo|ARTÍCULO|Capítulo|CAPÍTULO)/)) {
        return trimmed;
      }
    }
    return 'Untitled Document';
  }
}

/**
 * Generic content type detector and extractor
 */
export class ContentExtractor {
  private pdfExtractor = new PDFExtractor();
  private docExtractor = new DOCExtractor();

  async extractFromArrayBuffer(
    buffer: ArrayBuffer,
    contentType: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    // Detect content type if not provided or if it's generic
    if (!contentType || contentType === 'application/octet-stream') {
      contentType = this.detectContentType(buffer);
    }

    // Route to appropriate extractor
    if (contentType.includes('pdf')) {
      return await this.pdfExtractor.extractFromArrayBuffer(buffer, options);
    }
    
    if (contentType.includes('msword') || 
        contentType.includes('document') ||
        contentType.includes('officedocument.wordprocessingml')) {
      return await this.docExtractor.extractFromArrayBuffer(buffer, options);
    }
    
    // Fallback for plain text or unknown types
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(buffer);
    
    return {
      text,
      metadata: {
        title: 'Plain Text Document',
        pages: 1
      },
      structure: {
        pages: [{
          pageNumber: 1,
          text: text
        }]
      }
    };
  }

  async extractFromUrl(
    url: string,
    contentType?: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const actualContentType = contentType || response.headers.get('content-type') || '';
      const buffer = await response.arrayBuffer();
      
      return await this.extractFromArrayBuffer(buffer, actualContentType, options);
    } catch (error) {
      throw new Error(`Failed to fetch and extract content from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private detectContentType(buffer: ArrayBuffer): string {
    const uint8Array = new Uint8Array(buffer);
    
    // PDF signature
    if (uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && 
        uint8Array[2] === 0x44 && uint8Array[3] === 0x46) {
      return 'application/pdf';
    }
    
    // DOC signature (older format)
    if (uint8Array[0] === 0xD0 && uint8Array[1] === 0xCF && 
        uint8Array[2] === 0x11 && uint8Array[3] === 0xE0) {
      return 'application/msword';
    }
    
    // DOCX signature (ZIP-based)
    if (uint8Array[0] === 0x50 && uint8Array[1] === 0x4B && 
        (uint8Array[2] === 0x03 || uint8Array[2] === 0x05 || uint8Array[2] === 0x07)) {
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }
    
    return 'text/plain';
  }
}

// Export singleton instances for easy use
export const pdfExtractor = new PDFExtractor();
export const docExtractor = new DOCExtractor();
export const contentExtractor = new ContentExtractor();