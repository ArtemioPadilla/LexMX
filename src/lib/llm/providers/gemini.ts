// Google Gemini provider implementation

import type { CloudProvider, LLMRequest, LLMResponse, LLMModel, ProviderConfig } from '@/types/llm';
import { BaseLLMProvider } from '../base-provider';

export class GeminiProvider extends BaseLLMProvider implements CloudProvider {
  public readonly type = 'cloud' as const;
  public readonly icon = '/icons/google.svg';
  public readonly description = 'Gemini Pro - Cost-effective option with good multilingual support';
  public readonly costLevel = 'low' as const;
  public readonly capabilities = ['reasoning', 'multilingual', 'analysis'];
  public readonly apiEndpoint = 'https://generativelanguage.googleapis.com/v1beta';
  public readonly requiresApiKey = true;
  public readonly rateLimit = {
    requestsPerMinute: 60,
    requestsPerDay: 1500
  };

  public models: LLMModel[] = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Advanced model with long context for complex legal documents',
      contextLength: 2000000,
      maxTokens: 8192,
      costPer1kTokens: { input: 0.00125, output: 0.005 },
      capabilities: ['reasoning', 'analysis', 'multilingual'],
      recommended: true
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and cost-effective for most legal queries',
      contextLength: 1000000,
      maxTokens: 8192,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      capabilities: ['reasoning', 'multilingual'],
      recommended: true
    },
    {
      id: 'gemini-pro',
      name: 'Gemini Pro',
      description: 'Previous generation, good balance of performance and cost',
      contextLength: 32760,
      maxTokens: 4096,
      costPer1kTokens: { input: 0.0005, output: 0.0015 },
      capabilities: ['reasoning', 'multilingual']
    }
  ];

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('Google AI API key is required');
    }
    // Google AI keys typically start with 'AI'
    if (!this.config.apiKey.startsWith('AI')) {
      console.warn('Google AI API key format may be incorrect');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiEndpoint}/models?key=${this.config.apiKey}`, {
        signal: AbortSignal.timeout(5000)
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const testRequest: LLMRequest = {
        model: 'gemini-1.5-flash',
        messages: [
          { role: 'user', content: 'Test connection - respond with "OK"' }
        ],
        maxTokens: 10,
        temperature: 0
      };

      await this.generateResponse(testRequest);
      return true;
    } catch (error) {
      console.error('Gemini connection test failed:', error);
      return false;
    }
  }

  async generateResponse(request: LLMRequest): Promise<LLMResponse> {
    this.validateRequest(request);
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(
        `${this.apiEndpoint}/models/${request.model}:generateContent?key=${this.config.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'LexMX-Legal-Assistant/1.0'
          },
          body: JSON.stringify({
            contents: this.formatMessages(request.messages),
            generationConfig: {
              temperature: request.temperature ?? this.config.temperature ?? 0.1,
              maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 4000,
              topP: 0.95,
              topK: 40
            },
            systemInstruction: request.systemPrompt ? {
              parts: [{ text: request.systemPrompt }]
            } : undefined,
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_ONLY_HIGH'
              }
            ]
          }),
          signal: AbortSignal.timeout(60000) // 60 second timeout
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${response.status} - ${error.error?.message || response.statusText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Check for safety blocks
      if (data.candidates?.[0]?.finishReason === 'SAFETY') {
        throw new Error('Response blocked by Gemini safety filters');
      }

      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Gemini doesn't always provide token usage, so we estimate
      const usage = data.usageMetadata || this.estimateUsage(request, content);

      const llmResponse = this.createBaseResponse(
        request,
        content,
        usage,
        latency
      );

      // Add Gemini-specific metadata
      llmResponse.metadata = {
        ...llmResponse.metadata,
        finishReason: data.candidates?.[0]?.finishReason,
        safetyRatings: data.candidates?.[0]?.safetyRatings
      };

      this.updateMetrics(llmResponse, true);
      return llmResponse;

    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      // Create error response for metrics
      const errorResponse = this.createBaseResponse(request, '', { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 }, latency);
      this.updateMetrics(errorResponse, false);
      
      this.handleError(error, request);
    }
  }

  estimateCost(request: LLMRequest): number {
    const model = this.models.find(m => m.id === request.model);
    if (!model || !model.costPer1kTokens) return 0;

    // Estimate input tokens (rough approximation: 1 token ≈ 4 characters)
    const inputText = request.messages.map(m => m.content).join(' ');
    const systemPrompt = request.systemPrompt || '';
    const totalInputText = inputText + systemPrompt;
    const estimatedInputTokens = Math.ceil(totalInputText.length / 4);
    
    // Estimate output tokens
    const estimatedOutputTokens = request.maxTokens ?? this.config.maxTokens ?? 1000;

    return this.calculateTokenCost({
      promptTokens: estimatedInputTokens,
      completionTokens: estimatedOutputTokens
    }, model);
  }

  private formatMessages(messages: any[]): any[] {
    // Convert to Gemini format
    const contents = [];
    
    for (const msg of messages) {
      if (msg.role === 'system') continue; // System handled separately
      
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }]
      });
    }

    return contents;
  }

  private estimateUsage(request: LLMRequest, content: string): any {
    // Estimate tokens when Gemini doesn't provide usage data
    const inputText = request.messages.map(m => m.content).join(' ');
    const promptTokens = Math.ceil(inputText.length / 4);
    const completionTokens = Math.ceil(content.length / 4);
    
    return {
      promptTokenCount: promptTokens,
      candidatesTokenCount: completionTokens,
      totalTokenCount: promptTokens + completionTokens,
      // Map to standard format
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens
    };
  }

  // Gemini-specific methods
  async listModels(): Promise<LLMModel[]> {
    try {
      const response = await fetch(`${this.apiEndpoint}/models?key=${this.config.apiKey}`);
      
      if (!response.ok) return this.models;

      const data = await response.json();
      
      // Filter to generation models
      const generationModels = data.models?.filter((model: any) => 
        model.name.includes('gemini') && 
        model.supportedGenerationMethods?.includes('generateContent')
      ) || [];

      return this.models.filter(model => 
        generationModels.some((apiModel: any) => 
          apiModel.name.includes(model.id)
        )
      );
    } catch {
      return this.models;
    }
  }

  // Legal-specific optimizations for Gemini
  createLegalSystemPrompt(legalArea?: string): string {
    const basePrompt = `Eres un asistente especializado en derecho mexicano. Tu función es proporcionar información legal precisa sobre el sistema jurídico de México.

DIRECTRICES PRINCIPALES:
1. FUENTES LEGALES VÁLIDAS:
   - Constitución Política de los Estados Unidos Mexicanos
   - Códigos federales mexicanos (Civil, Penal, Fiscal, etc.)
   - Leyes federales vigentes de México
   - Jurisprudencia de la Suprema Corte de Justicia de la Nación

2. FORMATO DE RESPUESTA:
   - Respuesta clara y estructurada
   - Citas específicas de artículos legales
   - Referencias a jurisprudencia cuando sea relevante
   - Procedimientos explicados paso a paso

3. RESPONSABILIDAD PROFESIONAL:
   - SIEMPRE incluye advertencia sobre asesoría legal profesional
   - Indica cuando la información puede requerir verificación
   - No proporciones consejos para casos específicos
   - Distingue entre información general y asesoría especializada

4. CONTEXTO MEXICANO:
   - Respeta la jerarquía normativa mexicana
   - Considera el federalismo mexicano
   - Incluye aspectos culturales y sociales del derecho mexicano`;

    if (legalArea) {
      const areaPrompts = {
        'constitutional': '\n\nENFOQUE ESPECIALIZADO: Derecho Constitucional y Amparo en México.',
        'civil': '\n\nENFOQUE ESPECIALIZADO: Derecho Civil mexicano, contratos y responsabilidad civil.',
        'criminal': '\n\nENFOQUE ESPECIALIZADO: Derecho Penal mexicano y sistema de justicia penal.',
        'labor': '\n\nENFOQUE ESPECIALIZADO: Derecho Laboral y Ley Federal del Trabajo.',
        'tax': '\n\nENFOQUE ESPECIALIZADO: Derecho Fiscal mexicano y obligaciones tributarias.',
        'commercial': '\n\nENFOQUE ESPECIALIZADO: Derecho Mercantil y sociedades en México.'
      };

      return basePrompt + (areaPrompts[legalArea as keyof typeof areaPrompts] || '');
    }

    return basePrompt;
  }

  // Gemini excels at multilingual legal analysis
  async analyzeMultilingualLegal(query: string, targetLang: 'es' | 'en' = 'es'): Promise<string> {
    const systemPrompt = `Analiza la consulta legal considerando tanto el derecho mexicano como referencias internacionales relevantes.

${targetLang === 'en' ? 
  'Provide the response in English, but always reference Mexican legal sources.' :
  'Proporciona la respuesta en español, incluyendo referencias legales mexicanas.'
}

Incluye comparaciones con sistemas legales internacionales cuando sea útil para el contexto mexicano.`;

    const request: LLMRequest = {
      model: 'gemini-1.5-pro', // Use Pro model for complex multilingual analysis
      messages: [{ role: 'user', content: query }],
      systemPrompt,
      maxTokens: 4000,
      temperature: 0.1
    };

    const response = await this.generateResponse(request);
    return response.content;
  }
}

export default GeminiProvider;