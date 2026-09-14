import { describe, it, expect } from 'vitest';
import { providerRegistry, SUPPORTED_PROVIDERS } from '../provider-registry';
import type { LLMCapability, CostLevel } from '../../../types/llm';

const VALID_CAPABILITIES: ReadonlySet<LLMCapability> = new Set([
  'reasoning', 'analysis', 'citations', 'ethics', 'multilingual', 'privacy', 'offline', 'customizable'
]);

const VALID_COST_LEVELS: ReadonlySet<CostLevel> = new Set(['free', 'low', 'medium', 'high']);

describe('provider-registry', () => {
  describe('SUPPORTED_PROVIDERS shape', () => {
    it('registers the expected set of provider ids', () => {
      const ids = providerRegistry.getSupportedProviders().map(p => p.id).sort();
      expect(ids).toEqual(
        ['anthropic', 'azure', 'bedrock', 'google', 'mock', 'ollama', 'openai', 'openai-compatible', 'vertex', 'webllm'].sort()
      );
    });

    it('gives every provider only capabilities from the shared LLMCapability union', () => {
      for (const metadata of Object.values(SUPPORTED_PROVIDERS)) {
        for (const capability of metadata.capabilities) {
          expect(VALID_CAPABILITIES.has(capability), `${metadata.id} has invalid capability "${capability}"`).toBe(true);
        }
      }
    });

    it('gives every provider a costLevel from the shared CostLevel union', () => {
      for (const metadata of Object.values(SUPPORTED_PROVIDERS)) {
        expect(VALID_COST_LEVELS.has(metadata.costLevel), `${metadata.id} has invalid costLevel "${metadata.costLevel}"`).toBe(true);
      }
    });

    it('gives every provider a setupComplexity from the documented union', () => {
      for (const metadata of Object.values(SUPPORTED_PROVIDERS)) {
        expect(['easy', 'medium', 'advanced']).toContain(metadata.setupComplexity);
      }
    });

    it('gives every provider a non-empty id, name, icon and description', () => {
      for (const metadata of Object.values(SUPPORTED_PROVIDERS)) {
        expect(metadata.id.length).toBeGreaterThan(0);
        expect(metadata.name.length).toBeGreaterThan(0);
        expect(metadata.icon.length).toBeGreaterThan(0);
        expect(metadata.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('cost metadata queries', () => {
    it('classifies free providers as local, no-API-key options', () => {
      const freeIds = providerRegistry.getProvidersByCost('free').map(p => p.id).sort();
      expect(freeIds).toEqual(['mock', 'ollama', 'openai-compatible', 'webllm'].sort());
    });

    it('classifies the flagship cloud providers by cost level', () => {
      expect(providerRegistry.getProviderMetadata('openai')?.costLevel).toBe('high');
      expect(providerRegistry.getProviderMetadata('google')?.costLevel).toBe('low');
      expect(providerRegistry.getProviderMetadata('anthropic')?.costLevel).toBe('medium');
    });
  });

  describe('type partitioning', () => {
    it('partitions providers into cloud and local without overlap', () => {
      const cloud = providerRegistry.getCloudProviders().map(p => p.id);
      const local = providerRegistry.getLocalProviders().map(p => p.id);

      expect(cloud.length + local.length).toBe(providerRegistry.getSupportedProviders().length);
      expect(cloud.every(id => !local.includes(id))).toBe(true);
    });
  });

  describe('validateConfig', () => {
    it('rejects unknown provider ids', () => {
      const result = providerRegistry.validateConfig({
        id: 'not-a-real-provider',
        name: 'Fake',
        type: 'cloud',
        enabled: true,
        priority: 1,
        createdAt: Date.now()
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatch(/Unknown provider/);
    });

    it('requires an API key for cloud providers', () => {
      const result = providerRegistry.validateConfig({
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud',
        enabled: true,
        priority: 1,
        createdAt: Date.now()
      });
      expect(result.valid).toBe(false);
      expect(result.errors.join(' ')).toMatch(/API key/);
    });

    it('accepts webllm with no endpoint or API key', () => {
      const result = providerRegistry.validateConfig({
        id: 'webllm',
        name: 'WebLLM',
        type: 'local',
        enabled: true,
        priority: 1,
        createdAt: Date.now()
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });
});
