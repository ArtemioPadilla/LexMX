import * as webllm from '@mlc-ai/web-llm';
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
  // LLMProvider interface properties
  readonly id: string = 'webllm';
  readonly name: string = 'WebLLM (Browser)';
  readonly type: LLMProviderType = 'local';
  readonly icon: string = '🖥️';
  readonly description: string = 'Run AI models directly in your browser - 100% private, no API costs, works offline';
  readonly costLevel: CostLevel = 'free';
  readonly capabilities: LLMCapability[] = ['privacy', 'offline', 'reasoning', 'analysis'];
  
  models: LLMModel[] = [
    {
      id: 'Llama-3.2-3B-Instruct-q4f16_1',
      name: 'Llama 3.2 3B',
      description: 'Recommended: Good balance of quality and speed',
      contextLength: 8192,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis', 'multilingual'],
      recommended: true
    },
    {
      id: 'Phi-3.5-mini-instruct-q4f16_1',
      name: 'Phi 3.5 Mini',
      description: 'Faster: Smaller model, quicker responses',
      contextLength: 4096,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis']
    },
    {
      id: 'Llama-3.1-8B-Instruct-q4f32_1',
      name: 'Llama 3.1 8B',
      description: 'Advanced: Best quality, requires more resources',
      contextLength: 8192,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis', 'multilingual']
    },
    {
      id: 'Mistral-7B-Instruct-v0.3-q4f16_1',
      name: 'Mistral 7B',
      description: 'Alternative: Good for longer contexts',
      contextLength: 32768,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis', 'multilingual']
    },
    {
      id: 'Qwen2.5-7B-Instruct-q4f16_1',
      name: 'Qwen 2.5 7B',
      description: 'Multilingual: Strong support for multiple languages',
      contextLength: 32768,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis', 'multilingual']
    },
    {
      id: 'gemma-2-2b-it-q4f32_1',
      name: 'Gemma 2 2B',
      description: 'Lightweight: Smallest model, fastest loading',
      contextLength: 8192,
      maxTokens: 2048,
      capabilities: ['reasoning', 'analysis']
    }
  ];
  
  status: ProviderStatus = 'disconnected';
  
  // Private implementation properties
  private engine: webllm.MLCEngine | null = null;
  private config: WebLLMConfig;
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
    
    // Prevent multiple initialization attempts
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

      // Check if WebLLM is loaded
      console.log('[WebLLM] Checking WebLLM availability:', { webllm, CreateMLCEngine: webllm.CreateMLCEngine });
      
      // Get available models to verify WebLLM is working
      try {
        const models = webllm.prebuiltAppConfig?.model_list || [];
        console.log('[WebLLM] Available models:', models.map((m: any) => m.model_id));
      } catch (e) {
        console.warn('[WebLLM] Could not get model list:', e);
      }

      const modelId = this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1';
      
      // Add retry logic for model loading
      let retries = 3;
      let lastError: any;
      
      while (retries > 0) {
        try {
          // Try to create engine with the model
          console.log(`[WebLLM] Attempting to create engine with model: ${modelId}`);
          
          this.engine = await webllm.CreateMLCEngine(
            modelId,
            {
              initProgressCallback: (progress) => {
                const percentage = Math.round(progress.progress * 100);
                const message = `${progress.text} (${percentage}%)`;
                this.config.initProgressCallback?.(percentage, message);
              },
              // Simplified config without extra options that might cause issues
              logLevel: 'INFO'
            }
          );
          
          console.log('[WebLLM] Engine created successfully');
          break; // Success, exit retry loop
        } catch (error: any) {
          lastError = error;
          retries--;
          
          if (retries > 0) {
            console.warn(`WebLLM initialization attempt failed, retrying... (${retries} attempts left)`, error);
            // Wait before retry with exponential backoff
            await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
          }
        }
      }
      
      if (!this.engine) {
        throw lastError || new Error('Failed to initialize WebLLM after multiple attempts');
      }
    } catch (error) {
      console.error('Failed to initialize WebLLM:', error);
      throw error;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    // Ensure engine is initialized before use
    await this.ensureInitialized();

    try {
      // Convert messages to WebLLM format
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
      
      // Calculate approximate token usage
      const promptTokens = Math.ceil(request.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4);
      const completionTokens = Math.ceil(content.length / 4);

      return {
        content,
        role: 'assistant',
        model: this.config.modelId || 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
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
    
    // Ensure engine is initialized before use
    await this.ensureInitialized();

    try {
      // Convert messages to WebLLM format
      const webllmMessages = request.messages.map(msg => ({
        role: msg.role as 'system' | 'user' | 'assistant',
        content: msg.content
      }));

      if (onChunk) {
        // Streaming response
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

        // Calculate approximate token usage
        const promptTokens = Math.ceil(request.messages.reduce((sum, msg) => sum + msg.content.length, 0) / 4);
        const completionTokens = Math.ceil(fullContent.length / 4);

        return {
          content: fullContent,
          role: 'assistant',
          model: this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1',
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

  getModelDisplayName(modelId: string): string {
    const modelNames: Record<string, string> = {
      'Llama-3.1-8B-Instruct-q4f32_1': 'Llama 3.1 8B',
      'Llama-3.2-3B-Instruct-q4f16_1': 'Llama 3.2 3B',
      'Phi-3.5-mini-instruct-q4f16_1': 'Phi 3.5 Mini',
      'gemma-2-2b-it-q4f32_1': 'Gemma 2 2B',
      'Mistral-7B-Instruct-v0.3-q4f16_1': 'Mistral 7B',
      'Qwen2.5-7B-Instruct-q4f16_1': 'Qwen 2.5 7B'
    };
    return modelNames[modelId] || modelId;
  }

  getModelContextWindow(modelId: string): number {
    const contextWindows: Record<string, number> = {
      'Llama-3.1-8B-Instruct-q4f32_1': 8192,
      'Llama-3.2-3B-Instruct-q4f16_1': 8192,
      'Phi-3.5-mini-instruct-q4f16_1': 4096,
      'gemma-2-2b-it-q4f32_1': 8192,
      'Mistral-7B-Instruct-v0.3-q4f16_1': 32768,
      'Qwen2.5-7B-Instruct-q4f16_1': 32768
    };
    return contextWindows[modelId] || 4096;
  }

  // LLMProvider interface methods
  async isAvailable(): Promise<boolean> {
    // Check if WebGPU is supported
    if (!navigator.gpu) {
      return false;
    }
    
    // If engine is initialized, it's available
    if (this.engine) {
      return true;
    }
    
    // Otherwise check if WebGPU can create an adapter
    try {
      const adapter = await navigator.gpu.requestAdapter();
      return !!adapter;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    // For WebLLM, connection test only checks WebGPU availability
    // We defer actual model loading until first use
    try {
      const isAvailable = await this.isAvailable();
      if (!isAvailable) {
        this.status = 'error';
        return false;
      }
      
      // Don't initialize engine during test - just verify WebGPU works
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
      // Use the complete method which already implements the logic
      const response = await this.complete(request);
      
      // Convert to LLMResponse format
      const llmResponse: LLMResponse = {
        content: response.content,
        model: this.config.modelId || this.config.model || 'Llama-3.2-3B-Instruct-q4f16_1',
        provider: this.id,
        usage: {
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          totalTokens: response.totalTokens
        },
        cost: 0, // WebLLM is free
        latency: response.processingTime,
        metadata: {
          cached: false
        }
      };
      
      success = true;
      return llmResponse;
    } finally {
      // Update metrics
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
    // WebLLM is free to use
    return 0;
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  // Additional helper methods
  getConfig(): WebLLMConfig {
    return this.config;
  }

  updateConfig(config: Partial<WebLLMConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getCost(_promptTokens: number, _completionTokens: number, _model: string): number {
    // WebLLM is free
    return 0;
  }
}