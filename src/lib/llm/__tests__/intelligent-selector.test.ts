import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMProvider } from '../../../types/llm';

// `intelligent-selector` is the module under test; its only collaborator is
// `provider-manager`, which we replace with a fixed set of fake providers so
// routing decisions are driven purely by the (real, un-mocked) model
// capability table and scoring logic inside intelligent-selector.ts.
const getAvailableProviders = vi.fn<() => Promise<LLMProvider[]>>();
const getProvider = vi.fn<(id: string) => Promise<LLMProvider | undefined>>();

vi.mock('../provider-manager', () => ({
  providerManager: {
    getAvailableProviders: () => getAvailableProviders(),
    getProvider: (id: string) => getProvider(id)
  }
}));

function fakeProvider(id: string, type: LLMProvider['type'] = 'cloud'): LLMProvider {
  return {
    id,
    name: id,
    type,
    icon: '',
    description: '',
    costLevel: 'medium',
    capabilities: [],
    models: [],
    status: 'connected',
    isAvailable: async () => true,
    testConnection: async () => true,
    generateResponse: async () => {
      throw new Error('not implemented in fake');
    },
    estimateCost: () => 0,
    getMetrics: () => ({
      providerId: id,
      totalRequests: 0,
      successRate: 1,
      averageLatency: 0,
      totalCost: 0,
      lastUsed: 0
    })
  };
}

// Imported after the mock so the module under test picks up the fake.
const { intelligentSelector } = await import('../intelligent-selector');

describe('intelligent-selector', () => {
  beforeEach(() => {
    getAvailableProviders.mockReset();
    getProvider.mockReset();
    getProvider.mockImplementation(async (id: string) => fakeProvider(id));
  });

  describe('analyzeQuery', () => {
    it('detects complex queries that require reasoning', () => {
      const criteria = intelligentSelector.analyzeQuery('Necesito un análisis de la constitucionalidad de esta ley');
      expect(criteria.queryComplexity).toBe('complex');
      expect(criteria.requiresReasoning).toBe(true);
    });

    it('detects simple definitional queries', () => {
      const criteria = intelligentSelector.analyzeQuery('¿Qué es un amparo?');
      expect(criteria.queryComplexity).toBe('simple');
    });

    it('detects when citations are required', () => {
      const criteria = intelligentSelector.analyzeQuery('¿Qué dice el artículo 123 de la ley?');
      expect(criteria.requiresCitations).toBe(true);
    });
  });

  describe('selectProvider routing', () => {
    it('returns null when no providers are available', async () => {
      getAvailableProviders.mockResolvedValue([]);
      const result = await intelligentSelector.selectProvider({ queryComplexity: 'simple' });
      expect(result).toBeNull();
    });

    it('routes complex, reasoning-heavy queries to the strongest reasoning model', async () => {
      getAvailableProviders.mockResolvedValue([fakeProvider('ollama', 'local'), fakeProvider('claude', 'cloud')]);

      const result = await intelligentSelector.selectProvider({
        queryComplexity: 'complex',
        requiresReasoning: true,
        priority: 'quality',
        language: 'es'
      });

      expect(result).not.toBeNull();
      expect(result?.providerId).toBe('claude');
    });

    it('routes cost-sensitive queries with a hard budget to the free local provider', async () => {
      getAvailableProviders.mockResolvedValue([fakeProvider('ollama', 'local'), fakeProvider('openai', 'cloud')]);

      const result = await intelligentSelector.selectProvider({
        queryComplexity: 'simple',
        priority: 'cost',
        maxCost: 0
      });

      expect(result).not.toBeNull();
      expect(result?.providerId).toBe('ollama');
      expect(result?.estimatedCost).toBe(0);
    });

    it('skips providers that have no entry in the model capability table', async () => {
      getAvailableProviders.mockResolvedValue([fakeProvider('unknown-provider', 'cloud')]);

      const result = await intelligentSelector.selectProvider({ queryComplexity: 'simple' });
      expect(result).toBeNull();
    });
  });

  describe('getRecommendations', () => {
    it('returns at most maxResults recommendations sorted by score descending', async () => {
      getAvailableProviders.mockResolvedValue([fakeProvider('ollama', 'local'), fakeProvider('claude', 'cloud'), fakeProvider('openai', 'cloud')]);

      const recommendations = await intelligentSelector.getRecommendations('¿Qué es un amparo?', 2);

      expect(recommendations.length).toBeLessThanOrEqual(2);
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i - 1]!.score).toBeGreaterThanOrEqual(recommendations[i]!.score);
      }
    });

    it('returns an empty list when there are no available providers', async () => {
      getAvailableProviders.mockResolvedValue([]);
      const recommendations = await intelligentSelector.getRecommendations('cualquier consulta');
      expect(recommendations).toEqual([]);
    });
  });
});
