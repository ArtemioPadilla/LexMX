// Ollama (local) provider implementation
import type {
  CostLevel,
  LLMCapability,
  LLMModel,
  LLMProvider,
  LLMProviderType,
  LLMResponse,
  LLMRequest,
  ProviderConfig,
  ProviderMetrics,
  ProviderStatus,
  StreamCallback
} from '../../../types/llm';
import type { RawCompletionResult } from './raw-completion';

// Ollama's `/api/chat` response is untyped JSON; this covers the fields the
// provider actually reads out of it.
interface OllamaChatResponse {
  message?: { role?: string; content?: string };
  model?: string;
  done?: boolean;
  total_duration?: number;
}

interface OllamaStreamLine {
  message?: { content?: string };
  done?: boolean;
  model?: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name: string }>;
}

const DEFAULT_MODEL: LLMModel = {
  id: 'llama2',
  name: 'Llama 2',
  description: 'Default local Ollama model (override via provider config)',
  contextLength: 4096,
  maxTokens: 4096,
  capabilities: ['privacy', 'offline', 'customizable']
};

export class OllamaProvider implements LLMProvider {
  readonly id: string = 'ollama';
  readonly name: string = 'Ollama';
  readonly type: LLMProviderType = 'local';
  readonly icon: string = '/icons/ollama.svg';
  readonly description: string = 'Run models locally - Complete privacy, no API costs, works offline';
  readonly costLevel: CostLevel = 'free';
  readonly capabilities: LLMCapability[] = ['privacy', 'offline', 'customizable'];
  models: LLMModel[] = [DEFAULT_MODEL];
  status: ProviderStatus = 'disconnected';

  private config: ProviderConfig;
  private baseUrl: string;
  private metrics: ProviderMetrics = {
    providerId: 'ollama',
    totalRequests: 0,
    successRate: 1.0,
    averageLatency: 0,
    totalCost: 0,
    lastUsed: Date.now()
  };

  constructor(config: ProviderConfig) {
    this.config = config;
    this.baseUrl = config.endpoint || 'http://localhost:11434';
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
      processingTime: response.processingTime,
      metadata: {
        cached: false
      }
    };
  }

  async isAvailable(): Promise<boolean> {
    return this.testConnection();
  }

  estimateCost(_request: LLMRequest): number {
    // Ollama is free (local)
    return 0;
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  private async complete(request: LLMRequest): Promise<RawCompletionResult> {
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

      const data: OllamaChatResponse = await response.json();
      const content = data.message?.content || '';

      // Estimate token counts (Ollama doesn't provide exact counts)
      const promptTokens = this.estimateTokens(request.messages.map(m => m.content).join(' '));
      const completionTokens = this.estimateTokens(content);

      return {
        content,
        role: 'assistant',
        model: data.model || request.model || this.config.model || 'llama2',
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
      processingTime: response.processingTime,
      metadata: {
        cached: false
      }
    };
  }

  private async streamInternal(request: LLMRequest, onChunk: StreamCallback): Promise<RawCompletionResult> {
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

        // Check if request was aborted
        if (request.abortSignal?.aborted) {
          reader.cancel();
          throw new Error('Request aborted');
        }

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const parsed: OllamaStreamLine = JSON.parse(line);

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
      const data: OllamaTagsResponse = await response.json();
      return data.models?.map(m => m.name) || [];
    } catch (error) {
      console.error('Failed to list Ollama models:', error);
      return [];
    }
  }

  // Ollama-specific method to pull a model
  async pullModel(modelName: string, onProgress?: (progress: number) => void, abortSignal?: AbortSignal): Promise<void> {
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

        // Check if request was aborted
        if (abortSignal?.aborted) {
          reader.cancel();
          throw new Error('Request aborted');
        }

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
