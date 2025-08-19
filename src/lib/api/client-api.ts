/**
 * Client-side API implementation for GitHub Pages deployment
 * Replaces server-side API endpoints with browser-compatible functions
 */

import { CorpusService } from '../admin/corpus-service';
import { EmbeddingsService } from '../admin/embeddings-service';
import { AdminDataService } from '../admin/admin-data-service';
import { QualityTestService } from '../admin/quality-test-service';
import { QualityResultsService } from '../admin/quality-results-service';
import { DocumentLoader } from '../corpus/document-loader';
import { IndexedDBVectorStore } from '../storage/indexeddb-vector-store';

// Response type for consistency with API endpoints
interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
}

/**
 * Client-side API service that provides all API functionality
 * without requiring server-side endpoints
 */
export class ClientAPI {
  private static instance: ClientAPI;
  
  private corpusService: CorpusService;
  private embeddingsService: EmbeddingsService;
  private adminDataService: AdminDataService;
  private qualityTestService: QualityTestService;
  private qualityResultsService: QualityResultsService;
  private documentLoader: DocumentLoader;
  private vectorStore: IndexedDBVectorStore;
  
  private constructor() {
    this.corpusService = new CorpusService();
    this.embeddingsService = new EmbeddingsService();
    this.adminDataService = new AdminDataService();
    this.qualityTestService = new QualityTestService();
    this.qualityResultsService = new QualityResultsService();
    this.documentLoader = new DocumentLoader();
    this.vectorStore = new IndexedDBVectorStore();
  }
  
  static getInstance(): ClientAPI {
    if (!ClientAPI.instance) {
      ClientAPI.instance = new ClientAPI();
    }
    return ClientAPI.instance;
  }
  
  // Admin API
  async getAdminStats(): Promise<ApiResponse> {
    try {
      const [corpusStats, embeddingsStats, qualityStats] = await Promise.all([
        this.adminDataService.getCorpusStats(),
        this.adminDataService.getEmbeddingsStats(),
        this.adminDataService.getQualityStats()
      ]);
      
      return {
        data: {
          corpus: corpusStats,
          embeddings: embeddingsStats,
          quality: qualityStats,
          timestamp: Date.now()
        },
        status: 200
      };
    } catch (error) {
      console.error('Admin stats error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch admin stats',
        status: 500
      };
    }
  }
  
  // Corpus API
  async getCorpusList(): Promise<ApiResponse> {
    try {
      await this.corpusService.initialize();
      const documents = await this.corpusService.getDocuments();
      
      return {
        data: {
          documents,
          count: documents.length,
          timestamp: Date.now()
        },
        status: 200
      };
    } catch (error) {
      console.error('Corpus list error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch corpus list',
        status: 500
      };
    }
  }
  
  async getCorpusDocument(id: string): Promise<ApiResponse> {
    try {
      if (!id) {
        return {
          error: 'Document ID is required',
          status: 400
        };
      }
      
      await this.corpusService.initialize();
      const document = await this.corpusService.getDocument(id);
      
      if (!document) {
        return {
          error: 'Document not found',
          status: 404
        };
      }
      
      return {
        data: document,
        status: 200
      };
    } catch (error) {
      console.error('Corpus document error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch document',
        status: 500
      };
    }
  }
  
  async deleteCorpusDocument(id: string): Promise<ApiResponse> {
    try {
      if (!id) {
        return {
          error: 'Document ID is required',
          status: 400
        };
      }
      
      await this.corpusService.initialize();
      const success = await this.corpusService.deleteDocument(id);
      
      if (!success) {
        return {
          error: 'Failed to delete document',
          status: 500
        };
      }
      
      return {
        data: { message: 'Document deleted successfully' },
        status: 200
      };
    } catch (error) {
      console.error('Corpus delete error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to delete document',
        status: 500
      };
    }
  }
  
