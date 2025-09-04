// Pre-flight CORS detection and environment analysis
// Determines whether a URL will have CORS issues before attempting fetch

export interface CorsAnalysisResult {
  willBeCorsBlocked: boolean;
  isCrossOrigin: boolean;
  isMexicanGovt: boolean;
  environment: 'github-pages' | 'localhost' | 'other';
  corsProxyAvailable: boolean;
  shouldShowGuidance: boolean;
  suggestions: string[];
  canAttemptFetch: boolean;
  // Enhanced with i18n support
  title: string;
  description: string;
  quickFix: string;
  actionSteps: string[];
}

export interface CorsProxyStatus {
  available: boolean;
  healthy: boolean;
  url?: string;
  checkedAt: number;
}

/**
 * CORS Detection and Analysis Utility
 * 
 * This utility provides pre-flight CORS analysis to avoid failed network requests
 * and provide immediate, context-aware guidance to users.
 */
export class CorsDetector {
  private static readonly MEXICAN_GOVT_DOMAINS = [
    'diputados.gob.mx',
    'dof.gob.mx',
    'scjn.gob.mx',
    'senado.gob.mx',
    'gob.mx',
    'sat.gob.mx',
    'imss.gob.mx',
    'infonavit.org.mx'
  ];

  private static readonly CORS_PROXY_URL = 'http://localhost:3002';
  private static proxyStatusCache: CorsProxyStatus | null = null;
  private static readonly PROXY_CACHE_TTL = 30000; // 30 seconds
  private static readonly FAILED_CACHE_TTL = 300000; // 5 minutes for failed attempts

  /**
   * Analyze a URL for CORS issues without making network requests
   * Now supports i18n with translations parameter
   */
  static async analyzeCorsRequirements(url: string, translations?: any): Promise<CorsAnalysisResult> {
    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return {
        willBeCorsBlocked: false,
        isCrossOrigin: false,
        isMexicanGovt: false,
        environment: this.detectEnvironment(),
        corsProxyAvailable: false,
        shouldShowGuidance: false,
        suggestions: ['Invalid URL format'],
        canAttemptFetch: false,
        title: 'Invalid URL',
        description: 'The provided URL format is not valid',
        quickFix: 'Please check the URL and try again',
        actionSteps: ['Verify URL format', 'Check for typos']
      };
    }

    // Environment detection
    const environment = this.detectEnvironment();
    
    // Cross-origin analysis
    const isCrossOrigin = this.isCrossOrigin(parsedUrl);
    
    // Mexican government domain check
    const isMexicanGovt = this.isMexicanGovtSite(parsedUrl);
    
    // CORS proxy availability (only check in localhost environment)
    const corsProxyStatus = environment === 'localhost' 
      ? await this.checkCorsProxyAvailability()
      : { available: false, healthy: false, checkedAt: Date.now() };

    // Decision logic
    const willBeCorsBlocked = isCrossOrigin && !corsProxyStatus.healthy;
    const shouldShowGuidance = willBeCorsBlocked && isMexicanGovt;
    const canAttemptFetch = !isCrossOrigin || corsProxyStatus.healthy;

    // Generate context-specific suggestions with i18n support
    const guidanceData = this.generateContextualGuidance({
      url,
      isCrossOrigin,
      isMexicanGovt,
      environment,
      corsProxyAvailable: corsProxyStatus.available,
      corsProxyHealthy: corsProxyStatus.healthy,
      willBeCorsBlocked,
      translations
    });

