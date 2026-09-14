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
  /** Bulk insert; implementations should use one transaction per batch. */
  addDocuments?(documents: VectorDocument[]): Promise<void>;
  search(query: number[], options: SearchOptions): Promise<SearchResult[]>;
  getDocument(id: string): Promise<VectorDocument | null>;
  clear(): Promise<void>;
  /** Number of stored chunks. */
  count?(): Promise<number>;
  /** Removes every chunk whose id starts with `prefix` (one corpus document or one jurisdiction). Returns how many. */
  deleteByPrefix?(prefix: string): Promise<number>;
  /** Collection-level metadata (installed corpus version, installed documents…). */
  getMeta?<T = unknown>(key: string): Promise<T | null>;
  setMeta?(key: string, value: unknown): Promise<void>;
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
  /** Jurisdiction code ('mx', 'cl', …). Absent ⇒ 'mx'. */
  jurisdiction?: string;
  url?: string;
  article?: string;
  /** Corpus section type ('article', 'title', 'chapter'…). Only articles are ranked as answers. */
  contentType?: string;
  /** Article under a "Transitorios" heading; ranked below the permanent text. */
  transitory?: boolean;
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