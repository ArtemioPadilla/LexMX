// Transformers.js provider for free in-browser embeddings

import { pipeline, env } from '@xenova/transformers';
import { BaseEmbeddingProvider } from './base-provider';
import type { EmbeddingProviderType, EmbeddingVector, EmbeddingProviderConfig } from '@/types/embeddings';
import type { ProgressEvent } from '@/types/common';

// Configure Transformers.js for browser environment
env.allowLocalModels = false; // Use CDN models
env.backends.onnx.wasm.numThreads = 1; // Single thread for stability

export class TransformersEmbeddingProvider extends BaseEmbeddingProvider {
  type: EmbeddingProviderType = 'transformers';
  private extractor: unknown = null;
  private modelName: string;
  private progressCallback?: (progress: ProgressEvent) => void;

  constructor(config: EmbeddingProviderConfig = {}) {
    super({
      dimensions: 384, // Default for all-MiniLM-L6-v2
      ...config
    });

    // Default to multilingual model for Spanish/English support
    this.modelName = config.model || 'Xenova/multilingual-e5-small';
    this.progressCallback = config.onProgress;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      console.log(`[TransformersProvider] Loading model: ${this.modelName}`);
      
      // Create feature extraction pipeline
      this.extractor = await pipeline('feature-extraction', this.modelName, {
        progress_callback: this.progressCallback
      });

      this.initialized = true;
      this.stats.modelLoaded = true;
      
      console.log(`[TransformersProvider] Model loaded successfully`);
    } catch (error) {
      console.error('[TransformersProvider] Failed to initialize:', error);
      throw new Error(`Failed to load Transformers.js model: ${error}`);
    }
  }

  protected async generateEmbedding(text: string): Promise<EmbeddingVector> {
    if (!this.extractor) {
      throw new Error('Model not initialized');
    }

    try {
      // Generate embeddings
      const output = await this.extractor(text, {
        pooling: 'mean',
        normalize: true
      });

      // Convert to array and normalize
      const values = Array.from(output.data as Float32Array);
      const normalized = this.normalizeVector(values);

      return {
        values: normalized,
        dimensions: normalized.length
      };
    } catch (error) {
      console.error('[TransformersProvider] Embedding generation failed:', error);
      throw error;
    }
  }

  protected async generateEmbeddingBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.extractor) {
      throw new Error('Model not initialized');
    }

    try {
      // Process texts in batch
      const outputs = await this.extractor(texts, {
        pooling: 'mean',
        normalize: true
      });

      // Convert outputs to embedding vectors
      const embeddings: EmbeddingVector[] = [];
      const data = outputs.data as Float32Array;
      const dimensions = outputs.dims[outputs.dims.length - 1];
      
      for (let i = 0; i < texts.length; i++) {
        const start = i * dimensions;
        const end = start + dimensions;
        const values = Array.from(data.slice(start, end));
        const normalized = this.normalizeVector(values);
        
        embeddings.push({
          values: normalized,
          dimensions: normalized.length
        });
      }

      return embeddings;
    } catch (error) {
      console.error('[TransformersProvider] Batch embedding generation failed:', error);
      throw error;
    }
  }

  destroy(): void {
    super.destroy();
    this.extractor = null;
  }

  // Get available models for the UI
  static getAvailableModels() {
    return [
      {
        id: 'Xenova/multilingual-e5-small',
        name: 'Multilingual E5 Small',
        description: 'Best for Spanish/English legal text',
        dimensions: 384,
        size: '~150MB',
        languages: ['es', 'en'],
        recommended: true
      },
      {
        id: 'Xenova/all-MiniLM-L6-v2',
        name: 'All-MiniLM-L6-v2',
        description: 'Fast, general purpose',
        dimensions: 384,
        size: '~30MB',
        languages: ['en'],
        recommended: false
      },
      {
        id: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
        name: 'Paraphrase Multilingual MiniLM',
        description: 'Good for semantic similarity',
        dimensions: 384,
        size: '~120MB',
        languages: ['es', 'en'],
        recommended: false
      }
    ];
  }
}