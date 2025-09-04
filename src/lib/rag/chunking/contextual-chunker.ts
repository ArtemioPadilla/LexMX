// Contextual chunker for legal documents
// Preserves legal structure and context when creating chunks

import type { LegalDocument, LegalChunk } from '@/types/legal';

export interface ChunkerConfig {
  maxChunkSize?: number;      // Maximum characters per chunk
  overlapSize?: number;        // Overlap between chunks
  preserveStructure?: boolean; // Keep legal structure intact
  contextWindow?: number;      // Lines of context to preserve
  minChunkSize?: number;       // Minimum chunk size
}

export interface ChunkingStrategy {
  type: 'fixed' | 'semantic' | 'contextual' | 'hierarchical' | 'entity-aware';
  config: ChunkerConfig;
}

export class ContextualChunker {
  private config: Required<ChunkerConfig>;
  
  constructor(config: ChunkerConfig = {}) {
    this.config = {
      maxChunkSize: 512,
      overlapSize: 50,
      preserveStructure: true,
      contextWindow: 2,
      minChunkSize: 100,
      ...config
    };
  }

  /**
   * Chunk a legal document while preserving context (now with async processing)
   */
  async chunkDocument(
    document: LegalDocument, 
    onProgress?: (progress: number, message: string) => void
  ): Promise<LegalChunk[]> {
    const chunks: LegalChunk[] = [];
    
    if (this.config.preserveStructure && document.content) {
      // Use hierarchical chunking for structured documents
      onProgress?.(0, 'Processing structured content...');
      const hierarchicalChunks = await this.hierarchicalChunkingAsync(document, onProgress);
      chunks.push(...hierarchicalChunks);
    } else if (document.fullText) {
      // Use contextual chunking for unstructured text
      onProgress?.(0, 'Processing unstructured text...');
      const contextualChunks = await this.contextualChunkingAsync(document, onProgress);
      chunks.push(...contextualChunks);
    } else {
      console.warn('Document has no content to chunk');
    }
    
    onProgress?.(90, 'Adding metadata to chunks...');
    
    // Add document-level metadata to all chunks (with async processing)
    const processedChunks = await this.addMetadataAsync(chunks, document);
    
    onProgress?.(100, `Created ${processedChunks.length} chunks`);
    return processedChunks;
  }

