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

// Legacy adapter contract (`mock-embeddings.ts`, `openai-embeddings.ts`,
// `transformers-embeddings.ts`). This is intentionally a DIFFERENT shape
// than `EmbeddingProvider` above (documents/query instead of
// embed/embedBatch) — it exists only so `src/lib/admin/embeddings-service.ts`
// keeps a stable import while wrapping the real `*Provider` classes. Do not
// widen `EmbeddingProvider` itself to match this; they serve different
// callers.
export interface EmbeddingsAdapter {
  initialize(): Promise<void>;
  embedDocuments(texts: string[]): Promise<number[][]>;
  embedQuery(text: string): Promise<number[]>;
  getDimensions(): number;
  getModelName(): string;
  dispose(): Promise<void>;
}