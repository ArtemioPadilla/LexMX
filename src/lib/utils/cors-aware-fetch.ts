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
    // Local development proxy (always include for localhost)
    ...(typeof window !== 'undefined' && (
      window.location.hostname.includes('localhost') || 
      window.location.hostname.includes('127.0.0.1')
    ) ? ['http://localhost:3001'] : []),
    // Self-hosted proxies only - public proxies are unreliable
    // Add your own deployed proxy here when available
    // 'https://your-cors-proxy.vercel.app/api/proxy'
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

    // Immediate CORS detection for cross-origin requests
    const isCrossOrigin = this.isCrossOrigin(url);
    const isMexicanGovt = this.isMexicanGovtSite(url);
    
    console.log(`[CorsAwareFetch] Analyzing ${url}:`);
    console.log(`- Cross-origin: ${isCrossOrigin}`);
    console.log(`- Mexican govt: ${isMexicanGovt}`);

    // For cross-origin Mexican government sites, check local proxy first
    if (isCrossOrigin && isMexicanGovt) {
      console.log(`[CorsAwareFetch] Cross-origin Mexican govt site detected, trying direct fetch first...`);
      
      const directResult = await this.tryDirectFetch(url, fetchOptions, timeout);
      if (directResult.success) {
        return directResult;
      }

      console.log(`[CorsAwareFetch] Direct fetch failed, checking for local proxy...`);
      
      // Check if local development proxy is available
      const isLocalProxyAvailable = await this.isLocalProxyRunning();
      console.log(`[CorsAwareFetch] Local proxy available: ${isLocalProxyAvailable}`);
      
      if (isLocalProxyAvailable && this.CORS_PROXIES.length > 0) {
        console.log(`[CorsAwareFetch] Using local proxy for Mexican govt site...`);
        
        try {
          // Add race condition with timeout to prevent infinite hanging
          const proxyResult = await Promise.race([
            this.tryFallbackStrategy(url, 'proxy', fetchOptions, timeout),
            new Promise<CorsAwareFetchResult>((_, reject) => 
              setTimeout(() => reject(new Error('Proxy request timeout')), timeout + 1000)
            )
          ]);
          
          if (proxyResult.success) {
            return proxyResult;
          }
          console.log(`[CorsAwareFetch] Local proxy failed, providing user guidance`);
        } catch (error) {
          console.error(`[CorsAwareFetch] Proxy request failed with error:`, error);
        }
      } else {
        console.log(`[CorsAwareFetch] No local proxy available, providing user guidance`);
      }
      
      // Return CORS guidance only after trying available proxies
      return {
        success: false,
        error: 'Cross-origin request blocked by browser CORS policy',
        corsBlocked: true,
        strategy: isLocalProxyAvailable ? 'proxy-failed' : 'no-proxy',
        suggestions: this.generateSuggestions(url, true)
      };
    }

    // For same-origin or non-Mexican sites, try normal fetch flow
    const directResult = await this.tryDirectFetch(url, fetchOptions, timeout);
    if (directResult.success) {
      return directResult;
    }

    // If we have self-hosted proxies available, try them
    if (directResult.corsBlocked && this.CORS_PROXIES.length > 0) {
      console.log(`[CorsAwareFetch] Trying ${this.CORS_PROXIES.length} available proxies...`);
      
      for (const strategy of fallbackStrategies) {
        if (strategy === 'proxy') {
          const fallbackResult = await this.tryFallbackStrategy(url, strategy, fetchOptions, timeout);
          if (fallbackResult.success) {
            return fallbackResult;
          }
        }
      }
    } else if (directResult.corsBlocked) {
      console.log(`[CorsAwareFetch] No self-hosted proxies available, providing user guidance`);
    }

    // All strategies failed or no proxies available
    return {
      success: false,
      error: directResult.error || 'Failed to fetch document',
      corsBlocked: directResult.corsBlocked || isCrossOrigin,
      suggestions: this.generateSuggestions(url, directResult.corsBlocked || isCrossOrigin)
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
        // Properly construct proxy URL with query parameter
        const proxyUrl = `${proxyBase}/?url=${encodeURIComponent(url)}`;
        console.log(`[CorsAwareFetch] Trying proxy URL: ${proxyUrl}`);
        
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
          console.log(`[CorsAwareFetch] Proxy fetch successful: ${response.status}`);
          return {
            success: true,
            data: response,
            strategy: 'proxy'
          };
        } else {
          console.warn(`[CorsAwareFetch] Proxy responded with ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        console.error(`[CorsAwareFetch] Proxy ${proxyBase} failed:`, error);
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

  private static isCrossOrigin(url: string): boolean {
    try {
      const targetUrl = new URL(url);
      
      // In browser environment, compare with current origin
      if (typeof window !== 'undefined') {
        const currentOrigin = new URL(window.location.href);
        return targetUrl.origin !== currentOrigin.origin;
      }
      
      // In Node.js environment, assume cross-origin for external URLs
      return !targetUrl.hostname.includes('localhost') && !targetUrl.hostname.includes('127.0.0.1');
    } catch {
      return false;
    }
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

  /**
   * Check if local development proxy is running
   */
  private static async isLocalProxyRunning(): Promise<boolean> {
    if (typeof window === 'undefined' || this.CORS_PROXIES.length === 0) {
      return false;
    }
    
    try {
      const response = await fetch('http://localhost:3001/health', { 
        method: 'GET',
        signal: AbortSignal.timeout(2000) // 2 second timeout
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private static generateSuggestions(url: string, corsBlocked: boolean): string[] {
    const suggestions: string[] = [];
    const isLocalhost = typeof window !== 'undefined' && (
      window.location.hostname.includes('localhost') || 
      window.location.hostname.includes('127.0.0.1')
    );

    if (corsBlocked) {
      if (this.isMexicanGovtSite(url)) {
        // Specific guidance for Mexican government documents
        suggestions.push('🏛️ This is an official Mexican government document');
        suggestions.push('📥 Download manually: Right-click the link → "Save As" → save to your computer');
        suggestions.push('📤 Then upload: Use the file upload button above to select the downloaded file');
        suggestions.push('⚡ Automated ingestion: This document will be processed automatically in future updates');
        
        if (url.includes('.pdf')) {
          suggestions.push('📄 PDF detected: The file will be processed and made searchable once uploaded');
        }
        
        // Development-specific suggestions
        if (isLocalhost) {
          suggestions.push('🚀 Run local CORS proxy: `npm run dev:proxy` in another terminal');
          suggestions.push('🔧 Alternative: Install a CORS browser extension like "CORS Unblock"');
          suggestions.push('📊 Check proxy status: http://localhost:3001/health');
        }
      } else {
        suggestions.push('📥 Download the document manually and upload it using the file upload option');
        suggestions.push('🌐 Cross-origin requests are blocked by browser security policy');
      }
      
      suggestions.push('💡 The upload method is often more reliable than URL fetching');
      suggestions.push('📋 Submit document requests via GitHub Issues for automated processing');
    } else {
      suggestions.push('🔍 Check your internet connection');
      suggestions.push('🔗 Verify the document URL is correct and accessible');
      suggestions.push('⏰ The document server may be temporarily unavailable');
      suggestions.push('🔄 Try again in a few minutes');
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

/**
 * Check if local development proxy is running
 * Useful for UI components to show proxy status
 */
export async function checkLocalProxyStatus(): Promise<{
  running: boolean;
  url?: string;
  error?: string;
}> {
  const isLocalhost = typeof window !== 'undefined' && (
    window.location.hostname.includes('localhost') || 
    window.location.hostname.includes('127.0.0.1')
  );

  if (!isLocalhost) {
    return { running: false, error: 'Not in localhost environment' };
  }

  try {
    const response = await fetch('http://localhost:3001/health', { 
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    
    if (response.ok) {
      const data = await response.json();
      return { 
        running: true, 
        url: 'http://localhost:3001',
        ...data 
      };
    } else {
      return { running: false, error: `Proxy responded with ${response.status}` };
    }
  } catch (error) {
    return { 
      running: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}