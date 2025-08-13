// Embedding manager for provider selection and management

import { TransformersEmbeddingProvider } from './transformers-provider';
import { OpenAIEmbeddingProvider } from './openai-embedding-provider';
import { MockEmbeddingProvider } from './mock-provider';
import type { 
  EmbeddingProvider, 
  EmbeddingProviderConfig, 
  EmbeddingProviderType,
  EmbeddingVector,
  RAGProgressEvent
} from '@/types/embeddings';

export interface EmbeddingManagerConfig {
  defaultProvider?: EmbeddingProviderType;
  providers?: {
    [key in EmbeddingProviderType]?: EmbeddingProviderConfig;
  };
  onProgress?: (event: RAGProgressEvent) => void;
}

export class EmbeddingManager {
  private providers = new Map<EmbeddingProviderType, EmbeddingProvider>();
  private currentProvider: EmbeddingProvider | null = null;
  private config: EmbeddingManagerConfig;
  private progressCallback?: (event: RAGProgressEvent) => void;

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
    // Check if provider is already initialized
    if (this.providers.has(type)) {
      this.currentProvider = this.providers.get(type)!;
      return;
    }

    this.emitProgress('embedding_generation', 'active', `Initializing ${type} provider...`);

    try {
      let provider: EmbeddingProvider;
      const config = this.config.providers?.[type] || {};

      switch (type) {
        case 'transformers':
          provider = new TransformersEmbeddingProvider({
            ...config,
            onProgress: (progress: any) => {
              if (progress.status === 'downloading') {
                this.emitProgress(
                  'embedding_generation',
                  'active',
                  `Downloading model: ${Math.round(progress.progress)}%`,
                  { modelProgress: progress }
                );
              }
            }
          });
          break;
        
        case 'openai':
          provider = new OpenAIEmbeddingProvider(config);
          break;
        
        case 'mock':
          provider = new MockEmbeddingProvider(config);
          break;
        
        default:
          throw new Error(`Unknown provider type: ${type}`);
      }

      await provider.initialize();
      this.providers.set(type, provider);
      this.currentProvider = provider;
      
      this.emitProgress('embedding_generation', 'completed', `${type} provider ready`);
    } catch (error) {
      this.emitProgress('embedding_generation', 'error', `Failed to initialize ${type} provider`, { error });
      
      // Fallback to mock provider if initialization fails
      if (type !== 'mock') {
        console.warn(`Failed to initialize ${type} provider, falling back to mock provider`);
        await this.initializeProvider('mock');
      } else {
        throw error;
      }
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
    for (let i = 0; i < documents.length; i++) {
      result.set(documents[i].id, embeddings[i]);
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
      dotProduct += a.values[i] * b.values[i];
      magnitudeA += a.values[i] * a.values[i];
      magnitudeB += b.values[i] * b.values[i];
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

  getStats() {
    return this.currentProvider?.getStats() || null;
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
    details?: any
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