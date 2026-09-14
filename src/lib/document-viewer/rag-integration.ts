import type { LegalDocument, LegalContent, LegalChunk } from '../../types/legal';
import type { SearchResult, DocumentMetadata } from '../../types/rag';

/**
 * `SearchResult['metadata']` (`DocumentMetadata`, `src/types/rag.ts`) has no
 * `number`/`documentId`/`documentTitle` fields; this module's navigation and
 * RAG-context helpers need them, so we extend locally instead of widening
 * the shared type. A superset assigns fine to `DocumentMetadata` as long as
 * it's built through a typed value rather than an inline literal.
 */
export interface SearchResultMetadata extends DocumentMetadata {
  number?: string;
  documentId?: string;
  documentTitle?: string;
}

/** Result of {@link DocumentRAGIntegration.extractContext}. */
export interface DocumentContext {
  target: LegalContent | null;
  context: LegalContent[];
  hierarchy: LegalContent[];
}

export class DocumentRAGIntegration {
  private document: LegalDocument;

  constructor(document: LegalDocument) {
    this.document = document;
  }

  /**
   * Convert document content to RAG-compatible chunks
   */
  generateChunks(options: {
    maxChunkSize?: number;
    overlapSize?: number;
    preserveStructure?: boolean;
  } = {}): LegalChunk[] {
    const {
      maxChunkSize = 1000,
      overlapSize = 100,
      preserveStructure = true
    } = options;

    if (!this.document.content) return [];

    const chunks: LegalChunk[] = [];
    let chunkIndex = 0;

    for (const content of this.document.content) {
      if (preserveStructure) {
        // Create one chunk per content item (article, section, etc.)
        chunks.push({
          id: `${this.document.id}_chunk_${chunkIndex}`,
          documentId: this.document.id,
          content: content.content,
          metadata: {
            type: content.type,
            article: content.number,
            title: content.title,
            hierarchy: this.document.hierarchy,
            legalArea: this.document.primaryArea,
            originalId: content.id,
            documentTitle: this.document.title,
            chunkIndex
          },
          embedding: content.embedding,
          keywords: this.extractKeywords(content.content)
        });
        chunkIndex++;
      } else {
        // Split large content into smaller chunks
        const contentChunks = this.splitContent(content.content, maxChunkSize, overlapSize);
        
        contentChunks.forEach((chunkContent, subIndex) => {
          chunks.push({
            id: `${this.document.id}_chunk_${chunkIndex}_${subIndex}`,
            documentId: this.document.id,
            content: chunkContent,
            metadata: {
              type: content.type,
              article: content.number,
              title: content.title,
              hierarchy: this.document.hierarchy,
              legalArea: this.document.primaryArea,
              originalId: content.id,
              documentTitle: this.document.title,
              // `${documentId}_chunk_${chunkIndex}_${subIndex}` (the chunk id
              // above) already encodes the parent chunk; `LegalChunk.metadata`
              // has no `isSubChunk`/`parentChunk` fields to duplicate it in.
              chunkIndex: chunkIndex + subIndex,
              partNumber: subIndex,
              totalParts: contentChunks.length,
              isLastPart: subIndex === contentChunks.length - 1
            },
            keywords: this.extractKeywords(chunkContent)
          });
        });
        chunkIndex += contentChunks.length;
      }
    }

    return chunks;
  }

