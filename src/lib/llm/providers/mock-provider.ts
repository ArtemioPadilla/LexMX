// Mock LLM Provider for Testing and Development
// This provider simulates LLM responses for testing purposes, and also
// doubles as the always-available fallback `LLMProvider` used by
// `ProviderManager`/`ProviderFactory` when no real provider is configured.

import type {
  CostLevel,
  LLMCapability,
  LLMModel,
  LLMProvider,
  LLMProviderType,
  LLMRequest,
  LLMResponse,
  ProviderConfig,
  ProviderMetrics,
  ProviderStatus,
  StreamCallback
} from '../../../types/llm';

// Legacy testing-oriented request/response shapes. These predate the shared
// `LLMRequest`/`LLMResponse` types and are kept local (rather than imported
// from a removed `../types` module) so the existing behavior tests keep
// exercising the same lightweight surface.
export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatCompletionMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ChatCompletionResponse {
  content: string;
  usage: TokenUsage;
  error?: string;
  stream?: AsyncIterableIterator<string>;
  metadata?: {
    provider: string;
    model: string;
    timestamp: string;
  };
}

export interface MockProviderConfig {
  defaultDelay?: number;
  simulateErrors?: boolean;
  errorRate?: number;
  responsePrefix?: string;
  debug?: boolean;
  trackHistory?: boolean;
}

// Accepted by the constructor so the mock can be created either as a plain
// testing double (`new MockProvider({ simulateErrors: true })`) or through
// `ProviderFactory.createProvider(config)` with a real `ProviderConfig`.
export type MockProviderOptions = Partial<ProviderConfig> & MockProviderConfig;

interface RequestHistoryEntry {
  messages: ChatCompletionMessage[];
  timestamp: Date;
  response?: string;
}

const MOCK_MODEL: LLMModel = {
  id: 'mock-model',
  name: 'Mock Model',
  description: 'Simulated model used for development, tests, and the demo fallback.',
  contextLength: 8192,
  maxTokens: 4096,
  capabilities: ['privacy', 'offline'],
  costPer1kTokens: { input: 0, output: 0 }
};

export class MockProvider implements LLMProvider {
  private behaviorConfig: MockProviderConfig;
  private _initialized = false;
  private totalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  };
  private requestHistory: RequestHistoryEntry[] = [];

  // LLMProvider metadata
  public readonly id: string;
  public readonly name: string;
  public readonly type: LLMProviderType;
  public readonly icon = '🎭';
  public readonly description = 'Respuestas simuladas para demostrar LexMX cuando no hay proveedores configurados';
  public readonly costLevel: CostLevel = 'free';
  public readonly capabilities: LLMCapability[] = ['privacy', 'offline'];
  public readonly models: LLMModel[] = [MOCK_MODEL];
  public status: ProviderStatus = 'disconnected';

  constructor(config: MockProviderOptions = {}) {
    this.id = config.id ?? 'mock';
    this.name = config.name ?? 'Mock Provider';
    this.type = config.type ?? 'local';

    this.behaviorConfig = {
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

    // Don't simulate errors during initialization in test mode.
    // Errors only occur during complete()/generateResponse() calls, which
    // keeps tests deterministic.
    this._initialized = true;
    this.status = 'connected';
    return true;
  }

  async testConnection(): Promise<boolean> {
    return this._initialized;
  }

  async isAvailable(): Promise<boolean> {
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
    if (this.behaviorConfig.simulateErrors) {
      const errorRate = this.behaviorConfig.errorRate ?? 0.1;
      // In test mode with 100% error rate, always throw
      if (errorRate === 1.0 || Math.random() < errorRate) {
        throw new Error('Mock provider request failed (simulated error)');
      }
    }

    // Track history if enabled
    if (this.behaviorConfig.trackHistory) {
      this.requestHistory.push({
        messages: options.messages,
        timestamp: new Date()
      });
    }

    // Calculate delay based on message complexity
    const messageLength = options.messages.reduce((acc, msg) => acc + msg.content.length, 0);
    const defaultDelay = this.behaviorConfig.defaultDelay ?? 500;
    const delay = Math.min(defaultDelay + (messageLength / 100) * 100, 2000);

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

    const metadata = this.behaviorConfig.debug
      ? { provider: 'mock', model: 'mock-model', timestamp: new Date().toISOString() }
      : undefined;

    // Handle streaming mode
    if (options.stream) {
      const chunks = this.splitIntoChunks(responseContent);
      const stream = this.createStream(chunks);

      return {
        content: '',
        usage: { promptTokens, completionTokens, totalTokens },
        stream,
        metadata
      };
    }

    // Return regular response
    return {
      content: responseContent,
      usage: { promptTokens, completionTokens, totalTokens },
      metadata
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
    this.behaviorConfig = { ...this.behaviorConfig, ...config };
  }

  getConfig(): MockProviderConfig {
    return { ...this.behaviorConfig };
  }

  getRequestHistory(): RequestHistoryEntry[] {
    return [...this.requestHistory];
  }

  // --- LLMProvider surface (used by ProviderFactory/ProviderManager) ---

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    const completion = await this.complete({
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stream: false
    });

    const latency = Date.now() - startTime;

    return {
      content: completion.content,
      model: request.model || this.getModel(),
      provider: this.id,
      usage: completion.usage,
      cost: 0,
      latency,
      processingTime: latency,
      metadata: { cached: false, fallback: this.id === 'mock' }
    };
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const startTime = Date.now();
    const completion = await this.complete({
      messages: request.messages.map(m => ({ role: m.role, content: m.content })),
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stream: true
    });

    let fullContent = '';
    if (completion.stream) {
      for await (const chunk of completion.stream) {
        fullContent += chunk;
        onChunk(chunk);
      }
    }

    const latency = Date.now() - startTime;

    return {
      content: fullContent,
      model: request.model || this.getModel(),
      provider: this.id,
      usage: completion.usage,
      cost: 0,
      latency,
      processingTime: latency,
      metadata: { cached: false, fallback: this.id === 'mock' }
    };
  }

  estimateCost(_request: LLMRequest): number {
    return 0;
  }

  getMetrics(): ProviderMetrics {
    const lastEntry = this.requestHistory[this.requestHistory.length - 1];
    return {
      providerId: this.id,
      totalRequests: this.requestHistory.length,
      successRate: this.behaviorConfig.simulateErrors ? 1 - (this.behaviorConfig.errorRate ?? 0) : 1,
      averageLatency: this.behaviorConfig.defaultDelay ?? 500,
      totalCost: 0,
      lastUsed: lastEntry ? lastEntry.timestamp.getTime() : 0
    };
  }

  // --- Private helpers ---

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
    if (this.behaviorConfig.responsePrefix) {
      response = this.behaviorConfig.responsePrefix;
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

// Export alias for backward compatibility
export { MockProvider as MockLLMProvider };
