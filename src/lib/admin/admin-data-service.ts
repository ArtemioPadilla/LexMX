// Admin data service for real-time statistics and monitoring
// Provides centralized data management for admin panels
// Updated to use API endpoints instead of direct service access

import { EventEmitter } from 'events';
import type { LegalDocument } from '@/types/legal';

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

export class AdminDataService extends EventEmitter {
  private initialized = false;
  private baseUrl = '/api';

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    // API-based service doesn't need initialization
    this.initialized = true;
  }

  private async fetchAPI(endpoint: string, options?: RequestInit): Promise<any> {
    // Handle both absolute and relative URLs
    let url: string;
    if (endpoint.startsWith('http')) {
      url = endpoint;
    } else if (typeof window !== 'undefined') {
      url = `${window.location.origin}${this.baseUrl}${endpoint}`;
    } else {
      // Server-side fallback - just return the path
      url = `${this.baseUrl}${endpoint}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Handle both wrapped and unwrapped response formats
    // If the response has a success field, it's wrapped
    if (typeof data === 'object' && 'success' in data) {
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }
      return data.data;
    }
    
    // Otherwise, return the data directly (for backward compatibility with tests)
    return data;
  }

  // Corpus Management
  async getCorpusStats(): Promise<CorpusStats> {
    await this.initialize();
    return this.fetchAPI('/corpus/stats');
  }

  async getDocumentsList(): Promise<LegalDocument[]> {
    await this.initialize();
    return this.fetchAPI('/corpus/list');
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.initialize();
    
    this.emitProgress('delete_document', 'starting', 0, `Deleting document ${documentId}`);
    
    try {
      await this.fetchAPI('/corpus/delete', {
        method: 'DELETE',
        body: JSON.stringify({ documentId }),
      });
      
      this.emitProgress('delete_document', 'complete', 100, 'Document deleted successfully');
    } catch (error) {
      this.emitProgress('delete_document', 'error', 0, 'Failed to delete document', error);
      throw error;
    }
  }

  // Embeddings Management
  async getEmbeddingsStats(): Promise<EmbeddingsStats> {
    await this.initialize();
    return this.fetchAPI('/embeddings/stats');
  }

  async clearEmbeddingsCache(): Promise<void> {
    await this.initialize();
    
    this.emitProgress('clear_cache', 'starting', 0, 'Clearing embeddings cache');
    
    try {
      await this.fetchAPI('/embeddings/clear', {
        method: 'POST',
        body: JSON.stringify({ operation: 'clear_cache' }),
      });
      
      this.emitProgress('clear_cache', 'complete', 100, 'Cache cleared successfully');
    } catch (error) {
      this.emitProgress('clear_cache', 'error', 0, 'Failed to clear cache', error);
      throw error;
    }
  }

  async rebuildIndex(): Promise<void> {
    await this.initialize();
    
    this.emitProgress('rebuild_index', 'starting', 0, 'Starting index rebuild');
    
    try {
      await this.fetchAPI('/embeddings/generate', {
        method: 'POST',
        body: JSON.stringify({ 
          operation: 'rebuild_index',
          generateAll: true 
        }),
      });
      
      this.emitProgress('rebuild_index', 'complete', 100, 'Index rebuilt successfully');
    } catch (error) {
      this.emitProgress('rebuild_index', 'error', 0, 'Failed to rebuild index', error);
      throw error;
    }
  }

  // Quality Metrics
  async getQualityStats(): Promise<QualityStats> {
    await this.initialize();
    return this.fetchAPI('/quality/metrics');
  }

  private getQueryHistory(): Array<{ latency: number; failed: boolean; cached: boolean }> {
    try {
      if (typeof localStorage === 'undefined') {
        return [];
      }
      const stored = localStorage.getItem('lexmx_query_history');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load query history:', error);
      return [];
    }
  }

  logQuery(latency: number, failed: boolean, cached: boolean): void {
    const history = this.getQueryHistory();
    history.push({ latency, failed, cached });
    
    // Keep only last 1000 queries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
    
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('lexmx_query_history', JSON.stringify(history));
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
    details?: unknown
  ): void {
    const event: AdminProgress = {
      operation,
      stage,
      progress,
      message,
      details,
      timestamp: Date.now()
    };
    
    this.emit('progress', event);
  }

  // Export functionality
  async exportCorpus(): Promise<Blob> {
    await this.initialize();
    
    const url = `${window.location.origin}${this.baseUrl}/corpus/export`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    return response.blob();
  }

  async exportEmbeddings(): Promise<Blob> {
    await this.initialize();
    
    const url = `${window.location.origin}${this.baseUrl}/embeddings/export`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Export failed: ${response.status} ${response.statusText}`);
    }
    
    return response.blob();
  }
}

// Singleton instance
export const adminDataService = new AdminDataService();