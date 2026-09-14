// Document loader for legal corpus
// Loads and manages legal documents from the public corpus

import type { LegalDocument, LegalChunk } from '@/types/legal';
import type { VectorDocument } from '@/types/rag';

export interface CorpusMetadata {
  version: string;
  buildDate: string;
  totalDocuments: number;
  documents: Array<{
    id: string;
    title: string;
    type: string;
    hierarchy: number;
    primaryArea: string;
    source: string;
    size: number;
    lastUpdated: string;
  }>;
}

/** `embeddings/index.json`. Layout 2.1 ships one shard per document. */
export interface EmbeddingsIndex {
  version: string;
  layout?: 'batches' | 'per-document';
  provider?: string;
  dimensions?: number;
  totalEmbeddings?: number;
  batchFiles?: number;
  documents?: Record<string, { file: string; count: number }>;
  buildDate?: string;
}

interface EmbeddingRecord {
  id: string;
  embedding: number[];
}

export class DocumentLoader {
  private corpusPath: string;
  private embeddingsPath: string;
  private metadata: CorpusMetadata | null = null;
  private embeddingsIndex: EmbeddingsIndex | null | undefined;
  private documentsCache = new Map<string, LegalDocument>();
  private embeddingsCache = new Map<string, number[]>();
  private initialized = false;

  constructor() {
    // Get base path from import.meta.env or fall back to root
    let basePath = typeof import.meta !== 'undefined' && import.meta.env 
      ? import.meta.env.BASE_URL || '/' 
      : '/';
    
    // Ensure basePath ends with slash for proper concatenation
    if (!basePath.endsWith('/')) {
      basePath += '/';
    }
    
    this.corpusPath = `${basePath}legal-corpus/`;
    this.embeddingsPath = `${basePath}embeddings/`;
  }

  private getFullUrl(path: string): string {
    if (typeof window !== 'undefined') {
      return new URL(path, window.location.origin).toString();
    }
    
    // For SSG build, return the path as-is since we won't actually fetch
    return path;
  }

  private isSSGBuild(): boolean {
    return typeof process !== 'undefined' && typeof window === 'undefined';
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // During SSG build, skip fetch operations and use empty corpus
    if (this.isSSGBuild()) {
      this.metadata = {
        version: '1.0.0',
        buildDate: new Date().toISOString(),
        totalDocuments: 0,
        documents: []
      };
      this.initialized = true;
      return;
    }

    try {
      // Load corpus metadata
      const metadataUrl = this.getFullUrl(`${this.corpusPath}metadata.json`);
      const metadataResponse = await fetch(metadataUrl);
      if (!metadataResponse.ok) {
        console.warn('Corpus metadata not found, using empty corpus');
        this.metadata = {
          version: '1.0.0',
          buildDate: new Date().toISOString(),
          totalDocuments: 0,
          documents: []
        };
      } else {
        this.metadata = await metadataResponse.json();
      }

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize document loader:', error);
      // Initialize with empty corpus to prevent blocking
      this.metadata = {
        version: '1.0.0',
        buildDate: new Date().toISOString(),
        totalDocuments: 0,
        documents: []
      };
      this.initialized = true;
    }
  }

  /**
   * Identity of the served corpus. Changes whenever the pipeline republishes
   * (buildDate) or the document set differs (checksum/count), so the client
   * can tell an installed corpus from a stale one.
   */
  getCorpusVersion(): string | null {
    if (!this.metadata) return null;
    const m = this.metadata as CorpusMetadata & { checksum?: string };
    return [m.version, m.buildDate, m.checksum ?? String(m.totalDocuments)].join('|');
  }

  async loadEmbeddingsIndex(): Promise<EmbeddingsIndex | null> {
    if (this.embeddingsIndex !== undefined) return this.embeddingsIndex;
    try {
      const response = await fetch(this.getFullUrl(`${this.embeddingsPath}index.json`));
      this.embeddingsIndex = response.ok ? ((await response.json()) as EmbeddingsIndex) : null;
    } catch (error) {
      console.error('Failed to load embeddings index:', error);
      this.embeddingsIndex = null;
    }
    return this.embeddingsIndex;
  }

