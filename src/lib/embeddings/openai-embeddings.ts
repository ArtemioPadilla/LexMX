// Adapter for openai-embedding-provider.ts to match test expectations
import { OpenAIEmbeddingProvider } from './openai-embedding-provider';
import { getEnvConfig } from '../utils/env-config';
import type { EmbeddingProvider } from '@/types/embeddings';

export class OpenAIEmbeddings implements EmbeddingProvider {
  private provider: OpenAIEmbeddingProvider;

  constructor(apiKey?: string) {
    const envConfig = getEnvConfig();
    this.provider = new OpenAIEmbeddingProvider({
      apiKey: apiKey || envConfig.getOpenAIKey() || '',
      model: 'text-embedding-ada-002'
    });
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