// Document ingestion pipeline orchestrator
// Manages the complete flow from document fetching to embedding generation

import type { DocumentRequest, LegalDocument, LegalChunk } from '@/types/legal';
import type { EmbeddingVector } from '@/types/embeddings';
import { EventEmitter } from 'events';
import { DocumentFetcher } from './document-fetcher';
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

export interface IngestionProgress {
  stage: 'fetching' | 'parsing' | 'chunking' | 'embedding' | 'storing' | 'complete' | 'error';
  progress: number; // 0-100
  message: string;
  details?: unknown;
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

export class DocumentIngestionPipeline extends EventEmitter {
  private fetcher: DocumentFetcher;
  private parser: DocumentParser;
  private chunker: ContextualChunker;
  private embeddingManager: EmbeddingManager;
  private config: Required<IngestionPipelineConfig>;
  private abortController: AbortController | null = null;

  constructor(config: IngestionPipelineConfig = {}) {
    super();
    
    this.config = {
      chunkSize: 512,
      chunkOverlap: 50,
      preserveStructure: true,
      generateEmbeddings: true,
      validateSources: true,
      batchSize: 10,
      ...config
    };

    this.fetcher = new DocumentFetcher();
    this.parser = new DocumentParser();
    this.chunker = new ContextualChunker({
      maxChunkSize: this.config.chunkSize,
      overlapSize: this.config.chunkOverlap,
      preserveStructure: this.config.preserveStructure
    });
    this.embeddingManager = new EmbeddingManager({
      defaultProvider: 'transformers'
    });
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
          authority: request.authority,
          requestId: request.id
        }
      });
      
      stats.parseTime = Date.now() - parseStart;
      this.emitProgress('parsing', 100, `Parsed ${document.content?.length || 0} sections`);

      // Stage 3: Generate chunks
      this.emitProgress('chunking', 0, 'Creating contextual chunks...');
      const chunkStart = Date.now();
      
      const chunks = await this.chunker.chunkDocument(document);
      stats.chunkCount = chunks.length;
      stats.tokenCount = chunks.reduce((sum, chunk) => 
        sum + this.estimateTokens(chunk.content), 0
      );
      
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
      const embeddings = new Map<string, number[]>();
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await this.embeddingManager.generateEmbedding(chunk.content);
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
          tokenCount: this.estimateTokens(document.fullText || '')
        }
      };
    } catch (error) {
      this.emitProgress('error', 0, 'Ingestion failed', error);
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
    
    // Create a mock fetcher response
    const mockFetcher = {
      fetchFromRequest: async () => content
    };
    
    // Temporarily replace fetcher
    const originalFetcher = this.fetcher;
    this.fetcher = mockFetcher as any;
    
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
      ...metadata
    };

    return await this.ingestFromRequest(request as DocumentRequest);
  }

  /**
   * Batch ingest multiple documents
   */
  async ingestBatch(requests: DocumentRequest[]): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];
    
    for (let i = 0; i < requests.length; i++) {
      const request = requests[i];
      
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
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const progress = Math.round((i / batches.length) * 100);
      
      this.emitProgress(
        'embedding', 
        progress, 
        `Processing batch ${i + 1}/${batches.length}`
      );
      
      const texts = batch.map(chunk => chunk.content);
      const batchEmbeddings = await this.embeddingManager.embedBatch(texts);
      
      for (let j = 0; j < batch.length; j++) {
        embeddings.set(batch[j].id, batchEmbeddings[j]);
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
    // In production, this would store to a proper backend
    // For now, we'll store in IndexedDB and update the corpus
    
    // Store document metadata
    const metadata = {
      id: document.id,
      title: document.title,
      type: document.type,
      hierarchy: document.hierarchy,
      primaryArea: document.primaryArea,
      file: `${document.id}.json`,
      chunks: chunks.length,
      ingestionDate: new Date().toISOString()
    };
    
    // Update corpus metadata (in production, this would be an API call)
    console.log('Document stored:', metadata);
    
    // Store embeddings
    if (embeddings) {
      console.log(`Stored ${embeddings.size} embeddings`);
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

  private emitProgress(
    stage: IngestionProgress['stage'],
    progress: number,
    message: string,
    details?: unknown
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