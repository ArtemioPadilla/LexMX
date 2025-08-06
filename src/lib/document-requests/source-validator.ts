import type { 
  OfficialSourceValidation, 
  DocumentSource,
  SpamDetectionResult 
} from '../../types/legal';
import { OFFICIAL_SOURCES } from '../../types/legal';

/**
 * Official Source Validator
 * Validates URLs and documents against known official Mexican government sources
 */
export class SourceValidator {
  private static readonly DOF_PATTERNS = [
    /dof\.gob\.mx.*\/(\d{4})\/(\d{2})\/(\d{2})/,
    /diariooficial\.gob\.mx/
  ];

  private static readonly SCJN_PATTERNS = [
    /scjn\.gob\.mx/,
    /tribunales\.gob\.mx/
  ];

  private static readonly CONGRESS_PATTERNS = [
    /diputados\.gob\.mx/,
    /senado\.gob\.mx/,
    /congreso\.gob\.mx/
  ];

  private static readonly OFFICIAL_PATTERNS = [
    ...SourceValidator.DOF_PATTERNS,
    ...SourceValidator.SCJN_PATTERNS,
    ...SourceValidator.CONGRESS_PATTERNS,
    /gob\.mx/,
    /cndh\.org\.mx/,
    /infonavit\.org\.mx/,
    /imss\.gob\.mx/,
    /sat\.gob\.mx/
  ];

