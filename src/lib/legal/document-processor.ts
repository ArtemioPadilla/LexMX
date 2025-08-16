// Mexican legal document processor for RAG system

import type { LegalDocument, LegalContent, LegalArea, DocumentType as _DocumentType, LegalHierarchy } from '@/types/legal';
import type { VectorDocument, DocumentMetadata as _DocumentMetadata } from '@/types/rag';

export interface ProcessingOptions {
  chunkSize: number;
  chunkOverlap: number;
  preserveStructure: boolean;
  includeCitations: boolean;
}

export interface LegalChunk {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    documentTitle: string;
    type: string;
    article?: string;
    section?: string;
    hierarchy: LegalHierarchy;
    legalArea: LegalArea;
    keywords: string[];
    citations: string[];
  };
}

export class MexicanLegalDocumentProcessor {
  private readonly defaultOptions: ProcessingOptions = {
    chunkSize: 512,
    chunkOverlap: 50,
    preserveStructure: true,
    includeCitations: true
  };

  // Regular expressions for Mexican legal text patterns
  private readonly patterns = {
    article: /^(?:Artículo|Art\.?)\s+(\d+(?:\.\d+)*(?:\s*[A-Z])?)\b/i,
    section: /^(?:Sección|Secc\.?)\s+([IVX]+|\d+)/i,
    chapter: /^(?:Capítulo|Cap\.?)\s+([IVX]+|\d+)/i,
    title: /^(?:Título|Tít\.?)\s+([IVX]+|\d+)/i,
    fraction: /^(?:Fracción|Frac\.?)\s+([IVX]+|\d+)/i,
    paragraph: /^(?:Párrafo|¶)\s+(\d+)/i,
    citation: /(?:artículo|art\.?)\s+(\d+(?:\.\d+)*(?:\s*[A-Z])?)\s+(?:de\s+(?:la|el)\s+)?([\w\s]+)/gi,
    jurisprudence: /(?:tesis|jurisprudencia)\s+([\d/A-Z.]+)/gi,
    law: /(?:Ley|Código)\s+([\w\s]+?)(?:\s*,|\s*;|\s*\.|\s*$)/gi
  };

  // Mexican legal keywords for semantic enhancement
  private readonly legalKeywords = [
    // Constitutional terms
    'constitución', 'constitucional', 'garantías', 'derechos fundamentales', 'amparo',
    
    // Civil law terms
    'contrato', 'obligación', 'responsabilidad civil', 'daños y perjuicios', 'propiedad',
    'usucapión', 'prescripción', 'persona física', 'persona moral', 'patrimonio',
    
    // Criminal law terms
    'delito', 'pena', 'culpabilidad', 'dolo', 'culpa', 'tentativa', 'autoría', 'participación',
    'sistema acusatorio', 'debido proceso', 'presunción de inocencia',
    
    // Labor law terms
    'contrato de trabajo', 'relación laboral', 'salario', 'jornada', 'despido', 'rescisión',
    'seguridad social', 'riesgo de trabajo', 'sindicato', 'huelga',
    
    // Tax law terms
    'contribuyente', 'obligación fiscal', 'impuesto', 'deducción', 'crédito fiscal',
    'procedimiento administrativo', 'recurso de revocación',
    
    // Administrative law terms
    'acto administrativo', 'procedimiento administrativo', 'responsabilidad patrimonial',
    'servicio público', 'concesión', 'permiso', 'autorización'
  ];

  /**
   * Process a Mexican legal document into searchable chunks
   */
  async processLegalDocument(
    document: LegalDocument, 
    options: Partial<ProcessingOptions> = {}
  ): Promise<LegalChunk[]> {
    const opts = { ...this.defaultOptions, ...options };
    const chunks: LegalChunk[] = [];

    // Process each content section
    for (const content of document.content) {
      const contentChunks = await this.processLegalContent(
        document,
        content,
        opts
      );
      chunks.push(...contentChunks);
    }

    return chunks;
  }

  /**
   * Process individual legal content into chunks
   */
  private async processLegalContent(
    document: LegalDocument,
    content: LegalContent,
    options: ProcessingOptions
  ): Promise<LegalChunk[]> {
    const chunks: LegalChunk[] = [];
    
    if (options.preserveStructure) {
      // Create chunks that respect legal structure (articles, sections, etc.)
      const structuralChunks = this.createStructuralChunks(document, content, options);
      chunks.push(...structuralChunks);
    } else {
      // Create fixed-size chunks with overlap
      const textChunks = this.createTextChunks(document, content, options);
      chunks.push(...textChunks);
    }

    return chunks;
  }

