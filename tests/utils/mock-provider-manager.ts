import { Page } from '@playwright/test';
import type { 
  LLMProvider, 
  CloudProvider, 
  LocalProvider,
  LLMProviderType,
  ModelCapability,
  ProviderStatus,
  ProviderConfig
} from '../../src/types/llm';

/**
 * Mock implementation of LLMProvider for testing
 */
class MockLLMProvider implements LLMProvider {
  id: string;
  name: string;
  description: string;
  type: LLMProviderType;
  models: any[];
  status: ProviderStatus = 'connected';
  isAvailable = true;
  capabilities: ModelCapability[] = ['chat', 'embeddings'];
  defaultModel = 'mock-model';
  apiKeyRequired = false;
  
  constructor(id: string, name: string, type: LLMProviderType = 'cloud') {
    this.id = id;
    this.name = name;
    this.description = `Mock ${name} provider for testing`;
    this.type = type;
    this.models = [
      {
        id: `${id}-mock-model`,
        name: `${name} Mock Model`,
        maxTokens: 4096,
        contextWindow: 8192,
        capabilities: ['chat', 'embeddings'],
        costPer1kTokens: { input: 0.001, output: 0.002 }
      }
    ];
  }

  async initialize(config?: ProviderConfig): Promise<void> {
    return Promise.resolve();
  }

  async testConnection(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async chat(messages: any[], options?: any): Promise<any> {
    return Promise.resolve({
      content: `Mock response from ${this.name}`,
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 }
    });
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(() => Array(768).fill(0.1)));
  }

  async streamChat(messages: any[], options?: any): Promise<ReadableStream> {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`Mock streaming response from ${this.name}`));
        controller.close();
      }
    });
  }

  getEstimatedCost(tokens: number): number {
    return tokens * 0.001;
  }

  validateConfig(config: ProviderConfig): boolean {
    return true;
  }

  getModelInfo(modelId: string): any {
    return this.models[0];
  }

  async listModels(): Promise<any[]> {
    return Promise.resolve(this.models);
  }
}

/**
 * Mock provider manager for e2e tests
 */
export class MockProviderManager {
  private providers: Map<string, MockLLMProvider> = new Map();
  
  constructor() {
    // Initialize all provider types
    this.initializeProviders();
  }
  
  private initializeProviders() {
    // Cloud providers
    this.providers.set('openai', new MockLLMProvider('openai', 'OpenAI', 'cloud'));
    this.providers.set('anthropic', new MockLLMProvider('anthropic', 'Anthropic Claude', 'cloud'));
    this.providers.set('gemini', new MockLLMProvider('gemini', 'Google Gemini', 'cloud'));
    this.providers.set('azure', new MockLLMProvider('azure', 'Azure OpenAI', 'cloud'));
    this.providers.set('bedrock', new MockLLMProvider('bedrock', 'AWS Bedrock', 'cloud'));
    this.providers.set('vertex', new MockLLMProvider('vertex', 'Google Vertex AI', 'cloud'));
    
    // Local providers
    this.providers.set('webllm', new MockLLMProvider('webllm', 'WebLLM', 'local'));
    this.providers.set('ollama', new MockLLMProvider('ollama', 'Ollama', 'local'));
  }
  
  getProvider(id: string): MockLLMProvider | undefined {
    return this.providers.get(id);
  }
  
  getAllProviders(): MockLLMProvider[] {
    return Array.from(this.providers.values());
  }
  
  getCloudProviders(): MockLLMProvider[] {
    return this.getAllProviders().filter(p => p.type === 'cloud');
  }
  
  getLocalProviders(): MockLLMProvider[] {
    return this.getAllProviders().filter(p => p.type === 'local');
  }
  
  /**
   * Setup mock providers in the browser context
   */
  async setupInBrowser(page: Page): Promise<void> {
    await page.evaluate((providersData) => {
      // Create mock provider registry
      (window as any).__mockProviders = new Map(providersData);
      
      // Override provider initialization
      (window as any).__originalProviderInit = (window as any).initializeProvider;
      (window as any).initializeProvider = async (providerId: string, config?: any) => {
        const mockProvider = (window as any).__mockProviders.get(providerId);
        if (mockProvider) {
          console.log(`[MockProviderManager] Initializing mock provider: ${providerId}`);
          return mockProvider;
        }
        // Fall back to original if not mocked
        if ((window as any).__originalProviderInit) {
          return (window as any).__originalProviderInit(providerId, config);
        }
        throw new Error(`Provider ${providerId} not found`);
      };
      
      // Mock provider status checks
      (window as any).checkProviderStatus = async (providerId: string) => {
        const mockProvider = (window as any).__mockProviders.get(providerId);
        return mockProvider ? mockProvider.status : 'disconnected';
      };
      
      // Mock provider configuration validation
      (window as any).validateProviderConfig = (providerId: string, config: any) => {
        const mockProvider = (window as any).__mockProviders.get(providerId);
        return mockProvider ? true : false;
      };
      
    }, Array.from(this.providers.entries()).map(([id, provider]) => [
      id,
      {
        id: provider.id,
        name: provider.name,
        description: provider.description,
        type: provider.type,
        models: provider.models,
        status: provider.status,
        isAvailable: provider.isAvailable,
        capabilities: provider.capabilities,
        defaultModel: provider.defaultModel,
        apiKeyRequired: provider.apiKeyRequired
      }
    ]));
  }
  
