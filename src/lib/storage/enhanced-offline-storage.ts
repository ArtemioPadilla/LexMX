/**
 * Enhanced Offline Storage Manager
 * Provides comprehensive offline data management with sync capabilities
 */

import { IndexedDBVectorStore } from './indexeddb-vector-store';

export interface OfflineStorageConfig {
  maxStorageSize: number; // in bytes
  cacheTimeout: number; // in milliseconds
  enableCompression: boolean;
  syncInterval: number; // in milliseconds
}

export interface CachedData<T = any> {
  key: string;
  data: T;
  timestamp: Date;
  expires: Date;
  size: number;
  compressed: boolean;
  version: string;
  metadata?: Record<string, any>;
}

export interface StorageStats {
  totalSize: number;
  itemCount: number;
  oldestItem: Date | null;
  newestItem: Date | null;
  stores: {
    [storeName: string]: {
      itemCount: number;
      size: number;
    };
  };
}

/**
 * Enhanced offline storage with intelligent caching and data management
 */
export class EnhancedOfflineStorage {
  private static instance: EnhancedOfflineStorage;
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'LexMX_Enhanced_Storage';
  private readonly DB_VERSION = 4;
  private config: OfflineStorageConfig;
  
  private readonly STORES = {
    // Core data stores
    legal_documents: 'legal_documents',
    chunks: 'chunks',
    embeddings: 'embeddings',
    user_queries: 'user_queries',
    case_data: 'case_data',
    
    // Cache stores
    api_cache: 'api_cache',
    file_cache: 'file_cache',
    search_cache: 'search_cache',
    
    // System stores
    storage_metadata: 'storage_metadata',
    sync_metadata: 'sync_metadata',
    performance_metrics: 'performance_metrics'
  };

  private constructor(config?: Partial<OfflineStorageConfig>) {
    this.config = {
      maxStorageSize: 100 * 1024 * 1024, // 100MB
      cacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
      enableCompression: true,
      syncInterval: 5 * 60 * 1000, // 5 minutes
      ...config
    };
    
    this.initialize();
  }

  static getInstance(config?: Partial<OfflineStorageConfig>): EnhancedOfflineStorage {
    if (!EnhancedOfflineStorage.instance) {
      EnhancedOfflineStorage.instance = new EnhancedOfflineStorage(config);
    }
    return EnhancedOfflineStorage.instance;
  }

