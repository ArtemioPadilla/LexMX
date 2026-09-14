// Embedding manager for provider selection and management

import type { ModelProgressEvent } from '@/types/embeddings';
import { TransformersEmbeddingProvider } from './transformers-provider';
import { OpenAIEmbeddingProvider } from './openai-embedding-provider';
import { MockEmbeddingProvider } from './mock-provider';
import type {
  EmbeddingProvider,
  EmbeddingProviderConfig,
  EmbeddingProviderStats,
  EmbeddingProviderType,
  EmbeddingVector,
  RAGProgressEvent
} from '@/types/embeddings';
import type { ProgressEvent, JsonValue } from '@/types/common';

export interface EmbeddingManagerConfig {
  defaultProvider?: EmbeddingProviderType;
  providers?: {
    [key in EmbeddingProviderType]?: EmbeddingProviderConfig;
  };
  onProgress?: (event: RAGProgressEvent) => void;
}

// Explicit status callers can read to warn users when embeddings are not
// "real" (e.g. "sin embeddings reales") instead of silently getting mock
// vectors after an upstream provider failed to initialize.
export interface EmbeddingManagerStatus {
  providerType: EmbeddingProviderType | null;
  isFallback: boolean;
  fallbackReason?: string;
}

export class EmbeddingManager {
  private providers = new Map<EmbeddingProviderType, EmbeddingProvider>();
  private currentProvider: EmbeddingProvider | null = null;
  private config: EmbeddingManagerConfig;
  private progressCallback?: (event: RAGProgressEvent) => void;
  private usingFallback = false;
  private fallbackReason?: string;

  constructor(config: EmbeddingManagerConfig = {}) {
    this.config = {
      defaultProvider: 'transformers',
      ...config
    };
    this.progressCallback = config.onProgress;
  }

  async initialize(): Promise<void> {
    // Initialize default provider
    const providerType = this.config.defaultProvider || 'transformers';
    await this.initializeProvider(providerType);
  }

  async initializeProvider(type: EmbeddingProviderType): Promise<void> {
    await this.doInitializeProvider(type, false);
  }

