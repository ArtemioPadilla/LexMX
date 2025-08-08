// OpenAI-compatible API provider for local LLMs (LM Studio, vLLM, etc.)

import type { LocalProvider, LLMRequest, LLMResponse, LocalModel, ProviderConfig } from '@/types/llm';
import { BaseLLMProvider } from '../base-provider';

export class OpenAICompatibleProvider extends BaseLLMProvider implements LocalProvider {
  public readonly type = 'local' as const;
  public readonly icon = '/icons/local-api.svg';
  public readonly description = 'Connect to LM Studio, vLLM, or other OpenAI-compatible local APIs';
  public readonly costLevel = 'free' as const;
  public readonly capabilities = ['privacy', 'customizable', 'offline'];
  public readonly endpoint: string;
  public discoveredModels: LocalModel[] = [];

  // Common models that work with OpenAI-compatible APIs
  public models: LocalModel[] = [];

  constructor(config: ProviderConfig) {
    super(config);
    this.endpoint = config.endpoint || 'http://localhost:1234';
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.endpoint) {
      throw new Error('API endpoint is required');
    }
    
    try {
      new URL(this.config.endpoint);
    } catch {
      throw new Error('Invalid API endpoint URL');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Try models endpoint first
      const response = await fetch(`${this.endpoint}/v1/models`, {
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch {
      // If models endpoint fails, try a simple completion
      try {
        const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            model: 'test',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          }),
          signal: AbortSignal.timeout(5000)
        });
        
        // Even if it fails, a 400 with valid error format means API is available
        return response.status !== 404;
      } catch {
        return false;
      }
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // First discover models
      await this.discoverModels();
      
      if (this.discoveredModels.length === 0) {
        return false; // No models available
      }

      // Test with the first available model
      const testRequest: LLMRequest = {
        model: this.discoveredModels[0].id,
        messages: [
          { role: 'user', content: 'Test connection - respond with "OK"' }
        ],
        maxTokens: 10,
        temperature: 0
      };

