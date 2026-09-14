import { describe, expect, it, vi } from 'vitest';
import { MockEmbeddings } from '../mock-embeddings';
import { TransformersEmbeddings } from '../transformers-embeddings';
import { OpenAIEmbeddings } from '../openai-embeddings';

// These thin wrappers exist only so `src/lib/admin/embeddings-service.ts`
// (outside this module) can depend on a stable `embedDocuments`/`embedQuery`
// shape regardless of which underlying `*Provider` class backs it.

describe('MockEmbeddings adapter', () => {
  it('proxies embedQuery/embedDocuments/getDimensions/getModelName to the underlying provider', async () => {
    const adapter = new MockEmbeddings();
    await adapter.initialize();

    const query = await adapter.embedQuery('hola');
    expect(query).toHaveLength(384);

    const docs = await adapter.embedDocuments(['a', 'b']);
    expect(docs).toHaveLength(2);
    expect(docs[0]).toHaveLength(384);

    expect(adapter.getDimensions()).toBe(384);
    expect(adapter.getModelName()).toBe('mock');

    await expect(adapter.dispose()).resolves.toBeUndefined();
  });
});

describe('TransformersEmbeddings adapter', () => {
  it('proxies to TransformersEmbeddingProvider (backed by the globally-mocked pipeline)', async () => {
    const adapter = new TransformersEmbeddings();
    await adapter.initialize();

    const query = await adapter.embedQuery('hola mundo');
    expect(query).toHaveLength(384);
    expect(adapter.getDimensions()).toBe(384);
    expect(adapter.getModelName()).toBe('Xenova/multilingual-e5-small');
  });
});

describe('OpenAIEmbeddings adapter', () => {
  it('resolves the API key from the OPENAI_API_KEY env var and proxies embedQuery', async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-from-env';

    try {
      const okResponse = (embedding: number[]) =>
        ({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [{ embedding, index: 0 }] }),
          text: () => Promise.resolve(''),
        }) as Response;

      // First call is the provider's internal `initialize()` connectivity
      // check; the second is the actual `embedQuery` request.
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(okResponse([0]))
        .mockResolvedValueOnce(okResponse([0.1, 0.2]));

      const adapter = new OpenAIEmbeddings();
      const result = await adapter.embedQuery('texto');

      expect(result).toEqual([0.1, 0.2]);
      expect(adapter.getModelName()).toBe('text-embedding-ada-002');
    } finally {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });
});
