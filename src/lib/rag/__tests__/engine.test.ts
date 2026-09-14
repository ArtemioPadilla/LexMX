import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegalRAGEngine } from '../engine';
import type { EmbeddingManager, EmbeddingManagerStatus } from '@/lib/embeddings/embedding-manager';
import type { VectorStore, SearchResult } from '@/types/rag';
import type { LLMResponse } from '@/types/llm';

// Collaborators mocked at the module level (documentLoader, providerManager,
// promptBuilder) per the module's testing conventions — only the vector
// store and embedding manager are injected directly via the engine's
// dependency-injection constructor param.
vi.mock('@/lib/corpus/document-loader', () => ({
  documentLoader: {
    initialize: vi.fn(async () => undefined),
    convertToVectorDocuments: vi.fn(async () => [])
  }
}));

const mockLlmResponse: LLMResponse = {
  content: 'Respuesta legal simulada.',
  model: 'mock-model',
  provider: 'mock',
  usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
  latency: 5
};

vi.mock('@/lib/llm/provider-manager', () => ({
  providerManager: {
    initialize: vi.fn(async () => undefined),
    processRequest: vi.fn(async () => mockLlmResponse),
    processStreamingRequest: vi.fn(async () => mockLlmResponse)
  }
}));

vi.mock('@/lib/llm/prompt-builder', () => ({
  promptBuilder: {
    buildSystemPrompt: vi.fn(() => 'system prompt'),
    buildQueryPrompt: vi.fn(() => 'query prompt'),
    getLegalWarning: vi.fn(() => 'Esto no es asesoría legal.'),
    getRecommendedActions: vi.fn(() => [])
  }
}));

function createFakeEmbeddingManager(isFallback: boolean): EmbeddingManager {
  const status: EmbeddingManagerStatus = {
    providerType: isFallback ? 'mock' : 'transformers',
    isFallback
  };

  return {
    initialize: vi.fn(async () => undefined),
    embed: vi.fn(async () => ({ values: [0, 0, 1], dimensions: 3 })),
    embedBatch: vi.fn(async () => []),
    getStats: vi.fn(() => null),
    calculateSimilarity: vi.fn(() => 0),
    getStatus: vi.fn(() => status)
  } as unknown as EmbeddingManager;
}

function createFakeVectorStore(searchResults: SearchResult[]): VectorStore {
  return {
    initialize: vi.fn(async () => undefined),
    addDocument: vi.fn(async () => undefined),
    search: vi.fn(async () => searchResults),
    getDocument: vi.fn(async () => null),
    clear: vi.fn(async () => undefined)
  };
}

describe('LegalRAGEngine — explicit corpus/embeddings status and grounding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports an empty/mock corpus and produces an ungrounded, source-less response when nothing real is retrieved', async () => {
    const engine = new LegalRAGEngine(
      { enableCache: false },
      { vectorStore: createFakeVectorStore([]), embeddingManager: createFakeEmbeddingManager(true) }
    );

    await engine.initialize();

    const status = engine.getStatus();
    expect(['empty', 'mock']).toContain(status.corpus);
    expect(status.embeddings).toBe('mock');
    expect(status.documentCount).toBe(0);

    const response = await engine.processLegalQuery('¿Qué es el amparo?');

    expect(response.grounded).toBe(false);
    expect(response.sources).toEqual([]);
  });

  it('marks the response as grounded, with non-empty sources, when the injected vector store holds real documents', async () => {
    const realDocuments: SearchResult[] = [
      {
        id: 'doc-1',
        content: 'Artículo 1. Contenido real de prueba sobre contratos.',
        score: 0.9,
        metadata: { title: 'Documento 1', type: 'law', legalArea: 'civil', hierarchy: 3, lastUpdated: '2024-01-01' }
      },
      {
        id: 'doc-2',
        content: 'Artículo 2. Otro contenido real relacionado.',
        score: 0.8,
        metadata: { title: 'Documento 2', type: 'law', legalArea: 'civil', hierarchy: 3, lastUpdated: '2024-01-01' }
      }
    ];

    const engine = new LegalRAGEngine(
      { enableCache: false },
      { vectorStore: createFakeVectorStore(realDocuments), embeddingManager: createFakeEmbeddingManager(false) }
    );

    await engine.initialize();

    const response = await engine.processLegalQuery('¿Qué dice el artículo sobre contratos?');

    expect(response.grounded).toBe(true);
    expect(response.sources.length).toBe(2);
    expect(response.sources[0]!.documentId).toBe('doc-1');
  });
});
