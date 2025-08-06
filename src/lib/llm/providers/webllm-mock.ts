// Mock WebLLM provider for testing
import type { 
  LLMProvider,
  LLMRequest,
  LLMResponse, 
  ProviderConfig,
  StreamCallback,
  LLMModel,
  ProviderStatus,
  LLMCapability,
  CostLevel,
  LLMProviderType,
  ProviderMetrics
} from '../../../types/llm';

export class MockMLCEngine {
  chat = {
    completions: {
      create: async (params: any) => {
        if (params.stream) {
          // Return async generator for streaming
          return (async function* () {
            const response = "Esta es una respuesta simulada de WebLLM para pruebas.";
            const chunks = response.split(' ');
            for (const chunk of chunks) {
              yield {
                choices: [{
                  delta: { content: chunk + ' ' }
                }]
              };
            }
          })();
        } else {
          return {
            choices: [{
              message: {
                content: "Esta es una respuesta simulada de WebLLM para pruebas."
              },
              finish_reason: 'stop'
            }]
          };
        }
      }
    }
  };
}

export const CreateMLCEngine = async (modelId: string, config?: any): Promise<MockMLCEngine> => {
  // Simulate initialization delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Call progress callback if provided
  if (config?.initProgressCallback) {
    config.initProgressCallback({ progress: 0.5, text: 'Mock: Loading model' });
    await new Promise(resolve => setTimeout(resolve, 50));
    config.initProgressCallback({ progress: 1.0, text: 'Mock: Model ready' });
  }
  
  return new MockMLCEngine();
};

// Mock WebLLMProvider that extends the real one
export class MockWebLLMProvider implements LLMProvider {
  readonly id: string = 'webllm';
  readonly name: string = 'WebLLM (Browser)';
  readonly type: LLMProviderType = 'local';
  readonly icon: string = '🖥️';
  readonly description: string = 'Mock WebLLM for testing';
  readonly costLevel: CostLevel = 'free';
  readonly capabilities: LLMCapability[] = ['privacy', 'offline', 'reasoning', 'analysis'];
  
  models: LLMModel[] = [
    {
      id: 'mock-model',
      name: 'Mock Model',
      description: 'Mock model for testing',
      contextLength: 8192,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis'],
      recommended: true
    }
  ];
  
  status: ProviderStatus = 'disconnected';
  
  private config: ProviderConfig;
  private metrics: ProviderMetrics = {
    providerId: 'webllm',
    totalRequests: 0,
    successRate: 1.0,
    averageLatency: 0,
    totalCost: 0,
    lastUsed: Date.now()
  };

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Mock initialization
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async isAvailable(): Promise<boolean> {
    // Always available in tests
    return true;
  }

  async testConnection(): Promise<boolean> {
    this.status = 'connected';
    return true;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return {
      content: "Mock response for: " + request.messages[request.messages.length - 1].content,
      role: 'assistant',
      model: 'mock-model',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      finishReason: 'stop',
      processingTime: 100
    };
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const response = "Mock streaming response for testing.";
    const chunks = response.split(' ');
    
    let fullContent = '';
    for (const chunk of chunks) {
      await new Promise(resolve => setTimeout(resolve, 50));
      fullContent += chunk + ' ';
      onChunk(chunk + ' ');
    }
    
    return {
      content: fullContent.trim(),
      role: 'assistant',
      model: 'mock-model',
      promptTokens: 10,
      completionTokens: 20,
      totalTokens: 30,
      finishReason: 'stop',
      processingTime: chunks.length * 50
    };
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.complete(request);
    return {
      content: response.content,
      model: response.model,
      provider: this.id,
      usage: {
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens
      },
      cost: 0,
      latency: response.processingTime,
      metadata: { cached: false }
    };
  }

  estimateCost(request: LLMRequest): number {
    return 0;
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  getConfig(): ProviderConfig {
    return this.config;
  }

  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getCost(promptTokens: number, completionTokens: number, model: string): number {
    return 0;
  }
}