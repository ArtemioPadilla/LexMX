// Hybrid search engine combining semantic and keyword search for legal documents

import type { SearchResult, SearchOptions } from '@/types/rag';
import type { LegalArea, QueryType } from '@/types/legal';

export interface HybridSearchOptions extends SearchOptions {
  semanticWeight?: number;
  keywordWeight?: number;
  queryType?: QueryType;
  legalArea?: LegalArea;
  boostFactors?: {
    recency?: number;
    hierarchy?: number;
    exactMatch?: number;
  };
}

export interface KeywordSearchResult {
  id: string;
  content: string;
  score: number;
  matches: Array<{
    term: string;
    frequency: number;
    positions: number[];
  }>;
}

export interface SemanticSearchResult {
  id: string;
  content: string;
  score: number;
  embedding?: number[];
}

/**
 * BM25 (Best Matching 25) implementation for keyword search
 */
export class BM25Search {
  private documents: Map<string, {
    id: string;
    content: string;
    tokens: string[];
    metadata?: any;
  }> = new Map();
  
  private termFrequencies: Map<string, Map<string, number>> = new Map();
  private documentFrequencies: Map<string, number> = new Map();
  private averageDocumentLength = 0;
  
  // BM25 hyperparameters optimized for legal text
  private readonly k1 = 1.2; // Term frequency saturation parameter
  private readonly b = 0.75; // Length normalization parameter

  /**
   * Add document to the search index
   */
  addDocument(id: string, content: string, metadata?: any): void {
    const tokens = this.tokenize(content);
    const document = { id, content, tokens, metadata };
    
    this.documents.set(id, document);
    this.updateTermFrequencies(id, tokens);
    this.updateDocumentFrequencies(tokens);
    this.updateAverageDocumentLength();
  }

  /**
   * Search documents using BM25 scoring
   */
  search(query: string, options: { topK?: number; boost?: Record<string, number> } = {}): KeywordSearchResult[] {
    const queryTerms = this.tokenize(query);
    const scores = new Map<string, number>();
    const matches = new Map<string, Array<{ term: string; frequency: number; positions: number[] }>>();

    // Calculate BM25 score for each document
    for (const [docId, document] of this.documents) {
      let totalScore = 0;
      const docMatches: Array<{ term: string; frequency: number; positions: number[] }> = [];

      for (const term of queryTerms) {
        const termFreq = this.getTermFrequency(docId, term);
        if (termFreq === 0) continue;

        const docFreq = this.documentFrequencies.get(term) || 0;
        const idf = Math.log((this.documents.size - docFreq + 0.5) / (docFreq + 0.5));
        
        const numerator = termFreq * (this.k1 + 1);
        const denominator = termFreq + this.k1 * (1 - this.b + this.b * (document.tokens.length / this.averageDocumentLength));
        
        const termScore = idf * (numerator / denominator);
        totalScore += termScore;

        // Track term matches
        const positions = this.findTermPositions(document.tokens, term);
        docMatches.push({
          term,
          frequency: termFreq,
          positions
        });
      }

      if (totalScore > 0) {
        // Apply boost factors
        const boost = this.calculateBoostFactor(document, queryTerms, options.boost);
        scores.set(docId, totalScore * boost);
        matches.set(docId, docMatches);
      }
    }

    // Sort by score and return top results
    const sortedResults = Array.from(scores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, options.topK || 10);

    return sortedResults.map(([docId, score]) => {
      const document = this.documents.get(docId)!;
      return {
        id: docId,
        content: document.content,
        score,
        matches: matches.get(docId) || []
      };
    });
  }

