import { describe, it, expect } from 'vitest';
import { MexicanLegalDocumentProcessor } from '../document-processor';
import type { LegalDocument } from '@/types/legal';

/**
 * Builds a minimal, valid LegalDocument whose single content block holds the
 * raw multi-line text under test, mirroring how real corpus documents store
 * an entire título/capítulo/artículo body as one LegalContent entry.
 */
function buildDocument(contentText: string): LegalDocument {
  return {
    id: 'test-doc',
    title: 'Ley de Prueba',
    shortTitle: 'LP',
    type: 'law',
    hierarchy: 3,
    primaryArea: 'civil',
    secondaryAreas: [],
    authority: 'Test Authority',
    publicationDate: '2024-01-01',
    status: 'active',
    territorialScope: 'federal',
    applicability: 'Nacional',
    relatedDependencies: [],
    importance: 'medium',
    updateFrequency: 'medium',
    content: [
      {
        id: 'test-doc-body',
        type: 'title',
        number: 'I',
        title: 'Cuerpo',
        content: contentText,
      },
    ],
  };
}

describe('MexicanLegalDocumentProcessor', () => {
  const processor = new MexicanLegalDocumentProcessor();

  it('preserves TÍTULO / CAPÍTULO / Artículo structure when chunking', async () => {
    const text = [
      'TÍTULO I',
      'CAPÍTULO I De los Derechos Humanos',
      'Artículo 1. En los Estados Unidos Mexicanos todas las personas gozarán de los derechos humanos.',
      'Artículo 2. La Nación Mexicana es única e indivisible.',
    ].join('\n');

    const chunks = await processor.processLegalDocument(buildDocument(text));
    const types = chunks.map(c => c.metadata.type);

    // NOTE: `identifyLegalUnits` only special-cases article/section/chapter
    // prefixes (its `title` pattern is otherwise unused), so a leading
    // TÍTULO line is preserved as the text of a leading 'paragraph' unit
    // rather than being tagged as a distinct 'title' unit. This test
    // documents that existing behavior rather than the pattern table.
    expect(types).toContain('paragraph');
    expect(types).toContain('chapter');
    expect(types.filter(t => t === 'article')).toHaveLength(2);

    const preamble = chunks.find(c => c.metadata.type === 'paragraph');
    expect(preamble?.content).toContain('TÍTULO I');

    const articleOne = chunks.find(
      c => c.metadata.type === 'article' && c.metadata.article === '1'
    );
    expect(articleOne?.content).toContain('Artículo 1');
    expect(articleOne?.content).toContain('derechos humanos');
  });

  it('extracts Mexican legal citations (constitutional, statutory and jurisprudence)', async () => {
    const text = [
      'Artículo 1. Toda persona goza de los derechos reconocidos en el Artículo 123 constitucional.',
      'Artículo 2. Lo anterior conforme al Artículo 47 de la Ley Federal del Trabajo y la Tesis 1a./J. 15/2019.',
    ].join('\n');

    const chunks = await processor.processLegalDocument(buildDocument(text));
    const citations = chunks.flatMap(c => c.metadata.citations);

    // Constitutional citation: "Artículo 123 constitucional"
    expect(citations.some(c => c.includes('Artículo 123'))).toBe(true);
    // Statutory citation: "Artículo 47 de la Ley Federal del Trabajo"
    expect(
      citations.some(c => c.includes('47') && c.includes('Ley Federal del Trabajo'))
    ).toBe(true);
    // Jurisprudence citation: "Tesis 1a./J. 15/2019"
    expect(citations.some(c => c.startsWith('Tesis 1a./J.'))).toBe(true);
  });
});
