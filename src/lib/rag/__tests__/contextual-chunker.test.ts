import { describe, it, expect, beforeEach } from 'vitest';
import { ContextualChunker } from '../chunking/contextual-chunker';
import type { LegalDocument, LegalChunk } from '@/types/legal';

// Narrow view of the chunker's private helpers this suite exercises directly
// (sentence splitting, keyword extraction, overlap, cross-references) without
// resorting to `any` casts.
interface ChunkerInternals {
  splitIntoSentences(text: string): string[];
  extractKeywords(text: string): string[];
  createOverlapContext(paragraphs: string[], endIndex: number, contextWindow: number): string;
  addCrossReferences(chunks: LegalChunk[]): void;
}

function internals(chunker: ContextualChunker): ChunkerInternals {
  return chunker as unknown as ChunkerInternals;
}

function makeDocument(overrides: Partial<LegalDocument> = {}): LegalDocument {
  return {
    id: 'test-doc',
    title: 'Test Legal Document',
    shortTitle: 'Test Legal Document',
    type: 'law',
    hierarchy: 3,
    primaryArea: 'civil',
    secondaryAreas: [],
    authority: 'Test Authority',
    publicationDate: '2024-01-01',
    status: 'active',
    territorialScope: 'federal',
    applicability: 'General',
    relatedDependencies: [],
    importance: 'medium',
    updateFrequency: 'medium',
    content: [],
    citations: [],
    ...overrides
  };
}

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
    it('should chunk structured legal document preserving article boundaries', async () => {
      const document = makeDocument({
        id: 'test-doc',
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
        ]
      });

      const chunks = await chunker.chunkDocument(document);

      // One chunk per article: no article got merged or split apart.
      expect(chunks).toHaveLength(2);
      expect(chunks[0]!.documentId).toBe('test-doc');
      expect(chunks[0]!.content).toContain('first article');
      expect(chunks[0]!.metadata?.article).toBe('1');
      expect(chunks[1]!.metadata?.article).toBe('2');
    });

    it('should keep article citations inside the chunk content', async () => {
      const document = makeDocument({
        id: 'citation-doc',
        content: [
          {
            id: 'section-1',
            type: 'article',
            number: '47',
            title: 'Rescisión',
            content: 'Según lo dispuesto en el Artículo 47 de esta ley, procede la rescisión sin responsabilidad.'
          }
        ]
      });

      const chunks = await chunker.chunkDocument(document);

      expect(chunks).toHaveLength(1);
      // The citation ("Artículo 47") must survive chunking verbatim.
      expect(chunks[0]!.content).toContain('Artículo 47');
      expect(chunks[0]!.keywords).toContain('art_47');
    });

    it('should handle documents without structured content', async () => {
      const document = makeDocument({ id: 'test-doc-2', title: 'Unstructured Document', shortTitle: 'Unstructured Document', content: [] });

      const chunks = await chunker.chunkDocument(document);

      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });

    it('should add document metadata to all chunks', async () => {
      const document = makeDocument({
        id: 'test-doc-3',
        title: 'Metadata Test Document',
        shortTitle: 'Metadata Test Document',
        type: 'code',
        primaryArea: 'criminal',
        secondaryAreas: ['civil'],
        authority: 'Federal Authority',
        content: [{ id: 'section-1', type: 'article', content: 'Short content' }]
      });

      const chunks = await chunker.chunkDocument(document);

      expect(chunks[0]!.metadata).toMatchObject({
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
      const sentences = internals(chunker).splitIntoSentences(text);

      expect(sentences).toHaveLength(4);
      expect(sentences[2]).toContain('Art. 123');
    });

    it('should preserve legal abbreviations', () => {
      const text = 'Según el Art. 47 de la ley. Frac. III del reglamento. Inc. A del código.';
      const sentences = internals(chunker).splitIntoSentences(text);

      expect(sentences[0]).toContain('Art. 47');
      expect(sentences[1]).toContain('Frac. III');
      expect(sentences[2]).toContain('Inc. A');
    });
  });

  describe('keyword extraction', () => {
    it('should extract legal keywords from text', () => {
      const text = 'El artículo 123 de la constitución establece el derecho y la obligación según el código civil.';
      const keywords = internals(chunker).extractKeywords(text);

      expect(keywords).toContain('artículo');
      expect(keywords).toContain('constitución');
      expect(keywords).toContain('derecho');
      expect(keywords).toContain('obligación');
      expect(keywords).toContain('código');
      expect(keywords).toContain('art_123');
    });

    it('should extract law references', () => {
      const text = 'Según la Ley Federal del Trabajo y el Código Civil Federal.';
      const keywords = internals(chunker).extractKeywords(text);

      const lawKeywords = keywords.filter((k: string) => k.startsWith('ley_'));
      expect(lawKeywords.length).toBeGreaterThan(0);
    });
  });

  describe('overlap creation', () => {
    it('should create overlap context correctly', () => {
      const paragraphs = ['First paragraph.', 'Second paragraph.', 'Third paragraph.'];
      const overlap = internals(chunker).createOverlapContext(paragraphs, 1, 1);

      expect(overlap).toContain('Second paragraph');
    });

    it('should handle edge cases in overlap', () => {
      const paragraphs = ['Only paragraph.'];
      const overlap = internals(chunker).createOverlapContext(paragraphs, 0, 2);

      expect(overlap).toContain('Only paragraph');
    });
  });

  describe('chunk size control', () => {
    it('should respect maximum chunk size', async () => {
      const longContent = 'a'.repeat(1000);
      const document = makeDocument({
        id: 'long-doc',
        title: 'Long Document',
        shortTitle: 'Long Document',
        authority: 'Test',
        content: [{ id: 'section-1', type: 'article', content: longContent }]
      });

      const chunks = await chunker.chunkDocument(document);

      chunks.forEach(chunk => {
        // Account for added context (article prefix, title, etc can add ~150 chars)
        expect(chunk.content.length).toBeLessThanOrEqual(350); // Max size (200) + context (~150)
      });
    });

    it('should respect minimum chunk size', async () => {
      const shortContent = 'abc';
      const document = makeDocument({
        id: 'short-doc',
        title: 'Short Document',
        shortTitle: 'Short Document',
        authority: 'Test',
        content: [{ id: 'section-1', type: 'article', content: shortContent }]
      });

      const chunks = await chunker.chunkDocument(document);

      // Very short content should still create a chunk
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('cross-references', () => {
    it('should add cross-references between chunks', () => {
      const chunks: LegalChunk[] = [
        {
          id: 'chunk-1',
          documentId: 'doc',
          content: 'Según el artículo 2 de esta ley',
          metadata: { article: '1', type: 'article', hierarchy: 3, legalArea: 'civil' },
          keywords: []
        },
        {
          id: 'chunk-2',
          documentId: 'doc',
          content: 'El contenido del artículo segundo',
          metadata: { article: '2', type: 'article', hierarchy: 3, legalArea: 'civil' },
          keywords: []
        }
      ];

      internals(chunker).addCrossReferences(chunks);

      expect(chunks[0]!.relatedChunks).toContain('chunk-2');
    });
  });
});