    return {
      willBeCorsBlocked,
      isCrossOrigin,
      isMexicanGovt,
      environment,
      corsProxyAvailable: corsProxyStatus.available,
      shouldShowGuidance,
      suggestions: guidanceData.suggestions, // Keep for backward compatibility
      canAttemptFetch,
      title: guidanceData.title,
      description: guidanceData.description,
      quickFix: guidanceData.quickFix,
      actionSteps: guidanceData.actionSteps
    };
  }

  /**
   * Detect the current environment
   */
  static detectEnvironment(): 'github-pages' | 'localhost' | 'other' {
    if (typeof window === 'undefined') {
      return 'other'; // SSR context
    }

    const hostname = window.location.hostname;
    
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'localhost';
    }
    
    if (hostname.includes('github.io')) {
      return 'github-pages';
    }
    
    return 'other';
  }

  /**
   * Check if URL is cross-origin
   */
  private static isCrossOrigin(targetUrl: URL): boolean {
    if (typeof window === 'undefined') {
      return true; // Assume cross-origin in SSR
    }

    const currentOrigin = new URL(window.location.href);
    return targetUrl.origin !== currentOrigin.origin;
  }

  /**
   * Check if URL is from Mexican government domain
   */
  private static isMexicanGovtSite(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();
    return this.MEXICAN_GOVT_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  }

  /**
   * Check CORS proxy availability and health
   */
  static async checkCorsProxyAvailability(): Promise<CorsProxyStatus> {
    // Return cached result if still valid
    if (this.proxyStatusCache) {
      const age = Date.now() - this.proxyStatusCache.checkedAt;
      const cacheTimeout = this.proxyStatusCache.healthy 
        ? this.PROXY_CACHE_TTL 
        : this.FAILED_CACHE_TTL; // Cache failed attempts longer
      
      if (age < cacheTimeout) {
        return this.proxyStatusCache;
      }
    }

    // Perform health check
    const result: CorsProxyStatus = {
      available: false,
      healthy: false,
      checkedAt: Date.now()
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout

      const response = await fetch(`${this.CORS_PROXY_URL}/health`, {
        signal: controller.signal,
        method: 'GET'
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const healthData = await response.json();
        result.available = true;
        result.healthy = healthData.status === 'healthy';
        result.url = this.CORS_PROXY_URL;
      }
    } catch (error) {
      // Proxy not available or unhealthy - silently handle to prevent console spam
      result.available = false;
      result.healthy = false;
      
      // Only log connection errors in development, not in production/GitHub Pages
      if (this.detectEnvironment() === 'localhost') {
        console.debug('CORS proxy not available:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Cache the result (especially important for failed attempts to prevent spam)
    this.proxyStatusCache = result;
    return result;
  }

  /**
   * Generate context-specific guidance with i18n support
   */
  private static generateContextualGuidance(context: {
    url: string;
    isCrossOrigin: boolean;
    isMexicanGovt: boolean;
    environment: string;
    corsProxyAvailable: boolean;
    corsProxyHealthy: boolean;
    willBeCorsBlocked: boolean;
    translations?: any;
  }): {
    title: string;
    description: string;
    quickFix: string;
    actionSteps: string[];
    suggestions: string[]; // Keep for backward compatibility
  } {
    const { 
      url, 
      isCrossOrigin, 
      isMexicanGovt, 
      environment, 
      corsProxyAvailable, 
      corsProxyHealthy, 
      willBeCorsBlocked,
      translations 
    } = context;

    // Helper function to get translated text or fallback
    const t = (key: string, params?: any) => {
      if (!translations) {
        // Fallback to English hardcoded strings
        return this.getFallbackText(key, params);
      }
      
      const keys = key.split('.');
      let value = translations;
      for (const k of keys) {
        value = value?.[k];
      }
      
      if (typeof value === 'string' && params) {
        return this.interpolateString(value, params);
      }
      
      return value || this.getFallbackText(key, params);
    };

    const actionSteps: string[] = [];
    let title: string;
    let description: string;
    let quickFix: string;

    // Not a CORS issue
    if (!willBeCorsBlocked) {
      if (!isCrossOrigin) {
        title = 'Same Origin URL';
        description = 'This URL should work normally.';
        quickFix = 'Ready to proceed with ingestion.';
        actionSteps.push('✅ Same-origin URL - should work normally');
      } else if (corsProxyHealthy) {
        title = t('corsGuidance.status.proxyHealthy');
        description = 'CORS proxy is available and healthy.';
        quickFix = t('corsGuidance.status.ready');
        actionSteps.push('✅ CORS proxy is healthy - URL ingestion enabled');
      }
      return {
        title,
        description,
        quickFix,
        actionSteps,
        suggestions: actionSteps // Backward compatibility
      };
    }

    // CORS will be blocked - provide specific guidance
    if (isMexicanGovt) {
      title = t('corsGuidance.title.mexicanGovt');
      description = t('corsGuidance.description.mexicanGovt');
      
      actionSteps.push('🏛️ ' + t('corsGuidance.steps.officialDocument'));
      
      // Environment-specific suggestions
      if (environment === 'github-pages') {
        quickFix = t('corsGuidance.quickFix.production');
        actionSteps.push('🌐 ' + t('corsGuidance.steps.productionEnvironment'));
        actionSteps.push('📥 ' + t('corsGuidance.steps.downloadMethod'));
        actionSteps.push('📤 ' + t('corsGuidance.steps.uploadMethod'));
        actionSteps.push('⚡ ' + t('corsGuidance.steps.automatedProcessing'));
      } else if (environment === 'localhost') {
        quickFix = t('corsGuidance.quickFix.development');
        
        if (corsProxyAvailable) {
          if (corsProxyHealthy) {
            actionSteps.push('✅ ' + t('corsGuidance.environment.development.proxyAvailable'));
          } else {
            actionSteps.push('⚠️ ' + t('corsGuidance.environment.development.proxyDetected'));
          }
        } else {
          actionSteps.push('🔧 ' + t('corsGuidance.steps.developmentEnvironment'));
          actionSteps.push('🚀 ' + t('corsGuidance.steps.enableUrlIngestion'));
          actionSteps.push('📋 ' + t('corsGuidance.steps.currentBasicServer'));
        }
        actionSteps.push('📥 ' + t('corsGuidance.steps.alternativeDownload'));
      } else {
        quickFix = 'Use download + upload method instead';
        actionSteps.push('🌐 ' + t('corsGuidance.steps.crossOriginBlocked'));
        actionSteps.push('📥 ' + t('corsGuidance.steps.downloadManually'));
      }

      if (url.includes('.pdf')) {
        actionSteps.push('📄 ' + t('corsGuidance.steps.pdfDetected'));
      }
    } else {
      // Non-Mexican government cross-origin URL
      title = t('corsGuidance.title.general');
      description = t('corsGuidance.description.general');
      quickFix = 'Download the document manually and upload it';
      
      actionSteps.push('🌐 ' + t('corsGuidance.steps.crossOriginBlocked'));
      actionSteps.push('📥 ' + t('corsGuidance.steps.downloadManually'));
      if (environment === 'localhost' && !corsProxyHealthy) {
        actionSteps.push('🔧 Or enable CORS proxy: run "make dev-full"');
      }
    }

    actionSteps.push('💡 ' + t('corsGuidance.steps.fileUploadReliable'));

    return {
      title,
      description,
      quickFix,
      actionSteps,
      suggestions: actionSteps // Backward compatibility
    };
  }

  /**
   * Fallback text for when translations are not available
   */
  private static getFallbackText(key: string, params?: any): string {
    const fallbacks: Record<string, string> = {
      'corsGuidance.title.mexicanGovt': 'Cross-Origin Policy Blocks Mexican Government Document',
      'corsGuidance.title.general': 'Cross-Origin Request Blocked by Browser Security',
      'corsGuidance.description.mexicanGovt': 'Browser security blocks direct access to external government websites. This is normal and expected.',
      'corsGuidance.description.general': 'Browser CORS policy prevents direct access to this external website.',
      'corsGuidance.quickFix.development': 'Open a new terminal and run make dev-full to enable URL ingestion.',
      'corsGuidance.quickFix.production': 'Use the file upload button above. Download the document manually, then select it from your computer.',
      'corsGuidance.steps.officialDocument': 'Official Mexican government document detected',
      'corsGuidance.steps.developmentEnvironment': 'Development environment - CORS proxy not running',
      'corsGuidance.steps.enableUrlIngestion': 'Enable URL ingestion: run "make dev-full" (starts dev server + CORS proxy)',
      'corsGuidance.steps.currentBasicServer': 'Current: "make start" (basic dev server only)',
      'corsGuidance.steps.alternativeDownload': 'Alternative: Download + upload method',
      'corsGuidance.steps.productionEnvironment': 'GitHub Pages environment - CORS proxy not available',
      'corsGuidance.steps.downloadMethod': 'Download method: Right-click URL → "Save Link As" → save to computer',
      'corsGuidance.steps.uploadMethod': 'Upload method: Use the file upload button above',
      'corsGuidance.steps.automatedProcessing': 'Automated processing: Submit document request for future updates',
      'corsGuidance.steps.pdfDetected': 'PDF detected - will be processed and made searchable once uploaded',
      'corsGuidance.steps.fileUploadReliable': 'File upload is often more reliable than URL fetching',
      'corsGuidance.steps.crossOriginBlocked': 'Cross-origin request blocked by browser security policy',
      'corsGuidance.steps.downloadManually': 'Download the document manually and upload it',
      'corsGuidance.environment.development.proxyAvailable': 'CORS proxy detected and healthy',
      'corsGuidance.environment.development.proxyDetected': 'CORS proxy detected but request still blocked',
      'corsGuidance.status.proxyHealthy': 'Proxy healthy - URL ingestion enabled',
      'corsGuidance.status.ready': 'Ready to ingest'
    };

    let text = fallbacks[key] || key;
    
    if (params) {
      text = this.interpolateString(text, params);
    }
    
    return text;
  }

  /**
   * Simple string interpolation for translations
   */
  private static interpolateString(template: string, params: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? String(params[key]) : match;
    });
  }

  /**
   * Get current CORS proxy status (cached)
   */
  static getCachedProxyStatus(): CorsProxyStatus | null {
    return this.proxyStatusCache;
  }

  /**
   * Clear proxy status cache (force recheck on next analysis)
   */
  static clearProxyCache(): void {
    this.proxyStatusCache = null;
  }

  /**
   * Quick check if URL should show immediate CORS guidance
   */
  static shouldShowImmediateGuidance(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      const isCrossOrigin = this.isCrossOrigin(parsedUrl);
      const isMexicanGovt = this.isMexicanGovtSite(parsedUrl);
      const environment = this.detectEnvironment();
      
      // Show guidance for cross-origin Mexican gov URLs unless we're in localhost with proxy
      return isCrossOrigin && isMexicanGovt && 
        (environment !== 'localhost' || !this.proxyStatusCache?.healthy);
    } catch {
      return false;
    }
  }
}

/**
 * Convenience function for quick CORS analysis
 */
export async function analyzeCors(url: string, translations?: any): Promise<CorsAnalysisResult> {
  return CorsDetector.analyzeCorsRequirements(url, translations);
}

/**
 * Quick synchronous check for immediate guidance needs
 */
export function needsImmediateGuidance(url: string): boolean {
  return CorsDetector.shouldShowImmediateGuidance(url);
}