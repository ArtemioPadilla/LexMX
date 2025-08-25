// Document fetcher for retrieving legal documents from various sources
// Supports official Mexican government sources and validated URLs

import type { DocumentRequest, DocumentSource } from '@/types/legal';
import { contentExtractor, type ExtractionOptions } from './document-content-extractors';
import { corsAwareFetch, isLikelyCorsBlocked } from '../utils/cors-aware-fetch';

/**
 * Custom error for CORS-blocked requests with detailed information
 */
export class CorsBlockedError extends Error {
  public readonly corsBlocked = true;
  public readonly suggestions: string[];
  public readonly strategy?: string;

  constructor(message: string, details: {
    corsBlocked?: boolean;
    suggestions?: string[];
    strategy?: string;
  }) {
    super(message);
    this.name = 'CorsBlockedError';
    this.suggestions = details.suggestions || [];
    this.strategy = details.strategy;
  }
}

export interface FetchOptions {
  validateSource?: boolean;
  timeout?: number;
  maxSize?: number;
  signal?: AbortSignal;
  extractionOptions?: ExtractionOptions;
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
    fetchStrategy?: string;
    corsBlocked?: boolean;
    suggestions?: string[];
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
      // Use CORS-aware fetch to handle cross-origin requests
      const fetchResult = await corsAwareFetch(url, {
        ...fetchOptions,
        timeout,
        maxRetries: 2,
        useProxy: true,
        fallbackStrategies: ['proxy', 'no-cors']
      });

      if (!fetchResult.success) {
        const errorDetails = {
          corsBlocked: fetchResult.corsBlocked,
          suggestions: fetchResult.suggestions || [],
          strategy: fetchResult.strategy
        };
        
        // Provide detailed error information for CORS issues
        if (fetchResult.corsBlocked) {
          throw new CorsBlockedError(
            `CORS policy blocked access to ${url}. ${fetchResult.error || 'Cross-origin request not allowed.'}`,
            errorDetails
          );
        } else {
          throw new Error(fetchResult.error || 'Failed to fetch document');
        }
      }

      const response = fetchResult.data!;

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

      // Handle different content types using enhanced extractors
      if (contentType.includes('application/pdf') || 
          contentType.includes('application/msword') ||
          contentType.includes('application/vnd.openxml')) {
        
        // Use enhanced content extractor for binary formats
        const buffer = await response.arrayBuffer();
        const result = await contentExtractor.extractFromArrayBuffer(
          buffer, 
          contentType, 
          options.extractionOptions || {}
        );
        
        return result.text;
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

  async fetchFromDiputados(lawId: string, format: 'pdf' | 'doc' = 'pdf'): Promise<string> {
    // Construct URL for Chamber of Deputies
    const baseUrl = 'https://www.diputados.gob.mx/LeyesBiblio';
    const url = `${baseUrl}/${format}/${lawId}.${format}`;
    
    return await this.fetchFromUrl(url, {
      extractionOptions: {
        preserveFormatting: true,
        includeMetadata: true,
        maxPages: 1000 // Legal documents can be long
      }
    });
  }

  /**
   * Fetch specific Mexican legal documents with enhanced extraction
   */
  async fetchConstitution(format: 'pdf' | 'doc' = 'pdf'): Promise<string> {
    return await this.fetchFromDiputados('CPEUM', format);
  }

  async fetchLaborLaw(format: 'pdf' | 'doc' = 'pdf'): Promise<string> {
    return await this.fetchFromDiputados('125', format); // Ley Federal del Trabajo
  }

  async fetchCivilCode(format: 'pdf' | 'doc' = 'pdf'): Promise<string> {
    return await this.fetchFromDiputados('CCF', format);
  }

  async fetchPenalCode(format: 'pdf' | 'doc' = 'pdf'): Promise<string> {
    return await this.fetchFromDiputados('CPF', format);
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