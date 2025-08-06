// Metadata storage system for document lineage

import type { 
  DocumentLineage, 
  LineageAudit,
  ChangeDetection,
  RAGMetadata 
} from '@/types/lineage';

interface MetadataDB {
  lineages: Map<string, DocumentLineage>;
  audits: LineageAudit[];
  changeDetection: Map<string, ChangeDetection>;
  ragMetadata: Map<string, RAGMetadata>;
}

export class MetadataStore {
  private dbName = 'lexmx_metadata';
  private version = 1;
  private db: IDBDatabase | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object stores
        if (!db.objectStoreNames.contains('lineages')) {
          const lineageStore = db.createObjectStore('lineages', { keyPath: 'documentId' });
          lineageStore.createIndex('legalArea', 'legalArea', { unique: false });
          lineageStore.createIndex('hierarchy', 'hierarchy', { unique: false });
          lineageStore.createIndex('currentVersion', 'currentVersion.versionId', { unique: false });
        }

        if (!db.objectStoreNames.contains('audits')) {
          const auditStore = db.createObjectStore('audits', { keyPath: 'auditId' });
          auditStore.createIndex('documentId', 'documentId', { unique: false });
          auditStore.createIndex('timestamp', 'timestamp', { unique: false });
          auditStore.createIndex('action', 'action', { unique: false });
        }

        if (!db.objectStoreNames.contains('changeDetection')) {
          const changeStore = db.createObjectStore('changeDetection', { keyPath: 'documentId' });
          changeStore.createIndex('nextCheckDate', 'nextCheckDate', { unique: false });
          changeStore.createIndex('changesDetected', 'changesDetected', { unique: false });
        }

        if (!db.objectStoreNames.contains('ragMetadata')) {
          const ragStore = db.createObjectStore('ragMetadata', { keyPath: 'documentId' });
          ragStore.createIndex('effectiveConfidence', 'effectiveConfidence', { unique: false });
          ragStore.createIndex('embeddingDate', 'embeddingDate', { unique: false });
        }
      };
    });
  }

  /**
   * Store document lineage
   */
  async storeLineage(lineage: DocumentLineage): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lineages'], 'readwrite');
      const store = transaction.objectStore('lineages');
      const request = store.put(lineage);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get document lineage by ID
   */
  async getLineage(documentId: string): Promise<DocumentLineage | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lineages'], 'readonly');
      const store = transaction.objectStore('lineages');
      const request = store.get(documentId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query lineages by criteria
   */
  async queryLineages(criteria: {
    legalArea?: string;
    hierarchy?: number;
    minConfidence?: number;
  }): Promise<DocumentLineage[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['lineages'], 'readonly');
      const store = transaction.objectStore('lineages');
      const results: DocumentLineage[] = [];

      let request: IDBRequest;
      
      if (criteria.legalArea) {
        const index = store.index('legalArea');
        request = index.openCursor(IDBKeyRange.only(criteria.legalArea));
      } else if (criteria.hierarchy !== undefined) {
        const index = store.index('hierarchy');
        request = index.openCursor(IDBKeyRange.only(criteria.hierarchy));
      } else {
        request = store.openCursor();
      }

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const lineage = cursor.value as DocumentLineage;
          
          // Apply additional filters
          if (!criteria.minConfidence || lineage.accuracy >= criteria.minConfidence) {
            results.push(lineage);
          }
          
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store audit entry
   */
  async storeAudit(audit: LineageAudit): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audits'], 'readwrite');
      const store = transaction.objectStore('audits');
      const request = store.add(audit);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get audit history for a document
   */
  async getAuditHistory(
    documentId: string,
    limit: number = 50
  ): Promise<LineageAudit[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['audits'], 'readonly');
      const store = transaction.objectStore('audits');
      const index = store.index('documentId');
      const results: LineageAudit[] = [];

      const request = index.openCursor(
        IDBKeyRange.only(documentId),
        'prev' // Reverse chronological order
      );

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && results.length < limit) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store RAG metadata
   */
  async storeRAGMetadata(metadata: RAGMetadata): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['ragMetadata'], 'readwrite');
      const store = transaction.objectStore('ragMetadata');
      const request = store.put(metadata);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get RAG metadata for a document
   */
  async getRAGMetadata(documentId: string): Promise<RAGMetadata | null> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['ragMetadata'], 'readonly');
      const store = transaction.objectStore('ragMetadata');
      const request = store.get(documentId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get documents needing confidence updates
   */
  async getDocumentsNeedingUpdate(
    daysOld: number = 365
  ): Promise<RAGMetadata[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['ragMetadata'], 'readonly');
      const store = transaction.objectStore('ragMetadata');
      const index = store.index('embeddingDate');
      const results: RAGMetadata[] = [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const request = index.openCursor(
        IDBKeyRange.upperBound(cutoffDate)
      );

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store change detection configuration
   */
  async storeChangeDetection(config: ChangeDetection): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['changeDetection'], 'readwrite');
      const store = transaction.objectStore('changeDetection');
      const request = store.put(config);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get documents to check for updates
   */
  async getDocumentsToCheck(): Promise<ChangeDetection[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['changeDetection'], 'readonly');
      const store = transaction.objectStore('changeDetection');
      const index = store.index('nextCheckDate');
      const results: ChangeDetection[] = [];

      const now = new Date();
      const request = index.openCursor(
        IDBKeyRange.upperBound(now)
      );

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          results.push(cursor.value);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all metadata (for testing/reset)
   */
  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const stores = ['lineages', 'audits', 'changeDetection', 'ragMetadata'];
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(stores, 'readwrite');
      
      stores.forEach(storeName => {
        transaction.objectStore(storeName).clear();
      });

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Export all metadata (for backup)
   */
  async exportMetadata(): Promise<MetadataDB> {
    if (!this.db) throw new Error('Database not initialized');

    const lineages = new Map<string, DocumentLineage>();
    const audits: LineageAudit[] = [];
    const changeDetection = new Map<string, ChangeDetection>();
    const ragMetadata = new Map<string, RAGMetadata>();

    // Export lineages
    const lineageList = await this.getAllFromStore<DocumentLineage>('lineages');
    lineageList.forEach(l => lineages.set(l.documentId, l));

    // Export audits
    audits.push(...await this.getAllFromStore<LineageAudit>('audits'));

    // Export change detection
    const changeList = await this.getAllFromStore<ChangeDetection>('changeDetection');
    changeList.forEach(c => changeDetection.set(c.documentId, c));

    // Export RAG metadata
    const ragList = await this.getAllFromStore<RAGMetadata>('ragMetadata');
    ragList.forEach(r => ragMetadata.set(r.documentId, r));

    return { lineages, audits, changeDetection, ragMetadata };
  }

  // Helper method to get all records from a store
  private async getAllFromStore<T>(storeName: string): Promise<T[]> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const metadataStore = new MetadataStore();