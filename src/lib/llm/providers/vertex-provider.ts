// Google Cloud Vertex AI provider implementation
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

interface VertexAIRequest {
  contents: Array<{
    role: string;
    parts: Array<{ text: string }>;
  }>;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    topP?: number;
    topK?: number;
    stopSequences?: string[];
  };
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}

export class VertexProvider implements LLMProvider {
  readonly id: string = 'vertex';
  readonly name: string = 'Google Cloud Vertex AI';
  readonly type: LLMProviderType = 'cloud';
  readonly icon: string = '🌐';
  readonly description: string = 'Google Cloud AI models including Gemini and PaLM';
  readonly costLevel: CostLevel = 'medium';
  readonly capabilities: LLMCapability[] = ['reasoning', 'analysis', 'multilingual', 'ethics'];
  
  models: LLMModel[] = [
    {
      id: 'gemini-1.5-pro',
      name: 'Gemini 1.5 Pro',
      description: 'Most capable model with 1M token context window',
      contextLength: 1048576,
      maxTokens: 8192,
      costPer1kTokens: { input: 0.00125, output: 0.00375 },
      capabilities: ['reasoning', 'analysis', 'multilingual', 'ethics'],
      recommended: true
    },
    {
      id: 'gemini-1.5-flash',
      name: 'Gemini 1.5 Flash',
      description: 'Fast and efficient for high-volume tasks',
      contextLength: 1048576,
      maxTokens: 8192,
      costPer1kTokens: { input: 0.000075, output: 0.0003 },
      capabilities: ['reasoning', 'analysis', 'multilingual'],
      recommended: false
    },
    {
      id: 'gemini-1.0-pro',
      name: 'Gemini 1.0 Pro',
      description: 'Balanced performance and cost',
      contextLength: 32768,
      maxTokens: 8192,
      costPer1kTokens: { input: 0.0005, output: 0.0015 },
      capabilities: ['reasoning', 'analysis'],
      recommended: false
    }
  ];
  
  status: ProviderStatus = 'disconnected';
  
  private config: ProviderConfig;
  private baseUrl: string;
  private metrics: ProviderMetrics = {
    providerId: 'vertex',
    totalRequests: 0,
    successRate: 1.0,
    averageLatency: 0,
    totalCost: 0,
    lastUsed: Date.now()
  };
  private accessToken?: string;
  private tokenExpiry?: number;

