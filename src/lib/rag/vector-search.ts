// Vector search implementation for RAG

import { EmbeddingManager } from '@/lib/embeddings/embedding-manager';
import type { 
  EmbeddingVector, 
  RAGSearchResult,
  RAGProgressEvent 
} from '@/types/embeddings';
import type { LegalDocument, LegalContent } from '@/types/legal';

export interface VectorSearchConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  topK?: number;
  scoreThreshold?: number;
  includeMetadata?: boolean;
  searchScope?: 'all' | 'document' | 'corpus';
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  embedding?: EmbeddingVector;
  metadata: {
    title?: string;
    article?: string;
    section?: string;
    legalArea?: string;
    hierarchy?: number;
    position: number;
    length: number;
  };
}

export class VectorSearch {
  private embeddingManager: EmbeddingManager;
  private documentChunks = new Map<string, DocumentChunk>();
  private chunkEmbeddings = new Map<string, EmbeddingVector>();
  private config: VectorSearchConfig;
  private progressCallback?: (event: RAGProgressEvent) => void;

  constructor(
    embeddingManager: EmbeddingManager,
    config: VectorSearchConfig = {},
    onProgress?: (event: RAGProgressEvent) => void
  ) {
    this.embeddingManager = embeddingManager;
    this.config = {
      chunkSize: 512,
      chunkOverlap: 50,
      topK: 5,
      scoreThreshold: 0.5,
      includeMetadata: true,
      searchScope: 'all',
      ...config
    };
    this.progressCallback = onProgress;
  }

