// Ollama (local) provider implementation
import type { 
  LLMProvider, 
  LLMResponse, 
  LLMRequest, 
  ProviderConfig,
  StreamCallback 
} from '../../../types/llm';

export class OllamaProvider implements LLMProvider {
  private config: ProviderConfig;
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.endpoint || 'http://localhost:11434';
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model || this.config.model || 'llama2',
          messages: request.messages,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            top_p: request.topP,
            num_predict: request.maxTokens,
            stop: request.stop,
            frequency_penalty: request.frequencyPenalty,
            presence_penalty: request.presencePenalty
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      // Estimate token counts (Ollama doesn't provide exact counts)
      const promptTokens = this.estimateTokens(request.messages.map(m => m.content).join(' '));
      const completionTokens = this.estimateTokens(data.message.content);

      return {
        content: data.message.content,
        role: data.message.role,
        model: data.model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: data.done ? 'stop' : 'length',
        processingTime: data.total_duration ? Math.round(data.total_duration / 1000000) : Date.now() - startTime
      };
    } catch (error) {
      console.error('Ollama provider error:', error);
      throw error;
    }
  }

  async stream(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse> {
    const startTime = Date.now();
    let fullContent = '';
    let model = request.model || this.config.model || 'llama2';

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: request.messages,
          stream: true,
          options: {
            temperature: request.temperature ?? 0.7,
            top_p: request.topP,
            num_predict: request.maxTokens,
            stop: request.stop,
            frequency_penalty: request.frequencyPenalty,
            presence_penalty: request.presencePenalty
          }
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              
              if (parsed.message?.content) {
                fullContent += parsed.message.content;
                onChunk(parsed.message.content);
              }

              if (parsed.done && parsed.model) {
                model = parsed.model;
              }
            } catch (e) {
              console.warn('Failed to parse streaming data:', e);
            }
          }
        }
      }

      // Estimate token counts
      const promptTokens = this.estimateTokens(request.messages.map(m => m.content).join(' '));
      const completionTokens = this.estimateTokens(fullContent);

      return {
        content: fullContent,
        role: 'assistant',
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        finishReason: 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Ollama streaming error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
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

  getCost(_promptTokens: number, _completionTokens: number, _model: string): number {
    // Ollama is free (local)
    return 0;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  // Ollama-specific method to list available models
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`);
      }
      const data = await response.json();
      return data.models?.map((m: any) => m.name) || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  // Ollama-specific method to pull a model
  async pullModel(modelName: string, onProgress?: (progress: number) => void): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelName, stream: true })
      });

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed = JSON.parse(line);
              if (parsed.total && parsed.completed && onProgress) {
                const progress = (parsed.completed / parsed.total) * 100;
                onProgress(progress);
              }
            } catch (e) {
              console.warn('Failed to parse pull progress:', e);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to pull Ollama model:', error);
      throw error;
    }
  }
}