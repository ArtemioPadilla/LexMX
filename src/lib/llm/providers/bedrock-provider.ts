// AWS Bedrock provider implementation
import type { 
  LLMProvider, 
  LLMResponse, 
  LLMRequest, 
  ProviderConfig,
  StreamCallback,
  ProviderStatus,
  ProviderMetrics,
  LLMModel
} from '../../../types/llm';

interface BedrockConfig extends ProviderConfig {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

export class BedrockProvider implements LLMProvider {
  id = 'bedrock';
  name = 'AWS Bedrock';
  type: 'cloud' = 'cloud';
  status: ProviderStatus = 'disconnected';
  
  private config: BedrockConfig;
  private baseUrl: string;
  private metrics: ProviderMetrics = {
    providerId: 'bedrock',
    totalRequests: 0,
    successRate: 1.0,
    averageLatency: 0,
    totalCost: 0,
    lastUsed: Date.now()
  };

  // Common Bedrock models
  models: LLMModel[] = [
    {
      id: 'anthropic.claude-3-sonnet-20240229-v1:0',
      name: 'Claude 3 Sonnet',
      description: 'Balanced performance and cost',
      contextWindow: 200000,
      maxOutput: 4096,
      costPer1kInput: 0.003,
      costPer1kOutput: 0.015
    },
    {
      id: 'anthropic.claude-3-haiku-20240307-v1:0',
      name: 'Claude 3 Haiku',
      description: 'Fast and cost-effective',
      contextWindow: 200000,
      maxOutput: 4096,
      costPer1kInput: 0.00025,
      costPer1kOutput: 0.00125
    },
    {
      id: 'anthropic.claude-v2:1',
      name: 'Claude 2.1',
      description: 'Previous generation Claude',
      contextWindow: 100000,
      maxOutput: 4096,
      costPer1kInput: 0.008,
      costPer1kOutput: 0.024
    },
    {
      id: 'meta.llama3-70b-instruct-v1:0',
      name: 'Llama 3 70B',
      description: 'Large open-source model',
      contextWindow: 8192,
      maxOutput: 2048,
      costPer1kInput: 0.00265,
      costPer1kOutput: 0.0035
    },
    {
      id: 'meta.llama3-8b-instruct-v1:0',
      name: 'Llama 3 8B',
      description: 'Smaller, faster Llama model',
      contextWindow: 8192,
      maxOutput: 2048,
      costPer1kInput: 0.0003,
      costPer1kOutput: 0.0006
    },
    {
      id: 'amazon.titan-text-express-v1',
      name: 'Titan Text Express',
      description: 'Amazon\'s fast text model',
      contextWindow: 8192,
      maxOutput: 4096,
      costPer1kInput: 0.0002,
      costPer1kOutput: 0.0006
    },
    {
      id: 'cohere.command-text-v14',
      name: 'Cohere Command',
      description: 'Instruction-following model',
      contextWindow: 4096,
      maxOutput: 4096,
      costPer1kInput: 0.0015,
      costPer1kOutput: 0.002
    }
  ];

  constructor(config: BedrockConfig) {
    this.config = config;
    this.baseUrl = `https://bedrock-runtime.${config.region || 'us-east-1'}.amazonaws.com`;
  }

