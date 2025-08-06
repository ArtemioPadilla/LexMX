import type { 
  SpamDetectionResult, 
  RateLimitInfo, 
  DocumentRequest 
} from '../../types/legal';
import { SourceValidator } from './source-validator';

/**
 * Comprehensive Security Manager for Document Request System
 * Handles anti-spam, rate limiting, content filtering, and abuse prevention
 */
export class SecurityManager {
  private static readonly STORAGE_KEYS = {
    RATE_LIMITS: 'lexmx_rate_limits',
    USER_REPORTS: 'lexmx_user_reports',
    BLOCKED_USERS: 'lexmx_blocked_users',
    SPAM_PATTERNS: 'lexmx_spam_patterns'
  };

  private static readonly RATE_LIMITS = {
    REQUESTS_PER_HOUR: 5,
    VOTES_PER_HOUR: 50,
    COMMENTS_PER_HOUR: 20,
    REPORTS_PER_DAY: 10
  };

  private static readonly SUSPICIOUS_PATTERNS = [
    // Common spam patterns
    /(.)\1{10,}/, // Repeated characters
    /[A-Z]{50,}/, // Excessive capitals
    /(http|www\.)[^\s]{50,}/, // Very long URLs
    /\b(urgent|asap|immediate|now|fast|quick|hurry)\b/gi, // Urgency keywords
    /\b(winner|lottery|prize|congratulations|selected)\b/gi, // Prize scam keywords
    /\b(click here|visit now|act now|limited time)\b/gi, // Action spam keywords
    /\b(free money|make money|work from home|investment opportunity)\b/gi, // Money scam keywords
    /[^\w\s]{20,}/, // Excessive special characters
  ];

  private static readonly LEGAL_KEYWORDS = [
    'ley', 'código', 'reglamento', 'norma', 'decreto', 'acuerdo', 'constitución',
    'jurisprudencia', 'tribunal', 'corte', 'derecho', 'legal', 'jurídico',
    'artículo', 'fracción', 'inciso', 'párrafo', 'título', 'capítulo',
    'federal', 'estatal', 'municipal', 'civil', 'penal', 'laboral', 'fiscal',
    'mercantil', 'administrativo', 'amparo', 'juicio', 'procedimiento'
  ];

  /**
   * Main security check for new requests
   */
  static async validateRequest(
    request: Partial<DocumentRequest>,
    userFingerprint: string,
    userIP?: string
  ): Promise<{
    isValid: boolean;
    violations: string[];
    riskScore: number;
    action: 'allow' | 'review' | 'block';
  }> {
    const violations: string[] = [];
    let riskScore = 0;

    // 1. Rate limiting check
    const rateLimitCheck = await this.checkRateLimit(userFingerprint, 'requests');
    if (!rateLimitCheck.allowed) {
      violations.push(`Límite de velocidad excedido. Intenta en ${Math.ceil((rateLimitCheck.resetAt.getTime() - Date.now()) / 60000)} minutos`);
      riskScore += 0.8;
    }

    // 2. Content spam detection
    const spamCheck = this.detectContentSpam(request.title || '', request.description || '');
    if (spamCheck.isSpam) {
      violations.push(...spamCheck.reasons);
      riskScore += spamCheck.confidence;
    }

    // 3. User behavior analysis
    const behaviorCheck = await this.analyzeUserBehavior(userFingerprint);
    if (behaviorCheck.isSuspicious) {
      violations.push(...behaviorCheck.reasons);
      riskScore += behaviorCheck.riskIncrease;
    }

    // 4. Source validation
    if (request.sources && request.sources.length > 0) {
      const sourceChecks = await Promise.all(
        request.sources.map(source => this.validateRequestSource(source))
      );
      
      const suspiciousSources = sourceChecks.filter(check => !check.isValid);
      if (suspiciousSources.length > 0) {
        violations.push(`${suspiciousSources.length} fuente(s) sospechosa(s) detectada(s)`);
        riskScore += suspiciousSources.length * 0.3;
      }
    }

    // 5. IP-based checks (if available)
    if (userIP) {
      const ipCheck = await this.checkIPReputation(userIP);
      if (ipCheck.isRisky) {
        violations.push('IP con reputación sospechosa');
        riskScore += 0.4;
      }
    }

    // 6. Content relevance check
    const relevanceCheck = this.checkLegalRelevance(request.title || '', request.description || '');
    if (!relevanceCheck.isRelevant) {
      violations.push('Contenido no parece estar relacionado con documentos legales mexicanos');
      riskScore += 0.5;
    }

    // Determine action based on risk score
    let action: 'allow' | 'review' | 'block' = 'allow';
    if (riskScore >= 1.0) {
      action = 'block';
    } else if (riskScore >= 0.5) {
      action = 'review';
    }

    return {
      isValid: action !== 'block',
      violations,
      riskScore: Math.min(1, riskScore),
      action
    };
  }