  /**
   * Add metadata to chunks asynchronously to prevent blocking
   */
  private async addMetadataAsync(chunks: LegalChunk[], document: LegalDocument): Promise<LegalChunk[]> {
    const processedChunks: LegalChunk[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      processedChunks.push({
        ...chunk,
        metadata: {
          ...chunk.metadata,
          documentId: document.id,
          documentTitle: document.title,
          documentType: document.type,
          legalArea: document.primaryArea,
          authority: document.authority,
          publicationDate: document.publicationDate
        }
      });
      
      // Yield control every 100 chunks to prevent blocking
      if (i % 100 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    return processedChunks;
  }

  /**
   * Hierarchical chunking - preserves document structure (ASYNC VERSION)
   */
  private async hierarchicalChunkingAsync(
    document: LegalDocument,
    onProgress?: (progress: number, message: string) => void
  ): Promise<LegalChunk[]> {
    const chunks: LegalChunk[] = [];
    let chunkIndex = 0;
    
    if (!document.content) return chunks;
    
    const totalSections = document.content.length;
    
    // Process each section maintaining hierarchy
    for (let i = 0; i < document.content.length; i++) {
      const section = document.content[i];
      
      onProgress?.(
        Math.round((i / totalSections) * 80), // Reserve 20% for final processing
        `Processing section ${i + 1}/${totalSections}: ${section.title || 'Untitled'}`
      );
      
      const sectionChunks = await this.chunkSectionAsync(
        section,
        document,
        chunkIndex
      );
      
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
      
      // Yield control every few sections to prevent blocking
      if (i % 5 === 0 && i > 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
    
    onProgress?.(90, 'Adding cross-references...');
    
    // Add cross-references between related chunks (async version)
    await this.addCrossReferencesAsync(chunks);
    
    return chunks;
  }

  /**
   * Hierarchical chunking - preserves document structure (ORIGINAL SYNC VERSION)
   */
  private hierarchicalChunking(document: LegalDocument): LegalChunk[] {
    const chunks: LegalChunk[] = [];
    let chunkIndex = 0;
    
    if (!document.content) return chunks;
    
    // Process each section maintaining hierarchy
    for (const section of document.content) {
      const sectionChunks = this.chunkSection(
        section,
        document,
        chunkIndex
      );
      
      chunks.push(...sectionChunks);
      chunkIndex += sectionChunks.length;
    }
    
    // Add cross-references between related chunks
    this.addCrossReferences(chunks);
    
    return chunks;
  }

  /**
   * Chunk a single section (ASYNC VERSION)
   */
  private async chunkSectionAsync(
    section: any,
    document: LegalDocument,
    startIndex: number
  ): Promise<LegalChunk[]> {
    // Use the sync version but add yielding for very large sections
    const chunks = this.chunkSection(section, document, startIndex);
    
    // Yield control if we created many chunks
    if (chunks.length > 10) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return chunks;
  }

  /**
   * Add cross-references asynchronously
   */
  private async addCrossReferencesAsync(chunks: LegalChunk[]): Promise<void> {
    // Process cross-references in batches to prevent blocking
    const batchSize = 50;
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      this.addCrossReferences(batch);
      
      // Yield control every batch
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  }

  /**
   * Contextual chunking async version
   */
  private async contextualChunkingAsync(
    document: LegalDocument,
    onProgress?: (progress: number, message: string) => void
  ): Promise<LegalChunk[]> {
    if (!document.fullText) return [];
    
    onProgress?.(0, 'Splitting text into sentences...');
    
    const sentences = this.splitIntoSentences(document.fullText);
    const totalSentences = sentences.length;
    const chunks: LegalChunk[] = [];
    let chunkIndex = 0;
    
    onProgress?.(25, 'Creating contextual chunks...');
    
    // Process sentences in batches to prevent blocking
    const batchSize = 100;
    
    for (let i = 0; i < sentences.length; i += batchSize) {
      const batch = sentences.slice(i, i + batchSize);
      const progress = 25 + Math.round((i / totalSentences) * 65); // 25-90%
      
      onProgress?.(progress, `Processing sentences ${i + 1}-${Math.min(i + batchSize, totalSentences)} of ${totalSentences}`);
      
      const batchChunks = this.createChunksFromSentencesBatch(
        batch,
        document,
        chunkIndex
      );
      
      chunks.push(...batchChunks);
      chunkIndex += batchChunks.length;
      
      // Yield control between batches
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return chunks;
  }

  /**
   * Create chunks from a batch of sentences
   */
  private createChunksFromSentencesBatch(
    sentences: string[],
    document: LegalDocument,
    startIndex: number
  ): LegalChunk[] {
    // Simplified batch processing - in a real implementation,
    // this would use the existing createChunksFromSentences logic
    // but process in smaller batches
    const chunks: LegalChunk[] = [];
    let currentChunk = '';
    let chunkIndex = startIndex;
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > this.config.maxChunkSize) {
        if (currentChunk.trim()) {
          chunks.push({
            id: `${document.id}_chunk_${chunkIndex}`,
            documentId: document.id,
            content: currentChunk.trim(),
            metadata: {
              chunkIndex,
              documentTitle: document.title,
              type: 'contextual',
              isComplete: true
            },
            keywords: this.extractKeywords(currentChunk),
            embedding: undefined
          });
          chunkIndex++;
        }
        currentChunk = sentence + ' ';
      } else {
        currentChunk += sentence + ' ';
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        documentId: document.id,
        content: currentChunk.trim(),
        metadata: {
          chunkIndex,
          documentTitle: document.title,
          type: 'contextual',
          isComplete: true
        },
        keywords: this.extractKeywords(currentChunk),
        embedding: undefined
      });
    }
    
    return chunks;
  }

  /**
   * Chunk a single section (ORIGINAL SYNC VERSION)
   */
  private chunkSection(
    section: any,
    document: LegalDocument,
    startIndex: number
  ): LegalChunk[] {
    const chunks: LegalChunk[] = [];
    const content = section.content || '';
    const contextualContent = this.addContextualInfo(section, content);
    
    // If section is small enough (including context), create single chunk
    if (contextualContent.length <= this.config.maxChunkSize) {
      chunks.push({
        id: `${document.id}_chunk_${startIndex}`,
        documentId: document.id,
        content: contextualContent,
        metadata: {
          type: section.type,
          article: section.number,
          title: section.title,
          hierarchy: document.hierarchy,
          legalArea: document.primaryArea,
          originalId: section.id,
          documentTitle: document.title,
          chunkIndex: startIndex,
          isComplete: true
        },
        keywords: this.extractKeywords(content),
        embedding: undefined
      });
      
      return chunks;
    }
    
    // Split large sections intelligently
    const sentences = this.splitIntoSentences(content);
    const sectionChunks = this.createChunksFromSentences(
      sentences,
      section,
      document,
      startIndex
    );
    
    return sectionChunks;
  }

  /**
   * Contextual chunking - preserves surrounding context
   */
  private contextualChunking(document: LegalDocument): LegalChunk[] {
    const chunks: LegalChunk[] = [];
    const text = document.fullText || '';
    
    // Split into paragraphs first
    const paragraphs = text.split(/\n\n+/);
    let chunkIndex = 0;
    let currentChunk = '';
    let chunkContext = '';
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      
      // Check if adding this paragraph exceeds max size
      if (currentChunk.length + paragraph.length > this.config.maxChunkSize) {
        // Save current chunk if it meets minimum size
        if (currentChunk.length >= this.config.minChunkSize) {
          chunks.push({
            id: `${document.id}_chunk_${chunkIndex}`,
            documentId: document.id,
            content: chunkContext + currentChunk,
            metadata: {
              type: 'paragraph',
              hierarchy: document.hierarchy,
              legalArea: document.primaryArea,
              documentTitle: document.title,
              chunkIndex,
              startParagraph: Math.max(0, i - this.config.contextWindow),
              endParagraph: i
            },
            keywords: this.extractKeywords(currentChunk)
          });
          
          chunkIndex++;
          
          // Create overlap for next chunk
          chunkContext = this.createOverlapContext(
            paragraphs,
            i - 1,
            this.config.contextWindow
          );
        }
        
        currentChunk = paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }
    
    // Add final chunk
    if (currentChunk.length >= this.config.minChunkSize) {
      chunks.push({
        id: `${document.id}_chunk_${chunkIndex}`,
        documentId: document.id,
        content: chunkContext + currentChunk,
        metadata: {
          type: 'paragraph',
          hierarchy: document.hierarchy,
          legalArea: document.primaryArea,
          documentTitle: document.title,
          chunkIndex,
          isComplete: true
        },
        keywords: this.extractKeywords(currentChunk)
      });
    }
    
    return chunks;
  }

  /**
   * Create chunks from sentences with smart boundaries
   */
  private createChunksFromSentences(
    sentences: string[],
    section: any,
    document: LegalDocument,
    startIndex: number
  ): LegalChunk[] {
    const chunks: LegalChunk[] = [];
    let currentChunk = '';
    let chunkSentences: string[] = [];
    let localIndex = 0;
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      
      // Check if we should start a new chunk
      if (potentialChunk.length > this.config.maxChunkSize && currentChunk) {
        // Create chunk with context
        const contextPrefix = this.getArticleContext(section);
        
        chunks.push({
          id: `${document.id}_chunk_${startIndex + localIndex}`,
          documentId: document.id,
          content: contextPrefix + currentChunk,
          metadata: {
            type: section.type,
            article: section.number,
            title: section.title,
            hierarchy: document.hierarchy,
            legalArea: document.primaryArea,
            originalId: section.id,
            documentTitle: document.title,
            chunkIndex: startIndex + localIndex,
            partNumber: localIndex + 1,
            totalParts: Math.ceil(sentences.join(' ').length / this.config.maxChunkSize)
          },
          keywords: this.extractKeywords(currentChunk),
          relatedChunks: this.findRelatedChunkIds(section, document)
        });
        
        localIndex++;
        
        // Start new chunk with minimal overlap
        currentChunk = sentence;
        chunkSentences = [sentence];
      } else {
        currentChunk = potentialChunk;
        chunkSentences.push(sentence);
      }
    }
    
    // Add final chunk
    if (currentChunk.trim()) {
      const contextPrefix = this.getArticleContext(section);
      
      chunks.push({
        id: `${document.id}_chunk_${startIndex + localIndex}`,
        documentId: document.id,
        content: contextPrefix + currentChunk,
        metadata: {
          type: section.type,
          article: section.number,
          title: section.title,
          hierarchy: document.hierarchy,
          legalArea: document.primaryArea,
          originalId: section.id,
          documentTitle: document.title,
          chunkIndex: startIndex + localIndex,
          partNumber: localIndex + 1,
          isLastPart: true
        },
        keywords: this.extractKeywords(currentChunk)
      });
    }
    
    return chunks;
  }

  /**
   * Add contextual information to chunk
   */
  private addContextualInfo(section: any, content: string): string {
    const prefix = this.getArticleContext(section);
    return prefix + content;
  }

  /**
   * Get article context for legal clarity
   */
  private getArticleContext(section: any): string {
    const parts: string[] = [];
    
    if (section.type === 'article' && section.number) {
      parts.push(`[Artículo ${section.number}]`);
    }
    
    if (section.title) {
      parts.push(`[${section.title}]`);
    }
    
    return parts.length > 0 ? parts.join(' ') + '\n\n' : '';
  }

  /**
   * Create overlap context for continuity
   */
  private createOverlapContext(
    paragraphs: string[],
    endIndex: number,
    contextWindow: number
  ): string {
    const startIdx = Math.max(0, endIndex - contextWindow + 1);
    const contextParagraphs = paragraphs.slice(startIdx, endIndex + 1);
    
    // Take last sentences from context paragraphs
    const context = contextParagraphs
      .map(p => {
        const sentences = this.splitIntoSentences(p);
        return sentences.slice(-2).join(' ');
      })
      .join('\n\n');
    
    return context ? `[...] ${context}\n\n` : '';
  }

  /**
   * Create sentence overlap for chunk continuity
   */
  private createSentenceOverlap(sentences: string[]): string {
    if (sentences.length === 0) return '';
    
    // Take last 1-2 sentences for overlap
    const overlapCount = Math.min(2, sentences.length);
    const overlapSentences = sentences.slice(-overlapCount);
    
    return overlapSentences.join(' ') + ' [...]';
  }

  /**
   * Split text into sentences (legal-aware)
   */
  private splitIntoSentences(text: string): string[] {
    // Don't split on periods in common legal abbreviations
    const protectedText = text
      .replace(/\bArt\./g, 'Art⁂')
      .replace(/\bInc\./g, 'Inc⁂')
      .replace(/\bFrac\./g, 'Frac⁂')
      .replace(/\bNúm\./g, 'Núm⁂')
      .replace(/\bfrac\./g, 'frac⁂')
      .replace(/\bpárr\./g, 'párr⁂');
    
    // Split on sentence boundaries
    const sentences = protectedText
      .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/)
      .map(s => s.replace(/⁂/g, '.').trim())
      .filter(s => s.length > 0);
    
    // If we get very long sentences, force split them
    const maxSentenceLength = Math.floor(this.config.maxChunkSize * 0.8);
    const finalSentences: string[] = [];
    
    for (const sentence of sentences) {
      if (sentence.length > maxSentenceLength) {
        // Force split long sentences at word boundaries
        const words = sentence.split(/\s+/);
        
        // Handle case where there's a single very long word
        if (words.length === 1 && words[0].length > maxSentenceLength) {
          // Force split at character level
          const word = words[0];
          for (let i = 0; i < word.length; i += maxSentenceLength) {
            finalSentences.push(word.substring(i, i + maxSentenceLength));
          }
        } else {
          let currentSentence = '';
          
          for (const word of words) {
            // Handle individual words that are too long
            if (word.length > maxSentenceLength) {
              if (currentSentence) {
                finalSentences.push(currentSentence.trim());
                currentSentence = '';
              }
              // Split the long word
              for (let i = 0; i < word.length; i += maxSentenceLength) {
                finalSentences.push(word.substring(i, i + maxSentenceLength));
              }
            } else if (currentSentence.length + word.length + 1 > maxSentenceLength && currentSentence) {
              finalSentences.push(currentSentence.trim());
              currentSentence = word;
            } else {
              currentSentence += (currentSentence ? ' ' : '') + word;
            }
          }
          
          if (currentSentence) {
            finalSentences.push(currentSentence.trim());
          }
        }
      } else {
        finalSentences.push(sentence);
      }
    }
    
    return finalSentences.length > 0 ? finalSentences : [text];
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    const legalTerms = [
      'artículo', 'fracción', 'inciso', 'párrafo', 'constitución',
      'código', 'ley', 'reglamento', 'derecho', 'obligación',
      'responsabilidad', 'procedimiento', 'amparo', 'tribunal',
      'juzgado', 'sentencia', 'jurisprudencia', 'tesis', 'criterio'
    ];
    
    const keywords = new Set<string>();
    const lowerText = text.toLowerCase();
    
    // Extract legal terms
    for (const term of legalTerms) {
      if (lowerText.includes(term)) {
        keywords.add(term);
      }
    }
    
    // Extract article numbers
    const articleMatches = text.matchAll(/\b(?:artículo|art\.?)\s+(\d+)/gi);
    for (const match of articleMatches) {
      keywords.add(`art_${match[1]}`);
    }
    
    // Extract law references - more flexible pattern
    const lawMatches = text.matchAll(/\b(?:ley|código)\s+(?:federal\s+)?(?:de(?:l)?\s+)?([\w\s]+?)(?:\.|,|;|\n|$)/gi);
    for (const match of lawMatches) {
      const lawName = match[1].trim().toLowerCase().replace(/\s+/g, '_');
      if (lawName.length < 50 && lawName.length > 0) {
        keywords.add(`ley_${lawName}`);
      }
    }
    
    // Also extract simpler law patterns
    if (text.toLowerCase().includes('ley federal del trabajo')) {
      keywords.add('ley_federal_del_trabajo');
    }
    if (text.toLowerCase().includes('código civil')) {
      keywords.add('ley_codigo_civil');
    }
    
    return Array.from(keywords);
  }