  /**
   * Mock a specific provider's response
   */
  async mockProviderResponse(page: Page, providerId: string, response: string): Promise<void> {
    await page.evaluate(({ providerId, response }) => {
      const mockProvider = (window as any).__mockProviders?.get(providerId);
      if (mockProvider) {
        mockProvider.mockResponse = response;
      }
    }, { providerId, response });
  }
  
  /**
   * Set provider status
   */
  async setProviderStatus(page: Page, providerId: string, status: ProviderStatus): Promise<void> {
    await page.evaluate(({ providerId, status }) => {
      const mockProvider = (window as any).__mockProviders?.get(providerId);
      if (mockProvider) {
        mockProvider.status = status;
      }
    }, { providerId, status });
  }
  
  /**
   * Set provider availability
   */
  async setProviderAvailability(page: Page, providerId: string, isAvailable: boolean): Promise<void> {
    await page.evaluate(({ providerId, isAvailable }) => {
      const mockProvider = (window as any).__mockProviders?.get(providerId);
      if (mockProvider) {
        mockProvider.isAvailable = isAvailable;
      }
    }, { providerId, isAvailable });
  }
  
  /**
   * Clear all mock providers
   */
  async clearMocks(page: Page): Promise<void> {
    await page.evaluate(() => {
      (window as any).__mockProviders?.clear();
      if ((window as any).__originalProviderInit) {
        (window as any).initializeProvider = (window as any).__originalProviderInit;
        delete (window as any).__originalProviderInit;
      }
    });
  }
}

/**
 * Helper function to setup mock provider manager for tests
 */
export async function setupMockProviders(page: Page): Promise<MockProviderManager> {
  const manager = new MockProviderManager();
  await manager.setupInBrowser(page);
  return manager;
}

/**
 * Helper to mock specific provider scenarios
 */
export class ProviderScenarios {
  constructor(private manager: MockProviderManager) {}
  
  /**
   * Setup a scenario where all cloud providers require API keys
   */
  async allCloudProvidersNeedKeys(page: Page): Promise<void> {
    for (const provider of this.manager.getCloudProviders()) {
      await page.evaluate((providerId) => {
        const mockProvider = (window as any).__mockProviders?.get(providerId);
        if (mockProvider) {
          mockProvider.apiKeyRequired = true;
          mockProvider.status = 'disconnected';
        }
      }, provider.id);
    }
  }
  
  /**
   * Setup a scenario where only WebLLM is available
   */
  async onlyWebLLMAvailable(page: Page): Promise<void> {
    for (const provider of this.manager.getAllProviders()) {
      if (provider.id === 'webllm') {
        await this.manager.setProviderStatus(page, provider.id, 'connected');
        await this.manager.setProviderAvailability(page, provider.id, true);
      } else {
        await this.manager.setProviderStatus(page, provider.id, 'disconnected');
        await this.manager.setProviderAvailability(page, provider.id, false);
      }
    }
  }
  
  /**
   * Setup a scenario with mixed provider availability
   */
  async mixedAvailability(page: Page): Promise<void> {
    // Some providers connected, some not
    await this.manager.setProviderStatus(page, 'openai', 'connected');
    await this.manager.setProviderStatus(page, 'anthropic', 'connected');
    await this.manager.setProviderStatus(page, 'gemini', 'error');
    await this.manager.setProviderStatus(page, 'webllm', 'connected');
    await this.manager.setProviderStatus(page, 'ollama', 'disconnected');
  }
  
  /**
   * Setup provider with rate limiting
   */
  async providerWithRateLimit(page: Page, providerId: string): Promise<void> {
    await page.evaluate((providerId) => {
      const mockProvider = (window as any).__mockProviders?.get(providerId);
      if (mockProvider) {
        mockProvider.rateLimited = true;
        mockProvider.rateLimitReset = Date.now() + 60000; // 1 minute
      }
    }, providerId);
  }
}