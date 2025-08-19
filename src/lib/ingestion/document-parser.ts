// Document parser for extracting structured content from legal documents
// Handles various formats and preserves legal document structure

import type { LegalDocument, DocumentType, LegalArea } from '@/types/legal';

export interface ParseOptions {
  documentType?: DocumentType;
  metadata?: Partial<LegalDocument>;
  preserveFormatting?: boolean;
  extractCitations?: boolean;
}

export interface ParsedSection {
  id: string;
  type: 'title' | 'chapter' | 'section' | 'article' | 'paragraph' | 'fraction';
  number?: string;
  title?: string;
  content: string;
  level: number;
  parent?: string;
  children?: string[];
  citations?: string[];
}

export class DocumentParser {
  private legalPatterns = {
    // Article patterns
    article: /(?:Artículo|Art\.?)\s+(\d+(?:\s+bis)?(?:\s+[A-Z])?)/gi,
    
    // Chapter patterns
    chapter: /(?:CAPÍTULO|Capítulo|CAP\.?)\s+([IVXLCDM]+|\d+)/gi,
    
    // Title patterns
    title: /(?:TÍTULO|Título|TÍT\.?)\s+([IVXLCDM]+|\d+)/gi,
    
    // Section patterns
    section: /(?:SECCIÓN|Sección|SECC?\.?)\s+([IVXLCDM]+|\d+|[A-Z])/gi,
    
    // Fraction patterns
    fraction: /(?:fracción|Fracción|frac\.?|FRACCIÓN)\s+([IVXLCDM]+|\d+)/gi,
    
    // Paragraph patterns
    paragraph: /(?:párrafo|Párrafo|PÁRRAFO)\s+(\d+|primero|segundo|tercero|cuarto|quinto)/gi,
    
    // Legal citations
    citation: /(?:artículo|art\.?)\s+\d+(?:\s+(?:de|del|de la))\s+[\w\s]+/gi,
    
    // Date patterns
    date: /\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/gi,
    
    // Reform patterns
    reform: /(?:reformado|adicionado|derogado)\s+(?:por|mediante)/gi
  };

  async parse(
    content: string,
    options: ParseOptions = {}
  ): Promise<LegalDocument> {
    const {
      documentType = 'law',
      metadata = {},
      extractCitations = true
    } = options;

    // Clean and normalize content
    const normalizedContent = this.normalizeContent(content);
    
    // Extract document structure
    const sections = this.extractSections(normalizedContent);
    
    // Build hierarchy
    const hierarchicalSections = this.buildHierarchy(sections);
    
    // Extract metadata from content
    const extractedMetadata = this.extractMetadata(normalizedContent);
    
    // Extract citations if requested
    const citations = extractCitations ? 
      this.extractCitations(normalizedContent) : [];
    
    // Generate document ID
    const documentId = this.generateDocumentId(metadata.title || extractedMetadata.title);
    
    // Create legal document
    const document: LegalDocument = {
      id: documentId,
      title: metadata.title || extractedMetadata.title || 'Untitled Document',
      type: documentType,
      hierarchy: this.getHierarchyLevel(documentType) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      primaryArea: metadata.primaryArea || this.detectLegalArea(normalizedContent),
      secondaryAreas: [],
      authority: metadata.authority || extractedMetadata.authority || 'Unknown',
      publicationDate: metadata.publicationDate || extractedMetadata.date || new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      version: '1.0',
      status: 'active',
      territorialScope: 'federal',
      content: hierarchicalSections,
      fullText: normalizedContent,
      citations,
      ...metadata
    };
    
    return document;
  }

  /**
   * Parse a PDF document (placeholder - requires PDF library)
   */
  async parsePDF(_pdfBuffer: ArrayBuffer): Promise<string> {
    // In production, use a library like pdf-parse or pdfjs
    console.warn('PDF parsing not yet implemented');
    return '[PDF content would be extracted here]';
  }

  /**
   * Normalize content for consistent parsing
   */
  private normalizeContent(content: string): string {
    let normalized = content;
    
    // Normalize line breaks
    normalized = normalized.replace(/\r\n/g, '\n');
    normalized = normalized.replace(/\r/g, '\n');
    
    // Remove excessive whitespace
    normalized = normalized.replace(/[ \t]+/g, ' ');
    normalized = normalized.replace(/\n{3,}/g, '\n\n');
    
    // Normalize quotes
    normalized = normalized.replace(/[""]/g, '"');
    normalized = normalized.replace(/['']/g, "'");
    
    // Fix common OCR errors in legal text
    normalized = this.fixCommonOCRErrors(normalized);
    
    return normalized.trim();
  }