  /**
   * Tokenize text for search indexing
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\sáéíóúñü]/g, ' ') // Keep Spanish characters
      .split(/\s+/)
      .filter(token => token.length > 2) // Filter short tokens
      .filter(token => !this.isStopWord(token));
  }

  /**
   * Spanish legal stop words
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le',
      'da', 'su', 'por', 'son', 'con', 'para', 'al', 'del', 'los', 'las', 'uno', 'una',
      'ser', 'estar', 'tener', 'hacer', 'todo', 'pero', 'más', 'poder', 'ir', 'saber',
      'ver', 'dar', 'que', 'como', 'cuando', 'donde', 'quien', 'cual', 'cuyo', 'cuya'
    ]);
    return stopWords.has(word);
  }

  private updateTermFrequencies(docId: string, tokens: string[]): void {
    const termFreq = new Map<string, number>();
    
    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }
    
    this.termFrequencies.set(docId, termFreq);
  }

  private updateDocumentFrequencies(tokens: string[]): void {
    const uniqueTerms = new Set(tokens);
    
    for (const term of uniqueTerms) {
      this.documentFrequencies.set(term, (this.documentFrequencies.get(term) || 0) + 1);
    }
  }

  private updateAverageDocumentLength(): void {
    if (this.documents.size === 0) {
      this.averageDocumentLength = 0;
      return;
    }

    const totalLength = Array.from(this.documents.values())
      .reduce((sum, doc) => sum + doc.tokens.length, 0);
    
    this.averageDocumentLength = totalLength / this.documents.size;
  }

  private getTermFrequency(docId: string, term: string): number {
    return this.termFrequencies.get(docId)?.get(term) || 0;
  }

  private findTermPositions(tokens: string[], term: string): number[] {
    const positions: number[] = [];
    for (let i = 0; i < tokens.length; i++) {
      if (tokens[i] === term) {
        positions.push(i);
      }
    }
    return positions;
  }

  private calculateBoostFactor(
    document: any, 
    queryTerms: string[], 
    boostConfig?: Record<string, number>
  ): number {
    let boost = 1.0;

    if (!boostConfig) return boost;

    // Boost for exact phrase matches
    if (boostConfig.exactMatch && this.hasExactMatch(document.tokens, queryTerms)) {
      boost *= boostConfig.exactMatch;
    }

    // Boost for document hierarchy (Constitutional > Laws > Regulations)
    if (boostConfig.hierarchy && document.metadata?.hierarchy) {
      const hierarchyBoost = 8 - document.metadata.hierarchy; // Higher hierarchy = higher boost
      boost *= 1 + (hierarchyBoost * boostConfig.hierarchy * 0.1);
    }

    // Boost for document recency
    if (boostConfig.recency && document.metadata?.lastUpdated) {
      const age = Date.now() - new Date(document.metadata.lastUpdated).getTime();
      const daysSinceUpdate = age / (1000 * 60 * 60 * 24);
      const recencyBoost = Math.exp(-daysSinceUpdate / 365); // Exponential decay over a year
      boost *= 1 + (recencyBoost * boostConfig.recency);
    }

    return boost;
  }

  private hasExactMatch(docTokens: string[], queryTerms: string[]): boolean {
    if (queryTerms.length <= 1) return false;

    for (let i = 0; i <= docTokens.length - queryTerms.length; i++) {
      let match = true;
      for (let j = 0; j < queryTerms.length; j++) {
        if (docTokens[i + j] !== queryTerms[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
    return false;
  }

  clear(): void {
    this.documents.clear();
    this.termFrequencies.clear();
    this.documentFrequencies.clear();
    this.averageDocumentLength = 0;
  }
}

/**
 * Hybrid search engine that combines semantic and keyword search
 */
export class HybridSearchEngine {
  private bm25Search = new BM25Search();
  private vectorStore: any; // Will be injected

  constructor(vectorStore?: any) {
    this.vectorStore = vectorStore;
  }

  /**
   * Add document to both search indices
   */
  async addDocument(id: string, content: string, embedding: number[], metadata?: any): Promise<void> {
    // Add to keyword search index
    this.bm25Search.addDocument(id, content, metadata);

    // Add to vector store if available
    if (this.vectorStore) {
      await this.vectorStore.addDocument({
        id,
        content,
        embedding,
        metadata: {
          title: metadata?.title || '',
          type: metadata?.type || '',
          legalArea: metadata?.legalArea || '',
          hierarchy: metadata?.hierarchy || 7,
          lastUpdated: metadata?.lastUpdated || new Date().toISOString(),
          url: metadata?.url,
          article: metadata?.article
        }
      });
    }
  }

  /**
   * Perform hybrid search combining semantic and keyword approaches
   */
  async hybridSearch(
    query: string,
    queryEmbedding: number[],
    options: HybridSearchOptions = {}
  ): Promise<SearchResult[]> {
    const {
      topK = 10,
      semanticWeight = 0.7,
      keywordWeight = 0.3,
      queryType,
      legalArea,
      boostFactors = {}
    } = options;

    // Adjust weights based on query type
    const adjustedWeights = this.adjustWeights(semanticWeight, keywordWeight, queryType);

    // Perform keyword search
    const keywordResults = this.bm25Search.search(query, {
      topK: topK * 2, // Get more results for fusion
      boost: boostFactors
    });

    // Perform semantic search
    let semanticResults: SemanticSearchResult[] = [];
    if (this.vectorStore && queryEmbedding.length > 0) {
      const vectorResults = await this.vectorStore.search(queryEmbedding, {
        topK: topK * 2,
        scoreThreshold: 0.5,
        filter: legalArea ? { legalArea } : undefined
      });

      semanticResults = vectorResults.map((result: any) => ({
        id: result.id,
        content: result.content,
        score: result.score,
        embedding: result.embedding
      }));
    }

    // Combine results using Reciprocal Rank Fusion (RRF)
    const fusedResults = this.fuseResults(
      keywordResults,
      semanticResults,
      adjustedWeights.keyword,
      adjustedWeights.semantic
    );

    // Apply legal-specific re-ranking
    const rerankedResults = this.legalRerank(fusedResults, query, queryType, legalArea);

    return rerankedResults.slice(0, topK);
  }