  /**
   * Perform semantic search within the document
   */
  async semanticSearch(
    query: string,
    options: {
      topK?: number;
      minScore?: number;
      filterTypes?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    const { topK = 5, minScore = 0.1, filterTypes } = options;
    
    if (!this.document.content) return [];

    const results: SearchResult[] = [];
    
    // Simple keyword-based search (in production, use actual embeddings)
    for (const content of this.document.content) {
      if (filterTypes && !filterTypes.includes(content.type)) continue;
      
      const score = this.calculateSemanticScore(query, content.content);
      if (score >= minScore) {
        results.push({
          id: content.id,
          content: content.content,
          score,
          metadata: this.buildSearchMetadata(content)
        });
      }
    }

    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Find related sections based on content similarity
   */
  findRelatedSections(
    sectionId: string,
    options: {
      topK?: number;
      minScore?: number;
    } = {}
  ): SearchResult[] {
    const { topK = 3, minScore = 0.2 } = options;
    
    if (!this.document.content) return [];

    const targetSection = this.document.content.find(c => c.id === sectionId);
    if (!targetSection) return [];

    const results: SearchResult[] = [];
    
    for (const content of this.document.content) {
      if (content.id === sectionId) continue;
      
      const score = this.calculateContentSimilarity(targetSection.content, content.content);
      if (score >= minScore) {
        results.push({
          id: content.id,
          content: content.content,
          score,
          metadata: this.buildSearchMetadata(content)
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }

  /**
   * Build the `DocumentMetadata` (plus this module's extra navigation
   * fields) shared by `semanticSearch` and `findRelatedSections`.
   */
  private buildSearchMetadata(content: LegalContent): SearchResultMetadata {
    return {
      type: content.type,
      number: content.number,
      article: content.number,
      title: content.title ?? this.document.title,
      documentId: this.document.id,
      documentTitle: this.document.title,
      hierarchy: this.document.hierarchy,
      legalArea: this.document.primaryArea,
      lastUpdated: this.document.lastUpdated ?? this.document.publicationDate
    };
  }

  /**
   * Extract context around a specific section for RAG
   */
  extractContext(
    sectionId: string,
    options: {
      contextWindow?: number;
      includeHierarchy?: boolean;
    } = {}
  ): DocumentContext {
    const { contextWindow = 2, includeHierarchy = true } = options;

    if (!this.document.content) {
      return { target: null, context: [], hierarchy: [] };
    }

    const targetIndex = this.document.content.findIndex(c => c.id === sectionId);
    if (targetIndex === -1) {
      return { target: null, context: [], hierarchy: [] };
    }

    const target = this.document.content[targetIndex];
    if (!target) {
      return { target: null, context: [], hierarchy: [] };
    }
    
    // Get surrounding context
    const startIndex = Math.max(0, targetIndex - contextWindow);
    const endIndex = Math.min(this.document.content.length, targetIndex + contextWindow + 1);
    const context = this.document.content.slice(startIndex, endIndex).filter(c => c.id !== sectionId);

    // Get hierarchical context (parent sections)
    const hierarchy = includeHierarchy ? this.getHierarchicalContext(target) : [];

    return { target, context, hierarchy };
  }

  /**
   * Generate embeddings for document content (placeholder)
   */
  async generateEmbeddings(): Promise<void> {
    // In production, this would call an embedding service.
    // Placeholder implementation
    if (this.document.content) {
      for (const content of this.document.content) {
        // Mock embedding generation
        content.embedding = Array.from({ length: 384 }, () => Math.random() - 0.5);
      }
    }
  }

  /**
   * Private helper methods
   */
  private splitContent(content: string, maxSize: number, overlapSize: number): string[] {
    const chunks: string[] = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim() + '.';
      
      if (currentChunk.length + trimmedSentence.length > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        
        // Add overlap from the end of current chunk
        const overlapWords = currentChunk.split(' ').slice(-Math.floor(overlapSize / 6));
        currentChunk = overlapWords.join(' ') + ' ' + trimmedSentence;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
    }
    
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : [content];
  }

  private extractKeywords(content: string): string[] {
    // Simple keyword extraction
    const stopWords = new Set([
      'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le',
      'da', 'su', 'por', 'son', 'con', 'no', 'una', 'pero', 'sus', 'al', 'él', 'esto',
      'ya', 'todo', 'esta', 'fue', 'han', 'ser', 'para', 'está', 'son', 'del', 'las',
      'los', 'nos', 'ni', 'o', 'si', 'más', 'muy', 'cuando', 'hasta', 'sin', 'sobre'
    ]);

    const words = content.toLowerCase()
      .replace(/[^\w\sáéíóúüñ]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.has(word));

    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  private calculateSemanticScore(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let score = 0;
    const contentWordSet = new Set(contentWords);
    
    // Exact phrase matching
    if (content.toLowerCase().includes(query.toLowerCase())) {
      score += 0.5;
    }
    
    // Word overlap scoring
    for (const word of queryWords) {
      if (contentWordSet.has(word)) {
        score += 1 / queryWords.length;
      }
    }
    
    // Length normalization
    return Math.min(score, 1.0);
  }

  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size; // Jaccard similarity
  }

  private getHierarchicalContext(target: LegalContent): LegalContent[] {
    if (!this.document.content) return [];

    const hierarchy: LegalContent[] = [];
    let currentParent = target.parent;
    
    while (currentParent) {
      const parent = this.document.content.find(c => c.id === currentParent);
      if (parent) {
        hierarchy.unshift(parent);
        currentParent = parent.parent;
      } else {
        break;
      }
    }
    
    return hierarchy;
  }
}

/** A `SearchResult` produced by `DocumentRAGIntegration`, carrying the extra navigation fields. */
export type EnrichedSearchResult = SearchResult & { metadata: SearchResultMetadata };

/** A document navigation entry, as returned by `convertSearchResultsToNavigation`. */
export interface DocumentNavigationEntry {
  id: string;
  type: string;
  number?: string;
  title: string;
  score: number;
  level: number;
}

/**
 * Utility functions for document viewer integration
 */
export const DocumentViewerUtils = {
  /**
   * Create a document RAG integration instance
   */
  createRAGIntegration(document: LegalDocument): DocumentRAGIntegration {
    return new DocumentRAGIntegration(document);
  },

  /**
   * Convert search results to document navigation format
   */
  convertSearchResultsToNavigation(results: EnrichedSearchResult[]): DocumentNavigationEntry[] {
    return results.map(result => ({
      id: result.id,
      type: result.metadata.type,
      number: result.metadata.number,
      title: result.metadata.title || result.content.substring(0, 100) + '...',
      score: result.score,
      level: this.getTypeLevel(result.metadata.type)
    }));
  },

  /**
   * Get hierarchical level for content type
   */
  getTypeLevel(type: string): number {
    const levelMap: { [key: string]: number } = {
      'title': 0,
      'chapter': 1,
      'section': 2,
      'article': 3,
      'paragraph': 4,
      'fraction': 5
    };
    return levelMap[type] || 3;
  },

  /**
   * Format content for RAG context window
   */
  formatContextForRAG(context: DocumentContext): string {
    let formatted = '';
    
    // Add hierarchical context
    if (context.hierarchy.length > 0) {
      formatted += '=== CONTEXTO JERÁRQUICO ===\n';
      for (const item of context.hierarchy) {
        formatted += `[${item.type.toUpperCase()}${item.number ? ` ${item.number}` : ''}] ${item.title || ''}\n`;
        formatted += `${item.content.substring(0, 200)}...\n\n`;
      }
    }
    
    // Add target content
    if (context.target) {
      formatted += '=== CONTENIDO PRINCIPAL ===\n';
      formatted += `[${context.target.type.toUpperCase()}${context.target.number ? ` ${context.target.number}` : ''}] ${context.target.title || ''}\n`;
      formatted += `${context.target.content}\n\n`;
    }
    
    // Add surrounding context
    if (context.context.length > 0) {
      formatted += '=== CONTEXTO RELACIONADO ===\n';
      for (const item of context.context) {
        formatted += `[${item.type.toUpperCase()}${item.number ? ` ${item.number}` : ''}] ${item.title || ''}\n`;
        formatted += `${item.content.substring(0, 300)}...\n\n`;
      }
    }
    
    return formatted;
  }
};