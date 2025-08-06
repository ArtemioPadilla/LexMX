// RAG engine types

export interface RAGConfig {
  corpusPath: string;
  embeddingsPath: string;
  chunkSize: number;
  chunkOverlap: number;
  vectorDimensions: number;
  similarityThreshold: number;
  maxResults: number;
}

export interface VectorStore {
  initialize(config: RAGConfig): Promise<void>;
  addDocument(document: VectorDocument): Promise<void>;
  search(query: number[], options: SearchOptions): Promise<SearchResult[]>;
  getDocument(id: string): Promise<VectorDocument | null>;
  clear(): Promise<void>;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: DocumentMetadata;
}

export interface DocumentMetadata {
  title: string;
  type: string;
  legalArea: string;
  hierarchy: number;
  lastUpdated: string;
  url?: string;
  article?: string;
  // Lineage information
  lineageId?: string;
  confidence?: number;
  version?: string;
  lastVerified?: string;
  sourceInstitution?: string;
  publicationDate?: string;
}

export interface SearchOptions {
  topK?: number;
  scoreThreshold?: number;
  filter?: MetadataFilter;
  includeEmbeddings?: boolean;
}

export interface MetadataFilter {
  legalArea?: string;
  hierarchy?: number;
  type?: string;
  dateRange?: {
    start: string;
    end: string;
  };
}

export interface SearchResult {
  id: string;
  content: string;
  score: number;
  metadata: DocumentMetadata;
  embedding?: number[];
}

export interface RAGResponse {
  answer: string;
  sources: RAGSource[];
  confidence: number;
  processingTime: number;
  fromCache: boolean;
  metadata?: {
    queryType?: string;
    legalArea?: string;
    model?: string;
    provider?: string;
  };
}

export interface RAGSource {
  id: string;
  title: string;
  excerpt: string;
  score: number;
  metadata: DocumentMetadata;
}

export interface ProcessedQuery {
  originalQuery: string;
  normalizedQuery: string;
  queryType: string;
  intent: string;
  legalArea?: string;
  extractedEntities: QueryEntity[];
  embedding?: number[];
}

export interface QueryEntity {
  type: string;
  text: string;
  normalized: string;
  confidence: number;
}

export interface CacheEntry {
  key: string;
  query: string;
  response: RAGResponse;
  timestamp: number;
  embedding?: number[];
  usageCount: number;
  lastAccessed: number;
}