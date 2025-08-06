// Lineage processor for document integrity and tracking

import { createHash } from 'crypto';
import type { 
  DocumentLineage, 
  DigitalCustody, 
  LineageAudit,
  SourceValidation,
  DocumentOrigin
} from '@/types/lineage';
import type { LegalDocument } from '@/types/legal';

export class LineageProcessor {
  private static readonly OFFICIAL_DOMAINS = [
    'gob.mx',
    'diputados.gob.mx',
    'senado.gob.mx',
    'scjn.gob.mx',
    'dof.gob.mx',
    'sat.gob.mx',
    'imss.gob.mx'
  ];

  /**
   * Generate digital custody information for a document
   */
  async generateDigitalCustody(
    content: string | Buffer,
    mimeType: string = 'text/plain'
  ): Promise<DigitalCustody> {
    const buffer = typeof content === 'string' 
      ? Buffer.from(content, 'utf-8') 
      : content;

    // Generate hashes
    const sha256Hash = createHash('sha256').update(buffer).digest('hex');
    const md5Hash = createHash('md5').update(buffer).digest('hex');

    return {
      sha256Hash,
      md5Hash,
      fileSize: buffer.length,
      mimeType,
      integrityVerified: true,
      lastIntegrityCheck: new Date(),
      validationErrors: []
    };
  }

