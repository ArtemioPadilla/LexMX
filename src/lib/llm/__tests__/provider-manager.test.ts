import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMProvider, LLMRequest, LLMResponse, ProviderConfig, QueryContext } from '../../../types/llm';
import type { PrivacySettings } from '../../../types/security';

// `provider-manager` is the module under test. Its two collaborators —
// `secureStorage` (persistence/"encryption" boundary) and `ProviderFactory`
// (constructs concrete provider instances) — are mocked so tests can drive
// registration/selection/fallback deterministically without touching
// IndexedDB or real network providers.
const configStore = vi.hoisted(() => new Map<string, ProviderConfig>());

const secureStorageMock = vi.hoisted(() => ({
  initialize: vi.fn(async () => {}),
  storeProviderConfig: vi.fn(async (config: ProviderConfig) => {
    configStore.set(config.id, config);
  }),
  getProviderConfig: vi.fn(async (id: string) => configStore.get(id) ?? null),
  getAllProviderConfigs: vi.fn(async () => Array.from(configStore.values())),
  removeProviderConfig: vi.fn(async (id: string) => {
    configStore.delete(id);
  }),
  getPreferredProvider: vi.fn(async () => null),
  setPreferredProvider: vi.fn(async () => {}),
  getPrivacySettings: vi.fn(
    (): PrivacySettings => ({
      encryptTokens: true,
      encryptQueries: false,
      encryptResponses: false,
      clearDataOnExit: false,
      sessionOnly: true,
      analytics: 'none'
    })
  )
}));

const createProviderMock = vi.hoisted(() => vi.fn<(config: ProviderConfig) => LLMProvider>());

vi.mock('../../security/secure-storage', () => ({
  secureStorage: secureStorageMock
}));

vi.mock('../providers', () => ({
  ProviderFactory: {
    createProvider: (config: ProviderConfig) => createProviderMock(config)
  }
}));

const { ProviderManager } = await import('../provider-manager');

function fakeProvider(overrides: Partial<LLMProvider> & { id: string }): LLMProvider {
  return {
    name: overrides.id,
    type: 'local',
    icon: '',
    description: '',
    costLevel: 'free',
    capabilities: [],
    models: [],
    status: 'connected',
    isAvailable: async () => true,
    testConnection: async () => true,
    generateResponse: async () => {
      throw new Error(`${overrides.id}: generateResponse not stubbed`);
    },
    estimateCost: () => 0,
    getMetrics: () => ({
      providerId: overrides.id,
      totalRequests: 0,
      successRate: 1,
      averageLatency: 0,
      totalCost: 0,
      lastUsed: 0
    }),
    ...overrides
  };
}

function neutralContext(overrides: Partial<QueryContext> = {}): QueryContext {
  return {
    query: 'test query',
    complexity: 0,
    urgency: 'low',
    privacyRequired: false,
    offlineMode: false,
    userBudget: 1000,
    ...overrides
  };
}

function baseRequest(overrides: Partial<LLMRequest> = {}): LLMRequest {
  return {
    model: 'test-model',
    messages: [{ role: 'user', content: 'hola' }],
    ...overrides
  };
}

