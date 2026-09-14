// Adapter for openai-embedding-provider.ts to match test expectations
import { OpenAIEmbeddingProvider } from './openai-embedding-provider';
import type { EmbeddingsAdapter } from './types';

// Resolves an OpenAI API key with the same precedence `src/lib/utils/env-config.ts`
// (`getEnvConfig().getOpenAIKey()`) uses: explicit arg > `OPENAI_API_KEY` env
// var > `lexmx_openai_key` in localStorage. Reimplemented locally so this
// module doesn't depend on a file outside `src/lib/embeddings/` (env-config.ts
// isn't part of this cleanup and isn't `noUncheckedIndexedAccess`-clean yet).
function resolveApiKey(explicit?: string): string {
  if (explicit) return explicit;

  const envKey = typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined;
  if (envKey) return envKey;

  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem('lexmx_openai_key') ?? '';
    } catch {
      return '';
    }
  }

  return '';
}

export class OpenAIEmbeddings implements EmbeddingsAdapter {
  private provider: OpenAIEmbeddingProvider;

  constructor(apiKey?: string) {
    this.provider = new OpenAIEmbeddingProvider({
      apiKey: resolveApiKey(apiKey),
      model: 'text-embedding-ada-002'
    });
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
