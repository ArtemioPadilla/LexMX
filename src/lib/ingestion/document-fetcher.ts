// Document fetcher for retrieving legal documents from various sources
// Supports official Mexican government sources and validated URLs

import type { DocumentRequest, DocumentSource } from '@/types/legal';

export interface FetchOptions {
  validateSource?: boolean;
  timeout?: number;
  maxSize?: number;
  signal?: AbortSignal;
}

export interface FetchResult {
  content: string;
  metadata: {
    contentType: string;
    size: number;
    lastModified?: string;
    etag?: string;
    sourceUrl?: string;
    isOfficial: boolean;
  };
}

export class DocumentFetcher {
  private officialDomains = [
    'dof.gob.mx',           // Diario Oficial de la Federación
    'scjn.gob.mx',          // Suprema Corte de Justicia de la Nación
    'diputados.gob.mx',     // Cámara de Diputados
    'senado.gob.mx',        // Senado de la República
    'gob.mx',               // Portal general del gobierno
    'sat.gob.mx',           // Servicio de Administración Tributaria
    'imss.gob.mx',          // Instituto Mexicano del Seguro Social
    'infonavit.org.mx',     // INFONAVIT
    'cofece.mx',            // Comisión Federal de Competencia Económica
    'cndh.org.mx'           // Comisión Nacional de los Derechos Humanos
  ];

  private userAgent = 'LexMX/1.0 (Legal Document Fetcher; +https://lexmx.github.io)';

  async fetchFromRequest(
    request: DocumentRequest,
    options: FetchOptions = {}
  ): Promise<string | null> {
    const { 
      validateSource = true, 
      timeout = 30000, 
      maxSize = 10 * 1024 * 1024, // 10MB
      signal 
    } = options;

    // Find the first valid source
    const source = request.sources.find(s => 
      s.type === 'url' && s.url || 
      s.type === 'pdf_upload' && s.content
    );

    if (!source) {
      throw new Error('No valid source found in request');
    }

    if (source.type === 'url' && source.url) {
      return await this.fetchFromUrl(source.url, {
        validateSource,
        timeout,
        maxSize,
        signal
      });
    }

    if (source.type === 'pdf_upload' && source.content) {
      return source.content;
    }

    return null;
  }

  async fetchFromUrl(
    url: string,
    options: FetchOptions = {}
  ): Promise<string> {
    const { validateSource = true, timeout = 30000, maxSize, signal } = options;

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }

    // Check if source is official
    if (validateSource) {
      const isOfficial = this.isOfficialSource(parsedUrl.hostname);
      if (!isOfficial) {
        console.warn(`Warning: Fetching from non-official source: ${parsedUrl.hostname}`);
      }
    }