describe('ProviderManager', () => {
  beforeEach(() => {
    configStore.clear();
    createProviderMock.mockReset();
    secureStorageMock.storeProviderConfig.mockClear();
    secureStorageMock.getProviderConfig.mockClear();
  });

  describe('registration', () => {
    it('persists the config via secureStorage and registers the provider instance', async () => {
      const manager = new ProviderManager();
      const fake = fakeProvider({ id: 'webllm' });
      createProviderMock.mockReturnValue(fake);

      const config: ProviderConfig = {
        id: 'webllm',
        name: 'WebLLM (Local)',
        type: 'local',
        enabled: true,
        priority: 10,
        createdAt: Date.now()
      };

      await manager.configureProvider(config);

      expect(secureStorageMock.storeProviderConfig).toHaveBeenCalledWith(config);
      expect(manager.getConfiguredProviders().map(p => p.id)).toContain('webllm');
      expect(manager.getProvider('webllm')).toBe(fake);
    });

    it('rejects configs that fail provider-registry validation and does not persist them', async () => {
      const manager = new ProviderManager();

      const invalidConfig: ProviderConfig = {
        id: 'openai', // cloud provider, missing required apiKey
        name: 'OpenAI',
        type: 'cloud',
        enabled: true,
        priority: 1,
        createdAt: Date.now()
      };

      await expect(manager.configureProvider(invalidConfig)).rejects.toThrow(/Invalid configuration/);
      expect(secureStorageMock.storeProviderConfig).not.toHaveBeenCalled();
    });
  });

  describe('selection', () => {
    it('prefers a local provider when offlineMode is true, regardless of priority', async () => {
      const manager = new ProviderManager();
      createProviderMock.mockImplementation((config: ProviderConfig) => fakeProvider({ id: config.id, type: config.type }));

      await manager.configureProvider({
        id: 'anthropic',
        name: 'Claude',
        type: 'cloud',
        enabled: true,
        priority: 10, // same priority as ollama below: offlineMode's +/-100 swing must decide
        apiKey: 'test-key',
        createdAt: Date.now()
      });
      await manager.configureProvider({
        id: 'ollama',
        name: 'Ollama',
        type: 'local',
        enabled: true,
        priority: 10,
        endpoint: 'http://localhost:11434',
        createdAt: Date.now()
      });

      const selected = await manager.selectOptimalProvider(neutralContext({ offlineMode: true }));
      expect(selected?.id).toBe('ollama');
    });

    it('prefers a cloud reasoning provider for high-complexity, legal-area-matched queries', async () => {
      // scoreProvider() consults the real `providerRegistry` metadata (not
      // provider.capabilities) for the complexity/legal-area bonuses, so the
      // fake instances only need to carry id/type/status here.
      const manager = new ProviderManager();
      createProviderMock.mockImplementation((config: ProviderConfig) => fakeProvider({ id: config.id, type: config.type }));

      await manager.configureProvider({
        id: 'anthropic',
        name: 'Claude',
        type: 'cloud',
        enabled: true,
        priority: 1,
        apiKey: 'test-key',
        createdAt: Date.now()
      });
      await manager.configureProvider({
        id: 'ollama',
        name: 'Ollama',
        type: 'local',
        enabled: true,
        priority: 1,
        endpoint: 'http://localhost:11434',
        createdAt: Date.now()
      });

      const selected = await manager.selectOptimalProvider(
        neutralContext({ complexity: 0.9, legalArea: 'ethical' })
      );
      expect(selected?.id).toBe('anthropic');
    });
  });

  describe('fallback on provider error', () => {
    it('falls back to a healthy provider and marks the response as a fallback', async () => {
      const manager = new ProviderManager();

      const successResponse: LLMResponse = {
        content: 'respuesta de respaldo',
        model: 'fallback-model',
        provider: 'ollama',
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
        latency: 42
      };

      createProviderMock.mockImplementation((config: ProviderConfig) => {
        if (config.id === 'webllm') {
          return fakeProvider({
            id: 'webllm',
            type: 'local',
            generateResponse: async () => {
              throw new Error('primary provider is down');
            }
          });
        }
        return fakeProvider({
          id: 'ollama',
          type: 'local',
          generateResponse: async () => ({ ...successResponse })
        });
      });

      await manager.configureProvider({
        id: 'webllm',
        name: 'WebLLM (Local)',
        type: 'local',
        enabled: true,
        priority: 10, // scored first
        createdAt: Date.now()
      });
      await manager.configureProvider({
        id: 'ollama',
        name: 'Ollama',
        type: 'local',
        enabled: true,
        priority: 1,
        endpoint: 'http://localhost:11434',
        createdAt: Date.now()
      });

      const response = await manager.processRequest(baseRequest(), neutralContext());

      expect(response.content).toBe('respuesta de respaldo');
      expect(response.metadata?.fallback).toBe(true);
    });
  });
});
