// Google Gemini provider implementation
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

export class GeminiProvider implements LLMProvider {
  readonly id: string = 'gemini';
  readonly name: string = 'Google Gemini';
  readonly type: LLMProviderType = 'cloud';
  readonly icon: string = '✨';
  readonly description: string = 'Gemini Pro models - Fast and capable for legal research';
  readonly costLevel: CostLevel = 'low';
  readonly capabilities: LLMCapability[] = ['reasoning', 'analysis', 'multilingual'];
  
  models: LLMModel[] = [
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      description: 'Balanced model for legal queries',
      contextLength: 32768,
      maxTokens: 8192,
      costPer1kTokens: { input: 0.0005, output: 0.0015 },
      capabilities: ['reasoning', 'analysis', 'multilingual'],
      recommended: true
    },
    {
      id: 'gemini-pro-vision',
      name: 'Gemini Pro Vision',
      description: 'Multimodal model for document analysis',
      contextLength: 16384,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.0005, output: 0.0015 },
      capabilities: ['reasoning', 'analysis'],
      recommended: false
    }
  ];
  
  status: ProviderStatus = 'disconnected';
  
  private config: ProviderConfig;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  private metrics: ProviderMetrics = {
    providerId: 'gemini',
    totalRequests: 0,
    successRate: 1.0,
    averageLatency: 0,
    totalCost: 0,
    lastUsed: Date.now()
  };

  constructor(config: ProviderConfig) {
    this.config = config;
    if (config.endpoint) {
      this.baseUrl = config.endpoint;
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
    const model = request.model || this.config.model || 'gemini-pro';
    const estimatedPromptTokens = request.messages.reduce((sum, msg) => sum + msg.content.length / 4, 0);
    const estimatedCompletionTokens = request.maxTokens || 1000;
    return this.getCost(estimatedPromptTokens, estimatedCompletionTokens, model);
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  private async complete(request: LLMRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      // Convert OpenAI-style messages to Gemini format
      const contents = this.convertMessagesToGeminiFormat(request.messages);
      const model = request.model || this.config.model || 'gemini-pro';

      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: request.abortSignal,
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: request.temperature ?? 0.7,
              topP: request.topP,
              topK: 40,
              maxOutputTokens: request.maxTokens || 2048,
              stopSequences: request.stop
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate) {
        throw new Error('No response from Gemini');
      }

      const content = candidate.content.parts.map((p: any) => p.text).join('');
      const usage = data.usageMetadata || {};

      return {
        content,
        role: 'assistant',
        model,
        promptTokens: usage.promptTokenCount || 0,
        completionTokens: usage.candidatesTokenCount || 0,
        totalTokens: usage.totalTokenCount || 0,
        finishReason: candidate.finishReason,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Gemini provider error:', error);
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
      const contents = this.convertMessagesToGeminiFormat(request.messages);
      const model = request.model || this.config.model || 'gemini-pro';

      const response = await fetch(
        `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          signal: request.abortSignal,
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: request.temperature ?? 0.7,
              topP: request.topP,
              topK: 40,
              maxOutputTokens: request.maxTokens || 2048,
              stopSequences: request.stop
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Gemini API error: ${response.status}`);
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
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              const candidate = parsed.candidates?.[0];
              
              if (candidate?.content?.parts) {
                const text = candidate.content.parts.map((p: any) => p.text).join('');
                if (text) {
                  fullContent += text;
                  onChunk(text);
                }
              }

              if (parsed.usageMetadata) {
                promptTokens = parsed.usageMetadata.promptTokenCount || promptTokens;
                completionTokens = parsed.usageMetadata.candidatesTokenCount || completionTokens;
              }
            } catch (e) {
              console.warn('Failed to parse streaming data:', e);
            }
          }
        }
      }

      return {
        content: fullContent,
        role: 'assistant',
        model: request.model || this.config.model || 'gemini-pro',
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Gemini streaming error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.config.apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
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
    if (config.endpoint) {
      this.baseUrl = config.endpoint;
    }
  }

  getCost(promptTokens: number, completionTokens: number, model: string): number {
    // Gemini pricing as of 2024 (per 1K tokens)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gemini-pro': { prompt: 0.0005, completion: 0.0015 },
      'gemini-pro-vision': { prompt: 0.0005, completion: 0.0015 },
      'gemini-ultra': { prompt: 0.01, completion: 0.03 }
    };

    const modelPricing = pricing[model] || pricing['gemini-pro'];
    return (promptTokens * modelPricing.prompt + completionTokens * modelPricing.completion) / 1000;
  }

  private convertMessagesToGeminiFormat(messages: Array<{ role: string; content: string }>) {
    const contents = [];
    let currentRole = '';
    let parts = [];

    for (const message of messages) {
      // Gemini uses 'user' and 'model' roles
      const geminiRole = message.role === 'assistant' ? 'model' : 'user';
      
      // System messages are prepended to the first user message
      if (message.role === 'system') {
        if (contents.length === 0 || contents[0].role !== 'user') {
          contents.unshift({
            role: 'user',
            parts: [{ text: message.content }]
          });
        } else {
          contents[0].parts.unshift({ text: message.content + '\n\n' });
        }
        continue;
      }

      if (geminiRole !== currentRole) {
        if (parts.length > 0) {
          contents.push({ role: currentRole, parts });
        }
        currentRole = geminiRole;
        parts = [];
      }
      
      parts.push({ text: message.content });
    }

    if (parts.length > 0) {
      contents.push({ role: currentRole, parts });
    }

    return contents;
  }
}