// Admin data service: aggregates corpus and embeddings data for admin islands.
// Runs fully client-side against the IndexedDB-backed services; there is no
// server API on GitHub Pages (see docs/INCEPTOR-MIGRATION-ANALYSIS.md, Fase 1).

import { EventEmitter } from 'events';
import type { LegalDocument } from '@/types/legal';
import { corpusService } from './corpus-service';
import { embeddingsService } from './embeddings-service';

export interface CorpusStats {
  totalDocuments: number;
  totalChunks: number;
  totalSize: number; // in bytes
  documentsByType: Record<string, number>;
  documentsByArea: Record<string, number>;
  lastUpdate: string;
}

export interface EmbeddingsStats {
  totalVectors: number;
  dimensions: number;
  storageSize: number; // in bytes
  indexStatus: 'ready' | 'building' | 'error' | 'not_initialized';
  modelsAvailable: string[];
  currentModel: string;
  averageGenerationTime: number; // in ms
}

export interface QualityStats {
  retrievalAccuracy: number; // percentage
  averageLatency: number; // in ms
  corpusCoverage: number; // percentage
  userSatisfaction: number; // 1-5 scale
  totalQueries: number;
  failedQueries: number;
  cacheHitRate: number; // percentage
}

export interface AdminProgress {
  operation: string;
  stage: string;
  progress: number; // 0-100
  message: string;
  details?: unknown;
  timestamp: number;
}

interface QueryRecord {
  latency: number;
  failed: boolean;
  cached: boolean;
}

const QUERY_HISTORY_KEY = 'lexmx_query_history';
const QUERY_HISTORY_LIMIT = 1000;

export class AdminDataService extends EventEmitter {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await corpusService.initialize();
    this.initialized = true;
  }

  // Corpus Management
  async getCorpusStats(): Promise<CorpusStats> {
    await this.initialize();
    const [documents, stats] = await Promise.all([
      corpusService.getDocuments(),
      corpusService.getStatistics(),
    ]);
    const totalChunks = documents.reduce((sum, doc) => sum + (doc.content?.length ?? 0), 0);
    const lastUpdate = documents
      .map((doc) => doc.lastUpdated)
      .filter((value): value is string => typeof value === 'string')
      .sort()
      .at(-1) ?? new Date(0).toISOString();
    return {
      totalDocuments: documents.length,
      totalChunks,
      totalSize: stats.totalSize,
      documentsByType: stats.byType,
      documentsByArea: stats.byArea,
      lastUpdate,
    };
  }

  async getDocumentsList(): Promise<LegalDocument[]> {
    await this.initialize();
    return corpusService.getDocuments();
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.initialize();
    this.emitProgress('delete_document', 'starting', 0, `Deleting document ${documentId}`);
    try {
      await corpusService.deleteDocument(documentId);
      this.emitProgress('delete_document', 'complete', 100, 'Document deleted successfully');
    } catch (error) {
      this.emitProgress('delete_document', 'error', 0, 'Failed to delete document', error);
      throw error;
    }
  }

  // Embeddings Management
  async getEmbeddingsStats(): Promise<EmbeddingsStats> {
    await this.initialize();
    const stats = await embeddingsService.getStats();
    return {
      totalVectors: stats.totalVectors,
      dimensions: 384,
      storageSize: stats.storageSize,
      indexStatus: stats.indexStatus,
      modelsAvailable: stats.modelsAvailable,
      currentModel: stats.currentModel,
      averageGenerationTime: stats.averageQueryTime,
    };
  }

  async clearEmbeddingsCache(): Promise<void> {
    await this.initialize();
    this.emitProgress('clear_embeddings', 'starting', 0, 'Clearing embeddings cache');
    try {
      await embeddingsService.clearEmbeddings();
      this.emitProgress('clear_embeddings', 'complete', 100, 'Embeddings cache cleared');
    } catch (error) {
      this.emitProgress('clear_embeddings', 'error', 0, 'Failed to clear embeddings', error);
      throw error;
    }
  }

  async rebuildIndex(): Promise<void> {
    await this.initialize();
    this.emitProgress('rebuild_index', 'starting', 0, 'Rebuilding embeddings index');
    try {
      const result = await embeddingsService.generateAllEmbeddings();
      this.emitProgress('rebuild_index', 'complete', 100, 'Index rebuilt', result);
    } catch (error) {
      this.emitProgress('rebuild_index', 'error', 0, 'Failed to rebuild index', error);
      throw error;
    }
  }

  // Quality Metrics (derived locally from the query history)
  async getQualityStats(): Promise<QualityStats> {
    await this.initialize();
    const history = this.getQueryHistory();
    const totalQueries = history.length;
    const failedQueries = history.filter((q) => q.failed).length;
    const cached = history.filter((q) => q.cached).length;
    const averageLatency = totalQueries
      ? history.reduce((sum, q) => sum + q.latency, 0) / totalQueries
      : 0;
    return {
      retrievalAccuracy: 0,
      averageLatency,
      corpusCoverage: 0,
      userSatisfaction: 0,
      totalQueries,
      failedQueries,
      cacheHitRate: totalQueries ? (cached / totalQueries) * 100 : 0,
    };
  }

  private getQueryHistory(): QueryRecord[] {
    try {
      if (typeof localStorage === 'undefined') return [];
      const stored = localStorage.getItem(QUERY_HISTORY_KEY);
      return stored ? (JSON.parse(stored) as QueryRecord[]) : [];
    } catch (error) {
      console.error('Failed to load query history:', error);
      return [];
    }
  }

  logQuery(latency: number, failed: boolean, cached: boolean): void {
    const history = this.getQueryHistory();
    history.push({ latency, failed, cached });
    if (history.length > QUERY_HISTORY_LIMIT) {
      history.splice(0, history.length - QUERY_HISTORY_LIMIT);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(QUERY_HISTORY_KEY, JSON.stringify(history));
      }
    } catch (error) {
      console.error('Failed to save query history:', error);
    }
  }

  // Progress tracking
  private emitProgress(
    operation: string,
    stage: string,
    progress: number,
    message: string,
    details?: unknown,
  ): void {
    const event: AdminProgress = { operation, stage, progress, message, details, timestamp: Date.now() };
    this.emit('progress', event);
  }

  // Export functionality
  async exportCorpus(): Promise<Blob> {
    await this.initialize();
    const documents = await corpusService.getDocuments();
    const payload = { exportedAt: new Date().toISOString(), documents };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }

  async exportEmbeddings(): Promise<Blob> {
    await this.initialize();
    const stats = await this.getEmbeddingsStats();
    const payload = { exportedAt: new Date().toISOString(), stats };
    return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  }
}

// Singleton instance
export const adminDataService = new AdminDataService();
