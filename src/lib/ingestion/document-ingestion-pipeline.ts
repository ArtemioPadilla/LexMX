// Document ingestion pipeline orchestrator
// Manages the complete flow from document fetching to embedding generation

import type { DocumentRequest, LegalDocument, LegalChunk } from '@/types/legal';
import type { EmbeddingVector } from '@/types/embeddings';
import { EventEmitter } from 'events';
import { DocumentFetcher, type FetchOptions } from './document-fetcher';
import { DocumentParser } from './document-parser';
import { ContextualChunker } from '../rag/chunking/contextual-chunker';
import { EmbeddingManager } from '../embeddings/embedding-manager';

export interface IngestionPipelineConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  preserveStructure?: boolean;
  generateEmbeddings?: boolean;
  validateSources?: boolean;
  batchSize?: number;
}

/**
 * Narrow surface the pipeline actually needs from a fetcher. Lets tests inject
 * a fake instead of stubbing `DocumentFetcher` internals, and keeps
 * `ingestFromFile` from having to fake a whole `DocumentFetcher`.
 */
export interface IngestionDocumentFetcher {
  fetchFromRequest(request: DocumentRequest, options?: FetchOptions): Promise<string | null>;
}

/**
 * Narrow surface the pipeline needs from an embedding backend. `EmbeddingManager`
 * satisfies this structurally; tests can inject a lightweight fake instead of
 * spinning up the real (transformers-backed) manager.
 */
export interface EmbeddingGenerator {
  initialize(): Promise<void>;
  embed(text: string): Promise<EmbeddingVector>;
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
}

/** Object stores the pipeline is allowed to write ingestion output into. */
export type IngestionStoreName = 'legal_documents' | 'chunks' | 'embeddings';

/**
 * Narrow surface the pipeline needs from a persistence backend. Defaults to
 * `EnhancedOfflineStorage`, loaded lazily so the pipeline doesn't pull
 * IndexedDB-only code into non-browser contexts (or tests) that inject a fake.
 */
export interface DocumentStore {
  store<T>(storeName: IngestionStoreName, key: string, data: T): Promise<void>;
}

export interface IngestionPipelineDependencies {
  fetcher?: IngestionDocumentFetcher;
  parser?: DocumentParser;
  chunker?: ContextualChunker;
  embeddingManager?: EmbeddingGenerator;
  store?: DocumentStore;
}

export interface IngestionProgressDetails {
  chunkingProgress?: number;
  chunkingMessage?: string;
  currentBatch?: number;
  totalBatches?: number;
  batchSize?: number;
  totalChunks?: number;
  processedChunks?: number;
  stats?: unknown;
  [key: string]: unknown;
}

export interface IngestionProgress {
  stage: 'fetching' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  details?: IngestionProgressDetails;
  timestamp: number;
}

export interface IngestionResult {
  success: boolean;
  documentId?: string;
  document?: LegalDocument;
  chunks?: LegalChunk[];
  embeddings?: Map<string, EmbeddingVector>;
  stats: {
    fetchTime: number;
    parseTime: number;
    chunkTime: number;
    embeddingTime: number;
    totalTime: number;
    chunkCount: number;
    tokenCount: number;
  };
  errors?: string[];
}

/** Default persistence backend: lazily-loaded `EnhancedOfflineStorage`. */
const defaultDocumentStore: DocumentStore = {
  async store<T>(storeName: IngestionStoreName, key: string, data: T): Promise<void> {
    const { EnhancedOfflineStorage } = await import('../storage/enhanced-offline-storage');
    await EnhancedOfflineStorage.getInstance().store(storeName, key, data);
  }
};

export class DocumentIngestionPipeline extends EventEmitter {
  private fetcher: IngestionDocumentFetcher;
  private parser: DocumentParser;
  private chunker: ContextualChunker;
  private embeddingManager: EmbeddingGenerator;
  private documentStore: DocumentStore;
  private config: Required<IngestionPipelineConfig>;
  private abortController: AbortController | null = null;