  /**
   * Extract sections from content
   */
  private extractSections(content: string): ParsedSection[] {
    const sections: ParsedSection[] = [];
    const lines = content.split('\n');
    
    let currentSection: ParsedSection | null = null;
    let sectionId = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Check for title
      const titleMatch = line.match(/^(?:TÍTULO|Título|TÍT\.?)\s+([IVXLCDM]+|\d+)/);
      if (titleMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          id: `section_${++sectionId}`,
          type: 'title',
          number: titleMatch[1],
          title: this.extractTitle(lines, i),
          content: '',
          level: 1
        };
        continue;
      }
      
      // Check for chapter
      const chapterMatch = line.match(/^(?:CAPÍTULO|Capítulo|CAP\.?)\s+([IVXLCDM]+|\d+)/);
      if (chapterMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          id: `section_${++sectionId}`,
          type: 'chapter',
          number: chapterMatch[1],
          title: this.extractTitle(lines, i),
          content: '',
          level: 2
        };
        continue;
      }
      
      // Check for article
      const articleMatch = line.match(/^(?:Artículo|Art\.?)\s+(\d+(?:\s+bis)?(?:\s+[A-Z])?)/);
      if (articleMatch) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          id: `section_${++sectionId}`,
          type: 'article',
          number: articleMatch[1],
          title: this.extractTitle(lines, i),
          content: '',
          level: 3
        };
        continue;
      }
      
      // Add content to current section
      if (currentSection) {
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      } else {
        // Create a default section for orphan content
        currentSection = {
          id: `section_${++sectionId}`,
          type: 'paragraph',
          content: line,
          level: 4
        };
      }
    }
    
    // Add the last section
    if (currentSection) {
      sections.push(currentSection);
    }
    
    return sections;
  }

  /**
   * Build hierarchical structure from flat sections
   */
  private buildHierarchy(sections: ParsedSection[]): Array<Record<string, unknown>> {
    const hierarchy: Array<Record<string, unknown>> = [];
    const sectionMap = new Map<string, Record<string, unknown>>();
    
    // Create section objects compatible with LegalDocument content
    for (const section of sections) {
      const sectionObj = {
        id: section.id,
        type: section.type,
        number: section.number,
        title: section.title,
        content: section.content,
        level: section.level,
        children: []
      };
      
      sectionMap.set(section.id, sectionObj);
      
      // Find parent based on level
      let parent = null;
      for (let i = sections.indexOf(section) - 1; i >= 0; i--) {
        if (sections[i].level < section.level) {
          parent = sections[i];
          break;
        }
      }
      
      if (parent) {
        const parentObj = sectionMap.get(parent.id);
        if (parentObj) {
          parentObj.children.push(sectionObj);
        }
      } else {
        hierarchy.push(sectionObj);
      }
    }
    
    return hierarchy;
  }

  /**
   * Extract metadata from content
   */
  private extractMetadata(content: string): Record<string, unknown> {
    const metadata: Record<string, unknown> = {};
    
    // Try to extract title from first lines
    const lines = content.split('\n').slice(0, 10);
    for (const line of lines) {
      if (line.length > 10 && line.length < 200 && !line.match(/^(?:Artículo|CAPÍTULO)/)) {
        metadata.title = line.trim();
        break;
      }
    }
    
    // Extract publication date
    const dateMatch = content.match(/\d{1,2}\s+de\s+\w+\s+de\s+\d{4}/);
    if (dateMatch) {
      metadata.date = this.parseSpanishDate(dateMatch[0]);
    }
    
    // Extract authority
    const authorityPatterns = [
      /Congreso de la Unión/i,
      /Cámara de Diputados/i,
      /Suprema Corte de Justicia/i,
      /Ejecutivo Federal/i,
      /Secretaría de\s+[\w\s]+/i
    ];
    
    for (const pattern of authorityPatterns) {
      const match = content.match(pattern);
      if (match) {
        metadata.authority = match[0];
        break;
      }
    }
    
    return metadata;
  }

  /**
   * Extract legal citations from content
   */
  private extractCitations(content: string): string[] {
    const citations = new Set<string>();
    const matches = content.matchAll(this.legalPatterns.citation);
    
    for (const match of matches) {
      citations.add(match[0].trim());
    }
    
    return Array.from(citations);
  }

  /**
   * Detect the primary legal area based on content
   */
  private detectLegalArea(content: string): LegalArea {
    const lowerContent = content.toLowerCase();
    
    const areaKeywords: Record<LegalArea, string[]> = {
      constitutional: ['constitución', 'constitucional', 'amparo', 'garantías'],
      civil: ['civil', 'contratos', 'obligaciones', 'propiedad', 'sucesiones'],
      criminal: ['penal', 'delito', 'pena', 'criminal', 'imputado'],
      labor: ['trabajo', 'laboral', 'trabajador', 'patrón', 'sindicato'],
      tax: ['fiscal', 'impuesto', 'tributario', 'contribución', 'sat'],
      commercial: ['mercantil', 'comercio', 'sociedad', 'empresa', 'negocio'],
      administrative: ['administrativo', 'gobierno', 'servidor público', 'administración'],
      environmental: ['ambiental', 'ecología', 'medio ambiente', 'sustentable'],
      family: ['familia', 'matrimonio', 'divorcio', 'alimentos', 'custodia'],
      property: ['inmobiliario', 'propiedad', 'registro', 'catastro', 'predio'],
      migration: ['migración', 'extranjero', 'visa', 'deportación', 'refugiado'],
      'human-rights': ['derechos humanos', 'discriminación', 'dignidad', 'libertad']
    };
    
    let bestMatch: LegalArea = 'constitutional';
    let maxScore = 0;
    
    for (const [area, keywords] of Object.entries(areaKeywords)) {
      let score = 0;
      for (const keyword of keywords) {
        if (lowerContent.includes(keyword)) {
          score++;
        }
      }
      if (score > maxScore) {
        maxScore = score;
        bestMatch = area as LegalArea;
      }
    }
    
    return bestMatch;
  }

  /**
   * Helper methods
   */
  private extractTitle(lines: string[], startIndex: number): string {
    // Look for title in the same line or next lines
    const currentLine = lines[startIndex];
    const titleInLine = currentLine.split(/\s{2,}/).slice(1).join(' ').trim();
    
    if (titleInLine) {
      return titleInLine;
    }
    
    // Check next lines for title
    for (let i = startIndex + 1; i < Math.min(startIndex + 3, lines.length); i++) {
      const line = lines[i].trim();
      if (line && !line.match(/^(?:Artículo|CAPÍTULO|TÍTULO|SECCIÓN)/)) {
        return line;
      }
    }
    
    return '';
  }

  private generateDocumentId(title: string): string {
    const slug = title
      .toLowerCase()
      .replace(/[áàäâ]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöô]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    
    const timestamp = Date.now().toString(36);
    return `${slug}-${timestamp}`;
  }

  private getHierarchyLevel(documentType: DocumentType): number {
    const hierarchyMap: Record<DocumentType, number> = {
      constitution: 1,
      treaty: 2,
      law: 3,
      code: 3,
      regulation: 4,
      norm: 5,
      agreement: 7,
      jurisprudence: 7,
      format: 7
    };
    
    return hierarchyMap[documentType] || 7;
  }

  private parseSpanishDate(dateStr: string): string {
    const months: Record<string, string> = {
      enero: '01', febrero: '02', marzo: '03', abril: '04',
      mayo: '05', junio: '06', julio: '07', agosto: '08',
      septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12'
    };
    
    const match = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = months[match[2].toLowerCase()] || '01';
      const year = match[3];
      return `${year}-${month}-${day}`;
    }
    
    return new Date().toISOString().split('T')[0];
  }

  private fixCommonOCRErrors(text: string): string {
    // Fix common OCR errors in Spanish legal text
    return text
      .replace(/\bl\s+a\b/g, 'la')
      .replace(/\be\s+l\b/g, 'el')
      .replace(/\bd\s+e\b/g, 'de')
      .replace(/\bI\s+a\b/g, 'la')
      .replace(/\bfraccion\b/gi, 'fracción')
      .replace(/\barticulo\b/gi, 'artículo')
      .replace(/\bcapitulo\b/gi, 'capítulo')
      .replace(/\bparrafo\b/gi, 'párrafo');
  }
}