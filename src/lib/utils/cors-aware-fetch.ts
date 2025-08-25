// CORS-aware fetch utility for handling cross-origin document requests
// Provides fallback strategies when direct fetching is blocked

export interface CorsAwareFetchOptions extends RequestInit {
  timeout?: number;
  maxRetries?: number;
  useProxy?: boolean;
  fallbackStrategies?: ('proxy' | 'no-cors' | 'iframe')[];
}

export interface CorsAwareFetchResult {
  success: boolean;
  data?: Response;
  content?: string;
  error?: string;
  strategy?: string;
  corsBlocked?: boolean;
  suggestions?: string[];
}

/**
 * Enhanced fetch that handles CORS issues gracefully
 */
export class CorsAwareFetch {
  private static readonly CORS_PROXIES = [
    // Public CORS proxies (use with caution in production)
    'https://api.codetabs.com/v1/proxy/?quest=',
    'https://cors-anywhere.herokuapp.com/',
    // Add your own deployed proxy here
    // 'https://your-cors-proxy.vercel.app/api/proxy?url='
  ];

  private static readonly MEXICAN_GOVT_DOMAINS = [
    'diputados.gob.mx',
    'dof.gob.mx', 
    'scjn.gob.mx',
    'senado.gob.mx',
    'gob.mx',
    'sat.gob.mx',
    'imss.gob.mx'
  ];

  static async fetch(url: string, options: CorsAwareFetchOptions = {}): Promise<CorsAwareFetchResult> {
    const {
      timeout = 30000,
      maxRetries = 2,
      useProxy = true,
      fallbackStrategies = ['proxy', 'no-cors'],
      ...fetchOptions
    } = options;

    // First try direct fetch
    const directResult = await this.tryDirectFetch(url, fetchOptions, timeout);
    if (directResult.success) {
      return directResult;
    }

    // If CORS blocked and it's a Mexican government site, try fallback strategies
    if (directResult.corsBlocked && this.isMexicanGovtSite(url)) {
      for (const strategy of fallbackStrategies) {
        const fallbackResult = await this.tryFallbackStrategy(url, strategy, fetchOptions, timeout);
        if (fallbackResult.success) {
          return fallbackResult;
        }
      }
    }

    // All strategies failed, return comprehensive error information
    return {
      success: false,
      error: directResult.error || 'Failed to fetch document',
      corsBlocked: directResult.corsBlocked,
      suggestions: this.generateSuggestions(url, directResult.corsBlocked)
    };
  }

  private static async tryDirectFetch(
    url: string, 
    options: RequestInit, 
    timeout: number
  ): Promise<CorsAwareFetchResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
          corsBlocked: false
        };
      }

      return {
        success: true,
        data: response,
        strategy: 'direct'
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const corsBlocked = this.isCorsError(errorMessage);

      return {
        success: false,
        error: errorMessage,
        corsBlocked
      };
    }
  }

  private static async tryFallbackStrategy(
    url: string,
    strategy: string,
    options: RequestInit,
    timeout: number
  ): Promise<CorsAwareFetchResult> {
    switch (strategy) {
      case 'proxy':
        return await this.tryProxyFetch(url, options, timeout);
      case 'no-cors':
        return await this.tryNoCors(url, options, timeout);
      case 'iframe':
        return await this.tryIframeFetch(url);
      default:
        return {
          success: false,
          error: `Unknown fallback strategy: ${strategy}`,
          corsBlocked: true
        };
    }
  }

  private static async tryProxyFetch(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<CorsAwareFetchResult> {
    for (const proxyBase of this.CORS_PROXIES) {
      try {
        const proxyUrl = `${proxyBase}${encodeURIComponent(url)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(proxyUrl, {
          ...options,
          signal: controller.signal,
          headers: {
            ...options.headers,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          return {
            success: true,
            data: response,
            strategy: 'proxy'
          };
        }
      } catch (error) {
        // Try next proxy
        continue;
      }
    }

    return {
      success: false,
      error: 'All CORS proxies failed',
      corsBlocked: true
    };
  }

  private static async tryNoCors(
    url: string,
    options: RequestInit,
    timeout: number
  ): Promise<CorsAwareFetchResult> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Note: no-cors mode has limited functionality
      const response = await fetch(url, {
        ...options,
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      return {
        success: true,
        data: response,
        strategy: 'no-cors',
        error: 'Content may be incomplete due to no-cors mode limitations'
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'No-cors fetch failed',
        corsBlocked: true
      };
    }
  }

  private static async tryIframeFetch(url: string): Promise<CorsAwareFetchResult> {
    // This is a placeholder for iframe-based fetching
    // In practice, this would require postMessage communication
    return {
      success: false,
      error: 'Iframe fetching not yet implemented',
      corsBlocked: true,
      suggestions: ['Use browser extension', 'Download and upload manually']
    };
  }

  private static isCorsError(errorMessage: string): boolean {
    const corsKeywords = [
      'CORS',
      'Cross-Origin Request Blocked',
      'Access-Control-Allow-Origin',
      'blocked by CORS policy',
      'No \'Access-Control-Allow-Origin\' header'
    ];

    return corsKeywords.some(keyword => 
      errorMessage.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  private static isMexicanGovtSite(url: string): boolean {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return this.MEXICAN_GOVT_DOMAINS.some(domain => 
        hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  private static generateSuggestions(url: string, corsBlocked: boolean): string[] {
    const suggestions: string[] = [];

    if (corsBlocked) {
      suggestions.push('Try downloading the document manually and uploading it instead');
      
      if (this.isMexicanGovtSite(url)) {
        suggestions.push('This is an official Mexican government document');
        suggestions.push('Consider using a browser extension to bypass CORS');
        suggestions.push('The document can be found in your browser\'s downloads folder');
      }

      if (url.includes('.pdf')) {
        suggestions.push('Right-click the link and "Save As" to download the PDF');
        suggestions.push('Then use the file upload option in the admin interface');
      }

      suggestions.push('Contact the administrator to configure a CORS proxy');
    } else {
      suggestions.push('Check your internet connection');
      suggestions.push('Verify the document URL is correct');
      suggestions.push('The document may be temporarily unavailable');
    }

    return suggestions;
  }
}

/**
 * Convenience function for simple CORS-aware fetching
 */
export async function corsAwareFetch(
  url: string, 
  options?: CorsAwareFetchOptions
): Promise<CorsAwareFetchResult> {
  return CorsAwareFetch.fetch(url, options);
}

/**
 * Check if a URL is likely to have CORS issues
 */
export function isLikelyCorsBlocked(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    
    // Different origin = potential CORS issue
    return urlObj.origin !== currentOrigin;
  } catch {
    return false;
  }
}