  /**
   * Find related chunk IDs based on legal references
   */
  private findRelatedChunkIds(section: any, document: LegalDocument): string[] {
    const related: string[] = [];
    
    // Add parent section chunks
    if (section.parent) {
      related.push(`${document.id}_${section.parent}`);
    }
    
    // Add child section chunks
    if (section.children && Array.isArray(section.children)) {
      for (const child of section.children) {
        related.push(`${document.id}_${child}`);
      }
    }
    
    return related;
  }

  /**
   * Add cross-references between chunks
   */
  private addCrossReferences(chunks: LegalChunk[]): void {
    // Build reference map
    const refMap = new Map<string, Set<string>>();
    
    for (const chunk of chunks) {
      // Find article references in content
      const references = chunk.content.matchAll(
        /\b(?:artículo|art\.?)\s+(\d+)/gi
      );
      
      for (const ref of references) {
        const articleNum = ref[1];
        
        // Find chunks with this article
        for (const targetChunk of chunks) {
          if (targetChunk.metadata?.article === articleNum) {
            if (!refMap.has(chunk.id)) {
              refMap.set(chunk.id, new Set());
            }
            refMap.get(chunk.id)!.add(targetChunk.id);
          }
        }
      }
    }
    
    // Add references to chunks
    for (const chunk of chunks) {
      const refs = refMap.get(chunk.id);
      if (refs) {
        chunk.relatedChunks = Array.from(refs);
      }
    }
  }
}