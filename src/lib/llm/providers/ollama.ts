// Ollama local LLM provider implementation

import type { LocalProvider, LLMRequest, LLMResponse, LocalModel, ProviderConfig } from '@/types/llm';
import type { LegalArea } from '@/types/legal';
import { BaseLLMProvider } from '../base-provider';
import { promptBuilder } from '../prompt-builder';
import { i18n } from '@/i18n';

export class OllamaProvider extends BaseLLMProvider implements LocalProvider {
  public readonly type = 'local' as const;
  public readonly icon = '/icons/ollama.svg';
  public readonly description = 'Run models locally - Complete privacy, no API costs, works offline';
  public readonly costLevel = 'free' as const;
  public readonly capabilities = ['privacy', 'offline', 'customizable'];
  public readonly endpoint: string;
  public discoveredModels: LocalModel[] = [];

  // Default Ollama models that work well for legal tasks
  public models: LocalModel[] = [
    {
      id: 'llama3.1:70b',
      name: 'Llama 3.1 70B',
      description: 'Large model with excellent reasoning capabilities',
      contextLength: 128000,
      maxTokens: 4096,
      size: '40GB',
      capabilities: ['reasoning', 'analysis', 'multilingual'],
      installedLocally: false,
      recommended: true
    },
    {
      id: 'llama3.1:8b',
      name: 'Llama 3.1 8B',
      description: 'Balanced model good for most legal queries',
      contextLength: 128000,
      maxTokens: 4096,
      size: '4.7GB',
      capabilities: ['reasoning', 'multilingual'],
      installedLocally: false,
      recommended: true
    },
    {
      id: 'mistral:7b',
      name: 'Mistral 7B',
      description: 'Fast and efficient for simple legal questions',
      contextLength: 32768,
      maxTokens: 4096,
      size: '4.1GB',
      capabilities: ['reasoning'],
      installedLocally: false
    },
    {
      id: 'codellama:13b',
      name: 'Code Llama 13B',
      description: 'Good for legal code analysis and structured reasoning',
      contextLength: 16384,
      maxTokens: 4096,
      size: '7.3GB',
      capabilities: ['reasoning', 'analysis'],
      installedLocally: false
    },
    {
      id: 'nous-hermes2:latest',
      name: 'Nous Hermes 2',
      description: 'Excellent instruction following for legal queries',
      contextLength: 4096,
      maxTokens: 2048,
      size: '4.1GB',
      capabilities: ['reasoning'],
      installedLocally: false,
      recommended: true
    }
  ];

  constructor(config: ProviderConfig) {
    super(config);
    this.endpoint = config.endpoint || 'http://localhost:11434';
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.endpoint) {
      throw new Error('Ollama endpoint is required');
    }
    
