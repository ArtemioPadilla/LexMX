// Common utility types for LexMX

// Generic JSON value types
export type JsonPrimitive = string | number | boolean | null;
export type JsonObject = { [Key in string]: JsonValue };
export type JsonArray = JsonValue[];
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

// Translation system types
export interface TranslationValue {
  [key: string]: string | TranslationValue;
}

export interface TranslationDict {
  [language: string]: TranslationValue;
}

// Translation parameters for string interpolation
export interface TranslationParams {
  [key: string]: string | number;
}

// Progress callback types
export interface ProgressEvent {
  loaded: number;
  total: number;
  percentage: number;
  status?: string;
  details?: string;
}

export type ProgressCallback = (progress: ProgressEvent) => void;

// Error handling types
export interface ErrorWithCode extends Error {
  code?: string;
  statusCode?: number;
  details?: JsonValue;
}

// Storage metadata
export interface StorageMetadata {
  created: number;
  updated: number;
  version: string;
  tags?: string[];
  [key: string]: JsonValue;
}

// API response wrappers
export interface ApiResponse<T = unknown> {
  data?: T;
  error?: string;
  status: number;
  headers?: Record<string, string>;
}

// Model API structures for external APIs
export interface OpenAIApiModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface OllamaApiModel {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    format: string;
    family: string;
    families?: string[];
    parameter_size: string;
    quantization_level: string;
  };
  modified_at: string;
}

export interface GeminiApiModel {
  name: string;
  version: string;
  displayName: string;
  description?: string;
  inputTokenLimit?: number;
  outputTokenLimit?: number;
  supportedGenerationMethods?: string[];
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface BedrockApiModel {
  modelId: string;
  modelName: string;
  providerName: string;
  inputModalities: string[];
  outputModalities: string[];
  responseStreamingSupported: boolean;
  customizationsSupported: string[];
  inferenceTypesSupported: string[];
  modelLifecycle: {
    status: string;
  };
}

// Model usage/response types
export interface TokenUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  // Alternative naming patterns
  input_tokens?: number;
  output_tokens?: number;
  // For providers that use different field names
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// Streaming response chunks
export interface StreamChunk {
  content?: string;
  delta?: string;
  finished?: boolean;
  usage?: TokenUsage;
  model?: string;
}

// WebLLM specific types
export interface WebLLMInitProgress {
  progress: number;
  timeElapsed: number;
  text: string;
  model?: string;
}

export interface WebLLMModel {
  model_id: string;
  local_id: string;
  model_lib: string;
  model_lib_url?: string;
  vram_required_MB: number;
  low_resource_required: boolean;
  buffer_size_required_bytes?: number;
}

// Document content types
export interface DocumentContent {
  type: 'text' | 'structure' | 'metadata' | 'chunk';
  content: string;
  level?: number;
  id?: string;
  title?: string;
  parent?: string;
  children?: string[];
  metadata?: StorageMetadata;
}

export type DocumentContentArray = DocumentContent[];

// Navigation and search types  
export interface NavigationItem {
  id: string;
  title: string;
  type: 'section' | 'article' | 'chapter' | 'title' | 'subsection';
  level: number;
  parent?: string;
  children?: NavigationItem[];
  searchScore?: number;
  metadata?: StorageMetadata;
}

export type NavigationTree = NavigationItem[];

// Request validation types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  metadata?: StorageMetadata;
}

export interface RequestMetadata {
  timestamp: number;
  ip?: string;
  userAgent?: string;
  fingerprint?: string;
  sessionId?: string;
  [key: string]: JsonValue;
}

// Rate limiting types
export interface RateLimitInfo {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

// Query processing types
export interface ProcessedQuery {
  original: string;
  normalized: string;
  keywords: string[];
  legalTerms: string[];
  entities: string[];
  intent: string;
  confidence: number;
  metadata?: StorageMetadata;
}

// Search context types
export interface SearchContext {
  target: NavigationItem;
  context: NavigationItem[];
  hierarchy: NavigationItem[];
  query?: string;
  filters?: Record<string, JsonValue>;
}

// Generic event types
export interface EventBase {
  type: string;
  timestamp: number;
  source?: string;
  metadata?: StorageMetadata;
}

export interface DataEvent<T = JsonValue> extends EventBase {
  data: T;
}

// Filter types for database operations
export interface MetadataFilter {
  [field: string]: JsonValue | {
    $eq?: JsonValue;
    $ne?: JsonValue;
    $in?: JsonValue[];
    $nin?: JsonValue[];
    $exists?: boolean;
    $regex?: string;
    $gt?: number;
    $gte?: number;
    $lt?: number;
    $lte?: number;
  };
}

// Service account for cloud providers
export interface ServiceAccount {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain?: string;
}