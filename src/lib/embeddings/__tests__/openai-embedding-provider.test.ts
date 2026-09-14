import { describe, expect, it, vi } from 'vitest';
import { OpenAIEmbeddingProvider } from '../openai-embedding-provider';

function mockFetchOnce(body: unknown, ok = true, status = 200): void {
  vi.mocked(global.fetch).mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  } as Response);
}

// `initialize()` performs its own connectivity check via `generateEmbedding('test')`,
// which consumes one mocked fetch response. Helper to get a ready provider
// without that call interfering with a test's own request assertions.
async function initializedProvider(config: ConstructorParameters<typeof OpenAIEmbeddingProvider>[0] = {}) {
  mockFetchOnce({ data: [{ embedding: [0], index: 0 }] });
  const provider = new OpenAIEmbeddingProvider({ apiKey: 'sk-test', cacheEnabled: false, ...config });
  await provider.initialize();
  vi.mocked(global.fetch).mockClear();
  return provider;
}

describe('OpenAIEmbeddingProvider', () => {
  it('throws when no API key is configured', async () => {
    const provider = new OpenAIEmbeddingProvider({ apiKey: '' });
    await expect(provider.initialize()).rejects.toThrow('OpenAI API key is required');
  });

  it('sends the expected request shape and parses a single embedding', async () => {
    const provider = await initializedProvider();
    mockFetchOnce({ data: [{ embedding: new Array(1536).fill(0.01), index: 0 }] });

    const vector = await provider.embed('hola mundo');

    expect(vector.dimensions).toBe(1536);
    expect(vector.values).toHaveLength(1536);

    const [url, init] = vi.mocked(global.fetch).mock.calls[0] ?? [];
    expect(url).toBe('https://api.openai.com/v1/embeddings');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer sk-test',
      'Content-Type': 'application/json',
    });

    const body = JSON.parse(init?.body as string);
    expect(body).toEqual({
      model: 'text-embedding-3-small',
      input: 'hola mundo',
      encoding_format: 'float',
    });
  });

  it('uses 3072 dimensions for text-embedding-3-large', () => {
    const provider = new OpenAIEmbeddingProvider({ apiKey: 'sk-test', model: 'text-embedding-3-large' });
    expect(provider.getDimensions()).toBe(3072);
    expect(provider.getModelName()).toBe('text-embedding-3-large');
  });

  it('embeds a batch and preserves order via the response index', async () => {
    const provider = await initializedProvider();
    mockFetchOnce({
      data: [
        { embedding: [0, 0, 1], index: 1 },
        { embedding: [1, 0, 0], index: 0 },
      ],
    });

    const [first, second] = await provider.embedBatch(['a', 'b']);

    expect(first?.values).toEqual([1, 0, 0]);
    expect(second?.values).toEqual([0, 0, 1]);
  });

  it('surfaces the API error body when the request fails', async () => {
    const provider = await initializedProvider();
    mockFetchOnce('rate limited', false, 429);

    await expect(provider.embed('texto')).rejects.toThrow('rate limited');
  });
});
