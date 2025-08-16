// Legal domain types for Mexican law

export type LegalArea = 
  | 'constitutional'
  | 'civil'
  | 'criminal'
  | 'labor'
  | 'tax'
  | 'commercial'
  | 'administrative'
  | 'environmental'
  | 'family'
  | 'property'
  | 'migration'
  | 'human-rights';

export type DocumentType = 
  | 'constitution'
  | 'law'
  | 'code'
  | 'regulation'
  | 'norm'
  | 'jurisprudence'
  | 'treaty'
  | 'format';

export type LegalHierarchy = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LegalDocument {
  id: string;
  title: string;
  shortTitle: string;
  type: DocumentType;
  hierarchy: LegalHierarchy;
  primaryArea: LegalArea;
  secondaryAreas: LegalArea[];
  
  // Publication info
  authority: string;
  publicationDate: string;
  lastReform?: string;
  status: 'active' | 'repealed' | 'suspended';
  
  // Scope
  territorialScope: 'national' | 'federal' | 'state' | 'municipal';
  applicability: string;
  
  // Content
  content: LegalContent[];
  
  // Metadata
  officialUrl?: string;
  relatedDependencies: string[];
  importance: 'critical' | 'high' | 'medium' | 'low';
  updateFrequency: 'very-high' | 'high' | 'medium' | 'low';
}

export interface LegalContent {
  id: string;
  type: 'title' | 'chapter' | 'section' | 'article' | 'paragraph' | 'fraction';
  number?: string;
  title?: string;
  content: string;
  parent?: string;
  children?: string[];
  
  // For vectorization
  embedding?: number[];
  chunkIndex?: number;
}

export interface LegalQuery {
  text: string;
  type: QueryType;
  legalArea?: LegalArea;
  complexity: number;
  intent: QueryIntent;
  entities: LegalEntity[];
}

export type QueryType = 
  | 'citation'        // "Artículo 123 constitucional"
  | 'procedural'      // "Cómo tramitar divorcio"
  | 'conceptual'      // "Qué es usucapión"
  | 'analytical'      // "Diferencias entre dolo y culpa"
  | 'comparative'     // "Diferencias entre códigos"
  | 'interpretation'  // Legal interpretation questions
  | 'analysis'        // Legal analysis tasks
  | 'advice'          // Legal advice requests
  | 'definition'      // Definition queries
  | 'procedure'       // Procedure questions
  | 'general'         // General legal questions
  | 'document analysis'; // Document analysis tasks

export type QueryIntent = 
  | 'information'
  | 'procedure'
  | 'analysis'
  | 'comparison'
  | 'citation'
  | 'interpretation';

export interface LegalEntity {
  type: 'law' | 'article' | 'institution' | 'procedure' | 'concept' | 'person';
  text: string;
  normalized: string;
  confidence: number;
}

export interface LegalResponse {
  answer: string;
  sources: LegalSource[];
  confidence: number;
  queryType: QueryType;
  legalArea: LegalArea;
  processingTime: number;
  fromCache: boolean;
  
  // Legal-specific metadata
  legalWarning?: string;
  recommendedActions?: string[];
  relatedQueries?: string[];
}

export interface LegalSource {
  documentId: string;
  title: string;
  article?: string;
  excerpt: string;
  relevanceScore: number;
  hierarchy: LegalHierarchy;
  url?: string;
  lastUpdated?: string;
}

export interface LegalChunk {
  id: string;
  documentId: string;
  content: string;
  metadata: {
    type: string;
    article?: string;
    title?: string;
    hierarchy: LegalHierarchy;
    legalArea: LegalArea;
  };
  embedding?: number[];
  keywords: string[];
}

// Mexican legal citation formats
export interface MexicanCitation {
  type: 'constitutional' | 'legal' | 'jurisprudence' | 'regulation';
  format: string;
  example: string;
}

export const MEXICAN_CITATIONS: Record<string, MexicanCitation> = {
  constitutional: {
    type: 'constitutional',
    format: 'Artículo {number} constitucional',
    example: 'Artículo 123 constitucional'
  },
  legal: {
    type: 'legal',
    format: 'Artículo {number} de la {law}',
    example: 'Artículo 47 de la Ley Federal del Trabajo'
  },
  jurisprudence: {
    type: 'jurisprudence',
    format: 'Tesis {number}',
    example: 'Tesis 1a./J. 15/2019'
  },
  regulation: {
    type: 'regulation',
    format: 'Artículo {number} del {regulation}',
    example: 'Artículo 15 del RLFT'
  }
};

// Legal document hierarchy in Mexican law
export const LEGAL_HIERARCHY: Record<LegalHierarchy, string> = {
  1: 'Constitución Política',
  2: 'Tratados Internacionales',
  3: 'Leyes Federales y Códigos',
  4: 'Reglamentos',
  5: 'Normas Oficiales (NOMs)',
  6: 'Leyes Estatales',
  7: 'Formatos Administrativos'
};

// Document Request System Types
export type RequestStatus = 'pending' | 'under_review' | 'in_progress' | 'completed' | 'rejected' | 'duplicate';

export type RequestPriority = 'low' | 'medium' | 'high' | 'critical';

export type SourceType = 'url' | 'pdf_upload' | 'manual_text';

export interface DocumentRequest {
  id: string;
  title: string;
  description: string;
  requestedBy: string; // Anonymous ID or username
  
