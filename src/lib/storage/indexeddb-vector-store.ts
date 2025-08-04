// IndexedDB-based vector store for client-side RAG

import type { VectorStore, VectorDocument, SearchOptions, SearchResult, DocumentMetadata } from '@/types/rag';

export class IndexedDBVectorStore implements VectorStore {
  private dbName = 'lexmx_vectors';
  private version = 1;
  private db: IDBDatabase | null = null;

  private readonly STORES = {
    DOCUMENTS: 'documents',
    EMBEDDINGS: 'embeddings',
    METADATA: 'metadata'
  };

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Documents store - stores document content and metadata
        if (!db.objectStoreNames.contains(this.STORES.DOCUMENTS)) {
          const documentsStore = db.createObjectStore(this.STORES.DOCUMENTS, { keyPath: 'id' });
          documentsStore.createIndex('type', 'metadata.type');
          documentsStore.createIndex('legalArea', 'metadata.legalArea');
          documentsStore.createIndex('hierarchy', 'metadata.hierarchy');
          documentsStore.createIndex('lastUpdated', 'metadata.lastUpdated');
        }

        // Embeddings store - stores vector embeddings separately for efficient search
        if (!db.objectStoreNames.contains(this.STORES.EMBEDDINGS)) {
          const embeddingsStore = db.createObjectStore(this.STORES.EMBEDDINGS, { keyPath: 'documentId' });
          embeddingsStore.createIndex('documentId', 'documentId');
        }