  // `isFallback` is true only when this call is the automatic recursive
  // retry triggered by another provider's init failure (see catch branch
  // below) — it is what drives `isUsingFallback()`/`getStatus()`. A caller
  // explicitly requesting 'mock' is not, by itself, a "fallback".
  private async doInitializeProvider(type: EmbeddingProviderType, isFallback: boolean): Promise<void> {
    // Check if provider is already initialized
    if (this.providers.has(type)) {
      this.currentProvider = this.providers.get(type)!;
      this.usingFallback = isFallback;
      if (!isFallback) this.fallbackReason = undefined;
      return;
    }

    this.emitProgress('embedding_generation', 'active', `Initializing ${type} provider...`);

    try {
      const config = this.config.providers?.[type] || {};
      const provider = this.createProvider(type, config);

      await provider.initialize();
      this.providers.set(type, provider);
      this.currentProvider = provider;
      this.usingFallback = isFallback;
      if (!isFallback) this.fallbackReason = undefined;

      this.emitProgress('embedding_generation', 'completed', `${type} provider ready`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.emitProgress(
        'embedding_generation',
        'error',
        `Failed to initialize ${type} provider: ${reason}`,
        { provider: type, error: reason }
      );

      // Fallback to mock provider if initialization fails — but make it
      // explicit (progress event + status) instead of silently swapping the
      // provider under the caller's feet.
      if (type !== 'mock') {
        this.fallbackReason = `${type} provider failed to initialize (${reason}); using mock embeddings — results are not semantically meaningful ("sin embeddings reales").`;
        this.emitProgress('embedding_generation', 'error', this.fallbackReason, {
          fallbackFrom: type
        });
        await this.doInitializeProvider('mock', true);
      } else {
        throw error;
      }
    }
  }

  private createProvider(type: EmbeddingProviderType, config: EmbeddingProviderConfig): EmbeddingProvider {
    switch (type) {
      case 'transformers':
        return new TransformersEmbeddingProvider({
          ...config,
          onProgress: (progress: ModelProgressEvent) => {
            if (progress.status === 'downloading') {
              this.emitProgress(
                'embedding_generation',
                'active',
                `Downloading model: ${Math.round(progress.percentage)}%`,
                { modelProgress: progress.percentage }
              );
            }
          }
        });

      case 'openai':
        return new OpenAIEmbeddingProvider(config);

      case 'mock':
        return new MockEmbeddingProvider(config);

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }

  async switchProvider(type: EmbeddingProviderType): Promise<void> {
    await this.initializeProvider(type);
  }

  async embed(text: string): Promise<EmbeddingVector> {
    if (!this.currentProvider) {
      await this.initialize();
    }

    return this.currentProvider!.embed(text);
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.currentProvider) {
      await this.initialize();
    }

    return this.currentProvider!.embedBatch(texts);
  }

  async embedDocuments(documents: Array<{ id: string; text: string }>): Promise<Map<string, EmbeddingVector>> {
    const texts = documents.map(doc => doc.text);
    const embeddings = await this.embedBatch(texts);

    const result = new Map<string, EmbeddingVector>();
    for (const [i, document] of documents.entries()) {
      const embedding = embeddings[i];
      if (embedding) {
        result.set(document.id, embedding);
      }
    }

    return result;
  }

  // Calculate cosine similarity between two vectors
  calculateSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
    if (a.dimensions !== b.dimensions) {
      throw new Error('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.dimensions; i++) {
      const valueA = a.values[i] ?? 0;
      const valueB = b.values[i] ?? 0;
      dotProduct += valueA * valueB;
      magnitudeA += valueA * valueA;
      magnitudeB += valueB * valueB;
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Find most similar documents
  async findSimilar(
    queryEmbedding: EmbeddingVector,
    documentEmbeddings: Map<string, EmbeddingVector>,
    topK = 5,
    threshold = 0.5
  ): Promise<Array<{ id: string; score: number }>> {
    const scores: Array<{ id: string; score: number }> = [];

    for (const [id, embedding] of documentEmbeddings) {
      const score = this.calculateSimilarity(queryEmbedding, embedding);
      if (score >= threshold) {
        scores.push({ id, score });
      }
    }

    // Sort by score descending and return top K
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, topK);
  }

  getCurrentProvider(): EmbeddingProvider | null {
    return this.currentProvider;
  }

  getProviderType(): EmbeddingProviderType | null {
    return this.currentProvider?.type || null;
  }

  getStats(): EmbeddingProviderStats | null {
    return this.currentProvider?.getStats() || null;
  }

  // True when the active provider is a mock substituted in automatically
  // after the requested provider failed to initialize (as opposed to a
  // caller explicitly choosing 'mock').
  isUsingFallback(): boolean {
    return this.usingFallback;
  }

  getStatus(): EmbeddingManagerStatus {
    return {
      providerType: this.getProviderType(),
      isFallback: this.usingFallback,
      fallbackReason: this.fallbackReason
    };
  }

  clearCache(): void {
    for (const provider of this.providers.values()) {
      provider.clearCache();
    }
  }

  destroy(): void {
    for (const provider of this.providers.values()) {
      provider.destroy();
    }
    this.providers.clear();
    this.currentProvider = null;
  }

  private emitProgress(
    stage: RAGProgressEvent['stage'],
    status: RAGProgressEvent['status'],
    message?: string,
    details?: JsonValue
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        status,
        message,
        details,
        timestamp: Date.now()
      });
    }
  }

  // Get available providers and their models
  static getAvailableProviders() {
    return [
      {
        type: 'transformers',
        name: 'Transformers.js (Free)',
        description: 'In-browser embeddings, no API needed',
        models: TransformersEmbeddingProvider.getAvailableModels(),
        recommended: true,
        requiresApiKey: false
      },
      {
        type: 'openai',
        name: 'OpenAI',
        description: 'High quality embeddings via API',
        models: OpenAIEmbeddingProvider.getAvailableModels(),
        recommended: false,
        requiresApiKey: true
      },
      {
        type: 'mock',
        name: 'Mock (Testing)',
        description: 'For development and testing',
        models: MockEmbeddingProvider.getAvailableModels(),
        recommended: false,
        requiresApiKey: false
      }
    ];
  }
}
