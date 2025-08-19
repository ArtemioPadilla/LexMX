import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebLLMProvider } from '../webllm-provider';
import type { LLMRequest, ProviderConfig } from '../../../../types/llm';

// Mock WebLLM module
const mockEngine = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
};

vi.mock('@mlc-ai/web-llm', () => ({
  CreateMLCEngine: vi.fn().mockResolvedValue(mockEngine),
  prebuiltAppConfig: {
    model_list: [
      { model_id: 'Phi-3.5-mini-instruct-q4f16_1-MLC' },
      { model_id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC' },
      { model_id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' }
    ]
  }
}));

// Navigator.gpu is already mocked in setupTests.ts

describe('WebLLMProvider', () => {
  let provider: WebLLMProvider;
  let mockConfig: ProviderConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mockEngine
    mockEngine.chat.completions.create.mockReset();
    
    mockConfig = {
      id: 'webllm',
      name: 'WebLLM',
      type: 'local',
      enabled: true,
      model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC'
    };

    provider = new WebLLMProvider(mockConfig);
  });

  describe('initialization', () => {
    it('should initialize with correct properties', () => {
      expect(provider.id).toBe('webllm');
      expect(provider.name).toBe('WebLLM (Browser)');
      expect(provider.type).toBe('local');
      expect(provider.costLevel).toBe('free');
      expect(provider.capabilities).toContain('privacy');
      expect(provider.capabilities).toContain('offline');
    });

    it('should have available models', () => {
      expect(provider.models.length).toBeGreaterThan(0);
      const modelIds = provider.models.map(m => m.id);
      expect(modelIds).toContain('Llama-3.2-3B-Instruct-q4f16_1-MLC');
    });

    it('should check WebGPU availability', async () => {
      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(true);
    });

    it('should fail when WebGPU is not available', async () => {
      // Store original value
      const originalGpu = navigator.gpu;
      
      // Remove WebGPU support
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        configurable: true
      });

      const isAvailable = await provider.isAvailable();
      expect(isAvailable).toBe(false);

      // Restore WebGPU
      Object.defineProperty(navigator, 'gpu', {
        value: originalGpu,
        configurable: true
      });
    });
  });

  describe('testConnection', () => {
    it('should return true when WebGPU is available', async () => {
      const result = await provider.testConnection();
      expect(result).toBe(true);
      expect(provider.status).toBe('connected');
    });

    it('should return false when WebGPU is not available', async () => {
      // Store original value
      const originalGpu = navigator.gpu;
      
      Object.defineProperty(navigator, 'gpu', {
        value: undefined,
        configurable: true
      });

      const result = await provider.testConnection();
      expect(result).toBe(false);
      expect(provider.status).toBe('error');

      // Restore
      Object.defineProperty(navigator, 'gpu', {
        value: originalGpu,
        configurable: true
      });
    });
  });

  describe('model operations', () => {
    it('should get model display name', () => {
      const name = provider.getModelDisplayName('Llama-3.2-3B-Instruct-q4f16_1-MLC');
      expect(name).toBe('Llama 3.2 3B');
    });

    it('should return model ID for unknown models', () => {
      const name = provider.getModelDisplayName('unknown-model');
      expect(name).toBe('unknown-model');
    });

    it('should get model context window', () => {
      const window = provider.getModelContextWindow('Llama-3.2-3B-Instruct-q4f16_1-MLC');
      expect(window).toBe(8192);
    });

    it('should return default context window for unknown models', () => {
      const window = provider.getModelContextWindow('unknown-model');
      expect(window).toBe(4096);
    });
  });

  describe('cost estimation', () => {
    it('should always return 0 cost', () => {
      const request: LLMRequest = {
        messages: [{ role: 'user', content: 'Test message' }],
        temperature: 0.7
      };

      const cost = provider.estimateCost(request);
      expect(cost).toBe(0);
    });

    it('should return 0 for getCost', () => {
      const cost = provider.getCost(100, 200, 'any-model');
      expect(cost).toBe(0);
    });
  });

  describe('metrics', () => {
    it('should return initial metrics', () => {
      const metrics = provider.getMetrics();
      expect(metrics.providerId).toBe('webllm');
      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successRate).toBe(1.0);
      expect(metrics.totalCost).toBe(0);
    });
  });

  describe('configuration', () => {
    it('should get config', () => {
      const config = provider.getConfig();
      expect(config.id).toBe('webllm');
      expect(config.model).toBe('Llama-3.2-3B-Instruct-q4f16_1-MLC');
    });

    it('should update config', () => {
      provider.updateConfig({ model: 'Llama-3.2-1B-Instruct-q4f16_1-MLC' });
      const config = provider.getConfig();
      expect(config.model).toBe('Llama-3.2-1B-Instruct-q4f16_1-MLC');
    });
  });

  describe('error handling', () => {
    it('should handle initialization errors gracefully', async () => {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      (CreateMLCEngine as any).mockRejectedValueOnce(new Error('Init failed'));

      await expect(provider.initialize()).rejects.toThrow('Init failed');
    });

    it('should prevent multiple initialization attempts', async () => {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      
      // Create a new provider for this test to ensure clean state
      const testProvider = new WebLLMProvider(mockConfig);
      
      (CreateMLCEngine as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockEngine), 50))
      );

      // Start multiple initializations
      const init1 = testProvider.initialize();
      const init2 = testProvider.initialize();
      const init3 = testProvider.initialize();

      await Promise.all([init1, init2, init3]);

      // Should only call CreateMLCEngine once
      expect(CreateMLCEngine).toHaveBeenCalledTimes(1);
    });
  });
});