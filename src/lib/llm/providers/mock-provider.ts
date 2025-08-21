// Mock LLM Provider for Testing and Development
// This provider simulates LLM responses for testing purposes

import type { 
  ChatCompletionOptions, 
  ChatCompletionResponse,
  LLMProvider,
  TokenUsage 
} from '../types';

export interface MockProviderConfig {
  defaultDelay?: number;
  simulateErrors?: boolean;
  errorRate?: number;
  responsePrefix?: string;
  debug?: boolean;
  trackHistory?: boolean;
}

interface RequestHistoryEntry {
  messages: Array<{ role: string; content: string }>;
  timestamp: Date;
  response?: string;
}

export class MockProvider implements LLMProvider {
  private config: MockProviderConfig;
  private _initialized = false;
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };
  private requestHistory: RequestHistoryEntry[] = [];
  
  // Provider metadata
  public readonly id = 'mock';
  public readonly name = 'Mock Provider';
  public readonly type: 'local' | 'cloud' = 'local';
  public status: 'connected' | 'disconnected' | 'error' = 'disconnected';

  constructor(config: MockProviderConfig = {}) {
    this.config = {
      defaultDelay: 500,
      simulateErrors: false,
      errorRate: 0.1,
      responsePrefix: '',
      debug: false,
      trackHistory: false,
      ...config
    };
  }

  async initialize(): Promise<boolean> {
    // Simulate initialization delay
    await this.delay(100);
    
    // Don't simulate errors during initialization in test mode
    // Only simulate errors during complete() calls
    // This makes tests more predictable
    
    this._initialized = true;
    this.status = 'connected';
    return true;
  }

  async testConnection(): Promise<boolean> {
    // Mock provider always returns true for test connection
    // unless it's not initialized
    return this._initialized;
  }

  async isAvailable(): Promise<boolean> {
    // Check if provider is available and initialized
    return this._initialized && this.status === 'connected';
  }

  isInitialized(): boolean {
    return this._initialized;
  }

  getName(): string {
    return 'mock';
  }

  getModel(): string {
    return 'mock-model';
  }

  async complete(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    if (!this._initialized) {
      throw new Error('Provider not initialized');
    }

    // Simulate errors if configured (deterministic in test mode)
    if (this.config.simulateErrors) {
      // In test mode with 100% error rate, always throw
      if (this.config.errorRate === 1.0) {
        throw new Error('Mock provider request failed (simulated error)');
      }
      // Otherwise use random chance
      if (Math.random() < this.config.errorRate!) {
        throw new Error('Mock provider request failed (simulated error)');
      }
    }

    // Track history if enabled
    if (this.config.trackHistory) {
      this.requestHistory.push({
        messages: options.messages,
        timestamp: new Date()
      });
    }

    // Calculate delay based on message complexity
    const messageLength = options.messages.reduce((acc, msg) => acc + msg.content.length, 0);
    const delay = Math.min(this.config.defaultDelay! + (messageLength / 100) * 100, 2000);
    
    await this.delay(delay);

    // Generate mock response
    const responseContent = this.generateMockResponse(options);
    
    // Calculate token usage
    const promptTokens = this.estimateTokens(
      options.messages.map(m => m.content).join(' ')
    );
    const completionTokens = Math.min(
      this.estimateTokens(responseContent),
      options.maxTokens || 500
    );
    const totalTokens = promptTokens + completionTokens;

    // Update total usage
    this.totalUsage.promptTokens += promptTokens;
    this.totalUsage.completionTokens += completionTokens;
    this.totalUsage.totalTokens += totalTokens;

    // Handle streaming mode
    if (options.stream) {
      const chunks = this.splitIntoChunks(responseContent);
      const stream = this.createStream(chunks);
      
      return {
        content: '',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens
        },
        stream,
        metadata: this.config.debug ? {
          provider: 'mock',
          model: 'mock-model',
          timestamp: new Date().toISOString()
        } : undefined
      };
    }

    // Return regular response
    return {
      content: responseContent,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens
      },
      metadata: this.config.debug ? {
        provider: 'mock',
        model: 'mock-model',
        timestamp: new Date().toISOString()
      } : undefined
    };
  }

  estimateTokens(text: string): number {
    // Simple estimation: ~4 characters per token (rough approximation)
    return Math.ceil(text.length / 4);
  }

  getTotalUsage(): TokenUsage {
    return { ...this.totalUsage };
  }

  reset(): void {
    this.totalUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    };
    this.requestHistory = [];
  }

  setConfig(config: Partial<MockProviderConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MockProviderConfig {
    return { ...this.config };
  }

  getRequestHistory(): RequestHistoryEntry[] {
    return [...this.requestHistory];
  }

  // Additional methods for compatibility with provider-manager

  async generateResponse(request: any): Promise<any> {
    // Use the complete method for generating responses
    const response = await this.complete({
      messages: request.messages || [],
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stream: false
    });
    
    return {
      ...response,
      metadata: {
        ...response.metadata,
        provider: this.id,
        model: this.getModel()
      }
    };
  }

  async stream(request: any, onChunk?: (chunk: string) => void): Promise<any> {
    // Use the complete method with streaming enabled
    const response = await this.complete({
      messages: request.messages || [],
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stream: true
    });
    
    // If onChunk callback is provided and we have a stream
    if (onChunk && response.stream) {
      for await (const chunk of response.stream) {
        onChunk(chunk);
      }
    }
    
    return response;
  }

  getMetrics(): any {
    // Return basic metrics for the mock provider
    return {
      totalRequests: this.requestHistory.length,
      totalTokens: this.totalUsage.totalTokens,
      averageResponseTime: 500, // Mock average
      errorRate: this.config.simulateErrors ? this.config.errorRate : 0,
      status: this.status,
      lastUsed: this.requestHistory.length > 0 
        ? this.requestHistory[this.requestHistory.length - 1].timestamp 
        : null
    };
  }

  validateConfig(config: any): boolean {
    // Mock provider accepts any config for testing
    return true;
  }

  getModelInfo(modelId: string): any {
    return {
      id: modelId || 'mock-model',
      name: 'Mock Model',
      maxTokens: 4096,
      contextWindow: 8192,
      capabilities: ['chat', 'completion', 'embeddings'],
      costPer1kTokens: { input: 0.001, output: 0.002 }
    };
  }

  async listModels(): Promise<any[]> {
    return Promise.resolve([
      {
        id: 'mock-model-small',
        name: 'Mock Model Small',
        maxTokens: 2048,
        contextWindow: 4096,
        capabilities: ['chat', 'completion'],
        costPer1kTokens: { input: 0.0005, output: 0.001 }
      },
      {
        id: 'mock-model-large',
        name: 'Mock Model Large',
        maxTokens: 8192,
        contextWindow: 16384,
        capabilities: ['chat', 'completion', 'embeddings'],
        costPer1kTokens: { input: 0.002, output: 0.004 }
      }
    ]);
  }

  getEstimatedCost(tokens: number): number {
    // Simple cost calculation: $0.001 per 1000 tokens
    return (tokens / 1000) * 0.001;
  }

  // Private helper methods

  private async delay(ms: number): Promise<void> {
    // Check if we're in a test environment with fake timers
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') {
      // Return immediately in test environment - the test will control timing
      return Promise.resolve();
    }
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private generateMockResponse(options: ChatCompletionOptions): string {
    const lastMessage = options.messages[options.messages.length - 1];
    const query = lastMessage?.content || '';
    
    // Check for legal terms in Spanish or English
    const legalTermsES = ['artículo', 'ley', 'derecho', 'legal', 'normativa', 'constitución', 'amparo'];
    const legalTermsEN = ['article', 'law', 'right', 'legal', 'regulation', 'constitution'];
    
    const hasLegalContext = [...legalTermsES, ...legalTermsEN].some(term => 
      query.toLowerCase().includes(term)
    );

    let response = '';
    
    // Add prefix if configured
    if (this.config.responsePrefix) {
      response = this.config.responsePrefix;
    }

    // Generate contextual mock response
    if (hasLegalContext) {
      if (query.includes('artículo') || query.includes('article')) {
        response += 'Este es un mock response sobre el artículo mencionado. ';
      }
      response += 'En el contexto legal mexicano, este mock response simula una respuesta jurídica. ';
      response += 'Mock: De acuerdo con la normativa vigente, los principios aplicables establecen que ';
      response += 'esta es una respuesta de desarrollo/prueba. ';
    } else {
      response += 'This is a mock response for testing purposes. ';
      response += 'Mock provider is being used for development. ';
    }

    // Add disclaimer
    response += '\n\nNota: Esta es una respuesta mock generada para desarrollo y pruebas. ';
    response += 'No debe ser considerada como asesoramiento legal real.';

    // Respect maxTokens if specified
    if (options.maxTokens && options.maxTokens < 100) {
      const words = response.split(' ');
      const limitedWords = words.slice(0, Math.floor(options.maxTokens / 4));
      response = limitedWords.join(' ');
    }

    return response;
  }

  private splitIntoChunks(text: string): string[] {
    const words = text.split(' ');
    const chunks: string[] = [];
    const chunkSize = 5; // 5 words per chunk
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      chunks.push(chunk + (i + chunkSize < words.length ? ' ' : ''));
    }
    
    return chunks;
  }

  private async *createStream(chunks: string[]): AsyncIterableIterator<string> {
    for (const chunk of chunks) {
      await this.delay(50); // Simulate streaming delay
      yield chunk;
    }
  }
}

// Export default instance for convenience
export const mockProvider = new MockProvider();

// Export alias for backward compatibility
export { MockProvider as MockLLMProvider };