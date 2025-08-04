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
  | 'citation'      // "Artículo 123 constitucional"
  | 'procedural'    // "Cómo tramitar divorcio"
  | 'conceptual'    // "Qué es usucapión"
  | 'analytical'    // "Diferencias entre dolo y culpa"
  | 'comparative';  // "Diferencias entre códigos"

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