    // Create fetch options
    const fetchOptions: RequestInit = {
      method: 'GET',
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/pdf,application/xml,text/plain'
      },
      signal: signal || AbortSignal.timeout(timeout)
    };

    try {
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check content size
      const contentLength = response.headers.get('content-length');
      if (contentLength && maxSize) {
        const size = parseInt(contentLength, 10);
        if (size > maxSize) {
          throw new Error(`Document too large: ${size} bytes (max: ${maxSize})`);
        }
      }

      // Get content type
      const contentType = response.headers.get('content-type') || 'text/plain';

      // Handle different content types
      if (contentType.includes('application/pdf')) {
        // For PDFs, we'd need a PDF parser
        // For now, return a placeholder
        return `[PDF Document from ${url}]\n\nThis document requires PDF parsing.`;
      }

      if (contentType.includes('application/xml') || contentType.includes('text/xml')) {
        const text = await response.text();
        return this.parseXmlContent(text);
      }

      // Default: treat as text/html or plain text
      const text = await response.text();
      
      // If it's HTML, try to extract the main content
      if (contentType.includes('text/html')) {
        return this.extractHtmlContent(text);
      }

      return text;

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Fetch timeout after ${timeout}ms`);
        }
        throw error;
      }
      throw new Error('Unknown fetch error');
    }
  }

  /**
   * Fetch from specific official sources with custom handling
   */
  async fetchFromDOF(date: string, documentNumber?: string): Promise<string> {
    // Construct DOF URL
    const baseUrl = 'https://www.dof.gob.mx/nota_detalle.php';
    const params = new URLSearchParams({
      fecha: date, // Format: DD/MM/YYYY
      ...(documentNumber && { codigo: documentNumber })
    });

    const url = `${baseUrl}?${params}`;
    return await this.fetchFromUrl(url);
  }

  async fetchFromSCJN(thesisNumber: string): Promise<string> {
    // Construct SCJN URL for jurisprudence
    const url = `https://sjf2.scjn.gob.mx/detalle/tesis/${thesisNumber}`;
    return await this.fetchFromUrl(url);
  }

  async fetchFromDiputados(lawId: string): Promise<string> {
    // Construct URL for Chamber of Deputies
    const url = `http://www.diputados.gob.mx/LeyesBiblio/pdf/${lawId}.pdf`;
    return await this.fetchFromUrl(url);
  }

  /**
   * Validate if a source is from an official domain
   */
  isOfficialSource(hostname: string): boolean {
    const lowerHost = hostname.toLowerCase();
    return this.officialDomains.some(domain => 
      lowerHost === domain || lowerHost.endsWith(`.${domain}`)
    );
  }

  /**
   * Extract main content from HTML
   */
  private extractHtmlContent(html: string): string {
    // Simple HTML content extraction
    // In production, use a proper HTML parser like cheerio or jsdom
    
    // Remove script and style tags
    let content = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    content = content.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    
    // Extract body content if present
    const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      content = bodyMatch[1];
    }
    
    // Remove HTML tags but preserve line breaks
    content = content.replace(/<br\s*\/?>/gi, '\n');
    content = content.replace(/<\/p>/gi, '\n\n');
    content = content.replace(/<\/div>/gi, '\n');
    content = content.replace(/<[^>]+>/g, '');
    
    // Decode HTML entities
    content = this.decodeHtmlEntities(content);
    
    // Clean up whitespace
    content = content.replace(/\n{3,}/g, '\n\n');
    content = content.trim();
    
    return content;
  }

  /**
   * Parse XML content (common for legal documents)
   */
  private parseXmlContent(xml: string): string {
    // Simple XML to text conversion
    // In production, use a proper XML parser
    
    // Remove XML declaration and comments
    let content = xml.replace(/<\?xml[^>]*\?>/gi, '');
    content = content.replace(/<!--[\s\S]*?-->/g, '');
    
    // Extract text content from tags
    content = content.replace(/<[^>]+>/g, ' ');
    
    // Clean up whitespace
    content = content.replace(/\s+/g, ' ');
    content = content.trim();
    
    return content;
  }

  /**
   * Decode HTML entities
   */
  private decodeHtmlEntities(text: string): string {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&iexcl;': '¡',
      '&iquest;': '¿',
      '&ntilde;': 'ñ',
      '&Ntilde;': 'Ñ',
      '&aacute;': 'á',
      '&eacute;': 'é',
      '&iacute;': 'í',
      '&oacute;': 'ó',
      '&uacute;': 'ú',
      '&Aacute;': 'Á',
      '&Eacute;': 'É',
      '&Iacute;': 'Í',
      '&Oacute;': 'Ó',
      '&Uacute;': 'Ú',
      '&uuml;': 'ü',
      '&Uuml;': 'Ü'
    };

    return text.replace(
      /&[a-zA-Z]+;|&#\d+;/g,
      match => entities[match] || match
    );
  }

  /**
   * Fetch and validate multiple sources
   */
  async fetchMultipleSources(
    sources: DocumentSource[],
    options: FetchOptions = {}
  ): Promise<string[]> {
    const results: string[] = [];
    
    for (const source of sources) {
      try {
        if (source.type === 'url' && source.url) {
          const content = await this.fetchFromUrl(source.url, options);
          results.push(content);
        }
      } catch (error) {
        console.error(`Failed to fetch from ${source.url}:`, error);
        // Continue with other sources
      }
    }
    
    return results;
  }
}