// OpenAI provider implementation
import type { 
  LLMProvider, 
  LLMResponse, 
  LLMRequest, 
  ProviderConfig,
  StreamCallback 
} from '../../../types/llm';

export class OpenAIProvider implements LLMProvider {
  private config: ProviderConfig;
  private baseUrl = 'https://api.openai.com/v1';

  constructor(config: ProviderConfig) {
    this.config = config;
    if (config.endpoint) {
      this.baseUrl = config.endpoint;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: request.model || this.config.model || 'gpt-3.5-turbo',
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
        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const choice = data.choices[0];

      return {
        content: choice.message.content,
        role: choice.message.role,
        model: data.model,
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0,
        finishReason: choice.finish_reason,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('OpenAI provider error:', error);
      throw error;
    }
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const startTime = Date.now();
    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: request.model || this.config.model || 'gpt-3.5-turbo',
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
        throw new Error(error.error?.message || `OpenAI API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
        model: request.model || this.config.model || 'gpt-3.5-turbo',
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('OpenAI streaming error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`
        }
      });
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
    // OpenAI pricing as of 2024 (per 1K tokens)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
      'gpt-4': { prompt: 0.03, completion: 0.06 },
      'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
      'gpt-3.5-turbo-16k': { prompt: 0.003, completion: 0.004 }
    };

    const modelPricing = pricing[model] || pricing['gpt-3.5-turbo'];
    return (promptTokens * modelPricing.prompt + completionTokens * modelPricing.completion) / 1000;
  }
}