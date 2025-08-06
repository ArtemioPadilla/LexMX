// Alternative WebLLM provider implementation with better error handling
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

export interface WebLLMConfig extends ProviderConfig {
  modelId?: string;
  initProgressCallback?: (progress: number, message: string) => void;
}

export class WebLLMProvider implements LLMProvider {
  readonly id: string = 'webllm';
  readonly name: string = 'WebLLM (Browser)';
  readonly type: LLMProviderType = 'local';
  readonly icon: string = '🖥️';
  readonly description: string = 'Run AI models directly in your browser - 100% private, no API costs, works offline';
  readonly costLevel: CostLevel = 'free';
  readonly capabilities: LLMCapability[] = ['privacy', 'offline', 'reasoning', 'analysis'];
  
  models: LLMModel[] = [
    {
      id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      name: 'Llama 3.2 1B',
      description: 'Smallest and fastest model',
      contextLength: 4096,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis'],
      recommended: false
    },
    {
      id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
      name: 'Llama 3.2 3B',
      description: 'Good balance of quality and size',
      contextLength: 8192,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis'],
      recommended: true
    },
    {
      id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
      name: 'Phi 3.5 Mini',
      description: 'Microsoft Phi model - efficient and capable',
      contextLength: 4096,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis'],
      recommended: false
    }
  ];
  
  status: ProviderStatus = 'disconnected';
  
  private engine: any = null;
  private config: WebLLMConfig;
  private webllmModule: any = null;
  private isInitializing = false;
  private initPromise: Promise<void> | null = null;
  private metrics: ProviderMetrics = {
    providerId: 'webllm',
    totalRequests: 0,
    successRate: 1.0,
    averageLatency: 0,
    totalCost: 0,
    lastUsed: Date.now()
  };

  constructor(config: WebLLMConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    if (this.engine) return;
    
    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = this._initialize();
    
    try {
      await this.initPromise;
    } finally {
      this.isInitializing = false;
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.engine && !this.isInitializing) {
      await this.initialize();
    } else if (this.isInitializing && this.initPromise) {
      await this.initPromise;
    }
    
    if (!this.engine) {
      throw new Error('WebLLM engine failed to initialize');
    }
  }

  private async _initialize(): Promise<void> {
    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error('WebGPU is not supported in this browser. Please use a compatible browser like Chrome or Edge.');
      }

      // Dynamically import WebLLM to ensure it's loaded in browser context
      console.log('[WebLLM] Loading WebLLM module...');
      this.webllmModule = await import('@mlc-ai/web-llm');
      
      console.log('[WebLLM] Module loaded:', Object.keys(this.webllmModule));

      const modelId = this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
      
      console.log(`[WebLLM] Creating engine with model: ${modelId}`);
      
      // Use the default configuration approach
      this.engine = await this.webllmModule.CreateMLCEngine(modelId, {
        initProgressCallback: (progress: any) => {
          const percentage = Math.round(progress.progress * 100);
          const message = `${progress.text} (${percentage}%)`;
          console.log(`[WebLLM] Progress: ${message}`);
          this.config.initProgressCallback?.(percentage, message);
        }
      });
      
      console.log('[WebLLM] Engine created successfully');
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
      throw error;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    await this.ensureInitialized();

    try {
      const webllmMessages = request.messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }));

      const response = await this.engine.chat.completions.create({
        messages: webllmMessages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2048,
        top_p: request.topP ?? 0.9,
        stream: false
      });

      const content = response.choices[0]?.message?.content || '';
      
      const promptTokens = Math.ceil(request.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4);
      const completionTokens = Math.ceil(content.length / 4);

      return {
        content,
        role: 'assistant',
        model: this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: response.choices[0]?.finish_reason || 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('WebLLM complete error:', error);
      throw error;
    }
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const startTime = Date.now();
    
    await this.ensureInitialized();

    try {
      const webllmMessages = request.messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }));

      if (onChunk) {
        let fullContent = '';

        const response = await this.engine.chat.completions.create({
          messages: webllmMessages,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2048,
          top_p: request.topP ?? 0.9,
          stream: true
        });

        for await (const chunk of response) {
          const delta = chunk.choices[0]?.delta?.content || '';
          fullContent += delta;
          
          if (delta) {
            onChunk(delta);
          }
        }

        const promptTokens = Math.ceil(request.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4);
        const completionTokens = Math.ceil(fullContent.length / 4);

        return {
          content: fullContent,
          role: 'assistant',
          model: this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          finishReason: 'stop',
          processingTime: Date.now() - startTime
        };
      }
    } catch (error) {
      console.error('WebLLM stream error:', error);
      throw error;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!navigator.gpu) {
      return false;
    }
    
    if (this.engine) {
      return true;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        this.status = 'error';
        return false;
      }
      
      this.status = 'connected';
      return true;
    } catch (error) {
      console.error('WebLLM connection test failed:', error);
      this.status = 'error';
      return false;
    }
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    let success = false;
    
    try {
      const response = await this.complete(request);
      
      const llmResponse: LLMResponse = {
        content: response.content,
        model: this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        provider: this.id,
        usage: {
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens
        },
        cost: 0,
        latency: response.processingTime,
        metadata: {
          cached: false
        }
      };
      
      success = true;
      return llmResponse;
    } finally {
      this.metrics.totalRequests++;
      this.metrics.lastUsed = Date.now();
      
      const latency = Date.now() - startTime;
      this.metrics.averageLatency = 
        (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency) / 
        this.metrics.totalRequests;
      
      if (success) {
        this.metrics.successRate = 
          (this.metrics.successRate * (this.metrics.totalRequests - 1) + 1) / 
          this.metrics.totalRequests;
      } else {
        this.metrics.successRate = 
          (this.metrics.successRate * (this.metrics.totalRequests - 1)) / 
          this.metrics.totalRequests;
      }
    }
  }

  estimateCost(request: LLMRequest): number {
    return 0;
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  getConfig(): WebLLMConfig {
    return this.config;
  }

  updateConfig(config: Partial<WebLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getCost(promptTokens: number, completionTokens: number, model: string): number {
    return 0;
  }

  getModelDisplayName(modelId: string): string {
    const model = this.models.find(m => m.id === modelId);
    return model?.name || modelId;
  }

  getModelContextWindow(modelId: string): number {
    const model = this.models.find(m => m.id === modelId);
    return model?.contextLength || 4096;
  }
}