        // Metadata store - stores collection-level metadata
        if (!db.objectStoreNames.contains(this.STORES.METADATA)) {
          db.createObjectStore(this.STORES.METADATA, { keyPath: 'key' });
        }
      };
    });
  }

  async addDocument(document: VectorDocument): Promise<void> {
    if (!this.db) throw new Error('Vector store not initialized');

    const transaction = this.db.transaction([this.STORES.DOCUMENTS, this.STORES.EMBEDDINGS], 'readwrite');
    
    try {
      // Store document content and metadata
      const documentsStore = transaction.objectStore(this.STORES.DOCUMENTS);
      await this.promisifyRequest(documentsStore.put({
        id: document.id,
        content: document.content,
        metadata: document.metadata
      }));

      // Store embedding separately for efficient vector operations
      const embeddingsStore = transaction.objectStore(this.STORES.EMBEDDINGS);
      await this.promisifyRequest(embeddingsStore.put({
        documentId: document.id,
        embedding: this.compressEmbedding(document.embedding),
        dimension: document.embedding.length
      }));

      await this.promisifyTransaction(transaction);
    } catch (error) {
      transaction.abort();
      throw new Error(`Failed to add document ${document.id}: ${error}`);
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.db) throw new Error('Vector store not initialized');

    // Process in batches to avoid overwhelming IndexedDB
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await Promise.all(batch.map(doc => this.addDocument(doc)));
    }
  }

  async search(queryEmbedding: number[], options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.db) throw new Error('Vector store not initialized');

    const {
      topK = 10,
      scoreThreshold = 0.7,
      filter,
      includeEmbeddings = false
    } = options;

    // Get all embeddings for similarity computation
    const embeddingsStore = this.db.transaction([this.STORES.EMBEDDINGS]).objectStore(this.STORES.EMBEDDINGS);
    const embeddingEntries = await this.getAllFromStore(embeddingsStore);

    // Compute similarities
    const similarities = embeddingEntries.map(entry => ({
      documentId: entry.documentId,
      score: this.cosineSimilarity(queryEmbedding, this.decompressEmbedding(entry.embedding, entry.dimension))
    }));

    // Filter by score threshold
    const filteredSimilarities = similarities.filter(s => s.score >= scoreThreshold);

    // Sort by similarity score (descending)
    filteredSimilarities.sort((a, b) => b.score - a.score);

    // Take top K results
    const topResults = filteredSimilarities.slice(0, topK);

    // Get document details
    const results: SearchResult[] = [];
    const documentsStore = this.db.transaction([this.STORES.DOCUMENTS]).objectStore(this.STORES.DOCUMENTS);

    for (const result of topResults) {
      try {
        const document = await this.promisifyRequest(documentsStore.get(result.documentId));
        
        if (document && this.matchesFilter(document.metadata, filter)) {
          const searchResult: SearchResult = {
            id: document.id,
            content: document.content,
            score: result.score,
            metadata: document.metadata
          };

          if (includeEmbeddings) {
            const embeddingEntry = embeddingEntries.find(e => e.documentId === document.id);
            if (embeddingEntry) {
              searchResult.embedding = this.decompressEmbedding(embeddingEntry.embedding, embeddingEntry.dimension);
            }
          }

          results.push(searchResult);
        }
      } catch (error) {
        console.warn(`Failed to retrieve document ${result.documentId}:`, error);
      }
    }

    return results;
  }

  async getDocument(id: string): Promise<VectorDocument | null> {
    if (!this.db) throw new Error('Vector store not initialized');

    const transaction = this.db.transaction([this.STORES.DOCUMENTS, this.STORES.EMBEDDINGS]);
    
    try {
      const documentsStore = transaction.objectStore(this.STORES.DOCUMENTS);
      const document = await this.promisifyRequest(documentsStore.get(id));
      
      if (!document) return null;

      const embeddingsStore = transaction.objectStore(this.STORES.EMBEDDINGS);
      const embeddingEntry = await this.promisifyRequest(embeddingsStore.get(id));
      
      if (!embeddingEntry) return null;

      return {
        id: document.id,
        content: document.content,
        metadata: document.metadata,
        embedding: this.decompressEmbedding(embeddingEntry.embedding, embeddingEntry.dimension)
      };
    } catch (error) {
      throw new Error(`Failed to get document ${id}: ${error}`);
    }
  }

  async clear(): Promise<void> {
    if (!this.db) throw new Error('Vector store not initialized');

    const transaction = this.db.transaction([this.STORES.DOCUMENTS, this.STORES.EMBEDDINGS, this.STORES.METADATA], 'readwrite');
    
    try {
      await Promise.all([
        this.promisifyRequest(transaction.objectStore(this.STORES.DOCUMENTS).clear()),
        this.promisifyRequest(transaction.objectStore(this.STORES.EMBEDDINGS).clear()),
        this.promisifyRequest(transaction.objectStore(this.STORES.METADATA).clear())
      ]);
      
      await this.promisifyTransaction(transaction);
    } catch (error) {
      transaction.abort();
      throw new Error(`Failed to clear vector store: ${error}`);
    }
  }

  // Get collection statistics
  async getStats(): Promise<{ documentCount: number; storageSize: number; collections: string[] }> {
    if (!this.db) throw new Error('Vector store not initialized');

    const documentsStore = this.db.transaction([this.STORES.DOCUMENTS]).objectStore(this.STORES.DOCUMENTS);
    const count = await this.promisifyRequest(documentsStore.count());

    // Estimate storage size (rough approximation)
    const allDocs = await this.getAllFromStore(documentsStore);
    const storageSize = allDocs.reduce((total, doc) => {
      return total + JSON.stringify(doc).length;
    }, 0);

    // Get unique collections (legal areas)
    const collections = [...new Set(allDocs.map(doc => doc.metadata?.legalArea).filter(Boolean))];

    return {
      documentCount: count,
      storageSize,
      collections
    };
  }

  // Search by metadata filter only (no vector search)
  async searchByMetadata(filter: any): Promise<SearchResult[]> {
    if (!this.db) throw new Error('Vector store not initialized');

    const documentsStore = this.db.transaction([this.STORES.DOCUMENTS]).objectStore(this.STORES.DOCUMENTS);
    const allDocs = await this.getAllFromStore(documentsStore);

    return allDocs
      .filter(doc => this.matchesFilter(doc.metadata, filter))
      .map(doc => ({
        id: doc.id,
        content: doc.content,
        score: 1.0, // No similarity score for metadata-only search
        metadata: doc.metadata
      }));
  }

  // Helper methods
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private compressEmbedding(embedding: number[]): Int8Array {
    // Convert float32 embeddings to int8 for storage efficiency
    // Scale from [-1, 1] to [-127, 127]
    return new Int8Array(embedding.map(val => Math.round(Math.max(-1, Math.min(1, val)) * 127)));
  }

  private decompressEmbedding(compressed: Int8Array | number[], dimension: number): number[] {
    // Convert int8 back to float32
    const array = compressed instanceof Int8Array ? compressed : new Int8Array(compressed);
    return Array.from(array).map(val => val / 127);
  }

  private matchesFilter(metadata: DocumentMetadata, filter?: any): boolean {
    if (!filter) return true;

    for (const [key, value] of Object.entries(filter)) {
      if (key === 'dateRange') {
        const range = value as { start: string; end: string };
        const docDate = new Date(metadata.lastUpdated);
        const startDate = new Date(range.start);
        const endDate = new Date(range.end);
        
        if (docDate < startDate || docDate > endDate) {
          return false;
        }
      } else if (metadata[key as keyof DocumentMetadata] !== value) {
        return false;
      }
    }

    return true;
  }

  private async getAllFromStore(store: IDBObjectStore): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private promisifyTransaction(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(new Error('Transaction aborted'));
    });
  }

  // Cleanup and maintenance
  async compact(): Promise<void> {
    // IndexedDB doesn't have explicit compaction, but we can optimize by rebuilding
    console.log('IndexedDB compaction not needed - handled automatically by browser');
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

export default IndexedDBVectorStore;