  /**
   * Embeddings for one document. With the per-document layout this is a
   * single fetch of that document's shard; with the legacy batch layout it
   * loads every batch once (cached) and filters by chunk-id prefix.
   */
  async loadDocumentEmbeddings(documentId: string): Promise<Map<string, number[]>> {
    const index = await this.loadEmbeddingsIndex();
    const shard = index?.documents?.[documentId];
    const result = new Map<string, number[]>();
    if (shard) {
      try {
        const response = await fetch(this.getFullUrl(`${this.embeddingsPath}${shard.file}`));
        if (!response.ok) {
          console.warn(`Embeddings shard for ${documentId} not found`);
          return result;
        }
        const records = (await response.json()) as EmbeddingRecord[];
        for (const item of records) {
          result.set(item.id, item.embedding);
          this.embeddingsCache.set(item.id, item.embedding);
        }
      } catch (error) {
        console.error(`Failed to load embeddings shard for ${documentId}:`, error);
      }
      return result;
    }
    if (this.embeddingsCache.size === 0 && (index?.batchFiles ?? 0) > 0) {
      await this.loadAllEmbeddings();
    }
    const prefix = `${documentId}_chunk_`;
    for (const [id, embedding] of this.embeddingsCache) {
      if (id.startsWith(prefix)) result.set(id, embedding);
    }
    return result;
  }

  async loadDocument(documentId: string): Promise<LegalDocument | null> {
    if (!this.initialized) await this.initialize();

    // Check cache first
    if (this.documentsCache.has(documentId)) {
      return this.documentsCache.get(documentId)!;
    }

    // Find document in metadata
    const docMeta = this.metadata?.documents.find(d => d.id === documentId);
    if (!docMeta) {
      console.warn(`Document ${documentId} not found in corpus`);
      return null;
    }

    try {
      // Load document from corpus - documents are stored as JSON files with document ID
      const fileName = `${docMeta.id}.json`;
      const documentUrl = this.getFullUrl(`${this.corpusPath}${fileName}`);
      const response = await fetch(documentUrl);
      if (!response.ok) {
        throw new Error(`Failed to load document ${fileName}: ${response.statusText}`);
      }

      const document: LegalDocument = await response.json();
      
      // Cache the document
      this.documentsCache.set(documentId, document);
      
      return document;
    } catch (error) {
      console.error(`Failed to load document ${documentId}:`, error);
      return null;
    }
  }

  async loadAllDocuments(): Promise<LegalDocument[]> {
    if (!this.initialized) await this.initialize();

    const documents: LegalDocument[] = [];
    
    if (!this.metadata?.documents) return documents;

    for (const docMeta of this.metadata.documents) {
      const doc = await this.loadDocument(docMeta.id);
      if (doc) {
        documents.push(doc);
      }
    }

    return documents;
  }

  async loadEmbeddings(batchIndex: number = 0): Promise<Map<string, number[]>> {
    const embeddings = new Map<string, number[]>();

    try {
      // Load embeddings batch file
      const embeddingsUrl = this.getFullUrl(
        `${this.embeddingsPath}embeddings-${String(batchIndex).padStart(3, '0')}.json`
      );
      const response = await fetch(embeddingsUrl);
      
      if (!response.ok) {
        console.warn(`Embeddings batch ${batchIndex} not found`);
        return embeddings;
      }

      const batch = await response.json();
      
      // Process embeddings
      for (const item of batch) {
        embeddings.set(item.id, item.embedding);
        this.embeddingsCache.set(item.id, item.embedding);
      }

    } catch (error) {
      console.error(`Failed to load embeddings batch ${batchIndex}:`, error);
    }

    return embeddings;
  }

  async loadAllEmbeddings(): Promise<Map<string, number[]>> {
    const allEmbeddings = new Map<string, number[]>();

    try {
      const index = await this.loadEmbeddingsIndex();
      if (!index) {
        console.warn('Embeddings index not found');
        return allEmbeddings;
      }

      if (index.documents) {
        for (const documentId of Object.keys(index.documents)) {
          for (const [id, embedding] of await this.loadDocumentEmbeddings(documentId)) {
            allEmbeddings.set(id, embedding);
          }
        }
        return allEmbeddings;
      }

      const batchCount = index.batchFiles || 0;
      for (let i = 0; i < batchCount; i++) {
        const batchEmbeddings = await this.loadEmbeddings(i);
        for (const [id, embedding] of batchEmbeddings) {
          allEmbeddings.set(id, embedding);
        }
      }
    } catch (error) {
      console.error('Failed to load embeddings:', error);
    }

    return allEmbeddings;
  }

  async searchDocuments(query: {
    legalArea?: string;
    type?: string;
    hierarchy?: number;
  }): Promise<LegalDocument[]> {
    if (!this.initialized) await this.initialize();

    const results: LegalDocument[] = [];
    
    if (!this.metadata?.documents) return results;

    for (const docMeta of this.metadata.documents) {
      // Apply filters
      if (query.legalArea && docMeta.primaryArea !== query.legalArea) continue;
      if (query.type && docMeta.type !== query.type) continue;
      if (query.hierarchy !== undefined && docMeta.hierarchy !== query.hierarchy) continue;

      const doc = await this.loadDocument(docMeta.id);
      if (doc) {
        results.push(doc);
      }
    }

    return results;
  }

