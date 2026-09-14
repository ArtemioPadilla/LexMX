import { describe, expect, it } from 'vitest';
import { TransformersEmbeddingProvider } from '../transformers-provider';

// `@xenova/transformers` is mocked globally in `src/test/setupTests.ts` (its
// `pipeline()` resolves to an extractor that always returns a 384-float
// vector) so these tests never touch the network or load a real model.

describe('TransformersEmbeddingProvider', () => {
  it('initializes lazily via a dynamic import and reports the default model dimensions', async () => {
    const provider = new TransformersEmbeddingProvider();
    expect(provider.isInitialized()).toBe(false);

    await provider.initialize();

    expect(provider.isInitialized()).toBe(true);
    expect(provider.getStats().modelLoaded).toBe(true);
    expect(provider.getModelName()).toBe('Xenova/multilingual-e5-small');
    expect(provider.getDimensions()).toBe(384);
  });

  it('embed() returns a normalized 384-dimension vector', async () => {
    const provider = new TransformersEmbeddingProvider({ cacheEnabled: false });
    const vector = await provider.embed('Artículo 123 constitucional');

    expect(vector.dimensions).toBe(384);
    expect(vector.values).toHaveLength(384);
  });

  it('initializing twice is a no-op (does not re-run the pipeline load)', async () => {
    const provider = new TransformersEmbeddingProvider();
    await provider.initialize();
    await provider.initialize();

    expect(provider.isInitialized()).toBe(true);
  });

  it('embedBatch() returns one vector per input text', async () => {
    const provider = new TransformersEmbeddingProvider({ cacheEnabled: false });
    const result = await provider.embedBatch(['solo texto']);

    expect(result).toHaveLength(1);
    expect(result[0]?.dimensions).toBe(384);
  });

  it('destroy() clears the loaded extractor and initialized state', async () => {
    const provider = new TransformersEmbeddingProvider();
    await provider.initialize();

    provider.destroy();

    expect(provider.isInitialized()).toBe(false);
    expect(provider.getStats().modelLoaded).toBe(false);
  });

  it('accepts a custom model name via config', () => {
    const provider = new TransformersEmbeddingProvider({ model: 'Xenova/all-MiniLM-L6-v2' });
    expect(provider.getModelName()).toBe('Xenova/all-MiniLM-L6-v2');
  });
});
