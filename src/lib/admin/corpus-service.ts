// Corpus management service for admin operations
// Handles document CRUD operations and corpus maintenance

import { EventEmitter } from 'events';
import type { LegalDocument, LegalArea, DocumentType } from '@/types/legal';
import { DocumentLoader } from '../corpus/document-loader';
import { DocumentIngestionPipeline } from '../ingestion/document-ingestion-pipeline';
import { adminDataService } from './admin-data-service';

export interface CorpusFilter {
  type?: DocumentType;
  legalArea?: LegalArea;
  hierarchy?: number;
  searchTerm?: string;
}

export interface DocumentMetrics {
  id: string;
  title: string;
  type: DocumentType;
  legalArea: LegalArea;
  chunks: number;
  embeddings: number;
  lastUpdated: string;
  size: number; // in bytes
  quality: number; // 0-100 score
}

export class CorpusService extends EventEmitter {
  private documentLoader: DocumentLoader;
  private ingestionPipeline: DocumentIngestionPipeline;
  private initialized = false;

  constructor() {
    super();
    this.documentLoader = new DocumentLoader();
    this.ingestionPipeline = new DocumentIngestionPipeline();
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await Promise.all([
        this.documentLoader.initialize(),
        this.ingestionPipeline.initialize()
      ]);
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize corpus service:', error);
      throw error;
    }
  }

  // Document Operations
  async getDocuments(filter?: CorpusFilter): Promise<LegalDocument[]> {
    await this.initialize();
    
    let documents = await this.documentLoader.loadAllDocuments();
    
    if (filter) {
      documents = this.applyFilter(documents, filter);
    }
    
    return documents;
  }

  async getDocument(documentId: string): Promise<LegalDocument | null> {
    await this.initialize();
    return this.documentLoader.loadDocument(documentId);
  }

  async getDocumentMetrics(documentId: string): Promise<DocumentMetrics | null> {
    await this.initialize();
    
    const document = await this.getDocument(documentId);
    if (!document) return null;
    
    const _stats = await adminDataService.getCorpusStats();
    const embeddingsStats = await adminDataService.getEmbeddingsStats();
    
    // Calculate metrics
    const chunks = document.content?.length || 0;
    const size = JSON.stringify(document).length;
    const hasEmbeddings = embeddingsStats.totalVectors > 0;
    
    // Simple quality score based on completeness
    let quality = 0;
    if (document.title) quality += 20;
    if (document.content && document.content.length > 0) quality += 30;
    if (hasEmbeddings) quality += 30;
    if (document.citations && document.citations.length > 0) quality += 10;
    if (document.lastUpdated) quality += 10;
    
    return {
      id: document.id,
      title: document.title,
      type: document.type,
      legalArea: document.primaryArea,
      chunks,
      embeddings: hasEmbeddings ? chunks : 0,
      lastUpdated: document.lastUpdated || document.publicationDate,
      size,
      quality
    };
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.initialize();
    
    this.emit('operation:start', { type: 'delete', documentId });
    
    try {
      await adminDataService.deleteDocument(documentId);
      this.emit('operation:complete', { type: 'delete', documentId });
    } catch (error) {
      this.emit('operation:error', { type: 'delete', documentId, error });
      throw error;
    }
  }

  async reindexDocument(documentId: string): Promise<void> {
    await this.initialize();
    
    this.emit('operation:start', { type: 'reindex', documentId });
    
    try {
      const document = await this.getDocument(documentId);
      if (!document) {
        throw new Error(`Document ${documentId} not found`);
      }
      
      // Re-process the document through the ingestion pipeline
      const result = await this.ingestionPipeline.ingestDocument(document);
      
      if (!result.success) {
        throw new Error('Reindexing failed');
      }
      
      this.emit('operation:complete', { type: 'reindex', documentId, result });
    } catch (error) {
      this.emit('operation:error', { type: 'reindex', documentId, error });
      throw error;
    }
  }

  // Bulk Operations
  async reindexAll(): Promise<void> {
    await this.initialize();
    
    const documents = await this.getDocuments();
    let processed = 0;
    
    this.emit('bulk:start', { total: documents.length });
    
    for (const doc of documents) {
      try {
        await this.reindexDocument(doc.id);
        processed++;
        this.emit('bulk:progress', { 
          processed, 
          total: documents.length,
          progress: (processed / documents.length) * 100
        });
      } catch (error) {
        console.error(`Failed to reindex document ${doc.id}:`, error);
      }
    }
    
    this.emit('bulk:complete', { processed, total: documents.length });
  }

  async validateCorpus(): Promise<{
    valid: number;
    invalid: number;
    issues: Array<{ documentId: string; issues: string[] }>;
  }> {
    await this.initialize();
    
    const documents = await this.getDocuments();
    const results = {
      valid: 0,
      invalid: 0,
      issues: [] as Array<{ documentId: string; issues: string[] }>
    };
    
    for (const doc of documents) {
      const issues: string[] = [];
      
      // Validation checks
      if (!doc.title || doc.title.trim() === '') {
        issues.push('Missing title');
      }
      
      if (!doc.content || doc.content.length === 0) {
        issues.push('No content');
      }
      
      if (!doc.primaryArea) {
        issues.push('Missing legal area');
      }
      
      if (!doc.hierarchy || doc.hierarchy < 1 || doc.hierarchy > 7) {
        issues.push('Invalid hierarchy level');
      }
      
      if (issues.length > 0) {
        results.invalid++;
        results.issues.push({ documentId: doc.id, issues });
      } else {
        results.valid++;
      }
    }
    
    return results;
  }

  // Search and Filter
  private applyFilter(documents: LegalDocument[], filter: CorpusFilter): LegalDocument[] {
    return documents.filter(doc => {
      if (filter.type && doc.type !== filter.type) return false;
      if (filter.legalArea && doc.primaryArea !== filter.legalArea) return false;
      if (filter.hierarchy !== undefined && doc.hierarchy !== filter.hierarchy) return false;
      
      if (filter.searchTerm) {
        const term = filter.searchTerm.toLowerCase();
        const matchesTitle = doc.title.toLowerCase().includes(term);
        const matchesContent = doc.fullText?.toLowerCase().includes(term) || false;
        if (!matchesTitle && !matchesContent) return false;
      }
      
      return true;
    });
  }

  // Export/Import
  async exportDocument(documentId: string): Promise<Blob> {
    await this.initialize();
    
    const document = await this.getDocument(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }
    
    const json = JSON.stringify(document, null, 2);
    return new Blob([json], { type: 'application/json' });
  }

  async importDocument(file: File): Promise<LegalDocument> {
    await this.initialize();
    
    const text = await this.readFile(file);
    const document = JSON.parse(text) as LegalDocument;
    
    // Validate the document
    if (!document.id || !document.title || !document.type) {
      throw new Error('Invalid document format');
    }
    
    // Process through ingestion pipeline
    const result = await this.ingestionPipeline.ingestDocument(document);
    
    if (!result.success) {
      throw new Error('Failed to import document');
    }
    
    return document;
  }

  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  // Statistics
  async getStatistics(): Promise<{
    byType: Record<DocumentType, number>;
    byArea: Record<LegalArea, number>;
    byHierarchy: Record<number, number>;
    averageChunks: number;
    totalSize: number;
  }> {
    await this.initialize();
    
    const documents = await this.getDocuments();
    const stats = {
      byType: {} as Record<DocumentType, number>,
      byArea: {} as Record<LegalArea, number>,
      byHierarchy: {} as Record<number, number>,
      averageChunks: 0,
      totalSize: 0
    };
    
    let totalChunks = 0;
    
    for (const doc of documents) {
      // By type
      stats.byType[doc.type] = (stats.byType[doc.type] || 0) + 1;
      
      // By area
      stats.byArea[doc.primaryArea] = (stats.byArea[doc.primaryArea] || 0) + 1;
      
      // By hierarchy
      stats.byHierarchy[doc.hierarchy] = (stats.byHierarchy[doc.hierarchy] || 0) + 1;
      
      // Chunks
      const chunks = doc.content?.length || 0;
      totalChunks += chunks;
      
      // Size
      stats.totalSize += JSON.stringify(doc).length;
    }
    
    stats.averageChunks = documents.length > 0 ? totalChunks / documents.length : 0;
    
    return stats;
  }

  async searchDocuments(query: string): Promise<LegalDocument[]> {
    try {
      const documents = await this.documentLoader.loadAllDocuments();
      
      // Simple search implementation - searches in title and content
      const results = documents.filter(doc => {
        const titleMatch = doc.title?.toLowerCase().includes(query.toLowerCase());
        const contentMatch = doc.content?.some(chunk => 
          chunk.content?.toLowerCase().includes(query.toLowerCase())
        );
        
        return titleMatch || contentMatch;
      });

      // Sort by relevance (number of occurrences)
      results.sort((a, b) => {
        const aCount = this.countOccurrences(a, query);
        const bCount = this.countOccurrences(b, query);
        return bCount - aCount;
      });

      return results;
    } catch (error) {
      console.error('Failed to search documents:', error);
      return [];
    }
  }

  private countOccurrences(doc: LegalDocument, query: string): number {
    const queryLower = query.toLowerCase();
    let count = 0;
    
    if (doc.title?.toLowerCase().includes(queryLower)) {
      count += (doc.title.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
    }
    
    doc.content?.forEach(chunk => {
      if (chunk.content?.toLowerCase().includes(queryLower)) {
        count += (chunk.content.toLowerCase().match(new RegExp(queryLower, 'g')) || []).length;
      }
    });
    
    return count;
  }
}

// Singleton instance
export const corpusService = new CorpusService();