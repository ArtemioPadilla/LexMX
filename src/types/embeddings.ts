// Embedding provider types and interfaces

export interface EmbeddingVector {
  values: number[];
  dimensions: number;
}

export interface EmbeddingDocument {
  id: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  document: EmbeddingDocument;
  embedding: EmbeddingVector;
  processingTime?: number;
}

export interface EmbeddingProviderConfig {
  model?: string;
  dimensions?: number;
  batchSize?: number;
  cacheEnabled?: boolean;
  cacheExpiration?: number;
  apiKey?: string;
  apiUrl?: string;
  onProgress?: (progress: any) => void;
}

export interface EmbeddingProviderStats {
  totalEmbeddings: number;
  cachedEmbeddings: number;
  averageProcessingTime: number;
  modelLoaded: boolean;
  providerType: string;
}

export type EmbeddingProviderType = 'transformers' | 'openai' | 'cohere' | 'mock';

export interface EmbeddingProvider {
  type: EmbeddingProviderType;
  config: EmbeddingProviderConfig;
  
  // Core methods
  initialize(): Promise<void>;
  embed(text: string): Promise<EmbeddingVector>;
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
  
  // Utility methods
  isInitialized(): boolean;
  getStats(): EmbeddingProviderStats;
  clearCache(): void;
  destroy(): void;
}

export interface EmbeddingCache {
  get(key: string): EmbeddingVector | null;
  set(key: string, embedding: EmbeddingVector): void;
  has(key: string): boolean;
  clear(): void;
  size(): number;
}

export interface SimilarityOptions {
  metric?: 'cosine' | 'euclidean' | 'dot';
  threshold?: number;
}

// Progress event types for RAG visualization
export interface RAGProgressEvent {
  stage: 'query_analysis' | 'embedding_generation' | 'document_search' | 'context_building' | 'response_generation';
  status: 'pending' | 'active' | 'completed' | 'error';
  message?: string;
  details?: unknown;
  progress?: number;
  timestamp: number;
}

export interface RAGSearchResult {
  documentId: string;
  content: string;
  score: number;
  metadata?: {
    title?: string;
    article?: string;
    section?: string;
    legalArea?: string;
    hierarchy?: number;
    lastUpdated?: string;
  };
  highlights?: Array<{
    text: string;
    position: [number, number];
  }>;
}