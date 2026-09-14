import { describe, expect, it, vi } from 'vitest';
import { EmbeddingManager } from '../embedding-manager';
import { MockEmbeddingProvider } from '../mock-provider';
import type { RAGProgressEvent } from '@/types/embeddings';

// `@xenova/transformers` is mocked globally (src/test/setupTests.ts), so the
// 'transformers' provider initializes successfully without a real model or
// network access. 'openai' has no API key configured here, so it always
// fails to initialize — this is what we use below to exercise the explicit
// fallback path.

describe('EmbeddingManager — provider selection', () => {
  it('defaults to the transformers provider and initializes without falling back', async () => {
    const manager = new EmbeddingManager();
    await manager.initialize();

    expect(manager.getProviderType()).toBe('transformers');
    expect(manager.isUsingFallback()).toBe(false);
    expect(manager.getStatus()).toEqual({
      providerType: 'transformers',
      isFallback: false,
      fallbackReason: undefined,
    });
  });

  it('switches to an explicitly requested provider', async () => {
    const manager = new EmbeddingManager();
    await manager.switchProvider('mock');

    expect(manager.getProviderType()).toBe('mock');
    expect(manager.getCurrentProvider()?.type).toBe('mock');
  });

  it('reuses an already-initialized provider instead of constructing a new one', async () => {
    const manager = new EmbeddingManager();
    await manager.switchProvider('mock');
    const first = manager.getCurrentProvider();

    await manager.switchProvider('transformers');
    await manager.switchProvider('mock');

    expect(manager.getCurrentProvider()).toBe(first);
  });
});

describe('EmbeddingManager — explicit fallback status', () => {
  it('falls back to mock and exposes an explicit, non-silent status when the requested provider fails', async () => {
    const events: RAGProgressEvent[] = [];
    const manager = new EmbeddingManager({
      defaultProvider: 'openai',
      providers: { openai: { apiKey: '' } }, // guaranteed to fail initialize()
      onProgress: (event) => events.push(event),
    });

    await manager.initialize();

    expect(manager.getProviderType()).toBe('mock');
    expect(manager.isUsingFallback()).toBe(true);
    expect(manager.getStatus().fallbackReason).toMatch(/openai/i);

    // The failure and the fallback must be observable, not silent.
    const errorEvents = events.filter((e) => e.status === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
    expect(errorEvents.some((e) => /falling back|fallback|mock/i.test(e.message ?? ''))).toBe(true);
  });

  it('does not report a fallback when mock is explicitly requested', async () => {
    const manager = new EmbeddingManager();
    await manager.switchProvider('mock');

    expect(manager.isUsingFallback()).toBe(false);
  });

  it('re-throws when the mock provider itself cannot initialize (no further fallback target)', async () => {
    const spy = vi
      .spyOn(MockEmbeddingProvider.prototype, 'initialize')
      .mockRejectedValueOnce(new Error('disk full'));

    const manager = new EmbeddingManager({ defaultProvider: 'mock' });

    await expect(manager.initialize()).rejects.toThrow('disk full');
    expect(manager.isUsingFallback()).toBe(false);

    spy.mockRestore();
  });
});

describe('EmbeddingManager — embedding operations', () => {
  it('embeds documents keyed by id using the batch provider call', async () => {
    const manager = new EmbeddingManager({ defaultProvider: 'mock' });
    await manager.initialize();

    const result = await manager.embedDocuments([
      { id: 'doc-1', text: 'Artículo 1' },
      { id: 'doc-2', text: 'Artículo 2' },
    ]);

    expect(result.size).toBe(2);
    expect(result.get('doc-1')?.dimensions).toBe(384);
    expect(result.get('doc-2')?.dimensions).toBe(384);
  });

  it('calculateSimilarity returns 1 for identical vectors and rejects mismatched dimensions', () => {
    const manager = new EmbeddingManager();
    const vector = { values: [1, 0, 0], dimensions: 3 };

    expect(manager.calculateSimilarity(vector, vector)).toBeCloseTo(1);
    expect(() =>
      manager.calculateSimilarity(vector, { values: [1, 0], dimensions: 2 })
    ).toThrow('Vectors must have the same dimensions');
  });

  it('findSimilar filters by threshold and sorts by score descending', async () => {
    const manager = new EmbeddingManager();
    const query = { values: [1, 0], dimensions: 2 };
    const docs = new Map([
      ['low', { values: [0, 1], dimensions: 2 }], // orthogonal -> score 0
      ['high', { values: [1, 0], dimensions: 2 }], // identical -> score 1
    ]);

    const results = await manager.findSimilar(query, docs, 5, 0.5);

    expect(results).toEqual([{ id: 'high', score: 1 }]);
  });

  it('lists the three available providers with their models', () => {
    const providers = EmbeddingManager.getAvailableProviders();
    expect(providers.map((p) => p.type)).toEqual(['transformers', 'openai', 'mock']);
    expect(providers.every((p) => p.models.length > 0)).toBe(true);
  });
});