  async exportCorpus(): Promise<ApiResponse> {
    try {
      await this.documentLoader.initialize();
      const allDocuments = await this.documentLoader.getAllDocuments();
      
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        documents: allDocuments,
        count: allDocuments.length
      };
      
      // Create downloadable blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      return {
        data: {
          blob,
          filename: `lexmx-corpus-${Date.now()}.json`,
          size: blob.size
        },
        status: 200
      };
    } catch (error) {
      console.error('Corpus export error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to export corpus',
        status: 500
      };
    }
  }
  
  async getCorpusStats(): Promise<ApiResponse> {
    try {
      const stats = await this.adminDataService.getCorpusStats();
      
      return {
        data: stats,
        status: 200
      };
    } catch (error) {
      console.error('Corpus stats error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch corpus stats',
        status: 500
      };
    }
  }
  
  // Embeddings API
  async generateEmbeddings(options?: { forceRegenerate?: boolean }): Promise<ApiResponse> {
    try {
      await this.embeddingsService.initialize();
      
      if (options?.forceRegenerate) {
        await this.vectorStore.clear();
      }
      
      const result = await this.embeddingsService.generateAllEmbeddings();
      
      return {
        data: {
          processed: result.processedChunks,
          skipped: result.skippedChunks,
          errors: result.errors,
          duration: result.duration
        },
        status: 200
      };
    } catch (error) {
      console.error('Embeddings generation error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to generate embeddings',
        status: 500
      };
    }
  }
  
  async clearEmbeddings(): Promise<ApiResponse> {
    try {
      await this.vectorStore.initialize();
      await this.vectorStore.clear();
      
      return {
        data: { message: 'Embeddings cleared successfully' },
        status: 200
      };
    } catch (error) {
      console.error('Embeddings clear error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to clear embeddings',
        status: 500
      };
    }
  }
  
  async exportEmbeddings(): Promise<ApiResponse> {
    try {
      await this.vectorStore.initialize();
      const embeddings = await this.vectorStore.getAllEmbeddings();
      
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        embeddings,
        count: embeddings.length
      };
      
      // Create downloadable blob
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json'
      });
      
      return {
        data: {
          blob,
          filename: `lexmx-embeddings-${Date.now()}.json`,
          size: blob.size
        },
        status: 200
      };
    } catch (error) {
      console.error('Embeddings export error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to export embeddings',
        status: 500
      };
    }
  }
  
  async getEmbeddingsStats(): Promise<ApiResponse> {
    try {
      const stats = await this.adminDataService.getEmbeddingsStats();
      
      return {
        data: stats,
        status: 200
      };
    } catch (error) {
      console.error('Embeddings stats error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch embeddings stats',
        status: 500
      };
    }
  }
  
  // Quality API
  async runQualityTest(options: {
    testType: string;
    queryCount?: number;
    modelId?: string;
  }): Promise<ApiResponse> {
    try {
      const result = await this.qualityTestService.runTest(options);
      
      return {
        data: result,
        status: 200
      };
    } catch (error) {
      console.error('Quality test error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to run quality test',
        status: 500
      };
    }
  }
  
  async getQualityMetrics(): Promise<ApiResponse> {
    try {
      const metrics = await this.qualityTestService.getMetrics();
      
      return {
        data: metrics,
        status: 200
      };
    } catch (error) {
      console.error('Quality metrics error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch quality metrics',
        status: 500
      };
    }
  }
  
  async getQualityResults(params?: {
    startDate?: string;
    endDate?: string;
    testType?: string;
    limit?: number;
  }): Promise<ApiResponse> {
    try {
      const results = await this.qualityResultsService.getResults(params);
      
      return {
        data: results,
        status: 200
      };
    } catch (error) {
      console.error('Quality results error:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to fetch quality results',
        status: 500
      };
    }
  }
  
  // Helper method to handle file downloads
  downloadFile(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

// Export singleton instance
export const clientAPI = ClientAPI.getInstance();