// Claude (Anthropic) provider implementation
import type { 
  LLMProvider, 
  LLMResponse, 
  LLMRequest, 
  ProviderConfig,
  StreamCallback 
} from '../../../types/llm';

export class ClaudeProvider implements LLMProvider {
  private config: ProviderConfig;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(config: ProviderConfig) {
    this.config = config;
    if (config.endpoint) {
      this.baseUrl = config.endpoint;
    }
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      // Convert OpenAI-style messages to Claude format
      const systemMessage = request.messages.find(m => m.role === 'system');
      const otherMessages = request.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: request.model || this.config.model || 'claude-3-haiku-20240307',
          messages: otherMessages,
          system: systemMessage?.content,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP,
          stop_sequences: request.stop
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Claude API error: ${response.status}`);
      }

      const data = await response.json();

      return {
        content: data.content[0].text,
        role: 'assistant',
        model: data.model,
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        finishReason: data.stop_reason,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Claude provider error:', error);
      throw error;
    }
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const startTime = Date.now();
    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const systemMessage = request.messages.find(m => m.role === 'system');
      const otherMessages = request.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: request.model || this.config.model || 'claude-3-haiku-20240307',
          messages: otherMessages,
          system: systemMessage?.content,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP,
          stop_sequences: request.stop,
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Claude API error: ${response.status}`);
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
              
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                fullContent += parsed.delta.text;
                onChunk(parsed.delta.text);
              }

              if (parsed.type === 'message_start' && parsed.message?.usage) {
                promptTokens = parsed.message.usage.input_tokens || 0;
              }

              if (parsed.type === 'message_delta' && parsed.usage) {
                completionTokens = parsed.usage.output_tokens || 0;
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
        model: request.model || this.config.model || 'claude-3-haiku-20240307',
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Claude streaming error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.config.apiKey!,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 1
        })
      });
      return response.ok || response.status === 400; // 400 might mean invalid request but valid API key
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
    // Claude pricing as of 2024 (per 1M tokens)
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'claude-3-opus-20240229': { prompt: 15, completion: 75 },
      'claude-3-sonnet-20240229': { prompt: 3, completion: 15 },
      'claude-3-haiku-20240307': { prompt: 0.25, completion: 1.25 },
      'claude-2.1': { prompt: 8, completion: 24 },
      'claude-2.0': { prompt: 8, completion: 24 }
    };

    const modelPricing = pricing[model] || pricing['claude-3-haiku-20240307'];
    return (promptTokens * modelPricing.prompt + completionTokens * modelPricing.completion) / 1000000;
  }
}