      await this.generateResponse(testRequest);
      return true;
    } catch (error) {
      console.error('OpenAI-compatible API connection test failed:', error);
      return false;
    }
  }

  async discoverModels(): Promise<LocalModel[]> {
    try {
      const response = await fetch(`${this.endpoint}/v1/models`, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      
      this.discoveredModels = data.data?.map((model: any) => ({
        id: model.id,
        name: model.id,
        description: this.inferModelDescription(model.id),
        contextLength: this.inferContextLength(model.id),
        maxTokens: 4096,
        size: 'Unknown',
        capabilities: this.inferCapabilities(model.id),
        installedLocally: true,
        recommended: this.isRecommendedForLegal(model.id)
      })) || [];

      // Update our models list
      this.models = this.discoveredModels;

      return this.discoveredModels;
    } catch (error) {
      console.error('Failed to discover models:', error);
      return [];
    }
  }

  async installModel(modelId: string): Promise<boolean> {
    // OpenAI-compatible APIs typically don't support model installation
    // This would need to be done externally (e.g., in LM Studio)
    console.warn('Model installation not supported for OpenAI-compatible APIs');
    return false;
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.endpoint}/v1/chat/completions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model: request.model,
          messages: this.formatMessages(request.messages, request.systemPrompt),
          temperature: request.temperature ?? this.config.temperature ?? 0.1,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 2000,
          top_p: request.topP ?? 0.9,
          frequency_penalty: request.frequencyPenalty ?? 0,
          presence_penalty: request.presencePenalty ?? 0,
          stream: false
        }),
        signal: request.abortSignal || AbortSignal.timeout(120000) // Use abort signal or 2 minute timeout
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const content = data.choices?.[0]?.message?.content || '';
      const usage = data.usage || this.estimateTokenUsage(request, content);

      const llmResponse = this.createBaseResponse(
        request,
        content,
        usage,
        latency
      );

      // Add API-specific metadata
      llmResponse.metadata = {
        ...llmResponse.metadata,
        finishReason: data.choices?.[0]?.finish_reason,
        model: data.model
      };

      this.updateMetrics(llmResponse, true);
      return llmResponse;

    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      // Create error response for metrics
      const errorResponse = this.createBaseResponse(
        request, 
        '', 
        { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, 
        latency
      );
      this.updateMetrics(errorResponse, false);
      
      this.handleError(error, request);
    }
  }

  estimateCost(request: LLMRequest): number {
    // Local APIs are free to use
    return 0;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'LexMX-Legal-Assistant/1.0'
    };

    // Add API key if provided (some local APIs may require it)
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private formatMessages(messages: any[], systemPrompt?: string): any[] {
    const formatted = [];

    // Add system message if provided
    if (systemPrompt) {
      formatted.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add user and assistant messages
    for (const message of messages) {
      if (message.role !== 'system') {
        formatted.push({
          role: message.role,
          content: message.content
        });
      }
    }

    return formatted;
  }

  private estimateTokenUsage(request: LLMRequest, response: string): any {
    // Rough token estimation (1 token ≈ 4 characters)
    const promptText = request.messages.map(m => m.content).join(' ');
    const systemPrompt = request.systemPrompt || '';
    const totalPrompt = promptText + systemPrompt;
    
    const promptTokens = Math.ceil(totalPrompt.length / 4);
    const completionTokens = Math.ceil(response.length / 4);
    
    return {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };
  }

  private inferModelDescription(modelName: string): string {
    const name = modelName.toLowerCase();
    
    if (name.includes('llama') && name.includes('70b')) {
      return 'Large Llama model - Excellent for complex legal reasoning';
    }
    if (name.includes('llama') && name.includes('13b')) {
      return 'Medium Llama model - Good balance of speed and quality';
    }
    if (name.includes('llama') && name.includes('7b')) {
      return 'Small Llama model - Fast responses for simple queries';
    }
    if (name.includes('mistral')) {
      return 'Mistral model - Efficient and capable';
    }
    if (name.includes('codellama')) {
      return 'Code Llama - Good for structured reasoning';
    }
    if (name.includes('hermes')) {
      return 'Hermes model - Excellent instruction following';
    }
    if (name.includes('mixtral')) {
      return 'Mixtral model - Mixture of experts architecture';
    }
    
    return 'Local language model';
  }

  private inferContextLength(modelName: string): number {
    const name = modelName.toLowerCase();
    
    if (name.includes('llama3') || name.includes('llama-3')) {
      return 128000; // Llama 3 models typically have 128k context
    }
    if (name.includes('mistral') && name.includes('7b')) {
      return 32768; // Mistral 7B has 32k context
    }
    if (name.includes('codellama')) {
      return 16384; // Code Llama typically 16k
    }
    
    return 4096; // Conservative default
  }

  private inferCapabilities(modelName: string): string[] {
    const name = modelName.toLowerCase();
    const capabilities = ['reasoning'];
    
    if (name.includes('llama') || name.includes('mistral')) {
      capabilities.push('multilingual');
    }
    if (name.includes('70b') || name.includes('mixtral')) {
      capabilities.push('analysis');
    }
    if (name.includes('codellama')) {
      capabilities.push('analysis');
    }
    
    return capabilities;
  }

  private isRecommendedForLegal(modelName: string): boolean {
    const name = modelName.toLowerCase();
    
    // Recommend larger models for legal work
    return name.includes('70b') || 
           name.includes('mixtral') || 
           (name.includes('hermes') && !name.includes('7b'));
  }

  // OpenAI-compatible API specific methods
  async getServerInfo(): Promise<any> {
    try {
      // Try to get server information (not standard OpenAI API)
      const response = await fetch(`${this.endpoint}/v1/models`, {
        headers: this.getHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        return {
          available: true,
          modelCount: data.data?.length || 0,
          endpoint: this.endpoint
        };
      }
      
      return { available: false };
    } catch {
      return { available: false };
    }
  }

  // Legal-specific optimizations
  createLegalSystemPrompt(legalArea?: string): string {
    const basePrompt = `You are a legal assistant specialized in Mexican law. Provide accurate legal information based on:

- Constitución Política de los Estados Unidos Mexicanos
- Mexican federal codes and laws
- Supreme Court of Justice jurisprudence
- Current Mexican legislation

INSTRUCTIONS:
1. Always cite specific articles and legal sources
2. Include jurisprudence references when relevant
3. ALWAYS warn that this is not professional legal advice
4. Recommend verifying information currency
5. Use clear but technically precise language

FORMAT:
- Direct and structured response
- Specific legal foundation
- Step-by-step procedures when applicable
- Professional consultation recommendations

RESPOND IN SPANISH unless specifically requested otherwise.`;

    if (legalArea) {
      const areaPrompts = {
        'constitutional': '\n\nSPECIALIZE in Mexican constitutional law, individual guarantees, and amparo proceedings.',
        'civil': '\n\nSPECIALIZE in Mexican civil law, contracts, civil liability, and property.',
        'criminal': '\n\nSPECIALIZE in Mexican criminal law, accusatory system, and due process.',
        'labor': '\n\nSPECIALIZE in Mexican labor law, Federal Labor Law, and social security.',
        'tax': '\n\nSPECIALIZE in Mexican tax law, tax obligations, and fiscal procedures.'
      };

      return basePrompt + (areaPrompts[legalArea as keyof typeof areaPrompts] || '');
    }

    return basePrompt;
  }

  // Detect common local LLM setups
  static detectCommonSetups(): { name: string; endpoint: string; description: string }[] {
    return [
      {
        name: 'LM Studio',
        endpoint: 'http://localhost:1234',
        description: 'Default LM Studio local server'
      },
      {
        name: 'vLLM',
        endpoint: 'http://localhost:8000',
        description: 'vLLM inference server'
      },
      {
        name: 'Text Generation WebUI',
        endpoint: 'http://localhost:5000',
        description: 'oobabooga text-generation-webui API'
      },
      {
        name: 'FastChat',
        endpoint: 'http://localhost:8001',
        description: 'FastChat OpenAI-compatible API'
      },
      {
        name: 'llama.cpp Server',
        endpoint: 'http://localhost:8080',
        description: 'llama.cpp built-in server'
      }
    ];
  }
}

export default OpenAICompatibleProvider;