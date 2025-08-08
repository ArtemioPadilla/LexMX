// Azure OpenAI Service provider implementation
import type { 
  LLMProvider, 
  LLMResponse, 
  LLMRequest, 
  ProviderConfig,
  StreamCallback,
  LLMModel,
  ProviderStatus,
  LLMCapability,
  CostLevel,
  LLMProviderType,
  ProviderMetrics
} from '../../../types/llm';

export class AzureProvider implements LLMProvider {
  readonly id: string = 'azure';
  readonly name: string = 'Azure OpenAI';
  readonly type: LLMProviderType = 'cloud';
  readonly icon: string = '☁️';
  readonly description: string = 'Azure-hosted OpenAI models with enterprise security';
  readonly costLevel: CostLevel = 'medium';
  readonly capabilities: LLMCapability[] = ['reasoning', 'analysis', 'citations', 'multilingual'];
  
  models: LLMModel[] = [
    {
      id: 'gpt-4-turbo',
      name: 'GPT-4 Turbo',
      description: 'Most capable model for complex legal reasoning',
      contextLength: 128000,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.01, output: 0.03 },
      capabilities: ['reasoning', 'analysis', 'citations', 'multilingual'],
      recommended: true
    },
    {
      id: 'gpt-4',
      name: 'GPT-4',
      description: 'Advanced reasoning and analysis',
      contextLength: 8192,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.03, output: 0.06 },
      capabilities: ['reasoning', 'analysis', 'citations', 'multilingual'],
      recommended: false
    },
    {
      id: 'gpt-35-turbo',
      name: 'GPT-3.5 Turbo',
      description: 'Fast and cost-effective for simpler queries',
      contextLength: 16384,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.0005, output: 0.0015 },
      capabilities: ['reasoning', 'analysis'],
      recommended: false
    }
  ];
  
  status: ProviderStatus = 'disconnected';
  
  private config: ProviderConfig;
  private baseUrl: string;
  private metrics: ProviderMetrics = {
    providerId: 'azure',
    totalRequests: 0,
    successRate: 1.0,
    averageLatency: 0,
    totalCost: 0,
    lastUsed: Date.now()
  };
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(config: ProviderConfig) {
    this.config = config;
    // Azure endpoint format: https://{resource}.openai.azure.com
    if (config.azureResourceName) {
      this.baseUrl = `https://${config.azureResourceName}.openai.azure.com`;
    } else {
      this.baseUrl = config.endpoint || '';
    }
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
      cost: this.getCost(response.promptTokens, response.completionTokens, response.model),
      latency: response.processingTime,
      metadata: {
        cached: false
      }
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.status === 'connected';
  }

  estimateCost(request: LLMRequest): number {
    const model = request.model || this.config.model || 'gpt-35-turbo';
    const estimatedPromptTokens = request.messages.reduce((sum, msg) => sum + msg.content.length / 4, 0);
    const estimatedCompletionTokens = request.maxTokens || 1000;
    return this.getCost(estimatedPromptTokens, estimatedCompletionTokens, model);
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  private async getAuthHeader(): Promise<string> {
    // Use API key if provided
    if (this.config.apiKey) {
      return `api-key: ${this.config.apiKey}`;
    }
    
    // Use Azure AD authentication
    if (this.config.azureTenantId && this.config.azureClientId && this.config.azureClientSecret) {
      // Check if we have a valid token
      if (!this.accessToken || !this.tokenExpiry || Date.now() >= this.tokenExpiry) {
        await this.refreshAccessToken();
      }
      return `Bearer ${this.accessToken}`;
    }
    
    throw new Error('No authentication method configured for Azure OpenAI');
  }

  private async refreshAccessToken(): Promise<void> {
    const tokenUrl = `https://login.microsoftonline.com/${this.config.azureTenantId}/oauth2/v2.0/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: this.config.azureClientId!,
        client_secret: this.config.azureClientSecret!,
        scope: 'https://cognitiveservices.azure.com/.default',
        grant_type: 'client_credentials'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to get Azure AD token: ${response.statusText}`);
    }
    
    const data = await response.json();
    this.accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
  }

  private async complete(request: LLMRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      const authHeader = await this.getAuthHeader();
      const deploymentName = this.config.azureDeploymentName || request.model || 'gpt-35-turbo';
      const apiVersion = this.config.azureApiVersion || '2024-02-01';
      
      const url = `${this.baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Set auth header based on type
      if (authHeader.startsWith('Bearer')) {
        headers['Authorization'] = authHeader;
      } else {
        headers['api-key'] = authHeader.replace('api-key: ', '');
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: request.abortSignal,
        body: JSON.stringify({
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
          stream: false
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Azure OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content,
        role: choice.message.role,
        model: deploymentName,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        finishReason: choice.finish_reason,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Azure provider error:', error);
      throw error;
    }
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const response = await this.streamInternal(request, onChunk);
    return {
      content: response.content,
      model: response.model,
      provider: this.id,
      usage: {
        promptTokens: response.promptTokens,
        completionTokens: response.completionTokens,
        totalTokens: response.totalTokens
      },
      cost: this.getCost(response.promptTokens, response.completionTokens, response.model),
      latency: response.processingTime,
      metadata: {
        cached: false
      }
    };
  }

  private async streamInternal(request: LLMRequest, onChunk: StreamCallback): Promise<any> {
    const startTime = Date.now();
    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const authHeader = await this.getAuthHeader();
      const deploymentName = this.config.azureDeploymentName || request.model || 'gpt-35-turbo';
      const apiVersion = this.config.azureApiVersion || '2024-02-01';
      
      const url = `${this.baseUrl}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      
      // Set auth header based on type
      if (authHeader.startsWith('Bearer')) {
        headers['Authorization'] = authHeader;
      } else {
        headers['api-key'] = authHeader.replace('api-key: ', '');
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: request.abortSignal,
        body: JSON.stringify({
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Azure OpenAI API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // Check if request was aborted
        if (request.abortSignal?.aborted) {
          reader.cancel();
          throw new Error('Request aborted');
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0].delta;
              
              if (delta.content) {
                fullContent += delta.content;
                onChunk(delta.content);
              }

              // Update token counts if available
              if (parsed.usage) {
                promptTokens = parsed.usage.prompt_tokens || promptTokens;
                completionTokens = parsed.usage.completion_tokens || completionTokens;
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }

      return {
        content: fullContent,
        role: 'assistant',
        model: deploymentName,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Azure streaming error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const authHeader = await this.getAuthHeader();
      const apiVersion = this.config.azureApiVersion || '2024-02-01';
      const url = `${this.baseUrl}/openai/models?api-version=${apiVersion}`;
      
      const headers: Record<string, string> = {};
      
      // Set auth header based on type
      if (authHeader.startsWith('Bearer')) {
        headers['Authorization'] = authHeader;
      } else {
        headers['api-key'] = authHeader.replace('api-key: ', '');
      }
      
      const response = await fetch(url, { headers });
      return response.ok;
    } catch {
      return false;
    }
  }

  getConfig(): ProviderConfig {
    return this.config;
  }

  updateConfig(config: Partial<ProviderConfig>): void {
    this.config = { ...this.config, ...config };
    if (config.azureResourceName) {
      this.baseUrl = `https://${config.azureResourceName}.openai.azure.com`;
    } else if (config.endpoint) {
      this.baseUrl = config.endpoint;
    }
  }

  getCost(promptTokens: number, completionTokens: number, model: string): number {
    // Azure OpenAI pricing (similar to OpenAI)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-35-turbo': { prompt: 0.0005, completion: 0.0015 },
      'gpt-35-turbo-16k': { prompt: 0.003, completion: 0.004 }
    };

    const modelPricing = pricing[model] || pricing['gpt-35-turbo'];
    return (promptTokens * modelPricing.prompt + completionTokens * modelPricing.completion) / 1000;
  }
}