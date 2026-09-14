// Alternative WebLLM provider implementation with better error handling

// GPU type declarations for WebGPU support
declare global {
  interface Navigator {
    gpu?: GPU;
  }
  
  interface GPU {
    requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null>;
  }
  
  interface GPUAdapter {
    readonly features: GPUSupportedFeatures;
    readonly limits: GPUSupportedLimits;
    readonly info: GPUAdapterInfo;
  }
  
  interface GPURequestAdapterOptions {
    powerPreference?: 'low-power' | 'high-performance';
    forceFallbackAdapter?: boolean;
  }
  
  type GPUSupportedFeatures = ReadonlySet<string>;
  type GPUSupportedLimits = Record<string, unknown>;
  type GPUAdapterInfo = Record<string, unknown>;
}

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
import type { LegalArea } from '../../../types/legal';
import { promptBuilder } from '../prompt-builder';
import { i18n } from '@/i18n';
// Type-only import: erased at compile time, so this does NOT create a static
// runtime dependency on `@mlc-ai/web-llm`. The engine itself is only ever
// loaded via the dynamic `import()` inside `_initialize()`.
import type { MLCEngine, InitProgressReport } from '@mlc-ai/web-llm';

type WebLLMModule = typeof import('@mlc-ai/web-llm');

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
  
  private engine: MLCEngine | null = null;
  private config: WebLLMConfig;
  private webllmModule: WebLLMModule | null = null;
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

  private async ensureInitialized(): Promise<MLCEngine> {
    if (!this.engine && !this.isInitializing) {
      await this.initialize();
    } else if (this.isInitializing && this.initPromise) {
      await this.initPromise;
    }

    const engine = this.engine;
    if (!engine) {
      throw new Error('WebLLM engine failed to initialize');
    }
    return engine;
  }

  private async _initialize(): Promise<void> {
    try {
      // Check WebGPU support
      if (!navigator.gpu) {
        throw new Error('WebGPU is not supported in this browser. Please use a compatible browser like Chrome or Edge.');
      }

      // Dynamically import WebLLM to ensure it's loaded in browser context
      this.webllmModule = await import('@mlc-ai/web-llm');

      const modelId = this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC';

      // Use the default configuration approach
      this.engine = await this.webllmModule.CreateMLCEngine(modelId, {
        initProgressCallback: (progress: InitProgressReport) => {
          const percentage = Math.round(progress.progress * 100);
          const message = `${progress.text} (${percentage}%)`;
          this.config.initProgressCallback?.(percentage, message);
        }
      });
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
      throw error;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();

    const engine = await this.ensureInitialized();

    try {
      const webllmMessages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      const response = await engine.chat.completions.create({
        messages: webllmMessages,
        temperature: request.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2048,
        top_p: request.topP ?? 0.9,
        stream: false
      });

      const content = response.choices[0]?.message?.content || '';
      
      const promptTokens = Math.ceil(request.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4);
      const completionTokens = Math.ceil(content.length / 4);

      const model = this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
      const processingTime = Date.now() - startTime;
      
      return {
        content,
        model: model,
        provider: this.id,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens
        },
        cost: 0,
        latency: processingTime,
        metadata: {
          cached: false
        }
      };
    } catch (error) {
      console.error('WebLLM complete error:', error);
      throw error;
    }
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const startTime = Date.now();

    const engine = await this.ensureInitialized();

    try {
      const webllmMessages = request.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      if (onChunk) {
        let fullContent = '';

        const response = await engine.chat.completions.create({
          messages: webllmMessages,
          temperature: request.temperature ?? this.config.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2048,
          top_p: request.topP ?? 0.9,
          stream: true
        });

        for await (const chunk of response) {
          // Check if request was aborted
          if (request.abortSignal?.aborted) {
            throw new Error('Request aborted');
          }
          
          const delta = chunk.choices[0]?.delta?.content || '';
          fullContent += delta;
          
          if (delta) {
            onChunk(delta);
          }
        }

        const promptTokens = Math.ceil(request.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4);
        const completionTokens = Math.ceil(fullContent.length / 4);

        const model = this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
        const processingTime = Date.now() - startTime;
        
        return {
          content: fullContent,
          model: model,
          provider: this.id,
          usage: {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens
          },
          cost: 0,
          latency: processingTime,
          processingTime: processingTime,
          metadata: {
            cached: false
          }
        };
      }
      
      // Return empty response if no streaming callback
      return {
        content: '',
        model: this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        provider: this.id,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        cost: 0,
        latency: 0,
        processingTime: 0,
        metadata: { cached: false }
      };
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
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens
        },
        cost: 0,
        latency: response.latency,
        processingTime: response.latency,
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

  estimateCost(_request: LLMRequest): number {
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

  getCost(_promptTokens: number, _completionTokens: number, _model: string): number {
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

  // Get legal system prompt using the centralized prompt builder
  getLegalSystemPrompt(legalArea?: LegalArea): string {
    return promptBuilder.buildSystemPrompt({
      language: i18n.language,
      legalArea: legalArea,
      provider: 'webllm',
      includeSpecialization: true
    });
  }
}