  constructor(config: ProviderConfig) {
    this.config = config;
    const projectId = config.gcpProjectId || 'your-project';
    const location = config.gcpLocation || 'us-central1';
    this.baseUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}`;
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
    const model = request.model || this.config.model || 'gemini-1.0-pro';
    const estimatedPromptTokens = request.messages.reduce((sum, msg) => sum + msg.content.length / 4, 0);
    const estimatedCompletionTokens = request.maxTokens || 1000;
    return this.getCost(estimatedPromptTokens, estimatedCompletionTokens, model);
  }

  getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  private async getAccessToken(): Promise<string> {
    // Check if we have a valid token
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Parse service account key
    let serviceAccount;
    try {
      serviceAccount = typeof this.config.gcpServiceAccountKey === 'string' 
        ? JSON.parse(this.config.gcpServiceAccountKey)
        : this.config.gcpServiceAccountKey;
    } catch (error) {
      throw new Error('Invalid service account key format');
    }

    if (!serviceAccount || !serviceAccount.private_key || !serviceAccount.client_email) {
      throw new Error('Service account key missing required fields');
    }

    // Create JWT for authentication
    const jwt = await this.createJWT(serviceAccount);
    
    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    // Set expiry to 5 minutes before actual expiry for safety
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    
    return this.accessToken;
  }

  private async createJWT(serviceAccount: any): Promise<string> {
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600
    };

    // Base64url encode header and payload
    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    
    // For simplicity in browser environment, we'll require the API key approach
    // In production, you'd use a proper JWT library or server-side signing
    throw new Error('JWT signing requires server-side implementation. Please use API key authentication or deploy server-side proxy.');
  }

  private convertToVertexFormat(messages: any[]): VertexAIRequest {
    const contents = messages.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Merge system prompt into first user message if present
    const systemMessage = messages.find(m => m.role === 'system');
    if (systemMessage && contents.length > 0) {
      contents[0].parts[0].text = `${systemMessage.content}\n\n${contents[0].parts[0].text}`;
    }

    return {
      contents: contents.filter(c => c.role !== 'system')
    };
  }

  private async complete(request: LLMRequest): Promise<any> {
    const startTime = Date.now();
    
    try {
      const model = request.model || this.config.model || 'gemini-1.0-pro';
      const url = `${this.baseUrl}/publishers/google/models/${model}:generateContent`;
      
      // Convert messages to Vertex AI format
      const vertexRequest: VertexAIRequest = this.convertToVertexFormat(request.messages);
      
      // Add generation config
      vertexRequest.generationConfig = {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens,
        topP: request.topP,
        stopSequences: request.stop
      };
      
      // Add safety settings (permissive for legal content)
      vertexRequest.safetySettings = [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }
      ];

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Use API key or OAuth token
      if (this.config.apiKey) {
        // API key authentication
        headers['x-goog-api-key'] = this.config.apiKey;
      } else if (this.config.gcpServiceAccountKey) {
        // Service account authentication
        const token = await this.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        throw new Error('No authentication method configured for Vertex AI');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: request.abortSignal,
        body: JSON.stringify(vertexRequest)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Vertex AI API error: ${response.status}`);
      }

      const data = await response.json();
      const candidate = data.candidates?.[0];
      
      if (!candidate || !candidate.content) {
        throw new Error('No valid response from Vertex AI');
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
        finishReason: candidate.finishReason || 'stop',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Vertex AI provider error:', error);
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
      const model = request.model || this.config.model || 'gemini-1.0-pro';
      const url = `${this.baseUrl}/publishers/google/models/${model}:streamGenerateContent`;
      
      // Convert messages to Vertex AI format
      const vertexRequest: VertexAIRequest = this.convertToVertexFormat(request.messages);
      
      // Add generation config
      vertexRequest.generationConfig = {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens,
        topP: request.topP,
        stopSequences: request.stop
      };
      
      // Add safety settings
      vertexRequest.safetySettings = [
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' }
      ];

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Use API key or OAuth token
      if (this.config.apiKey) {
        headers['x-goog-api-key'] = this.config.apiKey;
      } else if (this.config.gcpServiceAccountKey) {
        const token = await this.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        throw new Error('No authentication method configured for Vertex AI');
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        signal: request.abortSignal,
        body: JSON.stringify(vertexRequest)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
        throw new Error(error.error?.message || `Vertex AI API error: ${response.status}`);
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
        
        // Vertex AI streams JSON objects separated by newlines
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const data = JSON.parse(line);
            const candidate = data.candidates?.[0];
            
            if (candidate?.content?.parts) {
              const chunk = candidate.content.parts.map((p: any) => p.text || '').join('');
              if (chunk) {
                fullContent += chunk;
                onChunk(chunk);
              }
            }
            
            // Update token counts if available
            if (data.usageMetadata) {
              promptTokens = data.usageMetadata.promptTokenCount || promptTokens;
              completionTokens = data.usageMetadata.candidatesTokenCount || completionTokens;
            }
          } catch (e) {
            console.warn('Failed to parse streaming data:', e);
          }
        }
      }

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
      console.error('Vertex AI streaming error:', error);
      throw error;
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      const model = this.config.model || 'gemini-1.0-pro';
      const url = `${this.baseUrl}/publishers/google/models/${model}:generateContent`;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      if (this.config.apiKey) {
        headers['x-goog-api-key'] = this.config.apiKey;
      } else if (this.config.gcpServiceAccountKey) {
        const token = await this.getAccessToken();
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        return false;
      }

      const testRequest: VertexAIRequest = {
        contents: [{ role: 'user', parts: [{ text: 'Test' }] }],
        generationConfig: { maxOutputTokens: 1 }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(testRequest)
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
    const projectId = this.config.gcpProjectId || 'your-project';
    const location = this.config.gcpLocation || 'us-central1';
    this.baseUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}`;
  }

  getCost(promptTokens: number, completionTokens: number, model: string): number {
    // Vertex AI pricing per 1K tokens
    const pricing: Record<string, { prompt: number; completion: number }> = {
      'gemini-1.5-pro': { prompt: 0.00125, completion: 0.00375 },
      'gemini-1.5-flash': { prompt: 0.000075, completion: 0.0003 },
      'gemini-1.0-pro': { prompt: 0.0005, completion: 0.0015 }
    };

    const modelPricing = pricing[model] || pricing['gemini-1.0-pro'];
    return (promptTokens * modelPricing.prompt + completionTokens * modelPricing.completion) / 1000;
  }
}