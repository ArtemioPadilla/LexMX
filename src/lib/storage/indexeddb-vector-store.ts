// IndexedDB-based vector store for client-side RAG

import type { VectorStore, VectorDocument, SearchOptions, SearchResult, DocumentMetadata, MetadataFilter } from '@/types/rag';

// Shape actually persisted in the `documents` object store (content + metadata,
// embedding lives separately in `embeddings` for efficient vector ops).
interface VectorStoreRecord {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

// Shape persisted in the `embeddings` object store. Embeddings are quantized
// to Int8 for storage efficiency; `dimension` is kept to decompress correctly.
interface EmbeddingStoreRecord {
  documentId: string;
  embedding: Int8Array;
  dimension: number;
}

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
    // Skip initialization during SSG build (no IndexedDB in the Node build context)
    if (typeof indexedDB === 'undefined') {
      return;
    }
    
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
    if (!this.db) {
      if (typeof indexedDB === 'undefined') return; // Skip during SSG
      throw new Error('Vector store not initialized');
    }

    const transaction = this.db.transaction([this.STORES.DOCUMENTS, this.STORES.EMBEDDINGS], 'readwrite');
    
    try {
      // Store document content and metadata
      const documentsStore = transaction.objectStore(this.STORES.DOCUMENTS);
      const record: VectorStoreRecord = {
        id: document.id,
        content: document.content,
        metadata: document.metadata
      };
      await this.promisifyRequest(documentsStore.put(record));

      // Store embedding separately for efficient vector operations
      const embeddingsStore = transaction.objectStore(this.STORES.EMBEDDINGS);
      const embeddingRecord: EmbeddingStoreRecord = {
        documentId: document.id,
        embedding: this.compressEmbedding(document.embedding),
        dimension: document.embedding.length
      };
      await this.promisifyRequest(embeddingsStore.put(embeddingRecord));

      await this.promisifyTransaction(transaction);
    } catch (error) {
      transaction.abort();
      throw new Error(`Failed to add document ${document.id}: ${error}`);
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.db) {
      if (typeof indexedDB === 'undefined') return; // Skip during SSG
      throw new Error('Vector store not initialized');
    }
    if (documents.length === 0) return;

    // One readwrite transaction per batch: thousands of chunks per law would
    // otherwise mean thousands of transactions (the pre-Fase 6 behaviour).
    const batchSize = 500;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const transaction = this.db.transaction([this.STORES.DOCUMENTS, this.STORES.EMBEDDINGS], 'readwrite');
      const documentsStore = transaction.objectStore(this.STORES.DOCUMENTS);
      const embeddingsStore = transaction.objectStore(this.STORES.EMBEDDINGS);
      for (const document of batch) {
        const record: VectorStoreRecord = { id: document.id, content: document.content, metadata: document.metadata };
        documentsStore.put(record);
        const embeddingRecord: EmbeddingStoreRecord = {
          documentId: document.id,
          embedding: this.compressEmbedding(document.embedding),
          dimension: document.embedding.length
        };
        embeddingsStore.put(embeddingRecord);
      }
      await this.promisifyTransaction(transaction);
    }
  }

  async count(): Promise<number> {
    if (!this.db) return 0;
    const store = this.db.transaction([this.STORES.DOCUMENTS]).objectStore(this.STORES.DOCUMENTS);
    return this.promisifyRequest(store.count());
  }

  async getMeta<T = unknown>(key: string): Promise<T | null> {
    if (!this.db) return null;
    const store = this.db.transaction([this.STORES.METADATA]).objectStore(this.STORES.METADATA);
    const record = await this.promisifyRequest<{ key: string; value: T } | undefined>(store.get(key));
    return record ? record.value : null;
  }

  async setMeta(key: string, value: unknown): Promise<void> {
    if (!this.db) return;
    const transaction = this.db.transaction([this.STORES.METADATA], 'readwrite');
    transaction.objectStore(this.STORES.METADATA).put({ key, value });
    await this.promisifyTransaction(transaction);
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
    const embeddingEntries = await this.getAllFromStore<EmbeddingStoreRecord>(embeddingsStore);

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
        const document = await this.promisifyRequest<VectorStoreRecord | undefined>(
          documentsStore.get(result.documentId)
        );

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
      const document = await this.promisifyRequest<VectorStoreRecord | undefined>(documentsStore.get(id));

      if (!document) return null;

      const embeddingsStore = transaction.objectStore(this.STORES.EMBEDDINGS);
      const embeddingEntry = await this.promisifyRequest<EmbeddingStoreRecord | undefined>(
        embeddingsStore.get(id)
      );
      
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
    const allDocs = await this.getAllFromStore<VectorStoreRecord>(documentsStore);
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
  async searchByMetadata(filter: MetadataFilter): Promise<SearchResult[]> {
    if (!this.db) throw new Error('Vector store not initialized');

    const documentsStore = this.db.transaction([this.STORES.DOCUMENTS]).objectStore(this.STORES.DOCUMENTS);
    const allDocs = await this.getAllFromStore<VectorStoreRecord>(documentsStore);

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
      const valA = a[i] ?? 0;
      const valB = b[i] ?? 0;
      dotProduct += valA * valB;
      normA += valA * valA;
      normB += valB * valB;
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  private compressEmbedding(embedding: number[]): Int8Array {
    // Convert float32 embeddings to int8 for storage efficiency
    // Scale from [-1, 1] to [-127, 127]
    return new Int8Array(embedding.map(val => Math.round(Math.max(-1, Math.min(1, val)) * 127)));
  }

  private decompressEmbedding(compressed: Int8Array | number[], _dimension: number): number[] {
    // Convert int8 back to float32
    const array = compressed instanceof Int8Array ? compressed : new Int8Array(compressed);
    return Array.from(array).map(val => val / 127);
  }

  private matchesFilter(metadata: DocumentMetadata, filter?: MetadataFilter): boolean {
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

  private async getAllFromStore<T>(store: IDBObjectStore): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const request: IDBRequest<T[]> = store.getAll();
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
    // IndexedDB compaction not needed - handled automatically by browser
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  // Admin methods
  async deleteDocument(documentId: string): Promise<void> {
    if (!this.db) throw new Error('Vector store not initialized');

    const transaction = this.db.transaction([this.STORES.DOCUMENTS, this.STORES.EMBEDDINGS], 'readwrite');
    
    try {
      const documentsStore = transaction.objectStore(this.STORES.DOCUMENTS);
      await this.promisifyRequest(documentsStore.delete(documentId));
      
      const embeddingsStore = transaction.objectStore(this.STORES.EMBEDDINGS);
      await this.promisifyRequest(embeddingsStore.delete(documentId));
      
      await this.promisifyTransaction(transaction);
    } catch (error) {
      transaction.abort();
      throw new Error(`Failed to delete document ${documentId}: ${error}`);
    }
  }

  async getAllEmbeddings(): Promise<Array<{id: string; embedding: number[]}>> {
    if (!this.db) throw new Error('Vector store not initialized');

    const transaction = this.db.transaction([this.STORES.EMBEDDINGS], 'readonly');
    const embeddingsStore = transaction.objectStore(this.STORES.EMBEDDINGS);
    
    const allEmbeddings = await this.promisifyRequest<EmbeddingStoreRecord[]>(embeddingsStore.getAll());

    return allEmbeddings.map(item => ({
      id: item.documentId,
      embedding: this.decompressEmbedding(item.embedding, item.dimension)
    }));
  }
}