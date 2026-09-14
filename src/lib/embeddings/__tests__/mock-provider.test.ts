import { describe, expect, it } from 'vitest';
import { MockEmbeddingProvider } from '../mock-provider';

describe('MockEmbeddingProvider', () => {
  it('initializes and reports 384 dimensions by default', async () => {
    const provider = new MockEmbeddingProvider();
    expect(provider.isInitialized()).toBe(false);

    await provider.initialize();

    expect(provider.isInitialized()).toBe(true);
    expect(provider.getDimensions()).toBe(384);
    expect(provider.getStats().modelLoaded).toBe(true);
    expect(provider.getStats().providerType).toBe('mock');
  });

  it('is deterministic: the same text always yields the same vector', async () => {
    const provider = new MockEmbeddingProvider({ cacheEnabled: false });
    const a = await provider.embed('Artículo 123 constitucional');
    const b = await provider.embed('Artículo 123 constitucional');

    expect(a.dimensions).toBe(384);
    expect(a.values).toEqual(b.values);
  });

  it('produces different vectors for different text', async () => {
    const provider = new MockEmbeddingProvider({ cacheEnabled: false });
    const a = await provider.embed('Ley Federal del Trabajo');
    const b = await provider.embed('Código Civil Federal');

    expect(a.values).not.toEqual(b.values);
  });

  it('embedBatch returns one vector per input, matching individual embed() calls', async () => {
    const provider = new MockEmbeddingProvider({ cacheEnabled: false });
    const texts = ['uno', 'dos', 'tres'];

    const batch = await provider.embedBatch(texts);
    expect(batch).toHaveLength(3);

    for (const [i, text] of texts.entries()) {
      const single = await provider.embed(text);
      expect(batch[i]?.values).toEqual(single.values);
    }
  });

  it('caches repeated embed() calls', async () => {
    const provider = new MockEmbeddingProvider({ cacheEnabled: true });
    await provider.embed('repetido');
    await provider.embed('repetido');

    expect(provider.getStats().cachedEmbeddings).toBe(1);
    expect(provider.getStats().totalEmbeddings).toBe(1);
  });

  it('respects a custom dimensions config', async () => {
    const provider = new MockEmbeddingProvider({ dimensions: 8, cacheEnabled: false });
    const vector = await provider.embed('short vector');

    expect(vector.dimensions).toBe(8);
    expect(vector.values).toHaveLength(8);
    expect(provider.getDimensions()).toBe(8);
  });
});
