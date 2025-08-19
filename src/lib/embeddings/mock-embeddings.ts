// Adapter for mock-provider.ts to match test expectations
import { MockEmbeddingProvider } from './mock-provider';
import type { EmbeddingProvider } from '@/types/embeddings';

export class MockEmbeddings implements EmbeddingProvider {
  private provider: MockEmbeddingProvider;

  constructor() {
    this.provider = new MockEmbeddingProvider();
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