  async testConnection(): Promise<boolean> {
    try {
      // Try to list available models
      const response = await this.makeRequest('GET', '/foundation-models', {});
      return response.ok;
    } catch (error) {
      console.error('Bedrock connection test failed:', error);
      return false;
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

  async isAvailable(): Promise<boolean> {
    return this.status === 'connected';
  }

  estimateCost(request: LLMRequest): number {
    const model = request.model || this.config.model || 'anthropic.claude-3-haiku-20240307-v1:0';
    const estimatedPromptTokens = request.messages.reduce((sum, msg) => sum + msg.content.length / 4, 0);
    const estimatedCompletionTokens = request.maxTokens || 1000;
    return this.getCost(estimatedPromptTokens, estimatedCompletionTokens, model);
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  private async complete(request: LLMRequest): Promise<any> {
    const startTime = Date.now();
    const modelId = request.model || this.config.model || 'anthropic.claude-3-haiku-20240307-v1:0';
    
    try {
      // Format request based on model type
      const body = this.formatRequestBody(modelId, request);
      
      const response = await this.makeRequest(
        'POST',
        `/model/${modelId}/invoke`,
        body,
        request.abortSignal
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bedrock API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      return this.parseResponse(modelId, data, Date.now() - startTime);
    } catch (error) {
      console.error('Bedrock provider error:', error);
      throw error;
    }
  }

  private async streamInternal(request: LLMRequest, onChunk: StreamCallback): Promise<any> {
    const startTime = Date.now();
    const modelId = request.model || this.config.model || 'anthropic.claude-3-haiku-20240307-v1:0';
    let fullContent = '';
    let promptTokens = 0;
    let completionTokens = 0;

    try {
      const body = this.formatRequestBody(modelId, request);
      
      const response = await this.makeRequest(
        'POST',
        `/model/${modelId}/invoke-with-response-stream`,
        body,
        request.abortSignal
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Bedrock API error: ${response.status} - ${error}`);
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
        const chunks = this.parseStreamChunks(modelId, buffer);
        
        for (const chunk of chunks.parsed) {
          if (chunk.content) {
            fullContent += chunk.content;
            onChunk(chunk.content);
          }
          if (chunk.inputTokens) promptTokens = chunk.inputTokens;
          if (chunk.outputTokens) completionTokens = chunk.outputTokens;
        }
        
        buffer = chunks.remaining;
      }

      return {
        content: fullContent,
        role: 'assistant',
        model: modelId,
        promptTokens: promptTokens || this.estimateTokens(request.messages),
        completionTokens: completionTokens || this.estimateTokens(fullContent),
        totalTokens: (promptTokens || 0) + (completionTokens || 0),
        finishReason: 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Bedrock streaming error:', error);
      throw error;
    }
  }

  private formatRequestBody(modelId: string, request: LLMRequest): any {
    // Claude models
    if (modelId.startsWith('anthropic.claude')) {
      const systemMessage = request.messages.find(m => m.role === 'system');
      const otherMessages = request.messages.filter(m => m.role !== 'system');
      
      return {
        anthropic_version: 'bedrock-2023-05-31',
        messages: otherMessages.map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        system: systemMessage?.content,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.9,
        stop_sequences: request.stop
      };
    }
    
    // Llama models
    if (modelId.startsWith('meta.llama')) {
      const prompt = this.formatLlamaPrompt(request.messages);
      return {
        prompt,
        max_gen_len: request.maxTokens || 2048,
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.9
      };
    }
    
    // Titan models
    if (modelId.startsWith('amazon.titan')) {
      const prompt = request.messages.map(m => m.content).join('\n\n');
      return {
        inputText: prompt,
        textGenerationConfig: {
          maxTokenCount: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          topP: request.topP ?? 0.9,
          stopSequences: request.stop
        }
      };
    }
    
    // Cohere models
    if (modelId.startsWith('cohere.')) {
      const prompt = request.messages.map(m => m.content).join('\n\n');
      return {
        prompt,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature ?? 0.7,
        p: request.topP ?? 0.9,
        stop_sequences: request.stop
      };
    }
    
    // Default format
    const prompt = request.messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
    return {
      prompt,
      max_tokens: request.maxTokens || 2048,
      temperature: request.temperature ?? 0.7
    };
  }

  private formatLlamaPrompt(messages: any[]): string {
    let prompt = '';
    
    for (const msg of messages) {
      if (msg.role === 'system') {
        prompt += `<<SYS>>\n${msg.content}\n<</SYS>>\n\n`;
      } else if (msg.role === 'user') {
        prompt += `[INST] ${msg.content} [/INST]\n`;
      } else if (msg.role === 'assistant') {
        prompt += `${msg.content}\n`;
      }
    }
    
    return prompt;
  }

  private parseResponse(modelId: string, data: any, processingTime: number): any {
    // Claude models
    if (modelId.startsWith('anthropic.claude')) {
      return {
        content: data.content?.[0]?.text || '',
        role: 'assistant',
        model: modelId,
        promptTokens: data.usage?.input_tokens || 0,
        completionTokens: data.usage?.output_tokens || 0,
        totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        finishReason: data.stop_reason || 'stop',
        processingTime
      };
    }
    
    // Llama models
    if (modelId.startsWith('meta.llama')) {
      const content = data.generation || '';
      return {
        content,
        role: 'assistant',
        model: modelId,
        promptTokens: data.prompt_token_count || 0,
        completionTokens: data.generation_token_count || 0,
        totalTokens: (data.prompt_token_count || 0) + (data.generation_token_count || 0),
        finishReason: data.stop_reason || 'stop',
        processingTime
      };
    }
    
    // Titan models
    if (modelId.startsWith('amazon.titan')) {
      const result = data.results?.[0];
      return {
        content: result?.outputText || '',
        role: 'assistant',
        model: modelId,
        promptTokens: data.inputTextTokenCount || 0,
        completionTokens: result?.tokenCount || 0,
        totalTokens: (data.inputTextTokenCount || 0) + (result?.tokenCount || 0),
        finishReason: result?.completionReason || 'stop',
        processingTime
      };
    }
    
    // Cohere models
    if (modelId.startsWith('cohere.')) {
      return {
        content: data.generations?.[0]?.text || '',
        role: 'assistant',
        model: modelId,
        promptTokens: 0, // Cohere doesn't provide token counts
        completionTokens: 0,
        totalTokens: 0,
        finishReason: data.generations?.[0]?.finish_reason || 'stop',
        processingTime
      };
    }
    
    // Default parsing
    return {
      content: data.text || data.output || data.generation || '',
      role: 'assistant',
      model: modelId,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      finishReason: 'stop',
      processingTime
    };
  }

  private parseStreamChunks(modelId: string, buffer: string): { parsed: any[], remaining: string } {
    const chunks: any[] = [];
    let remaining = buffer;
    
    // Different models use different streaming formats
    // This is a simplified implementation - actual format depends on model
    
    try {
      const lines = buffer.split('\n');
      remaining = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          const parsed = JSON.parse(line);
          chunks.push(this.extractChunkContent(modelId, parsed));
        }
      }
    } catch (error) {
      // Keep accumulating if we can't parse yet
    }
    
    return { parsed: chunks, remaining };
  }

  private extractChunkContent(modelId: string, chunk: any): any {
    // Claude models
    if (modelId.startsWith('anthropic.claude')) {
      return {
        content: chunk.delta?.text || '',
        inputTokens: chunk.amazon_bedrock_invocationMetrics?.inputTokenCount,
        outputTokens: chunk.amazon_bedrock_invocationMetrics?.outputTokenCount
      };
    }
    
    // Other models - simplified
    return {
      content: chunk.text || chunk.outputText || chunk.generation || ''
    };
  }

  private async makeRequest(
    method: string,
    path: string,
    body: any,
    signal?: AbortSignal
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers = await this.getSignedHeaders(method, path, body);
    
    return fetch(url, {
      method,
      headers,
      body: method !== 'GET' ? JSON.stringify(body) : undefined,
      signal
    });
  }

  private async getSignedHeaders(method: string, path: string, body: any): Promise<Record<string, string>> {
    // For now, use simple API key authentication if provided
    // In production, you'd use AWS Signature V4
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    } else if (this.config.accessKeyId && this.config.secretAccessKey) {
      // In a real implementation, you would:
      // 1. Calculate AWS Signature V4
      // 2. Add appropriate AWS headers
      // For now, we'll use a simplified approach
      headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}`;
      
      if (this.config.sessionToken) {
        headers['X-Amz-Security-Token'] = this.config.sessionToken;
      }
    }
    
    return headers;
  }

  private getCost(promptTokens: number, completionTokens: number, modelId: string): number {
    const model = this.models.find(m => m.id === modelId);
    if (!model) return 0;
    
    return (promptTokens / 1000) * (model.costPer1kInput || 0) +
           (completionTokens / 1000) * (model.costPer1kOutput || 0);
  }

  private estimateTokens(input: string | any[]): number {
    if (typeof input === 'string') {
      return Math.ceil(input.length / 4);
    }
    return input.reduce((sum, msg) => sum + Math.ceil(msg.content.length / 4), 0);
  }
}