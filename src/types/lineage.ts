// Document lineage and metadata types for legal document tracking

import type { LegalArea, DocumentType, LegalHierarchy } from './legal';

// Document origin metadata
export interface DocumentOrigin {
  // Source information
  sourceUrl?: string;
  sourceInstitution: string;
  sourceType: 'official' | 'scraping' | 'manual' | 'api' | 'user_submission';
  
  // Dates
  publicationDate: Date;
  captureDate: Date;
  lastVerificationDate?: Date;
  
  // Capture metadata
  captureMethod: string;
  capturedBy: string; // System or user ID
  captureNotes?: string;
  
  // Official identifiers
  dofNumber?: string; // Diario Oficial de la Federación
  officialId?: string;
  registryNumber?: string;
}

// Version control for legal documents
export interface LegalVersion {
  versionId: string;
  versionNumber: string;
  effectiveDate: Date;
  publicationDate: Date;
  
  // Reform information
  reformType?: 'reforma' | 'adicion' | 'derogacion' | 'fe_de_erratas';
  reformedArticles?: string[];
  reformDescription?: string;
  reformSource?: string;
  
  // Changes tracking
  previousVersionId?: string;
  nextVersionId?: string;
  changeLog?: string;
  isCurrentVersion: boolean;
}

// Digital chain of custody
export interface DigitalCustody {
  // Document integrity
  sha256Hash: string;
  md5Hash?: string;
  fileSize: number;
  mimeType: string;
  
  // Digital signatures
  digitalSignature?: string;
  signatureAuthority?: string;
  signatureDate?: Date;
  signatureValid?: boolean;
  
  // Validation
  integrityVerified: boolean;
  lastIntegrityCheck: Date;
  validationErrors?: string[];
  
  // Blockchain or distributed ledger reference
  blockchainRef?: string;
  ipfsHash?: string;
}

// Complete document lineage
export interface DocumentLineage {
  documentId: string;
  
  // Basic metadata
  title: string;
  shortTitle: string;
  type: DocumentType;
  hierarchy: LegalHierarchy;
  legalArea: LegalArea;
  
  // Origin tracking
  origin: DocumentOrigin;
  
  // Version management
  versions: LegalVersion[];
  currentVersion: LegalVersion;
  
  // Digital custody
  custody: DigitalCustody;
  
  // Relationships
  parentDocumentId?: string; // For regulations derived from laws
  childDocumentIds?: string[]; // For laws that spawn regulations
  relatedDocumentIds?: string[];
  supersededDocumentId?: string; // Document this one replaces
  supersededByDocumentId?: string; // Document that replaces this one
  
  // Quality metrics
  completeness: number; // 0-1 score
  accuracy: number; // 0-1 score based on validations
  lastQualityCheck: Date;
  qualityNotes?: string[];
  
  // Usage tracking (privacy-preserving)
  citationCount: number;
  lastAccessDate?: Date;
  popularSections?: string[];
}

// Audit trail for document changes
export interface LineageAudit {
  auditId: string;
  documentId: string;
  timestamp: Date;
  action: 'created' | 'updated' | 'verified' | 'corrected' | 'deprecated';
  actor: string;
  changes?: Record<string, any>;
  reason?: string;
  metadata?: Record<string, any>;
}

// Integration with RAG system
export interface RAGMetadata extends DocumentLineage {
  // Chunking metadata
  chunkingStrategy: 'article' | 'section' | 'paragraph' | 'semantic';
  chunkCount: number;
  averageChunkSize: number;
  
  // Embedding metadata
  embeddingModel: string;
  embeddingDate: Date;
  embeddingVersion: string;
  
  // Confidence scoring
  baseConfidence: number; // Based on source reliability
  temporalPenalty: number; // Reduction based on age
  effectiveConfidence: number; // Final confidence for RAG
  
  // Search optimization
  keywords: string[];
  legalConcepts: string[];
  citedArticles: string[];
  crossReferences: Array<{
    documentId: string;
    article: string;
    relationship: 'cites' | 'modifies' | 'implements' | 'contradicts';
  }>;
}

// Source validation for user submissions
export interface SourceValidation {
  url: string;
  isOfficial: boolean;
  officialDomain?: string;
  trustScore: number; // 0-1
  validationDate: Date;
  validationMethod: 'domain_check' | 'ssl_verification' | 'content_analysis';
  warnings?: string[];
  errors?: string[];
}

// Document change detection
export interface ChangeDetection {
  documentId: string;
  lastCheckDate: Date;
  nextCheckDate: Date;
  checkFrequency: 'daily' | 'weekly' | 'monthly';
  
  changesDetected: boolean;
  changeType?: 'content' | 'metadata' | 'removed' | 'moved';
  changeDetails?: string;
  
  notificationSent: boolean;
  autoUpdateEnabled: boolean;
}

// Export metadata for citations
export interface CitationMetadata {
  documentId: string;
  citationFormat: 'apa' | 'mla' | 'chicago' | 'legal';
  
  // Required citation elements
  title: string;
  author: string; // Institution for legal documents
  publicationDate: Date;
  accessDate: Date;
  url?: string;
  
  // Legal-specific citation
  legalCitation: string; // e.g., "DOF 05-02-1917"
  articlesCited?: string[];
  
  // Formatted citations
  formattedCitation: string;
  shortCitation: string;
}