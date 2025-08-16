// Base LLM provider class that all providers extend

import type { 
  LLMProvider, 
  LLMRequest, 
  LLMResponse, 
  ProviderConfig, 
  ProviderStatus,
  LLMModel,
  ProviderMetrics,
  TokenUsage,
  LLMCapability
} from '@/types';
import type { ErrorWithCode } from '@/types/common';

export abstract class BaseLLMProvider implements LLMProvider {
  public readonly id: string;
  public readonly name: string;
  public readonly type: 'cloud' | 'local';
  public readonly icon: string;
  public readonly description: string;
  public readonly costLevel: 'free' | 'low' | 'medium' | 'high';
  public readonly capabilities: LLMCapability[];
  public models: LLMModel[] = [];
  public status: ProviderStatus = 'disconnected';

  protected config: ProviderConfig;
  protected metrics: ProviderMetrics;

  constructor(config: ProviderConfig) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = config;
    
    // Initialize metrics
    this.metrics = {
      providerId: config.id,
      totalRequests: 0,
      successRate: 1.0,
      averageLatency: 0,
      totalCost: 0,
      lastUsed: 0
    };

    // These will be set by concrete implementations
    this.icon = '';
    this.description = '';
    this.costLevel = 'medium';
    this.capabilities = [];
  }

  // Abstract methods that must be implemented
  abstract isAvailable(): Promise<boolean>;
  abstract testConnection(): Promise<boolean>;
  abstract generateResponse(request: LLMRequest): Promise<LLMResponse>;
  abstract estimateCost(request: LLMRequest): number;
  
  // Common functionality
  public getConfig(): ProviderConfig {
    return { ...this.config };
  }

  public getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  public updateConfig(newConfig: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  protected updateMetrics(response: LLMResponse, success: boolean): void {
    this.metrics.totalRequests++;
    this.metrics.lastUsed = Date.now();
    
    if (success) {
      // Update average latency
      const totalLatency = this.metrics.averageLatency * (this.metrics.totalRequests - 1) + response.latency;
      this.metrics.averageLatency = totalLatency / this.metrics.totalRequests;
      
      // Update cost
      if (response.cost) {
        this.metrics.totalCost += response.cost;
      }
    }
    
    // Update success rate
    const successCount = Math.floor(this.metrics.successRate * (this.metrics.totalRequests - 1)) + (success ? 1 : 0);
    this.metrics.successRate = successCount / this.metrics.totalRequests;
  }

  protected validateRequest(request: LLMRequest): void {
    if (!request.messages || request.messages.length === 0) {
      throw new Error('Request must contain at least one message');
    }

    if (!request.model) {
      throw new Error('Request must specify a model');
    }

    // Check if model is supported
    const supportedModel = this.models.find(m => m.id === request.model);
    if (!supportedModel) {
      throw new Error(`Model ${request.model} is not supported by ${this.name}`);
    }

    // Validate token limits
    if (request.maxTokens && request.maxTokens > supportedModel.maxTokens) {
      throw new Error(`Requested tokens (${request.maxTokens}) exceed model limit (${supportedModel.maxTokens})`);
    }
  }

  protected createBaseResponse(request: LLMRequest, content: string, usage: TokenUsage, latency: number): LLMResponse {
    const promptTokens = usage?.prompt_tokens ?? usage?.promptTokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? usage?.completionTokens ?? 0;
    const totalTokens = usage?.total_tokens ?? usage?.totalTokens ?? (promptTokens + completionTokens);
    
    return {
      content,
      model: request.model,
      provider: this.id,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens
      },
      latency,
      processingTime: latency,
      cost: this.estimateCost(request),
      metadata: {
        cached: false,
        fallback: false
      }
    };
  }

  protected handleError(error: ErrorWithCode, _request: LLMRequest): never {
    // Log error for debugging
    console.error(`[${this.name}] Error processing request:`, error);
    
    // Update metrics
    this.updateMetrics({} as LLMResponse, false);
    
    // Throw standardized error
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout for ${this.name}`);
    }
    
    if (error.statusCode === 401) {
      this.status = 'error';
      throw new Error(`Authentication failed for ${this.name}. Please check your API key.`);
    }
    
    if (error.statusCode === 429) {
      throw new Error(`Rate limit exceeded for ${this.name}. Please try again later.`);
    }
    
    if (error.statusCode && error.statusCode >= 500) {
      throw new Error(`${this.name} service is temporarily unavailable.`);
    }
    
    throw new Error(`${this.name} error: ${error.message || 'Unknown error'}`);
  }

  // Helper methods for cost calculation
  protected calculateTokenCost(usage: TokenUsage, model: LLMModel): number {
    if (!model.costPer1kTokens) return 0;
    
    const inputCost = (usage.promptTokens / 1000) * model.costPer1kTokens.input;
    const outputCost = (usage.completionTokens / 1000) * model.costPer1kTokens.output;
    
    return inputCost + outputCost;
  }

  // Helper method to check rate limits
  protected checkRateLimit(): boolean {
    // Basic rate limiting - can be overridden by providers
    const now = Date.now();
    const _oneMinuteAgo = now - 60000;
    
    // This is a simple implementation - providers should implement their own
    return true;
  }
}