  /**
   * Rate limiting system
   */
  static async checkRateLimit(
    userFingerprint: string,
    action: 'requests' | 'votes' | 'comments' | 'reports'
  ): Promise<RateLimitInfo> {
    const limits = {
      requests: this.RATE_LIMITS.REQUESTS_PER_HOUR,
      votes: this.RATE_LIMITS.VOTES_PER_HOUR,
      comments: this.RATE_LIMITS.COMMENTS_PER_HOUR,
      reports: this.RATE_LIMITS.REPORTS_PER_DAY
    };

    const windowMs = action === 'reports' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000; // 1 day or 1 hour
    const maxActions = limits[action];

    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.RATE_LIMITS);
      const rateLimits: Record<string, Array<{ timestamp: number; action: string }>> = 
        stored ? JSON.parse(stored) : {};

      const userActions = rateLimits[userFingerprint] || [];
      const now = Date.now();
      const windowStart = now - windowMs;

      // Filter out old actions
      const recentActions = userActions.filter(
        actionRecord => actionRecord.timestamp >= windowStart && actionRecord.action === action
      );

      const remaining = Math.max(0, maxActions - recentActions.length);
      const resetAt = new Date(windowStart + windowMs);

      // Update storage with recent actions only
      rateLimits[userFingerprint] = userActions.filter(
        actionRecord => actionRecord.timestamp >= windowStart
      );
      localStorage.setItem(this.STORAGE_KEYS.RATE_LIMITS, JSON.stringify(rateLimits));

