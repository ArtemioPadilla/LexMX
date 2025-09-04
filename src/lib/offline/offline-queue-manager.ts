/**
 * Offline Query Queue Manager
 * Handles queuing and syncing of legal queries when offline
 */

import { IndexedDBVectorStore } from '../storage/indexeddb-vector-store';

export interface OfflineQuery {
  id: string;
  query: string;
  timestamp: Date;
  userId?: string;
  context?: {
    legalArea?: string;
    caseId?: string;
    priority?: 'low' | 'medium' | 'high';
    expectedResponseType?: 'brief' | 'detailed' | 'citations';
  };
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retryCount: number;
  maxRetries: number;
  result?: {
    response: string;
    sources: Array<{
      title: string;
      url?: string;
      relevance: number;
    }>;
    completedAt: Date;
  };
  error?: {
    message: string;
    code?: string;
    failedAt: Date;
  };
}

export interface OfflineDocument {
  id: string;
  filename: string;
  file: File;
  timestamp: Date;
  processingOptions?: {
    extractText: boolean;
    generateSummary: boolean;
    legalAnalysis: boolean;
  };
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retryCount: number;
  result?: {
    documentId: string;
    processedAt: Date;
  };
  error?: {
    message: string;
    failedAt: Date;
  };
}

/**
 * Manages offline queries and document uploads with background sync
 */
export class OfflineQueueManager {
  private static instance: OfflineQueueManager;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'LexMX_OfflineQueue';
  private readonly DB_VERSION = 2;
  private readonly STORES = {
    queries: 'offline_queries',
    documents: 'offline_documents',
    sync_metadata: 'sync_metadata'
  };

  private constructor() {
    this.initializeDB();
  }

  static getInstance(): OfflineQueueManager {
    if (!OfflineQueueManager.instance) {
      OfflineQueueManager.instance = new OfflineQueueManager();
    }
    return OfflineQueueManager.instance;
  }