  constructor(
    config: IngestionPipelineConfig = {},
    dependencies: IngestionPipelineDependencies = {}
  ) {
    super();

    this.config = {
      chunkSize: 512,
      chunkOverlap: 50,
      preserveStructure: true,
      generateEmbeddings: true,
      validateSources: true,
      batchSize: 15, // Balanced for responsiveness vs performance
      ...config
    };

    this.fetcher = dependencies.fetcher ?? new DocumentFetcher();
    this.parser = dependencies.parser ?? new DocumentParser();
    this.chunker = dependencies.chunker ?? new ContextualChunker({
      maxChunkSize: this.config.chunkSize,
      overlapSize: this.config.chunkOverlap,
      preserveStructure: this.config.preserveStructure
    });
    this.embeddingManager = dependencies.embeddingManager ?? new EmbeddingManager({
      defaultProvider: 'transformers'
    });
    this.documentStore = dependencies.store ?? defaultDocumentStore;
  }

  async initialize(): Promise<void> {
    await this.embeddingManager.initialize();
  }

  /**
   * Ingest a document from a request
   */
  async ingestFromRequest(request: DocumentRequest): Promise<IngestionResult> {
    const startTime = Date.now();
    const stats = {
      fetchTime: 0,
      parseTime: 0,
      chunkTime: 0,
      embeddingTime: 0,
      totalTime: 0,
      chunkCount: 0,
      tokenCount: 0
    };
    const errors: string[] = [];

    try {
      this.abortController = new AbortController();

      // Stage 1: Fetch document
      this.emitProgress('fetching', 0, 'Fetching document from source...');
      const fetchStart = Date.now();
      
      const rawContent = await this.fetcher.fetchFromRequest(request, {
        validateSource: this.config.validateSources,
        signal: this.abortController.signal
      });
      
      stats.fetchTime = Date.now() - fetchStart;
      this.emitProgress('fetching', 100, 'Document fetched successfully');

      if (!rawContent) {
        throw new Error('Failed to fetch document content');
      }

      // Stage 2: Parse document
      this.emitProgress('parsing', 0, 'Parsing document structure...');
      const parseStart = Date.now();
      
      const document = await this.parser.parse(rawContent, {
        documentType: request.type,
        metadata: {
          title: request.title,
          type: request.type,
          hierarchy: request.hierarchy,
          primaryArea: request.primaryArea,
          authority: request.authority
        }
      });
      
      stats.parseTime = Date.now() - parseStart;
      this.emitProgress('parsing', 100, `Parsed ${document.content?.length || 0} sections`);

      // Stage 3: Generate chunks (with progress updates)
      this.emitProgress('chunking', 0, 'Creating contextual chunks...');
      const chunkStart = Date.now();
      
      const chunks = await this.chunker.chunkDocument(document, (progress, message) => {
        this.emitProgress('chunking', Math.round(progress * 0.8), message, {
          chunkingProgress: progress,
          chunkingMessage: message
        });
      });
      stats.chunkCount = chunks.length;
      
      // Async token counting to prevent blocking on large documents
      this.emitProgress('chunking', 85, 'Calculating token counts...');
      stats.tokenCount = await this.estimateTokensAsync(chunks);
      
      stats.chunkTime = Date.now() - chunkStart;
      this.emitProgress('chunking', 100, `Created ${chunks.length} chunks`);

      // Stage 4: Generate embeddings
      let embeddings: Map<string, EmbeddingVector> | undefined;
      
      if (this.config.generateEmbeddings) {
        this.emitProgress('embedding', 0, 'Generating embeddings...');
        const embeddingStart = Date.now();
        
        embeddings = await this.generateEmbeddings(chunks);
        
        stats.embeddingTime = Date.now() - embeddingStart;
        this.emitProgress('embedding', 100, `Generated ${embeddings.size} embeddings`);
      }

      // Stage 5: Store document
      this.emitProgress('storing', 0, 'Storing document and chunks...');
      
      // Save to corpus directory (in production, this would be a proper storage backend)
      await this.storeDocument(document, chunks, embeddings);
      
      this.emitProgress('storing', 100, 'Document stored successfully');

      // Complete
      stats.totalTime = Date.now() - startTime;
      this.emitProgress('complete', 100, 'Ingestion complete', { stats });

      return {
        success: true,
        documentId: document.id,
        document,
        chunks,
        embeddings,
        stats,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(errorMessage);
      
      this.emitProgress('error', 0, `Ingestion failed: ${errorMessage}`);
      
      return {
        success: false,
        stats: {
          ...stats,
          totalTime: Date.now() - startTime
        },
        errors
      };
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Ingest a pre-parsed document (for reindexing)
   */
  async ingestDocument(document: LegalDocument): Promise<IngestionResult> {
    const startTime = Date.now();
    
    try {
      this.emitProgress('parsing', 0, 'Processing document...');
      
      // Skip fetching and parsing since we already have the document
      
      // Chunk the document
      this.emitProgress('chunking', 25, 'Creating document chunks...');
      const chunks = await this.chunker.chunkDocument(document);
      
      // Generate embeddings
      this.emitProgress('embedding', 50, 'Generating embeddings...');
      const embeddings = new Map<string, EmbeddingVector>();
      
      for (const [i, chunk] of chunks.entries()) {
        const embedding = await this.embeddingManager.embed(chunk.content);
        embeddings.set(chunk.id, embedding);

        this.emitProgress(
          'embedding',
          50 + (i / chunks.length) * 40,
          `Embedding chunk ${i + 1}/${chunks.length}`
        );
      }
      
      // Store the document and embeddings
      this.emitProgress('storing', 90, 'Storing document and embeddings...');
      await this.storeDocument(document, chunks, embeddings);
      
      this.emitProgress('complete', 100, 'Document ingestion complete!');
      
      return {
        success: true,
        documentId: document.id,
        stats: {
          fetchTime: 0,
          parseTime: 0,
          chunkTime: Date.now() - startTime,
          embeddingTime: Date.now() - startTime,
          totalTime: Date.now() - startTime,
          chunkCount: chunks.length,
          tokenCount: this.estimateTokens(document.content?.map(c => c.content).join(' ') || '')
        }
      };
    } catch (error) {
      this.emitProgress('error', 0, 'Ingestion failed', { error: error instanceof Error ? error.message : String(error) });
      return {
        success: false,
        stats: {
          fetchTime: 0,
          parseTime: 0,
          chunkTime: 0,
          embeddingTime: 0,
          totalTime: Date.now() - startTime,
          chunkCount: 0,
          tokenCount: 0
        },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Ingest a document from a file
   */
  async ingestFromFile(file: File): Promise<IngestionResult> {
    const request: Partial<DocumentRequest> = {
      title: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      sources: [{
        id: `upload_${Date.now()}`,
        type: 'pdf_upload',
        filename: file.name,
        fileSize: file.size,
        fileType: file.type,
        uploadedAt: new Date().toISOString(),
        verified: false,
        isOfficial: false
      }]
    };

    // Read file content
    const content = await this.readFile(file);

    // Temporarily replace the fetcher with one that just returns the file's
    // already-read content, so ingestFromRequest can be reused unchanged.
    const fileFetcher: IngestionDocumentFetcher = {
      fetchFromRequest: async () => content
    };
    const originalFetcher = this.fetcher;
    this.fetcher = fileFetcher;

    try {
      return await this.ingestFromRequest(request as DocumentRequest);
    } finally {
      this.fetcher = originalFetcher;
    }
  }

  /**
   * Ingest a document from a URL
   */
  async ingestFromUrl(url: string, metadata?: Partial<LegalDocument>): Promise<IngestionResult> {
    const { content: _metadataContent, status: _metadataStatus, ...restMetadata } = metadata || {};
    const request: Partial<DocumentRequest> = {
      title: metadata?.title || 'Document from URL',
      type: metadata?.type || 'law',
      sources: [{
        id: `url_${Date.now()}`,
        type: 'url',
        url,
        verified: false,
        isOfficial: this.isOfficialSource(url)
      }],
      ...restMetadata
    };

    return await this.ingestFromRequest(request as DocumentRequest);
  }

  /**
   * Batch ingest multiple documents
   */
  async ingestBatch(requests: DocumentRequest[]): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];
    
    for (const [i, request] of requests.entries()) {
      this.emit('batch-progress', {
        current: i + 1,
        total: requests.length,
        currentDocument: request.title
      });

      const result = await this.ingestFromRequest(request);
      results.push(result);

      // Small delay between documents to avoid overwhelming the system
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  }

  /**
   * Cancel the current ingestion process
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.emitProgress('error', 0, 'Ingestion cancelled by user');
    }
  }

  /**
   * Private helper methods
   */
  private async generateEmbeddings(
    chunks: LegalChunk[]
  ): Promise<Map<string, EmbeddingVector>> {
    const embeddings = new Map<string, EmbeddingVector>();
    const batches = this.createBatches(chunks, this.config.batchSize);

    for (const [i, batch] of batches.entries()) {
      const progress = Math.round((i / batches.length) * 100);
      
      // Detailed progress with batch information
      this.emitProgress(
        'embedding', 
        progress, 
        `Processing batch ${i + 1}/${batches.length} (${batch.length} chunks)`,
        { 
          currentBatch: i + 1,
          totalBatches: batches.length,
          batchSize: batch.length,
          totalChunks: chunks.length,
          processedChunks: i * this.config.batchSize
        }
      );
      
      const texts = batch.map(chunk => chunk.content);
      const batchEmbeddings = await this.embeddingManager.embedBatch(texts);

      batch.forEach((chunk, j) => {
        const embedding = batchEmbeddings[j];
        // Defensive: only record a result if the batch embedder actually
        // returned one for this position (it should always match 1:1).
        if (embedding) {
          embeddings.set(chunk.id, embedding);
        }
      });
      
      // Critical: Yield control to the main thread to prevent UI blocking
      // This allows the UI to update progress and remain responsive
      if (i < batches.length - 1) { // Don't delay after the last batch
        // More aggressive yielding for better responsiveness
        await new Promise(resolve => setTimeout(resolve, 5)); // Small delay
        
        // Additionally, yield to the browser's rendering cycle
        await new Promise(resolve => {
          if (typeof requestAnimationFrame !== 'undefined') {
            requestAnimationFrame(() => {
              // Double RAF for smoother updates
              requestAnimationFrame(resolve);
            });
          } else {
            setTimeout(resolve, 32); // ~30fps fallback for more processing time
          }
        });
        
        // Add extra yield every 10 batches for very smooth experience
        if (i % 10 === 0 && i > 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    return embeddings;
  }

  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private async storeDocument(
    document: LegalDocument,
    chunks: LegalChunk[],
    embeddings?: Map<string, EmbeddingVector>
  ): Promise<void> {
    try {
      // Store the complete document
      await this.documentStore.store('legal_documents', document.id, document);

      // Store chunks for RAG engine
      for (const chunk of chunks) {
        await this.documentStore.store('chunks', chunk.id, chunk);
      }

      // Store embeddings
      if (embeddings) {
        for (const [chunkId, embedding] of embeddings.entries()) {
          await this.documentStore.store('embeddings', chunkId, embedding);
        }
      }

    } catch (error) {
      console.error('Failed to store document:', error);
      throw error;
    }
  }

  private async readFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  private isOfficialSource(url: string): boolean {
    const officialDomains = [
      'dof.gob.mx',
      'scjn.gob.mx',
      'diputados.gob.mx',
      'senado.gob.mx',
      'gob.mx'
    ];
    
    try {
      const domain = new URL(url).hostname.toLowerCase();
      return officialDomains.some(official => domain.includes(official));
    } catch {
      return false;
    }
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  private async estimateTokensAsync(chunks: LegalChunk[]): Promise<number> {
    let totalTokens = 0;

    for (const [i, chunk] of chunks.entries()) {
      totalTokens += this.estimateTokens(chunk.content);

      // Yield control every 100 chunks to prevent blocking
      if (i % 100 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    return totalTokens;
  }

  private emitProgress(
    stage: IngestionProgress['stage'],
    progress: number,
    message: string,
    details?: IngestionProgressDetails
  ): void {
    const event: IngestionProgress = {
      stage,
      progress,
      message,
      details,
      timestamp: Date.now()
    };
    
    this.emit('progress', event);
  }
}

// Singleton instance
export const ingestionPipeline = new DocumentIngestionPipeline();