  private async initialize(): Promise<void> {
    if (typeof window === 'undefined') return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.setupCleanupSchedule();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });
  }

  private createStores(db: IDBDatabase): void {
    // Legal documents store
    if (!db.objectStoreNames.contains(this.STORES.legal_documents)) {
      const legalStore = db.createObjectStore(this.STORES.legal_documents, { keyPath: 'key' });
      legalStore.createIndex('timestamp', 'timestamp', { unique: false });
      legalStore.createIndex('expires', 'expires', { unique: false });
      legalStore.createIndex('size', 'size', { unique: false });
    }

    // Chunks store (for RAG document chunks)
    if (!db.objectStoreNames.contains(this.STORES.chunks)) {
      const chunksStore = db.createObjectStore(this.STORES.chunks, { keyPath: 'key' });
      chunksStore.createIndex('timestamp', 'timestamp', { unique: false });
      chunksStore.createIndex('expires', 'expires', { unique: false });
      chunksStore.createIndex('size', 'size', { unique: false });
    }

    // Embeddings store (optimized for vector operations)
    if (!db.objectStoreNames.contains(this.STORES.embeddings)) {
      const embeddingsStore = db.createObjectStore(this.STORES.embeddings, { keyPath: 'key' });
      embeddingsStore.createIndex('timestamp', 'timestamp', { unique: false });
      embeddingsStore.createIndex('expires', 'expires', { unique: false });
      embeddingsStore.createIndex('size', 'size', { unique: false });
    }

    // User queries store (for offline query queue)
    if (!db.objectStoreNames.contains(this.STORES.user_queries)) {
      const queriesStore = db.createObjectStore(this.STORES.user_queries, { keyPath: 'id' });
      queriesStore.createIndex('status', 'status', { unique: false });
      queriesStore.createIndex('timestamp', 'timestamp', { unique: false });
      queriesStore.createIndex('priority', 'priority', { unique: false });
    }

    // Case data store
    if (!db.objectStoreNames.contains(this.STORES.case_data)) {
      const caseStore = db.createObjectStore(this.STORES.case_data, { keyPath: 'id' });
      caseStore.createIndex('userId', 'userId', { unique: false });
      caseStore.createIndex('status', 'status', { unique: false });
      caseStore.createIndex('lastModified', 'lastModified', { unique: false });
    }

    // API cache store
    if (!db.objectStoreNames.contains(this.STORES.api_cache)) {
      const apiCacheStore = db.createObjectStore(this.STORES.api_cache, { keyPath: 'key' });
      apiCacheStore.createIndex('expires', 'expires', { unique: false });
      apiCacheStore.createIndex('timestamp', 'timestamp', { unique: false });
      apiCacheStore.createIndex('size', 'size', { unique: false });
    }

    // File cache store (for large files)
    if (!db.objectStoreNames.contains(this.STORES.file_cache)) {
      const fileCacheStore = db.createObjectStore(this.STORES.file_cache, { keyPath: 'key' });
      fileCacheStore.createIndex('contentType', 'contentType', { unique: false });
      fileCacheStore.createIndex('expires', 'expires', { unique: false });
      fileCacheStore.createIndex('size', 'size', { unique: false });
    }

    // Search cache store
    if (!db.objectStoreNames.contains(this.STORES.search_cache)) {
      const searchCacheStore = db.createObjectStore(this.STORES.search_cache, { keyPath: 'key' });
      searchCacheStore.createIndex('queryHash', 'queryHash', { unique: false });
      searchCacheStore.createIndex('expires', 'expires', { unique: false });
    }

    // Storage metadata store
    if (!db.objectStoreNames.contains(this.STORES.storage_metadata)) {
      db.createObjectStore(this.STORES.storage_metadata, { keyPath: 'key' });
    }

    // Sync metadata store
    if (!db.objectStoreNames.contains(this.STORES.sync_metadata)) {
      const syncStore = db.createObjectStore(this.STORES.sync_metadata, { keyPath: 'key' });
      syncStore.createIndex('lastSync', 'lastSync', { unique: false });
    }

    // Performance metrics store
    if (!db.objectStoreNames.contains(this.STORES.performance_metrics)) {
      const metricsStore = db.createObjectStore(this.STORES.performance_metrics, { keyPath: 'id' });
      metricsStore.createIndex('timestamp', 'timestamp', { unique: false });
      metricsStore.createIndex('operation', 'operation', { unique: false });
    }
  }

  /**
   * Store data with intelligent caching
   */
  async store<T>(
    storeName: keyof typeof this.STORES,
    key: string,
    data: T,
    options?: {
      expires?: Date;
      metadata?: Record<string, any>;
      compress?: boolean;
    }
  ): Promise<void> {
    await this.ensureDB();

    let processedData = data;
    let compressed = false;
    
    // Compress large data if enabled
    if (options?.compress !== false && this.config.enableCompression) {
      const dataSize = this.estimateDataSize(data);
      if (dataSize > 10 * 1024) { // Compress if > 10KB
        try {
          processedData = await this.compressData(data);
          compressed = true;
        } catch (error) {
          console.warn('[Storage] Compression failed:', error);
        }
      }
    }

    const cachedData: CachedData<T> = {
      key,
      data: processedData,
      timestamp: new Date(),
      expires: options?.expires || new Date(Date.now() + this.config.cacheTimeout),
      size: this.estimateDataSize(processedData),
      compressed,
      version: '1.0',
      metadata: options?.metadata
    };

    const transaction = this.db!.transaction([this.STORES[storeName]], 'readwrite');
    const store = transaction.objectStore(this.STORES[storeName]);
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(cachedData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Check storage limits after storing
    await this.checkStorageLimits();
  }

  /**
   * Retrieve data with automatic decompression
   */
  async retrieve<T>(
    storeName: keyof typeof this.STORES,
    key: string
  ): Promise<T | null> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES[storeName]], 'readonly');
    const store = transaction.objectStore(this.STORES[storeName]);

    const cachedData = await new Promise<CachedData<T> | null>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });

    if (!cachedData) {
      return null;
    }

    // Check if data has expired
    if (cachedData.expires && new Date() > new Date(cachedData.expires)) {
      await this.remove(storeName, key);
      return null;
    }

    // Decompress if needed
    if (cachedData.compressed) {
      try {
        return await this.decompressData(cachedData.data);
      } catch (error) {
        console.warn('[Storage] Decompression failed:', error);
        return null;
      }
    }

    return cachedData.data;
  }

  /**
   * Remove data from store
   */
  async remove(storeName: keyof typeof this.STORES, key: string): Promise<void> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES[storeName]], 'readwrite');
    const store = transaction.objectStore(this.STORES[storeName]);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Query data with filters
   */
  async query<T>(
    storeName: keyof typeof this.STORES,
    filters?: {
      index?: string;
      range?: IDBKeyRange;
      limit?: number;
      offset?: number;
    }
  ): Promise<T[]> {
    await this.ensureDB();

    const transaction = this.db!.transaction([this.STORES[storeName]], 'readonly');
    const store = transaction.objectStore(this.STORES[storeName]);

    let request: IDBRequest;
    
    if (filters?.index && store.indexNames.contains(filters.index)) {
      const index = store.index(filters.index);
      request = filters.range ? index.getAll(filters.range) : index.getAll();
    } else {
      request = store.getAll();
    }

    const results = await new Promise<CachedData<T>[]>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });

    // Apply pagination if specified
    const startIndex = filters?.offset || 0;
    const endIndex = filters?.limit ? startIndex + filters.limit : results.length;
    const paginatedResults = results.slice(startIndex, endIndex);

    // Filter expired data and decompress
    const validResults: T[] = [];
    for (const item of paginatedResults) {
      if (!item.expires || new Date() <= new Date(item.expires)) {
        const data = item.compressed ? await this.decompressData(item.data) : item.data;
        validResults.push(data);
      }
    }

    return validResults;
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<StorageStats> {
    await this.ensureDB();

    const stats: StorageStats = {
      totalSize: 0,
      itemCount: 0,
      oldestItem: null,
      newestItem: null,
      stores: {}
    };

    for (const [storeName, storeKey] of Object.entries(this.STORES)) {
      const transaction = this.db!.transaction([storeKey], 'readonly');
      const store = transaction.objectStore(storeKey);

      const items = await new Promise<CachedData[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });

      let storeSize = 0;
      items.forEach(item => {
        storeSize += item.size || 0;
        const itemDate = new Date(item.timestamp);
        
        if (!stats.oldestItem || itemDate < stats.oldestItem) {
          stats.oldestItem = itemDate;
        }
        if (!stats.newestItem || itemDate > stats.newestItem) {
          stats.newestItem = itemDate;
        }
      });

      stats.stores[storeName] = {
        itemCount: items.length,
        size: storeSize
      };

      stats.totalSize += storeSize;
      stats.itemCount += items.length;
    }

    return stats;
  }

  /**
   * Clear expired data
   */
  async clearExpired(): Promise<number> {
    await this.ensureDB();

    let clearedCount = 0;
    const now = new Date();

    for (const storeKey of Object.values(this.STORES)) {
      const transaction = this.db!.transaction([storeKey], 'readwrite');
      const store = transaction.objectStore(storeKey);

      // Use expires index if available
      if (store.indexNames.contains('expires')) {
        const index = store.index('expires');
        const range = IDBKeyRange.upperBound(now);
        
        const request = index.openCursor(range);
        await new Promise<void>((resolve, reject) => {
          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest).result;
            if (cursor) {
              cursor.delete();
              clearedCount++;
              cursor.continue();
            } else {
              resolve();
            }
          };
          request.onerror = () => reject(request.error);
        });
      } else {
        // Fallback: check all items
        const items = await new Promise<CachedData[]>((resolve, reject) => {
          const getAllRequest = store.getAll();
          getAllRequest.onsuccess = () => resolve(getAllRequest.result || []);
          getAllRequest.onerror = () => reject(getAllRequest.error);
        });

        for (const item of items) {
          if (item.expires && new Date(item.expires) <= now) {
            store.delete(item.key);
            clearedCount++;
          }
        }
      }
    }

    return clearedCount;
  }

  /**
   * Check and enforce storage limits
   */
  private async checkStorageLimits(): Promise<void> {
    const stats = await this.getStats();
    
    if (stats.totalSize > this.config.maxStorageSize) {
      // Remove oldest items first
      const storesToClean = Object.entries(stats.stores)
        .sort((a, b) => b[1].size - a[1].size) // Start with largest stores
        .slice(0, 3); // Clean up to 3 stores

      for (const [storeName, storeStats] of storesToClean) {
        await this.cleanupStore(this.STORES[storeName as keyof typeof this.STORES], storeStats.itemCount * 0.2);
      }
    }
  }

  /**
   * Clean up old items from a specific store
   */
  private async cleanupStore(storeKey: string, itemsToRemove: number): Promise<void> {
    const transaction = this.db!.transaction([storeKey], 'readwrite');
    const store = transaction.objectStore(storeKey);

    // Try to use timestamp index for efficient cleanup
    if (store.indexNames.contains('timestamp')) {
      const index = store.index('timestamp');
      const request = index.openCursor();
      
      let removed = 0;
      await new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor && removed < itemsToRemove) {
            cursor.delete();
            removed++;
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    }
  }

  /**
   * Setup automatic cleanup schedule
   */
  private setupCleanupSchedule(): void {
    // Clean up expired data every hour
    setInterval(async () => {
      try {
        const cleared = await this.clearExpired();
        if (cleared > 0) {
          console.log(`[Storage] Cleared ${cleared} expired items`);
        }
      } catch (error) {
        console.warn('[Storage] Cleanup failed:', error);
      }
    }, 60 * 60 * 1000);

    // Check storage limits every 10 minutes
    setInterval(async () => {
      try {
        await this.checkStorageLimits();
      } catch (error) {
        console.warn('[Storage] Storage limit check failed:', error);
      }
    }, 10 * 60 * 1000);
  }

  /**
   * Estimate data size in bytes
   */
  private estimateDataSize(data: any): number {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Compress data (placeholder for actual compression)
   */
  private async compressData<T>(data: T): Promise<T> {
    // In a real implementation, use a compression library like pako
    // For now, return data as-is
    return data;
  }

  /**
   * Decompress data (placeholder for actual decompression)
   */
  private async decompressData<T>(data: T): Promise<T> {
    // In a real implementation, use a decompression library
    // For now, return data as-is
    return data;
  }

  private async ensureDB(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
  }

  // Convenience methods for document management
  async getDocument(documentId: string): Promise<any | null> {
    console.log(`[Storage] getDocument called with ID: "${documentId}"`);
    try {
      const result = await this.retrieve('legal_documents', documentId);
      console.log(`[Storage] retrieve returned:`, result);
      
      if (result?.data) {
        console.log(`[Storage] Found document data in wrapper:`, {
          id: result.data.id,
          title: result.data.title,
          type: typeof result.data,
          keys: Object.keys(result.data)
        });
        return result.data;
      } else if (result) {
        // Handle case where retrieve() returns document directly (not wrapped)
        console.log(`[Storage] Found document directly (no wrapper):`, {
          id: result.id,
          title: result.title,
          type: typeof result,
          keys: Object.keys(result)
        });
        return result;
      } else {
        console.log(`[Storage] No document data found for ID "${documentId}"`);
        return null;
      }
    } catch (error) {
      console.error(`[Storage] getDocument failed for ID "${documentId}":`, error);
      return null;
    }
  }

  async getAllDocuments(): Promise<any[]> {
    console.log(`[Storage] getAllDocuments called`);
    try {
      await this.ensureDB();
      const transaction = this.db!.transaction(['legal_documents'], 'readonly');
      const store = transaction.objectStore('legal_documents');
      const request = store.getAll();
      
      return new Promise((resolve, reject) => {
        request.onsuccess = () => {
          console.log(`[Storage] Raw items from IndexedDB:`, request.result);
          
          const documents = request.result.map((item: any, index: number) => {
            console.log(`[Storage] Raw item ${index + 1}:`, {
              type: typeof item,
              keys: Object.keys(item || {}),
              hasData: 'data' in (item || {}),
              item: item
            });
            
            return item.data || item;
          });
          
          console.log(`[Storage] Processed documents:`, documents);
          resolve(documents);
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[Storage] getAllDocuments failed:`, error);
      return [];
    }
  }
}

// Export singleton instance
export const enhancedOfflineStorage = EnhancedOfflineStorage.getInstance();