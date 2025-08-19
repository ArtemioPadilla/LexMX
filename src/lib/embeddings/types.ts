// Re-export types from @/types/embeddings for backwards compatibility
export type {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  EmbeddingProviderStats,
  EmbeddingProviderType,
  EmbeddingVector,
  EmbeddingCache
} from '@/types/embeddings';

// Additional types specific to the adapters
export interface EmbeddingModel {
  name: string;
  dimensions: number;
  maxTokens: number;
}

export interface EmbeddingOptions {
  batchSize?: number;
  timeout?: number;
  cache?: boolean;
}

export interface EmbeddingResult {
  embedding: number[];
  tokensUsed?: number;
  model?: string;
}