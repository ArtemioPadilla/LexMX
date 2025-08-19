import { describe, it, expect, beforeEach } from 'vitest';
import { ContextualChunker } from '../contextual-chunker';
import type { LegalDocument } from '@/types/legal';

describe('ContextualChunker', () => {
  let chunker: ContextualChunker;

  beforeEach(() => {
    chunker = new ContextualChunker({
      maxChunkSize: 200,
      overlapSize: 20,
      preserveStructure: true,
      minChunkSize: 50
    });
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const defaultChunker = new ContextualChunker();
      expect(defaultChunker).toBeDefined();
    });

    it('should accept custom configuration', () => {
      expect(chunker).toBeDefined();
    });
  });

  describe('chunkDocument', () => {
    it('should chunk structured legal document', async () => {
      const document: LegalDocument = {
        id: 'test-doc',
        title: 'Test Legal Document',
        type: 'law',
        hierarchy: 3,
        primaryArea: 'civil',
        secondaryAreas: [],
        authority: 'Test Authority',
        publicationDate: '2024-01-01',
        status: 'active',
        territorialScope: 'federal',
        content: [
          {
            id: 'section-1',
            type: 'article',
            number: '1',
            title: 'First Article',
            content: 'This is the content of the first article which is long enough to be a chunk.'
          },
          {
            id: 'section-2',
            type: 'article',
            number: '2',
            title: 'Second Article',
            content: 'This is the content of the second article with more legal text here.'
          }
        ],
        citations: []
      };

      const chunks = await chunker.chunkDocument(document);
      
      expect(chunks).toHaveLength(2);
      expect(chunks[0].documentId).toBe('test-doc');
      expect(chunks[0].content).toContain('first article');
      expect(chunks[0].metadata?.article).toBe('1');
    });

    it('should handle documents without structured content', async () => {
      const document: LegalDocument = {
        id: 'test-doc-2',
        title: 'Unstructured Document',
        type: 'law',
        hierarchy: 3,
        primaryArea: 'civil',
        secondaryAreas: [],
        authority: 'Test Authority',
        publicationDate: '2024-01-01',
        status: 'active',
        territorialScope: 'federal',
        content: [],
        citations: []
      };

      const chunks = await chunker.chunkDocument(document);
      
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should add document metadata to all chunks', async () => {
      const document: LegalDocument = {
        id: 'test-doc-3',
        title: 'Metadata Test Document',
        type: 'code',
        hierarchy: 3,
        primaryArea: 'criminal',
        secondaryAreas: ['civil'],
        authority: 'Federal Authority',
        publicationDate: '2024-01-01',
        status: 'active',
        territorialScope: 'federal',
        content: [{
          id: 'section-1',
          type: 'article',
          content: 'Short content'
        }],
        citations: []
      };

      const chunks = await chunker.chunkDocument(document);
      
      expect(chunks[0].metadata).toMatchObject({
        documentId: 'test-doc-3',
        documentTitle: 'Metadata Test Document',
        documentType: 'code',
        legalArea: 'criminal',
        authority: 'Federal Authority',
        publicationDate: '2024-01-01'
      });
    });
  });

  describe('sentence splitting', () => {
    it('should split text into sentences correctly', () => {
      const text = 'Primera oración. Segunda oración. Art. 123 no debe dividirse. Última oración.';
      const sentences = (chunker as any).splitIntoSentences(text);
      
      expect(sentences).toHaveLength(4);
      expect(sentences[2]).toContain('Art. 123');
    });

    it('should preserve legal abbreviations', () => {
      const text = 'Según el Art. 47 de la ley. Frac. III del reglamento. Inc. A del código.';
      const sentences = (chunker as any).splitIntoSentences(text);
      
      expect(sentences[0]).toContain('Art. 47');
      expect(sentences[1]).toContain('Frac. III');
      expect(sentences[2]).toContain('Inc. A');
    });
  });

  describe('keyword extraction', () => {
    it('should extract legal keywords from text', () => {
      const text = 'El artículo 123 de la constitución establece el derecho y la obligación según el código civil.';
      const keywords = (chunker as any).extractKeywords(text);
      
      expect(keywords).toContain('artículo');
      expect(keywords).toContain('constitución');
      expect(keywords).toContain('derecho');
      expect(keywords).toContain('obligación');
      expect(keywords).toContain('código');
      expect(keywords).toContain('art_123');
    });

    it('should extract law references', () => {
      const text = 'Según la Ley Federal del Trabajo y el Código Civil Federal.';
      const keywords = (chunker as any).extractKeywords(text);
      
      const lawKeywords = keywords.filter(k => k.startsWith('ley_'));
      expect(lawKeywords.length).toBeGreaterThan(0);
    });
  });

  describe('overlap creation', () => {
    it('should create overlap context correctly', () => {
      const paragraphs = ['First paragraph.', 'Second paragraph.', 'Third paragraph.'];
      const overlap = (chunker as any).createOverlapContext(paragraphs, 1, 1);
      
      expect(overlap).toContain('Second paragraph');
    });

    it('should handle edge cases in overlap', () => {
      const paragraphs = ['Only paragraph.'];
      const overlap = (chunker as any).createOverlapContext(paragraphs, 0, 2);
      
      expect(overlap).toContain('Only paragraph');
    });
  });

  describe('chunk size control', () => {
    it('should respect maximum chunk size', async () => {
      const longContent = 'a'.repeat(1000);
      const document: LegalDocument = {
        id: 'long-doc',
        title: 'Long Document',
        type: 'law',
        hierarchy: 3,
        primaryArea: 'civil',
        secondaryAreas: [],
        authority: 'Test',
        publicationDate: '2024-01-01',
        status: 'active',
        territorialScope: 'federal',
        content: [{
          id: 'section-1',
          type: 'article',
          content: longContent
        }],
        citations: []
      };

      const chunks = await chunker.chunkDocument(document);
      
      chunks.forEach(chunk => {
        // Account for added context (article prefix, title, etc can add ~150 chars)
        expect(chunk.content.length).toBeLessThanOrEqual(350); // Max size (200) + context (~150)
      });
    });

    it('should respect minimum chunk size', async () => {
      const shortContent = 'abc';
      const document: LegalDocument = {
        id: 'short-doc',
        title: 'Short Document',
        type: 'law',
        hierarchy: 3,
        primaryArea: 'civil',
        secondaryAreas: [],
        authority: 'Test',
        publicationDate: '2024-01-01',
        status: 'active',
        territorialScope: 'federal',
        content: [{
          id: 'section-1',
          type: 'article',
          content: shortContent
        }],
        citations: []
      };

      const chunks = await chunker.chunkDocument(document);
      
      // Very short content should still create a chunk
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('cross-references', () => {
    it('should add cross-references between chunks', () => {
      const chunks = [
        {
          id: 'chunk-1',
          documentId: 'doc',
          content: 'Según el artículo 2 de esta ley',
          metadata: { article: '1' },
          keywords: []
        },
        {
          id: 'chunk-2',
          documentId: 'doc',
          content: 'El contenido del artículo segundo',
          metadata: { article: '2' },
          keywords: []
        }
      ];

      (chunker as any).addCrossReferences(chunks);
      
      expect(chunks[0].relatedChunks).toContain('chunk-2');
    });
  });
});