    try {
      new URL(this.config.endpoint);
    } catch {
      throw new Error('Invalid Ollama endpoint URL');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`, {
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      // First check if Ollama is running
      if (!await this.isAvailable()) {
        return false;
      }

      // Try to discover models
      const models = await this.discoverModels();
      
      if (models.length === 0) {
        return false; // No models installed
      }

      // Test with the first available model
      const testRequest: LLMRequest = {
        model: models[0].id,
        messages: [
          { role: 'user', content: 'Test - respond with "OK"' }
        ],
        maxTokens: 10,
        temperature: 0
      };

      await this.generateResponse(testRequest);
      return true;
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return false;
    }
  }

  async discoverModels(): Promise<LocalModel[]> {
    try {
      const response = await fetch(`${this.endpoint}/api/tags`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch models: ${response.statusText}`);
      }

      const data = await response.json();
      
      this.discoveredModels = data.models?.map((model: any) => {
        // Find matching model in our predefined list
        const knownModel = this.models.find(m => 
          model.name.includes(m.id.split(':')[0])
        );

        return {
          id: model.name,
          name: model.name,
          description: knownModel?.description || 'Local Ollama model',
          contextLength: knownModel?.contextLength || 4096,
          maxTokens: knownModel?.maxTokens || 2048,
          size: this.formatSize(model.size),
          capabilities: knownModel?.capabilities || ['reasoning'],
          installedLocally: true,
          recommended: knownModel?.recommended || false
        };
      }) || [];

      // Update our models list with installation status
      this.models = this.models.map(model => ({
        ...model,
        installedLocally: this.discoveredModels.some(dm => 
          dm.id.includes(model.id.split(':')[0])
        )
      }));

      return this.discoveredModels;
    } catch (error) {
      console.error('Failed to discover Ollama models:', error);
      return [];
    }
  }

  async installModel(modelId: string): Promise<boolean> {
    try {
      // Start model pull
      const response = await fetch(`${this.endpoint}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: modelId,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to install model: ${response.statusText}`);
      }

      // Refresh discovered models
      await this.discoverModels();
      
      return true;
    } catch (error) {
      console.error(`Failed to install model ${modelId}:`, error);
      return false;
    }
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.endpoint}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: request.model,
          prompt: this.formatPrompt(request.messages, request.systemPrompt),
          options: {
            temperature: request.temperature ?? this.config.temperature ?? 0.1,
            num_predict: request.maxTokens ?? this.config.maxTokens ?? 2000,
            top_p: 0.9,
            repeat_penalty: 1.1
          },
          stream: false
        }),
        signal: AbortSignal.timeout(120000) // 2 minute timeout for local models
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Ollama API error: ${response.status} - ${error.error || response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Ollama doesn't provide detailed token usage, so we estimate
      const usage = this.estimateTokenUsage(request, data.response || '');

      const llmResponse = this.createBaseResponse(
        request,
        data.response || '',
        usage,
        latency
      );

      // Add Ollama-specific metadata
      llmResponse.metadata = {
        ...llmResponse.metadata,
        totalDuration: data.total_duration,
        loadDuration: data.load_duration,
        evalCount: data.eval_count,
        evalDuration: data.eval_duration
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

  estimateCost(_request: LLMRequest): number {
    // Ollama is free to use locally
    return 0;
  }

  private formatPrompt(messages: any[], systemPrompt?: string): string {
    // Convert chat messages to a single prompt
    let prompt = '';
    
    if (systemPrompt) {
      prompt += `Sistema: ${systemPrompt}\n\n`;
    }

    for (const message of messages) {
      const role = message.role === 'user' ? 'Usuario' : 
                   message.role === 'assistant' ? 'Asistente' : 
                   'Sistema';
      prompt += `${role}: ${message.content}\n\n`;
    }

    prompt += 'Asistente: ';
    return prompt;
  }

  private estimateTokenUsage(request: LLMRequest, response: string): any {
    // Rough token estimation for Ollama (1 token ≈ 4 characters)
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

  private formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)}${units[unitIndex]}`;
  }

  // Ollama-specific methods
  async getModelInfo(modelId: string): Promise<any> {
    try {
      const response = await fetch(`${this.endpoint}/api/show`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelId })
      });

      if (!response.ok) return null;

      return await response.json();
    } catch {
      return null;
    }
  }

  async deleteModel(modelId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/api/delete`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: modelId })
      });

      if (response.ok) {
        // Refresh discovered models
        await this.discoverModels();
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  }

  // Get legal system prompt using the centralized prompt builder
  getLegalSystemPrompt(legalArea?: string): string {
    // Validate and cast to LegalArea type
    const legalAreaTyped = legalArea as LegalArea | undefined;

    return promptBuilder.buildSystemPrompt({
      language: i18n.language,
      legalArea: legalAreaTyped,
      provider: 'ollama',
      includeSpecialization: true
    });
  }

  // Recommend best local models for legal work
  getRecommendedModels(): LocalModel[] {
    return this.models
      .filter(model => model.recommended)
      .sort((a, b) => {
        // Sort by size (larger models first for better quality)
        const sizeA = parseFloat(a.size);
        const sizeB = parseFloat(b.size);
        return sizeB - sizeA;
      });
  }

  // Check system requirements for models
  checkSystemRequirements(modelId: string): { canRun: boolean; warnings: string[] } {
    const model = this.models.find(m => m.id === modelId);
    if (!model) return { canRun: false, warnings: ['Model not found'] };

    const warnings: string[] = [];
    let canRun = true;

    // Estimate RAM requirements (rough approximation)
    const sizeGB = parseFloat(model.size);
    const ramNeeded = sizeGB * 1.5; // Models need ~1.5x their size in RAM

    // Check available memory (if possible)
    if (navigator.deviceMemory && navigator.deviceMemory < ramNeeded) {
      warnings.push(`Model may require ${ramNeeded}GB RAM, but only ${navigator.deviceMemory}GB detected`);
      canRun = false;
    }

    // Warn about large models
    if (sizeGB > 10) {
      warnings.push('Large model - ensure sufficient RAM and fast storage');
    }

    if (sizeGB > 30) {
      warnings.push('Very large model - may be slow on consumer hardware');
    }

    return { canRun, warnings };
  }
}

export default OllamaProvider;