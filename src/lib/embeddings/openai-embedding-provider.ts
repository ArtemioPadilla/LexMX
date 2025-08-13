// OpenAI embeddings provider

import { BaseEmbeddingProvider } from './base-provider';
import type { EmbeddingProviderType, EmbeddingVector } from '@/types/embeddings';

export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  type: EmbeddingProviderType = 'openai';
  private apiKey: string;
  private apiUrl: string;
  private modelName: string;

  constructor(config: any = {}) {
    super({
      dimensions: 1536, // Default for text-embedding-3-small
      ...config
    });

    this.apiKey = config.apiKey || '';
    this.apiUrl = config.apiUrl || 'https://api.openai.com/v1/embeddings';
    this.modelName = config.model || 'text-embedding-3-small';

    // Adjust dimensions based on model
    if (this.modelName === 'text-embedding-3-large') {
      this.config.dimensions = 3072;
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.apiKey) {
      throw new Error('OpenAI API key is required');
    }

    // Test API connection
    try {
      await this.generateEmbedding('test');
      this.initialized = true;
      this.stats.modelLoaded = true;
      console.log('[OpenAIProvider] Initialized successfully');
    } catch (error) {
      console.error('[OpenAIProvider] Failed to initialize:', error);
      throw new Error(`Failed to connect to OpenAI API: ${error}`);
    }
  }

  protected async generateEmbedding(text: string): Promise<EmbeddingVector> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelName,
          input: text,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      const embedding = data.data[0].embedding;

      return {
        values: embedding,
        dimensions: embedding.length
      };
    } catch (error) {
      console.error('[OpenAIProvider] Embedding generation failed:', error);
      throw error;
    }
  }

  protected async generateEmbeddingBatch(texts: string[]): Promise<EmbeddingVector[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.modelName,
          input: texts,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      
      // Sort by index to maintain order
      const sortedData = data.data.sort((a: any, b: any) => a.index - b.index);
      
      return sortedData.map((item: any) => ({
        values: item.embedding,
        dimensions: item.embedding.length
      }));
    } catch (error) {
      console.error('[OpenAIProvider] Batch embedding generation failed:', error);
      throw error;
    }
  }

  // Get available models for the UI
  static getAvailableModels() {
    return [
      {
        id: 'text-embedding-3-small',
        name: 'Text Embedding 3 Small',
        description: 'Most cost-effective, good quality',
        dimensions: 1536,
        cost: '$0.00002/1K tokens',
        recommended: true
      },
      {
        id: 'text-embedding-3-large',
        name: 'Text Embedding 3 Large',
        description: 'Highest quality embeddings',
        dimensions: 3072,
        cost: '$0.00013/1K tokens',
        recommended: false
      },
      {
        id: 'text-embedding-ada-002',
        name: 'Ada v2 (Legacy)',
        description: 'Previous generation model',
        dimensions: 1536,
        cost: '$0.0001/1K tokens',
        recommended: false
      }
    ];
  }
}