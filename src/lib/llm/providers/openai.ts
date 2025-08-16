// OpenAI provider implementation

import type { CloudProvider, LLMRequest, LLMResponse, LLMModel, ProviderConfig, ChatMessage, LLMCapability } from '@/types/llm';
import type { LegalArea } from '@/types/legal';
import type { ErrorWithCode, OpenAIApiModel } from '@/types/common';
import { BaseLLMProvider } from '../base-provider';
import { promptBuilder } from '../prompt-builder';
import { i18n } from '@/i18n';

export class OpenAIProvider extends BaseLLMProvider implements CloudProvider {
  public readonly type = 'cloud' as const;
  public readonly icon = '/icons/openai.svg';
  public readonly description = 'GPT-4 and GPT-3.5 models - Excellent for complex legal analysis and reasoning';
  public readonly costLevel = 'high' as const;
  public readonly capabilities: LLMCapability[] = ['reasoning', 'analysis', 'citations', 'multilingual'];
  public readonly apiEndpoint = 'https://api.openai.com/v1';
  public readonly requiresApiKey = true;
  public readonly rateLimit = {
    requestsPerMinute: 3500,
    requestsPerDay: 10000
  };

  public models: LLMModel[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      description: 'Most capable model for complex legal reasoning',
      contextLength: 128000,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.005, output: 0.015 },
      capabilities: ['reasoning', 'analysis', 'citations', 'multilingual'],
      recommended: true
    },
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'Fast and capable, good balance of speed and quality',
      contextLength: 128000,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.01, output: 0.03 },
      capabilities: ['reasoning', 'analysis', 'citations'],
      recommended: true
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Original GPT-4, most reliable for legal tasks',
      contextLength: 8192,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.03, output: 0.06 },
      capabilities: ['reasoning', 'analysis', 'citations']
    },
    {
      id: 'gpt-3.5-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Cost-effective option for simpler legal queries',
      contextLength: 16385,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.001, output: 0.002 },
      capabilities: ['reasoning', 'multilingual']
    }
  ];

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required');
    }
    if (!this.config.apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'user', content: 'Test connection - respond with "OK"' }
        ],
        maxTokens: 10,
        temperature: 0
      };

      await this.generateResponse(testRequest);
      return true;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.apiEndpoint}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LexMX-Legal-Assistant/1.0'
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.formatMessages(request.messages),
          temperature: request.temperature ?? this.config.temperature ?? 0.1,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4000,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0,
          stream: false
        }),
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`OpenAI API error: ${response.status} - ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const llmResponse = this.createBaseResponse(
        request,
        data.choices[0].message.content,
        data.usage,
        latency
      );

      // Add OpenAI-specific metadata
      llmResponse.metadata = {
        ...llmResponse.metadata,
        model: data.model
      };

      this.updateMetrics(llmResponse, true);
      return llmResponse;

    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      
      // Create error response for metrics
      const errorResponse = this.createBaseResponse(request, '', { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, latency);
      this.updateMetrics(errorResponse, false);
      
      this.handleError(error as ErrorWithCode, request);
    }
  }

  estimateCost(request: LLMRequest): number {
    const model = this.models.find(m => m.id === request.model);
    if (!model || !model.costPer1kTokens) return 0;

    // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
    const inputText = request.messages.map(m => m.content).join(' ');
    const estimatedInputTokens = Math.ceil(inputText.length / 4);
    
    // Estimate output tokens
    const estimatedOutputTokens = request.maxTokens ?? this.config.maxTokens ?? 1000;

    return this.calculateTokenCost({
      promptTokens: estimatedInputTokens,
      completionTokens: estimatedOutputTokens
    }, model);
  }

  private formatMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  // OpenAI-specific methods
  async listModels(): Promise<LLMModel[]> {
    try {
      const response = await fetch(`${this.apiEndpoint}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) return this.models;

      const data = await response.json();
      
      // Filter to only chat models and update our model list
      const chatModels = data.data.filter((model: OpenAIApiModel) => 
        model.id.includes('gpt-') && !model.id.includes('instruct')
      );

      return this.models.filter(model => 
        chatModels.some((apiModel: OpenAIApiModel) => apiModel.id === model.id)
      );
    } catch {
      return this.models;
    }
  }

  async checkUsage(): Promise<{ dailyUsage: number; monthlyUsage: number }> {
    // OpenAI doesn't provide usage API, so we track locally
    const metrics = this.getMetrics();
    return {
      dailyUsage: metrics.totalCost, // This would need proper daily tracking
      monthlyUsage: metrics.totalCost
    };
  }

  // Get legal system prompt using the centralized prompt builder
  getLegalSystemPrompt(legalArea?: string): string {
    // Validate and cast to LegalArea type
    const legalAreaTyped = legalArea as LegalArea | undefined;
    
    return promptBuilder.buildSystemPrompt({
      language: i18n.language,
      legalArea: legalAreaTyped,
      provider: 'openai',
      includeSpecialization: true
    });
  }
}

export default OpenAIProvider;