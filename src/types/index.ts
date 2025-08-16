// Export all types for easy importing
// First export common types
export * from './common';

// Then export specific types, avoiding conflicts
export type { 
  StoredChatMessage, 
  ChatSession,
  CaseData,
  Deadline,
  TimelineEvent,
  FormField,
  GlossaryTerm,
  GlossaryCategory,
  StoredChatSession,
  StoredCaseData
} from './chat';

export type {
  LLMProviderType,
  CostLevel,
  LLMCapability,
  ProviderStatus,
  StreamCallback,
  LLMModel,
  LocalModel,
  LLMProvider,
  CloudProvider,
  LocalProvider,
  LLMRequest,
  LLMResponse,
  LegalCitation,
  ProviderConfig,
  UserProfile,
  ProviderMetrics,
  QueryContext
} from './llm';

// Export TokenUsage from common.ts since it's defined there
export type { TokenUsage } from './common';

// Export ChatMessage from llm.ts to avoid conflict with chat.ts
export type { ChatMessage } from './llm';

export type {
  LegalArea,
  DocumentType,
  LegalHierarchy,
  LegalDocument,
  LegalContent,
  LegalQuery,
  QueryType,
  QueryIntent,
  LegalEntity,
  LegalResponse,
  LegalSource,
  LegalChunk,
  MexicanCitation,
  RequestStatus,
  RequestPriority,
  SourceType,
  DocumentRequest,
  DocumentSource,
  RequestComment,
  RequestNotification,
  RequestFilter,
  RequestStats,
  DuplicateDetectionResult,
  OfficialSourceValidation,
  ModerationAction,
  ModeratorUser,
  SpamDetectionResult,
  DocumentSuggestion,
  SmartFormState
} from './legal';

// Export RateLimitInfo from legal.ts to avoid conflict with common.ts
export type { RateLimitInfo } from './legal';

export type {
  RAGConfig,
  VectorStore,
  VectorDocument,
  DocumentMetadata,
  SearchOptions,
  SearchResult,
  RAGResponse,
  RAGSource,
  QueryEntity,
  CacheEntry
} from './rag';

// Export ProcessedQuery and MetadataFilter from rag.ts to avoid conflict with common.ts
export type { ProcessedQuery, MetadataFilter } from './rag';

export * from './security';
export * from './embeddings';
export * from './lineage';

// Re-export some important constants
export { 
  MEXICAN_CITATIONS, 
  LEGAL_HIERARCHY,
  REQUEST_VOTE_THRESHOLDS,
  REQUEST_STATUS_LABELS,
  PRIORITY_LABELS,
  OFFICIAL_SOURCES,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW
} from './legal';