      return {
        requests: recentActions.length,
        windowStart: new Date(windowStart).toISOString(),
        windowEnd: new Date(now).toISOString(),
        remaining,
        resetAt: resetAt.toISOString(),
        allowed: remaining > 0
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Fail open - allow the action
      return {
        requests: 0,
        windowStart: new Date(Date.now() - windowMs).toISOString(),
        windowEnd: new Date().toISOString(),
        remaining: maxActions,
        resetAt: new Date(Date.now() + windowMs).toISOString(),
        allowed: true
      };
    }
  }

  /**
   * Records an action for rate limiting
   */
  static async recordAction(
    userFingerprint: string,
    action: 'requests' | 'votes' | 'comments' | 'reports'
  ): Promise<void> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEYS.RATE_LIMITS);
      const rateLimits: Record<string, Array<{ timestamp: number; action: string }>> = 
        stored ? JSON.parse(stored) : {};

      if (!rateLimits[userFingerprint]) {
        rateLimits[userFingerprint] = [];
      }

      rateLimits[userFingerprint].push({
        timestamp: Date.now(),
        action
      });

      localStorage.setItem(this.STORAGE_KEYS.RATE_LIMITS, JSON.stringify(rateLimits));
    } catch (error) {
      console.error('Error recording action:', error);
    }
  }

  /**
   * Enhanced spam detection
   */
  private static detectContentSpam(title: string, description: string): SpamDetectionResult {
    const reasons: string[] = [];
    let confidence = 0;

    const fullText = (title + ' ' + description).toLowerCase();

    // Check for suspicious patterns
    for (const pattern of this.SUSPICIOUS_PATTERNS) {
      if (pattern.test(fullText)) {
        reasons.push('Patrón sospechoso detectado en el texto');
        confidence += 0.2;
      }
    }

    // Check for minimal content
    if (title.length < 5 || description.length < 20) {
      reasons.push('Contenido demasiado breve');
      confidence += 0.3;
    }

    // Check for excessive length
    if (title.length > 300 || description.length > 10000) {
      reasons.push('Contenido excesivamente largo');
      confidence += 0.2;
    }

    // Check character repetition
    const repetitionRatio = this.calculateRepetitionRatio(fullText);
    if (repetitionRatio > 0.3) {
      reasons.push('Contenido muy repetitivo');
      confidence += 0.3;
    }

    // Check for excessive links
    const urlCount = (fullText.match(/https?:\/\/[^\s]+/g) || []).length;
    if (urlCount > 5) {
      reasons.push('Demasiados enlaces');
      confidence += 0.2;
    }

    // Check for non-Spanish content (basic check)
    const spanishWords = ['el', 'la', 'de', 'en', 'y', 'a', 'que', 'es', 'se', 'no', 'te', 'lo', 'le', 'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del'];
    const wordCount = fullText.split(/\s+/).length;
    const spanishWordCount = spanishWords.filter(word => fullText.includes(word)).length;
    
    if (wordCount > 10 && spanishWordCount / wordCount < 0.1) {
      reasons.push('Contenido posiblemente no en español');
      confidence += 0.3;
    }

    // Check for contact information (potential spam)
    const contactPatterns = [
      /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/, // Phone numbers
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email addresses
      /whatsapp|telegram|facebook|instagram/i // Social media references
    ];

    let contactCount = 0;
    for (const pattern of contactPatterns) {
      if (pattern.test(fullText)) {
        contactCount++;
      }
    }

    if (contactCount > 2) {
      reasons.push('Excesiva información de contacto');
      confidence += 0.4;
    }

    const isSpam = confidence >= 0.5;
    const action: 'allow' | 'flag' | 'block' = confidence >= 0.8 ? 'block' : confidence >= 0.5 ? 'flag' : 'allow';

    return {
      isSpam,
      confidence: Math.min(1, confidence),
      reasons,
      action
    };
  }

  /**
   * User behavior analysis
   */
  private static async analyzeUserBehavior(userFingerprint: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskIncrease: number;
  }> {
    const reasons: string[] = [];
    let riskIncrease = 0;

    try {
      // Check if user is blocked
      const blockedUsers = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.BLOCKED_USERS) || '[]');
      if (blockedUsers.includes(userFingerprint)) {
        reasons.push('Usuario bloqueado previamente');
        riskIncrease += 1.0;
      }

      // Check user reports
      const userReports = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.USER_REPORTS) || '{}');
      const reportCount = userReports[userFingerprint] || 0;
      
      if (reportCount >= 3) {
        reasons.push('Usuario con múltiples reportes');
        riskIncrease += 0.4;
      }

      // Check recent activity pattern
      const rateLimits = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.RATE_LIMITS) || '{}');
      const userActions = rateLimits[userFingerprint] || [];
      
      if (userActions.length > 0) {
        const recentActions = userActions.filter(action => 
          Date.now() - action.timestamp < 10 * 60 * 1000 // Last 10 minutes
        );
        
        if (recentActions.length > 10) {
          reasons.push('Actividad excesivamente rápida');
          riskIncrease += 0.3;
        }

        // Check for suspicious timing patterns
        const timestamps = recentActions.map(action => action.timestamp).sort();
        let suspiciousIntervals = 0;
        
        for (let i = 1; i < timestamps.length; i++) {
          const interval = timestamps[i] - timestamps[i - 1];
          if (interval < 1000) { // Less than 1 second between actions
            suspiciousIntervals++;
          }
        }
        
        if (suspiciousIntervals > 3) {
          reasons.push('Patrón de actividad no humano detectado');
          riskIncrease += 0.5;
        }
      }

      return {
        isSuspicious: riskIncrease > 0,
        reasons,
        riskIncrease: Math.min(1, riskIncrease)
      };
    } catch (error) {
      console.error('Error analyzing user behavior:', error);
      return {
        isSuspicious: false,
        reasons: [],
        riskIncrease: 0
      };
    }
  }

  /**
   * Validate request sources for suspicious patterns
   */
  private static async validateRequestSource(source: any): Promise<{ isValid: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    if (source.type === 'url' && source.url) {
      try {
        const url = new URL(source.url);
        
        // Check for suspicious domains
        const suspiciousDomains = ['bit.ly', 'tinyurl.com', 'goo.gl', 't.co', 'ow.ly'];
        if (suspiciousDomains.some(domain => url.hostname.includes(domain))) {
          reasons.push('URL acortada sospechosa');
        }

        // Check for non-HTTPS in government domains
        if (url.hostname.includes('.gob.mx') && url.protocol !== 'https:') {
          reasons.push('Conexión no segura para sitio gubernamental');
        }

        // Check for suspicious parameters
        const suspiciousParams = ['ref', 'affiliate', 'partner', 'promo'];
        for (const param of suspiciousParams) {
          if (url.searchParams.has(param)) {
            reasons.push('Parámetros sospechosos en URL');
            break;
          }
        }

        // Check URL length
        if (source.url.length > 500) {
          reasons.push('URL excesivamente larga');
        }

      } catch (error) {
        reasons.push('URL mal formada');
      }
    }

    if (source.type === 'pdf_upload' && source.filename) {
      // Check for suspicious filenames
      const suspiciousPatterns = [
        /virus|malware|trojan|hack/i,
        /^[a-z0-9]{32,}\./, // Hash-like filenames
        /\.(exe|bat|scr|com|pif|vbs|jar)$/i // Executable file extensions
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(source.filename)) {
          reasons.push('Nombre de archivo sospechoso');
          break;
        }
      }
    }

    return {
      isValid: reasons.length === 0,
      reasons
    };
  }

  /**
   * Basic IP reputation check (mock implementation)
   */
  private static async checkIPReputation(ip: string): Promise<{ isRisky: boolean; reasons: string[] }> {
    // In a real implementation, this would check against IP reputation services
    // For now, we'll do basic checks
    
    const reasons: string[] = [];
    let isRisky = false;

    // Check for local/private IPs (shouldn't happen in production)
    const privateIPPatterns = [
      /^127\./, // Localhost
      /^192\.168\./, // Private class C
      /^10\./, // Private class A
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./ // Private class B
    ];

    if (privateIPPatterns.some(pattern => pattern.test(ip))) {
      reasons.push('IP privada/local detectada');
      isRisky = true;
    }

    // Mock check for known bad IP ranges (in real implementation, use reputation service)
    const knownBadIPs = ['192.0.2.0', '198.51.100.0', '203.0.113.0']; // RFC 5737 test IPs
    if (knownBadIPs.some(badIP => ip.startsWith(badIP))) {
      reasons.push('IP en lista negra');
      isRisky = true;
    }

    return { isRisky, reasons };
  }

  /**
   * Check legal relevance of content
   */
  private static checkLegalRelevance(title: string, description: string): { isRelevant: boolean; score: number } {
    const fullText = (title + ' ' + description).toLowerCase();
    
    let legalKeywordCount = 0;
    for (const keyword of this.LEGAL_KEYWORDS) {
      if (fullText.includes(keyword)) {
        legalKeywordCount++;
      }
    }

    // Calculate relevance score
    const wordCount = fullText.split(/\s+/).length;
    const relevanceScore = legalKeywordCount / Math.max(1, wordCount / 10); // Normalize by text length

    return {
      isRelevant: relevanceScore >= 0.1 || legalKeywordCount >= 2,
      score: Math.min(1, relevanceScore)
    };
  }

  /**
   * Calculate text repetition ratio
   */
  private static calculateRepetitionRatio(text: string): number {
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const uniqueWords = new Set(words);
    
    if (words.length === 0) return 0;
    
    return 1 - (uniqueWords.size / words.length);
  }

  /**
   * Report user for suspicious activity
   */
  static async reportUser(
    reporterFingerprint: string,
    targetFingerprint: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Check if reporter is allowed to make reports
      const reportRateCheck = await this.checkRateLimit(reporterFingerprint, 'reports');
      if (!reportRateCheck.allowed) {
        return {
          success: false,
          message: 'Límite de reportes excedido'
        };
      }

      const userReports = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.USER_REPORTS) || '{}');
      userReports[targetFingerprint] = (userReports[targetFingerprint] || 0) + 1;
      
      localStorage.setItem(this.STORAGE_KEYS.USER_REPORTS, JSON.stringify(userReports));
      await this.recordAction(reporterFingerprint, 'reports');

      // Auto-block users with many reports
      if (userReports[targetFingerprint] >= 5) {
        const blockedUsers = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.BLOCKED_USERS) || '[]');
        if (!blockedUsers.includes(targetFingerprint)) {
          blockedUsers.push(targetFingerprint);
          localStorage.setItem(this.STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(blockedUsers));
        }
      }

      return {
        success: true,
        message: 'Reporte enviado exitosamente'
      };
    } catch (error) {
      console.error('Error reporting user:', error);
      return {
        success: false,
        message: 'Error al enviar reporte'
      };
    }
  }

  /**
   * Block a user
   */
  static async blockUser(userFingerprint: string, reason: string): Promise<void> {
    try {
      const blockedUsers = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.BLOCKED_USERS) || '[]');
      if (!blockedUsers.includes(userFingerprint)) {
        blockedUsers.push(userFingerprint);
        localStorage.setItem(this.STORAGE_KEYS.BLOCKED_USERS, JSON.stringify(blockedUsers));
      }

      // Log the blocking action
      console.log(`User ${userFingerprint} blocked for: ${reason}`);
    } catch (error) {
      console.error('Error blocking user:', error);
    }
  }

  /**
   * Check if user is blocked
   */
  static isUserBlocked(userFingerprint: string): boolean {
    try {
      const blockedUsers = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.BLOCKED_USERS) || '[]');
      return blockedUsers.includes(userFingerprint);
    } catch (error) {
      console.error('Error checking if user is blocked:', error);
      return false;
    }
  }

  /**
   * Clean up old security data
   */
  static async cleanupSecurityData(): Promise<void> {
    try {
      const now = Date.now();
      const rateLimitThreshold = now - (48 * 60 * 60 * 1000); // 48 hours
      
      // Clean rate limit data
      const rateLimits = JSON.parse(localStorage.getItem(this.STORAGE_KEYS.RATE_LIMITS) || '{}');
      
      for (const [userFingerprint, actions] of Object.entries(rateLimits)) {
        const recentActions = (actions as any[]).filter(action => action.timestamp >= rateLimitThreshold);
        if (recentActions.length > 0) {
          rateLimits[userFingerprint] = recentActions;
        } else {
          delete rateLimits[userFingerprint];
        }
      }
      
      localStorage.setItem(this.STORAGE_KEYS.RATE_LIMITS, JSON.stringify(rateLimits));

      // Reset user reports older than 30 days
      const reportThreshold = now - (30 * 24 * 60 * 60 * 1000); // 30 days
      // This is a simplified cleanup - in a real app, you'd track report timestamps
      
      console.log('Security data cleanup completed');
    } catch (error) {
      console.error('Error cleaning up security data:', error);
    }
  }
}