  // Legal classification
  type: DocumentType;
  hierarchy: LegalHierarchy;
  primaryArea: LegalArea;
  secondaryAreas: LegalArea[];
  territorialScope: 'national' | 'federal' | 'state' | 'municipal';
  authority?: string;
  
  // Sources
  sources: DocumentSource[];
  
  // Community engagement
  votes: number;
  voters: string[]; // Anonymous IDs to prevent duplicate voting
  comments: RequestComment[];
  priority: RequestPriority;
  
  // Status and tracking
  status: RequestStatus;
  statusReason?: string;
  assignedTo?: string;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  duplicateOf?: string; // Reference to existing document if duplicate
  
  // Anti-spam measures
  ipHash?: string;
  fingerprint?: string;
  verified: boolean;
}

export interface DocumentSource {
  id: string;
  type: SourceType;
  url?: string;
  filename?: string;
  fileSize?: number;
  fileType?: string;
  uploadedAt?: string;
  verified: boolean;
  isOfficial: boolean;
  metadata?: {
    publicationDate?: string;
    lastModified?: string;
    authority?: string;
    officialGazette?: string;
  };
}

export interface RequestComment {
  id: string;
  authorId: string; // Anonymous ID
  content: string;
  createdAt: string;
  isModeratorComment: boolean;
  votes: number;
  flagged: boolean;
}

export interface RequestNotification {
  id: string;
  requestId: string;
  recipientId: string;
  type: 'status_change' | 'new_comment' | 'vote_milestone' | 'completion';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface RequestFilter {
  status?: RequestStatus[];
  type?: DocumentType[];
  area?: LegalArea[];
  priority?: RequestPriority[];
  hierarchy?: LegalHierarchy[];
  territorialScope?: ('national' | 'federal' | 'state' | 'municipal')[];
  dateRange?: {
    from: string;
    to: string;
  };
  minVotes?: number;
  search?: string;
}

export interface RequestStats {
  total: number;
  byStatus: Record<RequestStatus, number>;
  byType: Record<DocumentType, number>;
  byArea: Record<LegalArea, number>;
  averageCompletionTime: number;
  topRequesters: Array<{
    userId: string;
    requestCount: number;
  }>;
}

// Validation and duplicate detection
export interface DuplicateDetectionResult {
  isDuplicate: boolean;
  confidence: number;
  matchingDocuments: Array<{
    id: string;
    title: string;
    similarity: number;
    type: 'existing_document' | 'pending_request';
  }>;
  suggestions: string[];
}

export interface OfficialSourceValidation {
  isValid: boolean;
  authority?: string;
  confidence: number;
  warnings: string[];
  metadata?: {
    publicationDate?: string;
    documentNumber?: string;
    officialGazette?: string;
  };
}

// Moderation system
export interface ModerationAction {
  id: string;
  requestId: string;
  moderatorId: string;
  action: 'approve' | 'reject' | 'flag' | 'assign' | 'priority_change' | 'merge';
  reason: string;
  previousStatus?: RequestStatus;
  newStatus?: RequestStatus;
  createdAt: string;
}

export interface ModeratorUser {
  id: string;
  username: string;
  role: 'moderator' | 'admin' | 'legal_expert';
  specializations: LegalArea[];
  assignedRequests: string[];
  stats: {
    totalReviewed: number;
    averageReviewTime: number;
    approvalRate: number;
  };
}

// Anti-spam and security
export interface SpamDetectionResult {
  isSpam: boolean;
  confidence: number;
  reasons: string[];
  action: 'allow' | 'flag' | 'block';
}

export interface RateLimitInfo {
  requests: number;
  windowStart: string;
  windowEnd: string;
  remaining: number;
  resetAt: string;
}

// Search and suggestions
export interface DocumentSuggestion {
  title: string;
  type: DocumentType;
  authority: string;
  relevance: number;
  source: 'existing_corpus' | 'official_catalog' | 'ai_suggestion';
}

export interface SmartFormState {
  title: string;
  description: string;
  type?: DocumentType;
  area?: LegalArea;
  authority?: string;
  suggestions: DocumentSuggestion[];
  duplicateCheck: DuplicateDetectionResult | null;
  validationResults: OfficialSourceValidation[];
  isValidating: boolean;
}

// Constants for the request system
export const REQUEST_VOTE_THRESHOLDS = {
  LOW_PRIORITY: 5,
  MEDIUM_PRIORITY: 15,
  HIGH_PRIORITY: 30,
  FAST_TRACK: 50
} as const;

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  pending: 'Pendiente',
  under_review: 'En Revisión',
  in_progress: 'En Proceso',
  completed: 'Completado',
  rejected: 'Rechazado',
  duplicate: 'Duplicado'
};

export const PRIORITY_LABELS: Record<RequestPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  critical: 'Crítica'
};

export const OFFICIAL_SOURCES = [
  'dof.gob.mx',
  'scjn.gob.mx',
  'diputados.gob.mx',
  'senado.gob.mx',
  'gob.mx',
  'tribunal.gob.mx',
  'cndh.org.mx'
] as const;

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
export const ALLOWED_FILE_TYPES = ['pdf', 'doc', 'docx', 'txt'] as const;
export const RATE_LIMIT_REQUESTS = 10;
export const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour