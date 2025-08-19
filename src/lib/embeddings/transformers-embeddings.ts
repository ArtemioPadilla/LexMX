// Adapter for transformers-provider.ts to match test expectations
import { TransformersEmbeddingProvider } from './transformers-provider';
import type { EmbeddingProvider } from '@/types/embeddings';

export class TransformersEmbeddings implements EmbeddingProvider {
  private provider: TransformersEmbeddingProvider;

  constructor() {
    this.provider = new TransformersEmbeddingProvider();
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.provider.embedDocuments(texts);
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.provider.embedQuery(text);
  }

  getDimensions(): number {
    return this.provider.getDimensions();
  }

  getModelName(): string {
    return this.provider.getModelName();
  }

  async dispose(): Promise<void> {
    await this.provider.dispose();
  }
}