// Adapter for mock-provider.ts to match test expectations
import { MockEmbeddingProvider } from './mock-provider';
import type { EmbeddingsAdapter } from './types';

export class MockEmbeddings implements EmbeddingsAdapter {
  private provider: MockEmbeddingProvider;

  constructor() {
    this.provider = new MockEmbeddingProvider();
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
