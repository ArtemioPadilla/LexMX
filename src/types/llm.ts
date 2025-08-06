// Core LLM types for LexMX

export type LLMProviderType = 'cloud' | 'local';
export type CostLevel = 'free' | 'low' | 'medium' | 'high';
export type LLMCapability = 'reasoning' | 'analysis' | 'citations' | 'ethics' | 'multilingual' | 'privacy' | 'offline' | 'customizable';
export type ProviderStatus = 'connected' | 'disconnected' | 'error' | 'testing';

// Streaming callback - receives chunks of text as they arrive
export type StreamCallback = (chunk: string) => void;

export interface LLMModel {
  id: string;
  name: string;
  description?: string;
  contextLength: number;
  maxTokens: number;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
  capabilities: LLMCapability[];
  recommended?: boolean;
}

export interface LocalModel extends LLMModel {
  size: string;
  downloadUrl?: string;
  installedLocally: boolean;
}

export interface LLMProvider {
  id: string;
  name: string;
  type: LLMProviderType;
  icon: string;
  description: string;
  costLevel: CostLevel;
  capabilities: LLMCapability[];
  models: LLMModel[];
  status: ProviderStatus;
  
  // Runtime methods
  isAvailable(): Promise<boolean>;
  testConnection(): Promise<boolean>;
  generateResponse(request: LLMRequest): Promise<LLMResponse>;
  stream?(request: LLMRequest, onChunk: StreamCallback): Promise<LLMResponse>;
  estimateCost(request: LLMRequest): number;
}

export interface CloudProvider extends LLMProvider {
  type: 'cloud';
  apiEndpoint: string;
  requiresApiKey: boolean;
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay?: number;
  };
}

export interface LocalProvider extends LLMProvider {
  type: 'local';
  endpoint: string;
  discoveredModels?: LocalModel[];
  
  discoverModels(): Promise<LocalModel[]>;
  installModel?(modelId: string): Promise<boolean>;
}

export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  stream?: boolean;
  metadata?: {
    queryId: string;
    legalArea?: string;
    complexity?: number;
    priority?: 'low' | 'medium' | 'high';
  };
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: {
    citations?: LegalCitation[];
    confidence?: number;
  };
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: number;
  latency: number;
  confidence?: number;
  metadata?: {
    cached?: boolean;
    fallback?: boolean;
    citations?: LegalCitation[];
  };
}

export interface LegalCitation {
  type: 'law' | 'article' | 'jurisprudence' | 'regulation';
  title: string;
  article?: string;
  url?: string;
  relevance: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  type: LLMProviderType;
  enabled: boolean;
  priority: number;
  
  // Connection settings
  apiKey?: string;
  endpoint?: string;
  model?: string;
  
  // Preferences
  temperature?: number;
  maxTokens?: number;
  
  // Limits and controls
  costLimit?: {
    daily: number;
    monthly: number;
  };
  
  // Metadata
  createdAt: number;
  lastUsed?: number;
  totalUsage?: {
    requests: number;
    tokens: number;
    cost: number;
  };
}

export interface UserProfile {
  id: string;
  name: string;
  description: string;
  
  providers: ProviderConfig[];
  
  preferences: {
    privacy: 'maximum' | 'balanced' | 'convenience';
    cost: 'minimize' | 'balanced' | 'quality-first';
    speed: 'fast' | 'balanced' | 'thorough';
    defaultProvider?: string;
  };
  
  limits: {
    dailyCostLimit: number;
    monthlyCostLimit: number;
    enableCostAlerts: boolean;
  };
}

export interface ProviderMetrics {
  providerId: string;
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  totalCost: number;
  lastUsed: number;
}

export interface QueryContext {
  query: string;
  legalArea?: string;
  complexity: number;
  urgency: 'low' | 'medium' | 'high';
  privacyRequired: boolean;
  offlineMode: boolean;
  userBudget: number;
}