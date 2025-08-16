// Anthropic Claude provider implementation

import type { CloudProvider, LLMRequest, LLMResponse, LLMModel, ProviderConfig, ChatMessage } from '@/types/llm';
import type { LegalArea } from '@/types/legal';
import type { ErrorWithCode } from '@/types/common';
import { BaseLLMProvider } from '../base-provider';
import { promptBuilder } from '../prompt-builder';
import { i18n } from '@/i18n';

export class ClaudeProvider extends BaseLLMProvider implements CloudProvider {
  public readonly type = 'cloud' as const;
  public readonly icon = '/icons/anthropic.svg';
  public readonly description = 'Claude 3.5 Sonnet - Superior legal reasoning and ethical considerations';
  public readonly costLevel = 'medium' as const;
  public readonly capabilities = ['reasoning', 'ethics', 'analysis', 'citations'];
  public readonly apiEndpoint = 'https://api.anthropic.com/v1';
  public readonly requiresApiKey = true;
  public readonly rateLimit = {
    requestsPerMinute: 1000,
    requestsPerDay: 5000
  };

  public models: LLMModel[] = [
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      description: 'Most advanced model, excellent for complex legal reasoning',
      contextLength: 200000,
      maxTokens: 8192,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      capabilities: ['reasoning', 'ethics', 'analysis', 'citations'],
      recommended: true
    },
    {
      id: 'claude-3-sonnet-20240229',
      name: 'Claude 3 Sonnet',
      description: 'Balanced performance for most legal tasks',
      contextLength: 200000,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.003, output: 0.015 },
      capabilities: ['reasoning', 'ethics', 'analysis', 'citations'],
      recommended: true
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      description: 'Fast and cost-effective for simpler legal queries',
      contextLength: 200000,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.00025, output: 0.00125 },
      capabilities: ['reasoning', 'ethics']
    }
  ];

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key is required');
    }
    if (!this.config.apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid Anthropic API key format');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Claude doesn't have a models endpoint, so we test with a minimal request
      const response = await fetch(`${this.apiEndpoint}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey!,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }]
        }),
        signal: AbortSignal.timeout(5000)
      });
      
      // Even if it fails, a 400 with valid error format means API is available
      return response.status !== 401 && response.status !== 403;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        model: 'claude-3-haiku-20240307',
        messages: [
          { role: 'user', content: 'Test connection - respond with "OK"' }
        ],
        maxTokens: 10,
        temperature: 0
      };

      await this.generateResponse(testRequest);
      return true;
    } catch (error) {
      console.error('Claude connection test failed:', error);
      return false;
    }
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(`${this.apiEndpoint}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey!,
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'User-Agent': 'LexMX-Legal-Assistant/1.0'
        },
        body: JSON.stringify({
          model: request.model,
          max_tokens: request.maxTokens ?? this.config.maxTokens ?? 4000,
          temperature: request.temperature ?? this.config.temperature ?? 0.1,
          messages: this.formatMessages(request.messages),
          system: request.systemPrompt || promptBuilder.buildSystemPrompt({ language: i18n.language, provider: 'claude' })
        }),
        signal: AbortSignal.timeout(60000) // 60 second timeout
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Claude API error: ${response.status} - ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Claude returns content as an array
      const content = data.content[0]?.text || '';

      const llmResponse = this.createBaseResponse(
        request,
        content,
        data.usage,
        latency
      );

      // Add Claude-specific metadata
      llmResponse.metadata = {
        ...llmResponse.metadata,
        stopReason: data.stop_reason,
        model: data.model
      };

      this.updateMetrics(llmResponse, true);
      return llmResponse;

    } catch (error: unknown) {
      const latency = Date.now() - startTime;
      
      // Create error response for metrics
      const errorResponse = this.createBaseResponse(request, '', { input_tokens: 0, output_tokens: 0 }, latency);
      this.updateMetrics(errorResponse, false);
      
      this.handleError(error as ErrorWithCode, request);
    }
  }

  estimateCost(request: LLMRequest): number {
    const model = this.models.find(m => m.id === request.model);
    if (!model || !model.costPer1kTokens) return 0;

    // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
    const inputText = request.messages.map(m => m.content).join(' ');
    const systemPrompt = request.systemPrompt || promptBuilder.buildSystemPrompt({ language: i18n.language, provider: 'claude' });
    const totalInputText = inputText + systemPrompt;
    const estimatedInputTokens = Math.ceil(totalInputText.length / 4);
    
    // Estimate output tokens
    const estimatedOutputTokens = request.maxTokens ?? this.config.maxTokens ?? 1000;

    return this.calculateTokenCost({
      promptTokens: estimatedInputTokens,
      completionTokens: estimatedOutputTokens
    }, model);
  }

  private formatMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    // Claude expects alternating user/assistant messages
    const formatted = [];
    let lastRole = null;

    for (const msg of messages) {
      if (msg.role === 'system') continue; // System messages handled separately
      
      if (msg.role === lastRole) {
        // Merge consecutive messages from same role
        const lastMsg = formatted[formatted.length - 1];
        lastMsg.content += '\n\n' + msg.content;
      } else {
        formatted.push({
          role: msg.role,
          content: msg.content
        });
        lastRole = msg.role;
      }
    }

    // Ensure we start with user message
    if (formatted.length > 0 && formatted[0].role !== 'user') {
      formatted.unshift({ role: 'user', content: 'Por favor, responde a la siguiente consulta legal:' });
    }

    return formatted;
  }

  // Claude-specific methods
  async checkUsage(): Promise<{ dailyUsage: number; monthlyUsage: number }> {
    // Anthropic doesn't provide usage API, so we track locally
    const metrics = this.getMetrics();
    return {
      dailyUsage: metrics.totalCost,
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
      provider: 'claude',
      includeSpecialization: true
    });
  }

  // Claude excels at constitutional analysis
  async analyzeConstitutionality(query: string, article?: string): Promise<string> {
    const systemPrompt = `Especialízate en análisis de constitucionalidad conforme al derecho mexicano. 

Analiza la consulta considerando:
1. Principios constitucionales relevantes
2. Jurisprudencia de la SCJN sobre el tema
3. Derechos fundamentales involucrados
4. Control de convencionalidad si aplica
5. Precedentes relevantes

${article ? `Enfócate especialmente en el ${article} constitucional.` : ''}`;

    const request: LLMRequest = {
      model: this.models[0].id, // Use best model for constitutional analysis
      messages: [{ role: 'user', content: query }],
      systemPrompt,
      maxTokens: 4000,
      temperature: 0.1
    };

    const response = await this.generateResponse(request);
    return response.content;
  }
}

export default ClaudeProvider;