  private async initializeDB(): Promise<void> {
    if (typeof window === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Offline queries store
        if (!db.objectStoreNames.contains(this.STORES.queries)) {
          const queriesStore = db.createObjectStore(this.STORES.queries, { keyPath: 'id' });
          queriesStore.createIndex('status', 'status', { unique: false });
          queriesStore.createIndex('timestamp', 'timestamp', { unique: false });
          queriesStore.createIndex('priority', ['context.priority', 'timestamp'], { unique: false });
        }

        // Offline documents store
        if (!db.objectStoreNames.contains(this.STORES.documents)) {
          const documentsStore = db.createObjectStore(this.STORES.documents, { keyPath: 'id' });
          documentsStore.createIndex('status', 'status', { unique: false });
          documentsStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Sync metadata store
        if (!db.objectStoreNames.contains(this.STORES.sync_metadata)) {
          db.createObjectStore(this.STORES.sync_metadata, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Add query to offline queue
   */
  async queueQuery(
    query: string,
    context?: OfflineQuery['context']
  ): Promise<string> {
    await this.ensureDB();

    const queryId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const offlineQuery: OfflineQuery = {
      id: queryId,
      query,
      timestamp: new Date(),
      context,
      status: 'pending',
      retryCount: 0,
      maxRetries: 3
    };

    const transaction = this.db!.transaction([this.STORES.queries], 'readwrite');
    const store = transaction.objectStore(this.STORES.queries);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(offlineQuery);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Register for background sync if available
    this.registerBackgroundSync('legal-query-sync');

    console.log(`[OfflineQueue] Query queued: ${queryId}`);
    return queryId;
  }

  /**
   * Add document upload to offline queue
   */
  async queueDocument(
    file: File,
    options?: OfflineDocument['processingOptions']
  ): Promise<string> {
    await this.ensureDB();

    const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const offlineDocument: OfflineDocument = {
      id: documentId,
      filename: file.name,
      file,
      timestamp: new Date(),
      processingOptions: options,
      status: 'pending',
      retryCount: 0
    };

    const transaction = this.db!.transaction([this.STORES.documents], 'readwrite');
    const store = transaction.objectStore(this.STORES.documents);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.add(offlineDocument);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Register for background sync if available
    this.registerBackgroundSync('document-upload-sync');

    console.log(`[OfflineQueue] Document queued: ${documentId}`);
    return documentId;
  }

  /**
   * Get all pending queries
   */
  async getPendingQueries(): Promise<OfflineQuery[]> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.queries], 'readonly');
    const store = transaction.objectStore(this.STORES.queries);
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all pending documents
   */
  async getPendingDocuments(): Promise<OfflineDocument[]> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.documents], 'readonly');
    const store = transaction.objectStore(this.STORES.documents);
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.getAll('pending');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Process pending queries (called by service worker)
   */
  async processPendingQueries(): Promise<void> {
    const pendingQueries = await this.getPendingQueries();
    console.log(`[OfflineQueue] Processing ${pendingQueries.length} pending queries`);

    for (const query of pendingQueries) {
      if (query.retryCount >= query.maxRetries) {
        await this.markQueryFailed(query.id, 'Maximum retries exceeded');
        continue;
      }

      try {
        await this.updateQueryStatus(query.id, 'syncing');
        const result = await this.processQuery(query);
        await this.markQueryCompleted(query.id, result);
        
        // Notify the client about completion
        this.notifyClient('queryCompleted', {
          queryId: query.id,
          result
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[OfflineQueue] Query processing failed:`, error);
        
        await this.incrementRetryCount(query.id);
        
        if (query.retryCount + 1 >= query.maxRetries) {
          await this.markQueryFailed(query.id, errorMessage);
        }
      }
    }
  }

  /**
   * Process pending documents (called by service worker)
   */
  async processPendingDocuments(): Promise<void> {
    const pendingDocuments = await this.getPendingDocuments();
    console.log(`[OfflineQueue] Processing ${pendingDocuments.length} pending documents`);

    for (const document of pendingDocuments) {
      try {
        await this.updateDocumentStatus(document.id, 'syncing');
        const result = await this.processDocument(document);
        await this.markDocumentCompleted(document.id, result);
        
        // Notify the client about completion
        this.notifyClient('documentCompleted', {
          documentId: document.id,
          result
        });
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[OfflineQueue] Document processing failed:`, error);
        await this.markDocumentFailed(document.id, errorMessage);
      }
    }
  }

  /**
   * Process individual query
   */
  private async processQuery(query: OfflineQuery): Promise<OfflineQuery['result']> {
    // Simulate API call to RAG engine
    // In real implementation, this would call the actual LLM/RAG service
    
    // Mock processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Mock success/failure
    if (Math.random() > 0.1) { // 90% success rate
      return {
        response: `Respuesta simulada para la consulta: "${query.query.substring(0, 50)}..."\n\nEsta es una respuesta generada automáticamente después de restaurar la conexión.`,
        sources: [
          {
            title: 'Código Civil Federal',
            url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/2_110121.pdf',
            relevance: 0.89
          },
          {
            title: 'Constitución Política de los Estados Unidos Mexicanos',
            url: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf',
            relevance: 0.76
          }
        ],
        completedAt: new Date()
      };
    } else {
      throw new Error('Simulated processing failure');
    }
  }

  /**
   * Process individual document
   */
  private async processDocument(document: OfflineDocument): Promise<OfflineDocument['result']> {
    // Simulate document processing
    // In real implementation, this would upload and process the document
    
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));
    
    return {
      documentId: `processed_${document.id}`,
      processedAt: new Date()
    };
  }

