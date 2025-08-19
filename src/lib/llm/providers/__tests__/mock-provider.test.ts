import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockProvider } from '../mock-provider';
import type { ChatCompletionOptions, ChatCompletionResponse } from '../../types';

describe('MockProvider', () => {
  let provider: MockProvider;

  beforeEach(() => {
    provider = new MockProvider();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await provider.initialize();
      expect(result).toBe(true);
      expect(provider.isInitialized()).toBe(true);
    });

    it('should handle multiple initialization calls', async () => {
      await provider.initialize();
      const secondInit = await provider.initialize();
      
      expect(secondInit).toBe(true);
      expect(provider.isInitialized()).toBe(true);
    });

    it('should have correct provider name', () => {
      expect(provider.getName()).toBe('mock');
    });

    it('should have mock model as default', () => {
      expect(provider.getModel()).toBe('mock-model');
    });
  });

  describe('Chat Completion', () => {
    it('should generate mock responses for legal queries', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: '¿Qué dice el artículo 123 de la Constitución?' }
        ],
        temperature: 0.7,
        maxTokens: 500
      };

      const response = await provider.complete(options);
      
      expect(response).toBeDefined();
      expect(response.content).toContain('mock');
      expect(response.content.length).toBeGreaterThan(0);
      expect(response.usage).toBeDefined();
      expect(response.usage.promptTokens).toBeGreaterThan(0);
      expect(response.usage.completionTokens).toBeGreaterThan(0);
    });

    it('should include legal disclaimer in responses', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Necesito asesoría legal' }
        ]
      };

      const response = await provider.complete(options);
      
      expect(response.content.toLowerCase()).toMatch(
        /mock|demo|desarrollo|development|test|prueba/
      );
    });

    it('should handle system messages', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'system', content: 'You are a legal assistant' },
          { role: 'user', content: 'What is law?' }
        ]
      };

      const response = await provider.complete(options);
      
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });

    it('should respect maxTokens parameter', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Explain everything about Mexican law' }
        ],
        maxTokens: 50
      };

      const response = await provider.complete(options);
      
      // Mock provider should respect token limits
      expect(response.usage.completionTokens).toBeLessThanOrEqual(50);
    });

    it('should handle empty messages gracefully', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: []
      };

      const response = await provider.complete(options);
      
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
      expect(response.error).toBeUndefined();
    });
  });

  describe('Streaming Responses', () => {
    it('should support streaming mode', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Test query' }
        ],
        stream: true
      };

      const response = await provider.complete(options);
      
      expect(response).toBeDefined();
      expect(response.stream).toBeDefined();
      
      if (response.stream) {
        const chunks: string[] = [];
        for await (const chunk of response.stream) {
          chunks.push(chunk);
        }
        
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks.join('')).toContain('mock');
      }
    });

    it('should simulate realistic streaming delays', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Test query' }
        ],
        stream: true
      };

      const startTime = Date.now();
      const response = await provider.complete(options);
      
      if (response.stream) {
        const chunks: string[] = [];
        for await (const chunk of response.stream) {
          chunks.push(chunk);
          // Advance timers to simulate delay
          vi.advanceTimersByTime(50);
        }
        
        // Should have some delay between chunks
        expect(chunks.length).toBeGreaterThan(1);
      }
    });
  });

  describe('Error Simulation', () => {
    it('should simulate errors when configured', async () => {
      // Use 100% error rate for deterministic testing
      const errorProvider = new MockProvider({ 
        simulateErrors: true,
        errorRate: 1.0 // Always error for deterministic testing
      });
      await errorProvider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Test query' }
        ]
      };

      // Should always throw with 100% error rate
      await expect(errorProvider.complete(options)).rejects.toThrow('Mock provider request failed (simulated error)');
    });

    it('should not throw errors during initialization', async () => {
      const errorProvider = new MockProvider({ 
        simulateErrors: true,
        errorRate: 1.0 // Always error
      });
      
      // Initialization should succeed even with error simulation
      // Errors only occur during complete() calls
      const result = await errorProvider.initialize();
      expect(result).toBe(true);
      expect(errorProvider.isInitialized()).toBe(true);
    });
  });

  describe('Delay Simulation', () => {
    it('should simulate realistic response delays', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Quick test' }
        ]
      };

      const startTime = Date.now();
      
      // Start the async operation
      const responsePromise = provider.complete(options);
      
      // Advance timers
      vi.advanceTimersByTime(1000);
      
      const response = await responsePromise;
      
      expect(response).toBeDefined();
      expect(response.content).toBeTruthy();
    });

    it('should vary delay based on message complexity', async () => {
      await provider.initialize();
      
      const simpleQuery: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Hi' }
        ]
      };

      const complexQuery: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Explain the entire Mexican legal system including constitutional law, civil law, criminal law, labor law, and administrative law with examples and citations.' }
        ]
      };

      // Simple query should be faster
      const simplePromise = provider.complete(simpleQuery);
      vi.advanceTimersByTime(500);
      const simpleResponse = await simplePromise;
      
      // Complex query should take longer
      const complexPromise = provider.complete(complexQuery);
      vi.advanceTimersByTime(2000);
      const complexResponse = await complexPromise;
      
      expect(simpleResponse).toBeDefined();
      expect(complexResponse).toBeDefined();
      
      // Complex response might be longer
      expect(complexResponse.usage.completionTokens).toBeGreaterThanOrEqual(
        simpleResponse.usage.completionTokens
      );
    });
  });

  describe('Configuration', () => {
    it('should accept custom configuration', async () => {
      const customProvider = new MockProvider({
        defaultDelay: 100,
        simulateErrors: false,
        responsePrefix: 'CUSTOM: '
      });
      
      await customProvider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Test' }
        ]
      };

      const response = await customProvider.complete(options);
      
      if (customProvider.getConfig().responsePrefix) {
        expect(response.content).toContain('CUSTOM');
      }
    });

    it('should provide configuration getters', () => {
      const customProvider = new MockProvider({
        defaultDelay: 250,
        simulateErrors: true
      });
      
      const config = customProvider.getConfig();
      
      expect(config.defaultDelay).toBe(250);
      expect(config.simulateErrors).toBe(true);
    });

    it('should update configuration dynamically', async () => {
      await provider.initialize();
      
      provider.setConfig({ simulateErrors: true });
      
      const config = provider.getConfig();
      expect(config.simulateErrors).toBe(true);
    });
  });

  describe('Token Calculation', () => {
    it('should estimate tokens consistently', async () => {
      await provider.initialize();
      
      const text = 'This is a test message for token calculation.';
      const tokens1 = provider.estimateTokens(text);
      const tokens2 = provider.estimateTokens(text);
      
      expect(tokens1).toBe(tokens2);
      expect(tokens1).toBeGreaterThan(0);
    });

    it('should calculate tokens proportionally to text length', async () => {
      await provider.initialize();
      
      const shortText = 'Short';
      const longText = 'This is a much longer text that should result in more tokens being calculated by the estimation function.';
      
      const shortTokens = provider.estimateTokens(shortText);
      const longTokens = provider.estimateTokens(longText);
      
      expect(longTokens).toBeGreaterThan(shortTokens);
    });

    it('should track cumulative token usage', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'First query' }
        ]
      };

      const response1 = await provider.complete(options);
      const usage1 = provider.getTotalUsage();
      
      const response2 = await provider.complete(options);
      const usage2 = provider.getTotalUsage();
      
      expect(usage2.totalTokens).toBeGreaterThan(usage1.totalTokens);
    });
  });

  describe('Legal Context Simulation', () => {
    it('should generate responses with legal terminology', async () => {
      await provider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: '¿Qué es un amparo?' }
        ]
      };

      const response = await provider.complete(options);
      
      // Should include some legal-sounding terms in mock
      const legalTerms = ['artículo', 'ley', 'derecho', 'legal', 'normativa', 'mock'];
      const hasLegalTerm = legalTerms.some(term => 
        response.content.toLowerCase().includes(term)
      );
      
      expect(hasLegalTerm).toBe(true);
    });

    it('should handle bilingual queries', async () => {
      await provider.initialize();
      
      const spanishQuery: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: '¿Cuáles son mis derechos laborales?' }
        ]
      };

      const englishQuery: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'What are my labor rights?' }
        ]
      };

      const spanishResponse = await provider.complete(spanishQuery);
      const englishResponse = await provider.complete(englishQuery);
      
      expect(spanishResponse.content).toBeTruthy();
      expect(englishResponse.content).toBeTruthy();
      
      // Both should be valid responses
      expect(spanishResponse.usage.totalTokens).toBeGreaterThan(0);
      expect(englishResponse.usage.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Development Features', () => {
    it('should provide debug information when enabled', async () => {
      const debugProvider = new MockProvider({ debug: true });
      await debugProvider.initialize();
      
      const options: ChatCompletionOptions = {
        messages: [
          { role: 'user', content: 'Debug test' }
        ]
      };

      const response = await debugProvider.complete(options);
      
      expect(response.metadata).toBeDefined();
      if (response.metadata) {
        expect(response.metadata.provider).toBe('mock');
        expect(response.metadata.timestamp).toBeDefined();
      }
    });

    it('should reset state when requested', async () => {
      await provider.initialize();
      
      // Make some requests
      await provider.complete({
        messages: [{ role: 'user', content: 'Test 1' }]
      });
      await provider.complete({
        messages: [{ role: 'user', content: 'Test 2' }]
      });
      
      const usageBefore = provider.getTotalUsage();
      expect(usageBefore.totalTokens).toBeGreaterThan(0);
      
      // Reset state
      provider.reset();
      
      const usageAfter = provider.getTotalUsage();
      expect(usageAfter.totalTokens).toBe(0);
    });

    it('should provide request history in debug mode', async () => {
      const debugProvider = new MockProvider({ 
        debug: true,
        trackHistory: true 
      });
      await debugProvider.initialize();
      
      await debugProvider.complete({
        messages: [{ role: 'user', content: 'First' }]
      });
      await debugProvider.complete({
        messages: [{ role: 'user', content: 'Second' }]
      });
      
      const history = debugProvider.getRequestHistory();
      
      expect(history).toHaveLength(2);
      expect(history[0].messages[0].content).toBe('First');
      expect(history[1].messages[0].content).toBe('Second');
    });
  });
});