  /**
   * Validates if a URL is from an official Mexican government source
   */
  static async validateUrl(url: string): Promise<OfficialSourceValidation> {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname.toLowerCase();
      const path = urlObj.pathname.toLowerCase();
      
      // Check against known official sources
      const isOfficialDomain = OFFICIAL_SOURCES.some(officialDomain => 
        domain.includes(officialDomain)
      );

      if (!isOfficialDomain) {
        return {
          isValid: false,
          confidence: 0.1,
          warnings: ['La fuente no pertenece a un dominio oficial conocido'],
        };
      }

      // Enhanced validation for specific sources
      const validation = await this.performDeepValidation(urlObj);
      
      return {
        isValid: true,
        authority: this.identifyAuthority(domain),
        confidence: validation.confidence,
        warnings: validation.warnings,
        metadata: validation.metadata
      };

    } catch (error) {
      return {
        isValid: false,
        confidence: 0,
        warnings: ['URL inválida o mal formada'],
      };
    }
  }

  /**
   * Performs deep validation of official sources
   */
  private static async performDeepValidation(url: URL): Promise<{
    confidence: number;
    warnings: string[];
    metadata?: any;
  }> {
    const domain = url.hostname.toLowerCase();
    const path = url.pathname.toLowerCase();
    const warnings: string[] = [];
    const metadata: any = {};

    let confidence = 0.5; // Base confidence for official domains

    // DOF (Diario Oficial de la Federación) validation
    if (this.DOF_PATTERNS.some(pattern => pattern.test(url.href))) {
      confidence = 0.95;
      
      // Extract publication date from DOF URLs
      const dateMatch = url.href.match(/(\d{4})\/(\d{2})\/(\d{2})/);
      if (dateMatch) {
        const [, year, month, day] = dateMatch;
        metadata.publicationDate = `${year}-${month}-${day}`;
        confidence = 0.98;
      } else {
        warnings.push('No se pudo extraer la fecha de publicación del DOF');
        confidence = 0.85;
      }

      // Check for document type in path
      if (path.includes('decreto')) metadata.documentType = 'decreto';
      if (path.includes('acuerdo')) metadata.documentType = 'acuerdo';
      if (path.includes('ley')) metadata.documentType = 'ley';
      if (path.includes('reglamento')) metadata.documentType = 'reglamento';
    }

    // SCJN (Supreme Court) validation
    else if (this.SCJN_PATTERNS.some(pattern => pattern.test(url.href))) {
      confidence = 0.92;
      
      if (path.includes('jurisprudencia')) {
        metadata.documentType = 'jurisprudencia';
        confidence = 0.95;
      }
      if (path.includes('tesis')) {
        metadata.documentType = 'tesis';
        confidence = 0.95;
      }
      if (path.includes('sentencia')) {
        metadata.documentType = 'sentencia';
        confidence = 0.90;
      }
    }

    // Congress validation
    else if (this.CONGRESS_PATTERNS.some(pattern => pattern.test(url.href))) {
      confidence = 0.88;
      
      if (path.includes('ley')) {
        metadata.documentType = 'ley';
        confidence = 0.92;
      }
      if (path.includes('codigo')) {
        metadata.documentType = 'codigo';
        confidence = 0.92;
      }
      if (path.includes('constitucion')) {
        metadata.documentType = 'constitucion';
        confidence = 0.98;
      }
    }

    // General .gob.mx validation
    else if (domain.endsWith('.gob.mx')) {
      confidence = 0.75;
      
      // Check for secure connection
      if (url.protocol !== 'https:') {
        warnings.push('La conexión no es segura (HTTP en lugar de HTTPS)');
        confidence -= 0.1;
      }

      // Check for common document indicators
      if (path.includes('.pdf')) {
        metadata.fileType = 'pdf';
        confidence += 0.1;
      }
      if (path.includes('norma')) {
        metadata.documentType = 'norma';
        confidence += 0.1;
      }
    }

    // Additional checks
    if (url.href.length > 500) {
      warnings.push('URL excesivamente larga, podría ser problemática');
      confidence -= 0.05;
    }

    if (url.searchParams.toString().length > 200) {
      warnings.push('Muchos parámetros en la URL, verificar que sea estable');
      confidence -= 0.05;
    }

    return {
      confidence: Math.max(0, Math.min(1, confidence)),
      warnings,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined
    };
  }

  /**
   * Identifies the authority based on domain
   */
  private static identifyAuthority(domain: string): string {
    if (domain.includes('dof.gob.mx') || domain.includes('diariooficial.gob.mx')) {
      return 'Diario Oficial de la Federación';
    }
    if (domain.includes('scjn.gob.mx')) {
      return 'Suprema Corte de Justicia de la Nación';
    }
    if (domain.includes('diputados.gob.mx')) {
      return 'Cámara de Diputados';
    }
    if (domain.includes('senado.gob.mx')) {
      return 'Senado de la República';
    }
    if (domain.includes('cndh.org.mx')) {
      return 'Comisión Nacional de los Derechos Humanos';
    }
    if (domain.includes('sat.gob.mx')) {
      return 'Servicio de Administración Tributaria';
    }
    if (domain.includes('imss.gob.mx')) {
      return 'Instituto Mexicano del Seguro Social';
    }
    if (domain.includes('infonavit.org.mx')) {
      return 'Instituto del Fondo Nacional de la Vivienda para los Trabajadores';
    }
    
    return 'Autoridad Federal';
  }

  /**
   * Validates file uploads
   */
  static async validateFile(file: File): Promise<OfficialSourceValidation> {
    const warnings: string[] = [];
    let confidence = 0.3; // Lower confidence for uploaded files
    const metadata: any = {};

    // File type validation
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    
    if (!allowedTypes.includes(file.type)) {
      return {
        isValid: false,
        confidence: 0,
        warnings: [`Tipo de archivo no permitido: ${file.type}`],
      };
    }

    // File size validation
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        isValid: false,
        confidence: 0,
        warnings: ['El archivo excede el tamaño máximo permitido (50MB)'],
      };
    }

    metadata.fileSize = file.size;
    metadata.fileType = file.type;
    metadata.fileName = file.name;

    // Filename analysis for official patterns
    const filename = file.name.toLowerCase();
    
    if (filename.includes('dof') || filename.includes('diario_oficial')) {
      confidence = 0.8;
      metadata.possibleSource = 'DOF';
    } else if (filename.includes('scjn') || filename.includes('suprema_corte')) {
      confidence = 0.8;
      metadata.possibleSource = 'SCJN';
    } else if (filename.includes('ley_') || filename.includes('codigo_')) {
      confidence = 0.6;
      metadata.possibleSource = 'Congreso';
    } else if (filename.includes('nom_') || filename.includes('norma_oficial')) {
      confidence = 0.7;
      metadata.possibleSource = 'Autoridades Regulatorias';
    }

    // Check for date patterns in filename
    const datePattern = /(\d{4})[-_](\d{2})[-_](\d{2})/;
    const dateMatch = filename.match(datePattern);
    if (dateMatch) {
      const [, year, month, day] = dateMatch;
      metadata.extractedDate = `${year}-${month}-${day}`;
      confidence += 0.1;
    }

    // Scan for potential issues
    if (filename.includes('draft') || filename.includes('borrador')) {
      warnings.push('El archivo parece ser un borrador, no un documento oficial');
      confidence -= 0.2;
    }

    if (filename.includes('copia') || filename.includes('copy')) {
      warnings.push('El archivo parece ser una copia, verificar autenticidad');
      confidence -= 0.1;
    }

    if (file.size < 1024) { // Less than 1KB
      warnings.push('El archivo es muy pequeño, podría estar vacío o corrupto');
      confidence -= 0.3;
    }

    return {
      isValid: true,
      authority: metadata.possibleSource,
      confidence: Math.max(0, Math.min(1, confidence)),
      warnings,
      metadata
    };
  }

  /**
   * Advanced spam detection for document requests
   */
  static detectSpam(title: string, description: string, userFingerprint?: string): SpamDetectionResult {
    const reasons: string[] = [];
    let spamScore = 0;

    // Title analysis
    if (title.length < 5) {
      reasons.push('Título demasiado corto');
      spamScore += 0.4;
    }

    if (title.length > 200) {
      reasons.push('Título excesivamente largo');
      spamScore += 0.2;
    }

    // Check for excessive uppercase
    const uppercaseRatio = (title.match(/[A-Z]/g) || []).length / title.length;
    if (uppercaseRatio > 0.7) {
      reasons.push('Demasiadas mayúsculas en el título');
      spamScore += 0.3;
    }

    // Description analysis
    if (description.length < 20) {
      reasons.push('Descripción demasiado corta');
      spamScore += 0.4;
    }

    if (description.length > 5000) {
      reasons.push('Descripción excesivamente larga');
      spamScore += 0.2;
    }

    // Check for repetitive content
    const words = description.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - (uniqueWords.size / words.length);
    if (repetitionRatio > 0.5) {
      reasons.push('Contenido muy repetitivo');
      spamScore += 0.3;
    }

    // Check for spam keywords
    const spamKeywords = [
      'viagra', 'casino', 'lottery', 'winner', 'congratulations',
      'click here', 'act now', 'limited time', 'free money',
      'make money fast', 'work from home', 'investment opportunity'
    ];
    
    const titleAndDesc = (title + ' ' + description).toLowerCase();
    const spamKeywordCount = spamKeywords.filter(keyword => 
      titleAndDesc.includes(keyword)
    ).length;
    
    if (spamKeywordCount > 0) {
      reasons.push(`Contiene ${spamKeywordCount} palabra(s) sospechosa(s)`);
      spamScore += spamKeywordCount * 0.2;
    }

    // Check for excessive links
    const linkPattern = /https?:\/\/[^\s]+/g;
    const links = titleAndDesc.match(linkPattern) || [];
    if (links.length > 5) {
      reasons.push('Demasiados enlaces');
      spamScore += 0.3;
    }

    // Check for non-legal content indicators
    const legalKeywords = [
      'ley', 'código', 'reglamento', 'norma', 'decreto', 'acuerdo',
      'constitución', 'jurisprudencia', 'tribunal', 'corte', 'derecho',
      'legal', 'jurídico', 'artículo', 'fracción', 'inciso'
    ];
    
    const legalKeywordCount = legalKeywords.filter(keyword => 
      titleAndDesc.includes(keyword)
    ).length;
    
    if (legalKeywordCount === 0) {
      reasons.push('No contiene términos legales relevantes');
      spamScore += 0.4;
    }

    // Determine action based on spam score
    let action: 'allow' | 'flag' | 'block' = 'allow';
    
    if (spamScore >= 0.8) {
      action = 'block';
    } else if (spamScore >= 0.5) {
      action = 'flag';
    }

    return {
      isSpam: spamScore >= 0.5,
      confidence: Math.min(1, spamScore),
      reasons,
      action
    };
  }

  /**
   * Rate limiting check
   */
  static checkRateLimit(userFingerprint: string, requests: any[]): {
    allowed: boolean;
    remaining: number;
    resetAt: Date;
  } {
    const maxRequests = 5; // Max 5 requests per hour
    const windowMs = 60 * 60 * 1000; // 1 hour
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMs);

    // Count requests from this user in the current window
    const userRequests = requests.filter(req => 
      req.userFingerprint === userFingerprint &&
      new Date(req.createdAt) >= windowStart
    );

    const remaining = Math.max(0, maxRequests - userRequests.length);
    const resetAt = new Date(windowStart.getTime() + windowMs);

    return {
      allowed: remaining > 0,
      remaining,
      resetAt
    };
  }

  /**
   * Generate user fingerprint for anonymous tracking
   */
  static generateUserFingerprint(): string {
    // In a real implementation, this would use browser fingerprinting
    // For now, we'll use a simple random identifier stored in localStorage
    const stored = localStorage.getItem('lexmx_user_fingerprint');
    if (stored) {
      return stored;
    }

    const fingerprint = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    localStorage.setItem('lexmx_user_fingerprint', fingerprint);
    return fingerprint;
  }
}