  // Process and index a legal document
  async indexDocument(document: LegalDocument): Promise<void> {
    this.emitProgress('document_search', 'active', `Indexing document: ${document.title}`);

    try {
      // Create chunks from document content
      const chunks = this.createDocumentChunks(document);
      
      // Generate embeddings for chunks
      const texts = chunks.map(chunk => chunk.content);
      const embeddings = await this.embeddingManager.embedBatch(texts);

      // Store chunks and embeddings
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        
        this.documentChunks.set(chunk.id, chunk);
        this.chunkEmbeddings.set(chunk.id, embedding);
        chunk.embedding = embedding;
      }

      this.emitProgress('document_search', 'completed', `Indexed ${chunks.length} chunks from ${document.title}`);
    } catch (error) {
      this.emitProgress('document_search', 'error', `Failed to index document: ${document.title}`, { error });
      throw error;
    }
  }

  // Create chunks from a legal document
  private createDocumentChunks(document: LegalDocument): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const { chunkSize = 512, chunkOverlap = 50 } = this.config;

    if (!document.content || document.content.length === 0) {
      return chunks;
    }

    // Process each content section
    for (const content of document.content) {
      if (!content.content || content.type === 'metadata') continue;

      const text = content.content;
      const metadata = {
        title: document.title,
        article: content.type === 'article' ? content.number : undefined,
        section: content.type === 'section' ? content.title : undefined,
        legalArea: document.metadata?.legalArea,
        hierarchy: document.metadata?.hierarchy,
        position: 0,
        length: text.length
      };

      // Smart chunking for legal text
      if (content.type === 'article' || content.type === 'section') {
        // Keep articles and sections intact if they're within reasonable size
        if (text.length <= chunkSize * 1.5) {
          chunks.push({
            id: `${document.id}_${content.id}`,
            documentId: document.id,
            content: text,
            metadata
          });
        } else {
          // Split large articles/sections
          const articleChunks = this.splitTextIntoChunks(text, chunkSize, chunkOverlap);
          articleChunks.forEach((chunkText, index) => {
            chunks.push({
              id: `${document.id}_${content.id}_${index}`,
              documentId: document.id,
              content: chunkText,
              metadata: {
                ...metadata,
                position: index * (chunkSize - chunkOverlap)
              }
            });
          });
        }
      } else {
        // Regular chunking for other content
        const textChunks = this.splitTextIntoChunks(text, chunkSize, chunkOverlap);
        textChunks.forEach((chunkText, index) => {
          chunks.push({
            id: `${document.id}_${content.id}_${index}`,
            documentId: document.id,
            content: chunkText,
            metadata: {
              ...metadata,
              position: index * (chunkSize - chunkOverlap)
            }
          });
        });
      }
    }

    return chunks;
  }

  // Split text into overlapping chunks
  private splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
    const chunks: string[] = [];
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let currentLength = 0;
    
    for (const sentence of sentences) {
      if (currentLength + sentence.length > chunkSize && currentChunk) {
        chunks.push(currentChunk.trim());
        
        // Create overlap by keeping last part of current chunk
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + ' ' + sentence;
        currentLength = overlapText.length + sentence.length;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentLength += sentence.length;
      }
    }
    
    if (currentChunk) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }

  // Split text into sentences (handles Spanish punctuation)
  private splitIntoSentences(text: string): string[] {
    // Improved regex for Spanish/legal text
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    return sentences.map(s => s.trim());
  }

  // Search for similar documents/chunks
  async search(query: string, options: Partial<VectorSearchConfig> = {}): Promise<RAGSearchResult[]> {
    const config = { ...this.config, ...options };
    
    this.emitProgress('document_search', 'active', 'Searching documents...');

    try {
      // Generate query embedding
      this.emitProgress('embedding_generation', 'active', 'Generating query embedding...');
      const queryEmbedding = await this.embeddingManager.embed(query);
      this.emitProgress('embedding_generation', 'completed', 'Query embedding generated');

      // Search for similar chunks
      const results = await this.findSimilarChunks(queryEmbedding, config);
      
      this.emitProgress('document_search', 'completed', `Found ${results.length} relevant documents`);
      
      return results;
    } catch (error) {
      this.emitProgress('document_search', 'error', 'Search failed', { error });
      throw error;
    }
  }

  // Find similar chunks using vector similarity
  private async findSimilarChunks(
    queryEmbedding: EmbeddingVector,
    config: VectorSearchConfig
  ): Promise<RAGSearchResult[]> {
    const scores: Array<{ chunkId: string; score: number }> = [];

    // Calculate similarity scores for all chunks
    for (const [chunkId, chunkEmbedding] of this.chunkEmbeddings) {
      const chunk = this.documentChunks.get(chunkId);
      if (!chunk) continue;

      // Apply search scope filter
      if (config.searchScope === 'document' && chunk.documentId !== config.searchScope) {
        continue;
      }

      const score = this.embeddingManager.calculateSimilarity(queryEmbedding, chunkEmbedding);
      
      if (score >= (config.scoreThreshold || 0)) {
        scores.push({ chunkId, score });
      }
    }

    // Sort by score and get top K
    scores.sort((a, b) => b.score - a.score);
    const topResults = scores.slice(0, config.topK || 5);

    // Convert to search results
    const results: RAGSearchResult[] = topResults.map(({ chunkId, score }) => {
      const chunk = this.documentChunks.get(chunkId)!;
      
      return {
        documentId: chunk.documentId,
        content: chunk.content,
        score,
        metadata: config.includeMetadata ? chunk.metadata : undefined,
        highlights: this.generateHighlights(chunk.content, 100)
      };
    });

    return results;
  }

  // Generate text highlights for search results
  private generateHighlights(text: string, maxLength: number): Array<{ text: string; position: [number, number] }> {
    // Simple highlight generation - take first sentence or maxLength chars
    const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text;
    const highlight = firstSentence.length > maxLength 
      ? firstSentence.substring(0, maxLength) + '...'
      : firstSentence;

    return [{
      text: highlight,
      position: [0, Math.min(highlight.length, text.length)]
    }];
  }

  // Clear all indexed documents
  clearIndex(): void {
    this.documentChunks.clear();
    this.chunkEmbeddings.clear();
  }

  // Get statistics
  getStats() {
    return {
      totalChunks: this.documentChunks.size,
      totalEmbeddings: this.chunkEmbeddings.size,
      documentsIndexed: new Set(
        Array.from(this.documentChunks.values()).map(chunk => chunk.documentId)
      ).size
    };
  }

  private emitProgress(
    stage: RAGProgressEvent['stage'],
    status: RAGProgressEvent['status'],
    message?: string,
    details?: any
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        stage,
        status,
        message,
        details,
        timestamp: Date.now()
      });
    }
  }
}