  /**
   * Validate document integrity
   */
  async validateIntegrity(
    content: string | Buffer,
    custody: DigitalCustody
  ): Promise<{ valid: boolean; errors: string[] }> {
    const buffer = typeof content === 'string' 
      ? Buffer.from(content, 'utf-8') 
      : content;

    const errors: string[] = [];
    
    // Check file size
    if (buffer.length !== custody.fileSize) {
      errors.push(`File size mismatch: expected ${custody.fileSize}, got ${buffer.length}`);
    }

    // Verify SHA-256 hash
    const currentSha256 = createHash('sha256').update(buffer).digest('hex');
    if (currentSha256 !== custody.sha256Hash) {
      errors.push('SHA-256 hash mismatch');
    }

    // Verify MD5 if available
    if (custody.md5Hash) {
      const currentMd5 = createHash('md5').update(buffer).digest('hex');
      if (currentMd5 !== custody.md5Hash) {
        errors.push('MD5 hash mismatch');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create document origin metadata
   */
  createDocumentOrigin(params: {
    sourceUrl?: string;
    sourceInstitution: string;
    publicationDate: Date;
    captureMethod: string;
    capturedBy: string;
    dofNumber?: string;
  }): DocumentOrigin {
    const sourceType = this.determineSourceType(params.sourceUrl);
    
    return {
      sourceUrl: params.sourceUrl,
      sourceInstitution: params.sourceInstitution,
      sourceType,
      publicationDate: params.publicationDate,
      captureDate: new Date(),
      captureMethod: params.captureMethod,
      capturedBy: params.capturedBy,
      dofNumber: params.dofNumber
    };
  }

  /**
   * Validate source URL
   */
  async validateSource(url: string): Promise<SourceValidation> {
    const validation: SourceValidation = {
      url,
      isOfficial: false,
      trustScore: 0,
      validationDate: new Date(),
      validationMethod: 'domain_check',
      warnings: [],
      errors: []
    };

    try {
      const urlObj = new URL(url);
      
      // Check if it's an official domain
      const domain = urlObj.hostname.toLowerCase();
      const isOfficial = this.OFFICIAL_DOMAINS.some(official => 
        domain.endsWith(official)
      );

      validation.isOfficial = isOfficial;
      validation.officialDomain = isOfficial ? domain : undefined;

      // Calculate trust score
      if (isOfficial) {
        validation.trustScore = 1.0;
      } else if (domain.endsWith('.edu.mx')) {
        validation.trustScore = 0.8;
        validation.warnings.push('Educational institution source - verify official status');
      } else if (domain.endsWith('.org.mx')) {
        validation.trustScore = 0.6;
        validation.warnings.push('Organization source - additional verification recommended');
      } else {
        validation.trustScore = 0.3;
        validation.warnings.push('Non-official source - manual verification required');
      }

      // Check HTTPS
      if (urlObj.protocol !== 'https:') {
        validation.trustScore *= 0.8;
        validation.warnings.push('Non-HTTPS source - security not guaranteed');
      }

    } catch (error) {
      validation.errors.push(`Invalid URL: ${error.message}`);
      validation.trustScore = 0;
    }

    return validation;
  }

  /**
   * Create audit entry
   */
  createAuditEntry(params: {
    documentId: string;
    action: LineageAudit['action'];
    actor: string;
    changes?: Record<string, any>;
    reason?: string;
  }): LineageAudit {
    return {
      auditId: this.generateAuditId(),
      documentId: params.documentId,
      timestamp: new Date(),
      action: params.action,
      actor: params.actor,
      changes: params.changes,
      reason: params.reason
    };
  }

  /**
   * Calculate document quality score
   */
  calculateQualityScore(document: LegalDocument): {
    completeness: number;
    accuracy: number;
    notes: string[];
  } {
    const notes: string[] = [];
    let completenessScore = 1.0;
    let accuracyScore = 1.0;

    // Check completeness
    if (!document.content || document.content.length === 0) {
      completenessScore -= 0.5;
      notes.push('No content found');
    }

    if (!document.metadata?.sourceUrl) {
      completenessScore -= 0.1;
      notes.push('Missing source URL');
    }

    if (!document.lastReform) {
      completenessScore -= 0.1;
      notes.push('Missing last reform date');
    }

    // Check for empty sections
    const emptySections = document.content.filter(c => 
      !c.text || c.text.trim().length === 0
    );
    if (emptySections.length > 0) {
      completenessScore -= 0.2;
      notes.push(`${emptySections.length} empty sections found`);
    }

    // Accuracy checks
    if (document.status !== 'active') {
      accuracyScore -= 0.3;
      notes.push(`Document status is ${document.status}`);
    }

    // Check publication date validity
    const pubDate = new Date(document.publicationDate);
    if (pubDate > new Date()) {
      accuracyScore -= 0.5;
      notes.push('Publication date is in the future');
    }

    return {
      completeness: Math.max(0, completenessScore),
      accuracy: Math.max(0, accuracyScore),
      notes
    };
  }

  /**
   * Generate confidence score for RAG
   */
  calculateRAGConfidence(lineage: DocumentLineage): {
    baseConfidence: number;
    temporalPenalty: number;
    effectiveConfidence: number;
  } {
    // Base confidence from source and quality
    let baseConfidence = lineage.accuracy * 0.5 + lineage.completeness * 0.3;
    
    // Boost for official sources
    if (lineage.origin.sourceType === 'official') {
      baseConfidence += 0.2;
    }

    // Temporal penalty - documents lose relevance over time
    const monthsSinceUpdate = this.getMonthsSince(
      lineage.currentVersion.effectiveDate
    );
    
    let temporalPenalty = 0;
    if (monthsSinceUpdate > 60) { // 5 years
      temporalPenalty = 0.3;
    } else if (monthsSinceUpdate > 24) { // 2 years
      temporalPenalty = 0.15;
    } else if (monthsSinceUpdate > 12) { // 1 year
      temporalPenalty = 0.05;
    }

    const effectiveConfidence = Math.max(
      0.1, // Minimum confidence
      baseConfidence - temporalPenalty
    );

    return {
      baseConfidence,
      temporalPenalty,
      effectiveConfidence
    };
  }

  // Helper methods
  private determineSourceType(url?: string): DocumentOrigin['sourceType'] {
    if (!url) return 'manual';
    
    const urlLower = url.toLowerCase();
    if (this.OFFICIAL_DOMAINS.some(d => urlLower.includes(d))) {
      return 'official';
    }
    
    if (urlLower.includes('/api/') || urlLower.includes('webservice')) {
      return 'api';
    }
    
    return 'scraping';
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getMonthsSince(date: Date): number {
    const now = new Date();
    const months = (now.getFullYear() - date.getFullYear()) * 12;
    return months + now.getMonth() - date.getMonth();
  }
}