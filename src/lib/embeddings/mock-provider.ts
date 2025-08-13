// Mock embedding provider for testing and fallback

import { BaseEmbeddingProvider } from './base-provider';
import type { EmbeddingProviderType, EmbeddingVector } from '@/types/embeddings';

export class MockEmbeddingProvider extends BaseEmbeddingProvider {
  type: EmbeddingProviderType = 'mock';
  private dimensions: number;

  constructor(config: any = {}) {
    super({
      dimensions: 384,
      ...config
    });
    this.dimensions = this.config.dimensions || 384;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    this.initialized = true;
    this.stats.modelLoaded = true;
    console.log('[MockProvider] Initialized with dimensions:', this.dimensions);
  }

  protected async generateEmbedding(text: string): Promise<EmbeddingVector> {
    // Generate deterministic mock embeddings based on text
    const hash = this.hashString(text);
    const values = new Array(this.dimensions);
    
    for (let i = 0; i < this.dimensions; i++) {
      // Generate pseudo-random values based on hash and position
      const seed = (hash + i) * 2654435761; // Large prime for distribution
      values[i] = (Math.sin(seed) * 43758.5453123) % 1;
    }

    // Normalize the vector
    const normalized = this.normalizeVector(values);

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));

    return {
      values: normalized,
      dimensions: this.dimensions
    };
  }

  protected async generateEmbeddingBatch(texts: string[]): Promise<EmbeddingVector[]> {
    // Process each text individually
    const embeddings: EmbeddingVector[] = [];
    
    for (const text of texts) {
      const embedding = await this.generateEmbedding(text);
      embeddings.push(embedding);
    }

    return embeddings;
  }

  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return Math.abs(hash);
  }

  // Get mock model info
  static getAvailableModels() {
    return [
      {
        id: 'mock-384',
        name: 'Mock Model (384 dims)',
        description: 'For testing and development',
        dimensions: 384,
        size: '0MB',
        languages: ['any'],
        recommended: false
      }
    ];
  }
}