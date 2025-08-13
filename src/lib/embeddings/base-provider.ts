// Base abstract class for embedding providers

import type { 
  EmbeddingProvider, 
  EmbeddingProviderConfig, 
  EmbeddingProviderStats,
  EmbeddingProviderType,
  EmbeddingVector,
  EmbeddingCache
} from '@/types/embeddings';

// Simple in-memory cache implementation
export class InMemoryEmbeddingCache implements EmbeddingCache {
  private cache = new Map<string, { embedding: EmbeddingVector; timestamp: number }>();
  private maxAge: number;

  constructor(maxAge = 7 * 24 * 60 * 60 * 1000) { // Default: 1 week
    this.maxAge = maxAge;
  }

  get(key: string): EmbeddingVector | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.embedding;
  }

  set(key: string, embedding: EmbeddingVector): void {
    this.cache.set(key, {
      embedding,
      timestamp: Date.now()
    });
  }

  has(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    if (Date.now() - cached.timestamp > this.maxAge) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  abstract type: EmbeddingProviderType;
  config: EmbeddingProviderConfig;
  protected cache: EmbeddingCache | null = null;
  protected initialized = false;
  protected stats: EmbeddingProviderStats;

  constructor(config: EmbeddingProviderConfig = {}) {
    this.config = {
      batchSize: 50,
      cacheEnabled: true,
      cacheExpiration: 7 * 24 * 60 * 60 * 1000, // 1 week
      ...config
    };

    if (this.config.cacheEnabled) {
      this.cache = new InMemoryEmbeddingCache(this.config.cacheExpiration);
    }

    this.stats = {
      totalEmbeddings: 0,
      cachedEmbeddings: 0,
      averageProcessingTime: 0,
      modelLoaded: false,
      providerType: this.type
    };
  }

  abstract initialize(): Promise<void>;

  async embed(text: string): Promise<EmbeddingVector> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Check cache first
    if (this.cache) {
      const cacheKey = this.getCacheKey(text);
      const cached = this.cache.get(cacheKey);
      if (cached) {
        this.stats.cachedEmbeddings++;
        return cached;
      }
    }

    // Generate embedding
    const startTime = Date.now();
    const embedding = await this.generateEmbedding(text);
    const processingTime = Date.now() - startTime;

    // Update stats
    this.stats.totalEmbeddings++;
    this.updateAverageProcessingTime(processingTime);

    // Cache the result
    if (this.cache) {
      const cacheKey = this.getCacheKey(text);
      this.cache.set(cacheKey, embedding);
    }

    return embedding;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const results: EmbeddingVector[] = [];
    const textsToEmbed: { text: string; index: number }[] = [];

    // Check cache for each text
    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (this.cache) {
        const cacheKey = this.getCacheKey(text);
        const cached = this.cache.get(cacheKey);
        if (cached) {
          results[i] = cached;
          this.stats.cachedEmbeddings++;
          continue;
        }
      }
      textsToEmbed.push({ text, index: i });
    }

    // Generate embeddings for uncached texts
    if (textsToEmbed.length > 0) {
      const batchSize = this.config.batchSize || 50;
      
      for (let i = 0; i < textsToEmbed.length; i += batchSize) {
        const batch = textsToEmbed.slice(i, i + batchSize);
        const startTime = Date.now();
        const embeddings = await this.generateEmbeddingBatch(batch.map(item => item.text));
        const processingTime = Date.now() - startTime;

        // Update stats
        this.stats.totalEmbeddings += embeddings.length;
        this.updateAverageProcessingTime(processingTime / embeddings.length);

        // Store results and cache
        for (let j = 0; j < batch.length; j++) {
          const { text, index } = batch[j];
          const embedding = embeddings[j];
          results[index] = embedding;

          if (this.cache) {
            const cacheKey = this.getCacheKey(text);
            this.cache.set(cacheKey, embedding);
          }
        }
      }
    }

    return results;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getStats(): EmbeddingProviderStats {
    return { ...this.stats };
  }

  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
    this.stats.cachedEmbeddings = 0;
  }

  destroy(): void {
    this.clearCache();
    this.initialized = false;
    this.stats.modelLoaded = false;
  }

  protected abstract generateEmbedding(text: string): Promise<EmbeddingVector>;
  
  protected abstract generateEmbeddingBatch(texts: string[]): Promise<EmbeddingVector[]>;

  protected getCacheKey(text: string): string {
    // Simple hash function for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${this.type}_${this.config.model}_${hash}`;
  }

  protected updateAverageProcessingTime(newTime: number): void {
    const currentAvg = this.stats.averageProcessingTime;
    const totalCount = this.stats.totalEmbeddings;
    this.stats.averageProcessingTime = (currentAvg * (totalCount - 1) + newTime) / totalCount;
  }

  // Utility function to normalize embeddings
  protected normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) return vector;
    return vector.map(val => val / magnitude);
  }
}