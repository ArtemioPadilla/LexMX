// Adapter for transformers-provider.ts to match test expectations
import { TransformersEmbeddingProvider } from './transformers-provider';
import type { EmbeddingsAdapter } from './types';

export class TransformersEmbeddings implements EmbeddingsAdapter {
  private provider: TransformersEmbeddingProvider;

  constructor() {
    this.provider = new TransformersEmbeddingProvider();
  }

  async initialize(): Promise<void> {
    await this.provider.initialize();
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const vectors = await this.provider.embedBatch(texts);
    return vectors.map((vector) => vector.values);
  }

  async embedQuery(text: string): Promise<number[]> {
    const vector = await this.provider.embed(text);
    return vector.values;
  }

  getDimensions(): number {
    return this.provider.getDimensions();
  }

  getModelName(): string {
    return this.provider.getModelName();
  }

  async dispose(): Promise<void> {
    this.provider.destroy();
  }
}
