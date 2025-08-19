import { EventEmitter } from 'events';
import { DocumentLoader } from '../corpus/document-loader';
import { IndexedDBVectorStore } from '../storage/indexeddb-vector-store';
import { TransformersEmbeddings } from '../embeddings/transformers-embeddings';
import { OpenAIEmbeddings } from '../embeddings/openai-embeddings';
import { MockEmbeddings } from '../embeddings/mock-embeddings';
import type { EmbeddingProvider } from '../embeddings/types';
import type { LegalDocument, VectorDocument } from '@/types/legal';

export interface EmbeddingStats {
  totalVectors: number;
  storageSize: number;
  averageQueryTime: number;
  averageGenerationTime?: number;
  modelsAvailable: string[];
  currentModel: string;
  indexStatus: 'ready' | 'building' | 'error';
  provider?: string;
}

export interface GenerationResult {
  success: boolean;
  documentId?: string;
  embeddingsGenerated?: number;
  duration?: number;
  tokensPerSecond?: number;
  error?: string;
}

export interface BatchResult {
  totalDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;
  errors: Array<{ documentId: string; error: string }>;
  averageDuration?: number;
  totalDuration?: number;
}

export interface TestResult {
  success: boolean;
  provider: string;
  dimensions: number;
  latency: number;
  error?: string;
}

export type ProviderType = 'transformers' | 'openai' | 'mock';

export class EmbeddingsService extends EventEmitter {
  private documentLoader: DocumentLoader;
  private vectorStore: IndexedDBVectorStore;
  private currentProvider: EmbeddingProvider;
  private currentProviderType: ProviderType;
  private initialized = false;

  constructor() {
    super();
    this.documentLoader = new DocumentLoader();
    this.vectorStore = new IndexedDBVectorStore();
    this.currentProviderType = 'transformers';
    this.currentProvider = new TransformersEmbeddings();
  }

  async initialize(provider: ProviderType = 'transformers'): Promise<void> {
    if (this.initialized) return;

    try {
      // Initialize document loader and vector store
      await this.documentLoader.initialize();
      await this.vectorStore.initialize();

      // Initialize embedding provider
      await this.switchProvider(provider);

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize embeddings service:', error);
      throw error;
    }
  }

  async switchProvider(provider: ProviderType): Promise<void> {
    try {
      switch (provider) {
        case 'openai':
          this.currentProvider = new OpenAIEmbeddings();
          break;
        case 'mock':
          this.currentProvider = new MockEmbeddings();
          break;
        case 'transformers':
          this.currentProvider = new TransformersEmbeddings();
          break;
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }

      this.currentProviderType = provider;
      await this.currentProvider.initialize();
      
      this.emit('provider-changed', { provider });
    } catch (error) {
      console.error('Failed to switch provider:', error);
      throw error;
    }
  }

  async generateEmbeddings(documentId: string): Promise<GenerationResult> {
    const startTime = Date.now();
    
    try {
      this.emit('progress', {
        stage: 'loading',
        documentId,
        progress: 0
      });

      // Load document
      const documents = await this.documentLoader.loadAllDocuments();
      const document = documents.find(d => d.id === documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }

      this.emit('progress', {
        stage: 'generating',
        documentId,
        progress: 30
      });

      // Convert to vector documents
      const vectorDocs = await this.documentLoader.convertToVectorDocuments([document]);

      this.emit('progress', {
        stage: 'storing',
        documentId,
        progress: 70
      });

      // Store in vector store
      await this.vectorStore.addDocuments(vectorDocs);

      const duration = Date.now() - startTime;
      const tokensPerSecond = (vectorDocs.length * 100) / (duration / 1000); // Approximate

      this.emit('progress', {
        stage: 'complete',
        documentId,
        progress: 100
      });

      return {
        success: true,
        documentId,
        embeddingsGenerated: vectorDocs.length,
        duration,
        tokensPerSecond
      };
    } catch (error) {
      this.emit('error', { documentId, error });
      throw error;
    }
  }

  async generateAllEmbeddings(batchSize = 5): Promise<BatchResult> {
    const documents = await this.documentLoader.loadAllDocuments();
    const errors: Array<{ documentId: string; error: string }> = [];
    let successfulDocuments = 0;
    const startTime = Date.now();
    const durations: number[] = [];

    this.emit('progress', {
      stage: 'starting',
      total: documents.length,
      progress: 0
    });

    // Process in batches
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, Math.min(i + batchSize, documents.length));
      
      this.emit('batch', {
        stage: 'batch_start',
        batchNumber: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(documents.length / batchSize)
      });

      // Process batch in parallel
      const batchPromises = batch.map(async (doc) => {
        const docStartTime = Date.now();
        try {
          await this.generateEmbeddings(doc.id);
          successfulDocuments++;
          const docDuration = Date.now() - docStartTime;
          durations.push(docDuration);
          
          this.emit('progress', {
            stage: 'document_complete',
            documentId: doc.id,
            progress: ((successfulDocuments + errors.length) / documents.length) * 100
          });
        } catch (error) {
          errors.push({
            documentId: doc.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });

      await Promise.all(batchPromises);

      this.emit('batch', {
        stage: 'batch_complete',
        batchNumber: Math.floor(i / batchSize) + 1,
        totalBatches: Math.ceil(documents.length / batchSize)
      });
    }

    const totalDuration = Date.now() - startTime;
    const averageDuration = durations.length > 0 
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    this.emit('progress', {
      stage: 'complete',
      total: documents.length,
      successful: successfulDocuments,
      failed: errors.length,
      progress: 100
    });

    return {
      totalDocuments: documents.length,
      successfulDocuments,
      failedDocuments: errors.length,
      errors,
      averageDuration,
      totalDuration
    };
  }

  async clearEmbeddings(): Promise<void> {
    try {
      this.emit('progress', { stage: 'clearing', progress: 0 });
      
      await this.vectorStore.clear();
      
      this.emit('progress', { stage: 'complete', progress: 100 });
    } catch (error) {
      console.error('Failed to clear embeddings:', error);
      throw error;
    }
  }

  async getStats(): Promise<EmbeddingStats> {
    try {
      const stats = await this.vectorStore.getStats();
      
      return {
        totalVectors: stats.documentCount || 0,
        storageSize: stats.storageSize || 0,
        averageQueryTime: stats.averageQueryTime || 0,
        modelsAvailable: ['transformers', 'openai', 'mock'],
        currentModel: this.currentProviderType,
        indexStatus: 'ready',
        provider: this.currentProviderType
      };
    } catch (error) {
      console.error('Failed to get stats:', error);
      return {
        totalVectors: 0,
        storageSize: 0,
        averageQueryTime: 0,
        modelsAvailable: ['transformers', 'openai', 'mock'],
        currentModel: this.currentProviderType,
        indexStatus: 'error',
        provider: this.currentProviderType
      };
    }
  }

  async testProvider(query: string): Promise<TestResult> {
    const startTime = Date.now();
    
    try {
      const embedding = await this.currentProvider.embedQuery(query);
      const latency = Date.now() - startTime;
      
      return {
        success: true,
        provider: this.currentProviderType,
        dimensions: embedding.length,
        latency
      };
    } catch (error) {
      return {
        success: false,
        provider: this.currentProviderType,
        dimensions: 0,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const embeddingsService = new EmbeddingsService();