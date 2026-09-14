// Transformers.js provider for free in-browser embeddings

import { BaseEmbeddingProvider } from './base-provider';
import type { EmbeddingProviderType, EmbeddingVector, EmbeddingProviderConfig } from '@/types/embeddings';
import type { ProgressEvent } from '@/types/common';
// Type-only import: erased at compile time, so it does NOT pull the runtime
// package (and its onnxruntime-node native binding) into any eagerly-loaded
// bundle. The actual module is loaded dynamically inside `initialize()`.
import type { FeatureExtractionPipeline, Tensor } from '@xenova/transformers';

export class TransformersEmbeddingProvider extends BaseEmbeddingProvider {
  type: EmbeddingProviderType = 'transformers';
  private extractor: FeatureExtractionPipeline | null = null;
  private modelName: string;
  private progressCallback?: (progress: ProgressEvent) => void;

  constructor(config: EmbeddingProviderConfig = {}) {
    super({
      dimensions: 384, // Default for all-MiniLM-L6-v2
      ...config
    });

    // Default to multilingual model for Spanish/English support
    this.modelName = config.model || 'Xenova/multilingual-e5-small';
    // Keep `config.model` in sync so the inherited `getModelName()` (which
    // reads `this.config.model`) reflects the resolved default, not just an
    // explicitly-passed one.
    this.config.model = this.modelName;
    this.progressCallback = config.onProgress;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Dynamic import keeps `@xenova/transformers` out of any eagerly-loaded
      // script chunk — it (and onnxruntime) is only fetched when a real
      // embedding is actually requested.
      const { pipeline, env } = await import('@xenova/transformers');

      env.allowLocalModels = false; // Use CDN models
      // `navigator` is a browser global; it does not exist during Astro's SSG build (Node).
      // Guard the access so importing/initializing this module in a Node build context doesn't throw.
      const hardwareConcurrency =
        typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined;
      env.backends.onnx.wasm.numThreads = Math.min(4, hardwareConcurrency || 4); // Multi-threading for better performance

      // Create feature extraction pipeline
      this.extractor = await pipeline('feature-extraction', this.modelName, {
        progress_callback: this.progressCallback
      });

      this.initialized = true;
      this.stats.modelLoaded = true;
    } catch (error) {
      throw new Error(`Failed to load Transformers.js model: ${error}`);
    }
  }

  protected async generateEmbedding(text: string): Promise<EmbeddingVector> {
    if (!this.extractor) {
      throw new Error('Model not initialized');
    }

    // Generate embeddings
    const output: Tensor = await this.extractor(text, {
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
  }

  protected async generateEmbeddingBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.extractor) {
      throw new Error('Model not initialized');
    }

    // Process texts in batch
    const outputs: Tensor = await this.extractor(texts, {
      pooling: 'mean',
      normalize: true
    });

    // Convert outputs to embedding vectors
    const embeddings: EmbeddingVector[] = [];
    const data = outputs.data as Float32Array;
    const dimensions = outputs.dims[outputs.dims.length - 1] ?? this.config.dimensions ?? 384;

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
  }

  override destroy(): void {
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