  /**
   * Create chunks that preserve legal document structure
   */
  private createStructuralChunks(
    document: LegalDocument,
    content: LegalContent,
    options: ProcessingOptions
  ): LegalChunk[] {
    const chunks: LegalChunk[] = [];
    const text = content.content;

    // Split by legal units (articles, sections, etc.)
    const units = this.identifyLegalUnits(text);
    
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];
      let chunkText = unit.text;

      // Add context from previous unit if needed
      if (options.chunkOverlap > 0 && i > 0) {
        const prevUnit = units[i - 1];
        const overlapText = this.getOverlapText(prevUnit.text, options.chunkOverlap);
        chunkText = overlapText + '\n\n' + chunkText;
      }

      // Add context from next unit if chunk is too small
      if (chunkText.length < options.chunkSize / 2 && i < units.length - 1) {
        const nextUnit = units[i + 1];
        const additionalText = this.getOverlapText(nextUnit.text, options.chunkSize - chunkText.length);
        chunkText = chunkText + '\n\n' + additionalText;
      }

      const chunk: LegalChunk = {
        id: `${content.id}_${unit.type}_${unit.number || i}`,
        content: chunkText.trim(),
        metadata: {
          documentId: document.id,
          documentTitle: document.title,
          type: unit.type,
          article: unit.type === 'article' ? unit.number : undefined,
          section: unit.type === 'section' ? unit.number : undefined,
          hierarchy: document.hierarchy,
          legalArea: document.primaryArea,
          keywords: this.extractKeywords(chunkText),
          citations: options.includeCitations ? this.extractCitations(chunkText) : []
        }
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Create fixed-size text chunks with overlap
   */
  private createTextChunks(
    document: LegalDocument,
    content: LegalContent,
    options: ProcessingOptions
  ): LegalChunk[] {
    const chunks: LegalChunk[] = [];
    const text = content.content;
    const sentences = this.splitIntoSentences(text);
    
    let currentChunk = '';
    let chunkIndex = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

      if (potentialChunk.length > options.chunkSize && currentChunk) {
        // Create chunk from current content
        const chunk: LegalChunk = {
          id: `${content.id}_chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          metadata: {
            documentId: document.id,
            documentTitle: document.title,
            type: content.type,
            hierarchy: document.hierarchy,
            legalArea: document.primaryArea,
            keywords: this.extractKeywords(currentChunk),
            citations: options.includeCitations ? this.extractCitations(currentChunk) : []
          }
        };

        chunks.push(chunk);
        chunkIndex++;

        // Start new chunk with overlap
        if (options.chunkOverlap > 0) {
          const overlapSentences = this.getLastSentences(currentChunk, options.chunkOverlap);
          currentChunk = overlapSentences + ' ' + sentence;
        } else {
          currentChunk = sentence;
        }
      } else {
        currentChunk = potentialChunk;
      }
    }

    // Add final chunk if there's remaining content
    if (currentChunk.trim()) {
      const chunk: LegalChunk = {
        id: `${content.id}_chunk_${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: {
          documentId: document.id,
          documentTitle: document.title,
          type: content.type,
          hierarchy: document.hierarchy,
          legalArea: document.primaryArea,
          keywords: this.extractKeywords(currentChunk),
          citations: options.includeCitations ? this.extractCitations(currentChunk) : []
        }
      };

      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Identify legal structural units (articles, sections, etc.)
   */
  private identifyLegalUnits(text: string): Array<{ type: string; number?: string; text: string }> {
    const units: Array<{ type: string; number?: string; text: string }> = [];
    const lines = text.split('\n');
    
    let currentUnit: { type: string; number?: string; text: string } | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // Check for article
      const articleMatch = trimmedLine.match(this.patterns.article);
      if (articleMatch) {
        if (currentUnit) units.push(currentUnit);
        currentUnit = {
          type: 'article',
          number: articleMatch[1],
          text: trimmedLine
        };
        continue;
      }

      // Check for section
      const sectionMatch = trimmedLine.match(this.patterns.section);
      if (sectionMatch) {
        if (currentUnit) units.push(currentUnit);
        currentUnit = {
          type: 'section',
          number: sectionMatch[1],
          text: trimmedLine
        };
        continue;
      }

      // Check for chapter
      const chapterMatch = trimmedLine.match(this.patterns.chapter);
      if (chapterMatch) {
        if (currentUnit) units.push(currentUnit);
        currentUnit = {
          type: 'chapter',
          number: chapterMatch[1],
          text: trimmedLine
        };
        continue;
      }

      // Add to current unit or create paragraph unit
      if (currentUnit) {
        currentUnit.text += '\n' + trimmedLine;
      } else {
        currentUnit = {
          type: 'paragraph',
          text: trimmedLine
        };
      }
    }

    if (currentUnit) units.push(currentUnit);
    
    return units;
  }

  /**
   * Extract legal keywords from text
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = [];
    const lowercaseText = text.toLowerCase();

    // Find exact keyword matches
    for (const keyword of this.legalKeywords) {
      if (lowercaseText.includes(keyword.toLowerCase())) {
        keywords.push(keyword);
      }
    }

    // Extract potential legal terms (capitalized phrases)
    const capitalizedPhrases = text.match(/\b[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*\b/g) || [];
    keywords.push(...capitalizedPhrases.slice(0, 10)); // Limit to 10 additional keywords

    return [...new Set(keywords)]; // Remove duplicates
  }

  /**
   * Extract legal citations from text
   */
  private extractCitations(text: string): string[] {
    const citations: string[] = [];

    // Extract article citations
    const articleCitations = [...text.matchAll(this.patterns.citation)];
    for (const match of articleCitations) {
      citations.push(`Artículo ${match[1]} de ${match[2]}`);
    }

    // Extract jurisprudence citations
    const jurisCitations = [...text.matchAll(this.patterns.jurisprudence)];
    for (const match of jurisCitations) {
      citations.push(`Tesis ${match[1]}`);
    }

    // Extract law citations
    const lawCitations = [...text.matchAll(this.patterns.law)];
    for (const match of lawCitations) {
      citations.push(match[0]);
    }

    return [...new Set(citations)]; // Remove duplicates
  }

  /**
   * Split text into sentences considering legal formatting
   */
  private splitIntoSentences(text: string): string[] {
    // Split on periods, but be careful with abbreviations and article numbers
    return text
      .split(/(?<!\b(?:Art|Artículo|Inc|Frac|Núm)\.)(?<!\d)\.(?!\d)(?=\s+[A-ZÁÉÍÓÚÑ]|$)/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Get overlap text from the end of a string
   */
  private getOverlapText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    
    const sentences = this.splitIntoSentences(text);
    let overlap = '';
    
    for (let i = sentences.length - 1; i >= 0; i--) {
      const candidate = sentences[i] + (overlap ? '. ' + overlap : '');
      if (candidate.length > maxLength) break;
      overlap = candidate;
    }
    
    return overlap || text.slice(-maxLength);
  }

  /**
   * Get the last few sentences up to a character limit
   */
  private getLastSentences(text: string, maxLength: number): string {
    const sentences = this.splitIntoSentences(text);
    let result = '';
    
    for (let i = sentences.length - 1; i >= 0; i--) {
      const candidate = sentences[i] + (result ? '. ' + result : '');
      if (candidate.length > maxLength) break;
      result = candidate;
    }
    
    return result;
  }

  /**
   * Convert legal chunks to vector documents for storage
   */
  async chunksToVectorDocuments(chunks: LegalChunk[]): Promise<VectorDocument[]> {
    // Note: Embedding generation would typically happen here
    // For now, we'll create documents without embeddings
    return chunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      embedding: [], // Will be populated by embedding service
      metadata: {
        title: chunk.metadata.documentTitle,
        type: chunk.metadata.type,
        legalArea: chunk.metadata.legalArea,
        hierarchy: chunk.metadata.hierarchy,
        lastUpdated: new Date().toISOString(),
        url: undefined,
        article: chunk.metadata.article
      }
    }));
  }

  /**
   * Validate Mexican legal document structure
   */
  validateLegalDocument(document: LegalDocument): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (!document.id) errors.push('Document ID is required');
    if (!document.title) errors.push('Document title is required');
    if (!document.type) errors.push('Document type is required');
    if (!document.primaryArea) errors.push('Primary legal area is required');
    if (!document.content || document.content.length === 0) {
      errors.push('Document content is required');
    }

    // Validate hierarchy
    if (document.hierarchy < 1 || document.hierarchy > 7) {
      errors.push('Invalid legal hierarchy (must be 1-7)');
    }

    // Validate content structure
    for (const content of document.content) {
      if (!content.id) errors.push(`Content section missing ID: ${content.title || 'Unknown'}`);
      if (!content.content) errors.push(`Content section missing text: ${content.id}`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export default MexicanLegalDocumentProcessor;