  async convertToVectorDocuments(): Promise<VectorDocument[]> {
    const documents = await this.loadAllDocuments();
    const embeddings = await this.loadAllEmbeddings();
    return documents.flatMap((doc) => this.toVectorDocuments(doc, embeddings));
  }

  /**
   * Chunks of one document paired with their embeddings. Chunks without a
   * real vector get a mock one so search still runs (and `grounded` stays
   * honest upstream because the engine reports embeddings as mock).
   */
  toVectorDocuments(doc: LegalDocument, embeddings: Map<string, number[]>): VectorDocument[] {
    // Structural sections (títulos, capítulos) are navigation, not answers:
    // the published index skips them (build-embeddings.ts) and so do we, so
    // they never get mock vectors nor outrank articles.
    return this.documentToChunks(doc).filter((chunk) => chunk.metadata?.type === undefined || chunk.metadata.type === 'article' || !Array.isArray(doc.content)).map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      embedding: embeddings.get(chunk.id) || this.generateMockEmbedding(),
      metadata: {
        title: doc.title,
        type: doc.type,
        legalArea: doc.primaryArea,
        hierarchy: doc.hierarchy,
        lastUpdated: doc.publicationDate,
        jurisdiction: doc.jurisdiction ?? 'mx',
        article: chunk.metadata?.article,
        contentType: chunk.metadata?.type,
        ...(chunk.metadata?.transitory ? { transitory: true } : {}),
        url: doc.officialUrl,
        sourceInstitution: doc.authority,
        publicationDate: doc.publicationDate,
        confidence: 0.95,
        version: '1.0'
      }
    }));
  }

  private documentToChunks(document: LegalDocument): LegalChunk[] {
    const chunks: LegalChunk[] = [];
    let chunkIndex = 0;

    if (!document.content || !Array.isArray(document.content)) {
      // If document doesn't have structured content, create a single chunk
      chunks.push({
        id: `${document.id}_chunk_0`,
        documentId: document.id,
        content: '',
        metadata: {
          type: document.type,
          hierarchy: document.hierarchy,
          legalArea: document.primaryArea,
          chunkIndex: 0
        },
        keywords: []
      });
      return chunks;
    }

    for (const section of document.content) {
      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        documentId: document.id,
        content: section.content,
        metadata: {
          type: section.type,
          article: section.number,
          title: section.title,
          hierarchy: document.hierarchy,
          legalArea: document.primaryArea,
          chunkIndex,
          ...(section.transitory ? { transitory: true } : {})
        },
        keywords: this.extractKeywords(section.content)
      });
      chunkIndex++;
    }

    return chunks;
  }

  private extractKeywords(content: string): string[] {
    const legalTerms = [
      'artículo', 'fracción', 'inciso', 'párrafo', 'constitución', 
      'código', 'ley', 'derecho', 'obligación', 'responsabilidad',
      'procedimiento', 'amparo', 'tribunal', 'juzgado', 'sentencia'
    ];
    
    const keywords: string[] = [];
    const lowerContent = content.toLowerCase();
    
    for (const term of legalTerms) {
      if (lowerContent.includes(term)) {
        keywords.push(term);
      }
    }
    
    return [...new Set(keywords)]; // Remove duplicates
  }

  private generateMockEmbedding(dimensions: number = 384): number[] {
    // Generate a normalized random vector for testing
    const vector: number[] = [];
    let magnitude = 0;
    
    for (let i = 0; i < dimensions; i++) {
      const value = (Math.random() - 0.5) * 2;
      vector.push(value);
      magnitude += value * value;
    }
    
    // Normalize
    magnitude = Math.sqrt(magnitude);
    return vector.map(v => v / magnitude);
  }

  getMetadata(): CorpusMetadata | null {
    return this.metadata;
  }

  clearCache(): void {
    this.documentsCache.clear();
    this.embeddingsCache.clear();
    this.embeddingsIndex = undefined;
  }

  async clearDocument(documentId: string): Promise<void> {
    this.documentsCache.delete(documentId);
    this.embeddingsCache.delete(documentId);
    
    // Update metadata
    if (this.metadata) {
      this.metadata.documents = this.metadata.documents.filter(d => d.id !== documentId);
      this.metadata.totalDocuments = this.metadata.documents.length;
    }
  }
}

// Singleton instance
export const documentLoader = new DocumentLoader();