  /**
   * Adjust search weights based on query type
   */
  private adjustWeights(
    semanticWeight: number,
    keywordWeight: number,
    queryType?: QueryType
  ): { semantic: number; keyword: number } {
    if (!queryType) return { semantic: semanticWeight, keyword: keywordWeight };

    // Adjust weights based on query characteristics
    const adjustments = {
      citation: { semantic: 0.3, keyword: 0.7 }, // "Artículo 123 constitucional"
      procedural: { semantic: 0.6, keyword: 0.4 }, // "Cómo tramitar divorcio"
      conceptual: { semantic: 0.8, keyword: 0.2 }, // "Qué es usucapión"
      analytical: { semantic: 0.7, keyword: 0.3 }, // "Diferencias entre dolo y culpa"
      comparative: { semantic: 0.8, keyword: 0.2 } // "Diferencias entre códigos"
    };

    const adjustment = adjustments[queryType];
    if (adjustment) {
      return adjustment;
    }

    return { semantic: semanticWeight, keyword: keywordWeight };
  }

  /**
   * Fuse keyword and semantic results using Reciprocal Rank Fusion
   */
  private fuseResults(
    keywordResults: KeywordSearchResult[],
    semanticResults: SemanticSearchResult[],
    keywordWeight: number,
    semanticWeight: number
  ): SearchResult[] {
    const scoreMap = new Map<string, { score: number; content: string; metadata?: any }>();

    // Process keyword results
    keywordResults.forEach((result, rank) => {
      const rrfScore = keywordWeight / (60 + rank + 1);
      scoreMap.set(result.id, {
        score: rrfScore,
        content: result.content
      });
    });

    // Process semantic results
    semanticResults.forEach((result, rank) => {
      const rrfScore = semanticWeight / (60 + rank + 1);
      const existing = scoreMap.get(result.id);
      
      if (existing) {
        existing.score += rrfScore;
      } else {
        scoreMap.set(result.id, {
          score: rrfScore,
          content: result.content
        });
      }
    });

    // Convert to SearchResult format and sort
    return Array.from(scoreMap.entries())
      .map(([id, data]) => ({
        id,
        content: data.content,
        score: data.score,
        metadata: data.metadata || {}
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Apply legal-specific re-ranking to improve result relevance
   */
  private legalRerank(
    results: SearchResult[],
    query: string,
    queryType?: QueryType,
    legalArea?: LegalArea
  ): SearchResult[] {
    return results.map(result => {
      let boost = 1.0;

      // Boost for legal area match
      if (legalArea && result.metadata?.legalArea === legalArea) {
        boost *= 1.2;
      }

      // Boost for constitutional sources (highest authority)
      if (result.metadata?.hierarchy === 1) {
        boost *= 1.3;
      }

      // Boost for articles that match query patterns
      if (queryType === 'citation' && result.metadata?.article) {
        const queryLower = query.toLowerCase();
        const articleNum = result.metadata.article;
        if (queryLower.includes(articleNum.toLowerCase())) {
          boost *= 1.5;
        }
      }

      // Boost for exact legal term matches in content
      const legalTerms = this.extractLegalTerms(query);
      for (const term of legalTerms) {
        if (result.content.toLowerCase().includes(term.toLowerCase())) {
          boost *= 1.1;
        }
      }

      return {
        ...result,
        score: result.score * boost
      };
    }).sort((a, b) => b.score - a.score);
  }

  /**
   * Extract legal terms from query
   */
  private extractLegalTerms(query: string): string[] {
    const legalPatterns = [
      /\b(?:artículo|art\.?)\s+(\d+(?:\.\d+)*)\b/gi,
      /\b(?:fracción|frac\.?)\s+([IVX]+|\d+)\b/gi,
      /\b(?:inciso|inc\.?)\s+([a-z]|\d+)\b/gi,
      /\b(?:párrafo|¶)\s+(\d+)\b/gi
    ];

    const terms: string[] = [];
    for (const pattern of legalPatterns) {
      const matches = [...query.matchAll(pattern)];
      terms.push(...matches.map(match => match[0]));
    }

    return terms;
  }

  /**
   * Clear all search indices
   */
  clear(): void {
    this.bm25Search.clear();
    if (this.vectorStore) {
      this.vectorStore.clear();
    }
  }

  /**
   * Get search statistics
   */
  getStats(): { keywordDocuments: number; semanticDocuments: number } {
    return {
      keywordDocuments: this.bm25Search['documents'].size,
      semanticDocuments: 0 // Would need to query vector store
    };
  }
}

export default HybridSearchEngine;