  /**
   * Update query status
   */
  private async updateQueryStatus(queryId: string, status: OfflineQuery['status']): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.queries], 'readwrite');
    const store = transaction.objectStore(this.STORES.queries);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(queryId);
      getRequest.onsuccess = () => {
        const query = getRequest.result;
        if (query) {
          query.status = status;
          const putRequest = store.put(query);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Query not found: ${queryId}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Update document status
   */
  private async updateDocumentStatus(documentId: string, status: OfflineDocument['status']): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.documents], 'readwrite');
    const store = transaction.objectStore(this.STORES.documents);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(documentId);
      getRequest.onsuccess = () => {
        const document = getRequest.result;
        if (document) {
          document.status = status;
          const putRequest = store.put(document);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Document not found: ${documentId}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Mark query as completed
   */
  private async markQueryCompleted(queryId: string, result: OfflineQuery['result']): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.queries], 'readwrite');
    const store = transaction.objectStore(this.STORES.queries);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(queryId);
      getRequest.onsuccess = () => {
        const query = getRequest.result;
        if (query) {
          query.status = 'completed';
          query.result = result;
          const putRequest = store.put(query);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Query not found: ${queryId}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Mark document as completed
   */
  private async markDocumentCompleted(documentId: string, result: OfflineDocument['result']): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.documents], 'readwrite');
    const store = transaction.objectStore(this.STORES.documents);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(documentId);
      getRequest.onsuccess = () => {
        const document = getRequest.result;
        if (document) {
          document.status = 'completed';
          document.result = result;
          const putRequest = store.put(document);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Document not found: ${documentId}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Mark query as failed
   */
  private async markQueryFailed(queryId: string, errorMessage: string): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.queries], 'readwrite');
    const store = transaction.objectStore(this.STORES.queries);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(queryId);
      getRequest.onsuccess = () => {
        const query = getRequest.result;
        if (query) {
          query.status = 'failed';
          query.error = {
            message: errorMessage,
            failedAt: new Date()
          };
          const putRequest = store.put(query);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Query not found: ${queryId}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Mark document as failed
   */
  private async markDocumentFailed(documentId: string, errorMessage: string): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.documents], 'readwrite');
    const store = transaction.objectStore(this.STORES.documents);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(documentId);
      getRequest.onsuccess = () => {
        const document = getRequest.result;
        if (document) {
          document.status = 'failed';
          document.error = {
            message: errorMessage,
            failedAt: new Date()
          };
          const putRequest = store.put(document);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Document not found: ${documentId}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Increment retry count for a query
   */
  private async incrementRetryCount(queryId: string): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.queries], 'readwrite');
    const store = transaction.objectStore(this.STORES.queries);

    return new Promise((resolve, reject) => {
      const getRequest = store.get(queryId);
      getRequest.onsuccess = () => {
        const query = getRequest.result;
        if (query) {
          query.retryCount++;
          query.status = 'pending'; // Reset to pending for retry
          const putRequest = store.put(query);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          reject(new Error(`Query not found: ${queryId}`));
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Register background sync
   */
  private registerBackgroundSync(syncTag: string): void {
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      navigator.serviceWorker.ready.then(registration => {
        return registration.sync.register(syncTag);
      }).catch(error => {
        console.warn('[OfflineQueue] Background sync registration failed:', error);
      });
    }
  }

  /**
   * Notify client about sync completion
   */
  private notifyClient(type: string, data: any): void {
    // Broadcast to all clients
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.controller?.postMessage({
        type,
        data
      });
    }

    // Also emit custom events for reactive UIs
    window.dispatchEvent(new CustomEvent(`offline-${type}`, {
      detail: data
    }));
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    queries: { pending: number; completed: number; failed: number };
    documents: { pending: number; completed: number; failed: number };
  }> {
    await this.ensureDB();

    const stats = {
      queries: { pending: 0, completed: 0, failed: 0 },
      documents: { pending: 0, completed: 0, failed: 0 }
    };

    // Count queries by status
    const queryTransaction = this.db!.transaction([this.STORES.queries], 'readonly');
    const queryStore = queryTransaction.objectStore(this.STORES.queries);
    
    await new Promise<void>((resolve) => {
      const request = queryStore.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const query = cursor.value as OfflineQuery;
          stats.queries[query.status]++;
          cursor.continue();
        } else {
          resolve();
        }
      };
    });

    // Count documents by status
    const docTransaction = this.db!.transaction([this.STORES.documents], 'readonly');
    const docStore = docTransaction.objectStore(this.STORES.documents);
    
    await new Promise<void>((resolve) => {
      const request = docStore.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const document = cursor.value as OfflineDocument;
          stats.documents[document.status]++;
          cursor.continue();
        } else {
          resolve();
        }
      };
    });

    return stats;
  }

  /**
   * Clear completed items from queue
   */
  async clearCompleted(): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES.queries, this.STORES.documents], 'readwrite');
    
    // Clear completed queries
    const queryStore = transaction.objectStore(this.STORES.queries);
    const queryIndex = queryStore.index('status');
    
    const completedQueries = await new Promise<IDBRequest>((resolve, reject) => {
      const request = queryIndex.getAll('completed');
      request.onsuccess = () => resolve(request);
      request.onerror = () => reject(request.error);
    });

    for (const query of (completedQueries as any).result) {
      queryStore.delete(query.id);
    }

    // Clear completed documents
    const docStore = transaction.objectStore(this.STORES.documents);
    const docIndex = docStore.index('status');
    
    const completedDocs = await new Promise<IDBRequest>((resolve, reject) => {
      const request = docIndex.getAll('completed');
      request.onsuccess = () => resolve(request);
      request.onerror = () => reject(request.error);
    });

    for (const document of (completedDocs as any).result) {
      docStore.delete(document.id);
    }

    console.log('[OfflineQueue] Completed items cleared from queue');
  }

  private async ensureDB(): Promise<void> {
    if (!this.db) {
      await this.initializeDB();
    }
  }
}

// Export singleton instance
export const offlineQueueManager = OfflineQueueManager.getInstance();