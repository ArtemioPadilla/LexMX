import { describe, it, expect } from 'vitest';
import { DocumentParser } from '../document-parser';
import type { LegalContent } from '@/types/legal';

/** `noUncheckedIndexedAccess`-safe accessor: fails the test with a clear message instead of `undefined`. */
function nth(content: LegalContent[], index: number): LegalContent {
  const section = content[index];
  if (!section) {
    throw new Error(`Expected a parsed section at index ${index}, got none (length ${content.length})`);
  }
  return section;
}

// A small but representative slice of Mexican statutory structure: título,
// capítulo, an article, a "bis" article with fracciones, and a transitorio.
const SAMPLE_LAW = `TÍTULO I
Disposiciones Generales

CAPÍTULO I
Del Objeto de la Ley

Artículo 1.-
La presente ley es de orden público y de observancia general en toda la República mexicana.

Artículo 2 Bis.-
Para los efectos de esta ley se entenderá por:
I. Trabajador: la persona física que presta un trabajo personal subordinado.
II. Patrón: la persona física o moral que utiliza los servicios de uno o varios trabajadores.

TRANSITORIOS

Artículo Primero.-
El presente Decreto entrará en vigor al día siguiente de su publicación en el Diario Oficial de la Federación.
`;

describe('DocumentParser', () => {
  const parser = new DocumentParser();

  it('extracts título, capítulo and artículo sections (including "Bis") in document order', async () => {
    const document = await parser.parse(SAMPLE_LAW, { documentType: 'law' });

    expect(document.content.map((section) => section.type)).toEqual([
      'title',
      'chapter',
      'article',
      'article'
    ]);

    const titulo = nth(document.content, 0);
    const capitulo = nth(document.content, 1);
    const articulo1 = nth(document.content, 2);
    const articulo2Bis = nth(document.content, 3);
    expect(titulo.number).toBe('I');
    expect(capitulo.number).toBe('I');
    expect(articulo1.number).toBe('1');
    expect(articulo2Bis.number).toBe('2 Bis');
  });

  it('keeps fracciones (I/II) as part of the owning "Bis" article content', async () => {
    const document = await parser.parse(SAMPLE_LAW, { documentType: 'law' });
    const articulo2Bis = nth(document.content, 3);

    expect(articulo2Bis.content).toContain('I. Trabajador');
    expect(articulo2Bis.content).toContain('II. Patrón');
  });

  it('does not drop transitorio provisions (no dedicated header pattern for them)', async () => {
    const document = await parser.parse(SAMPLE_LAW, { documentType: 'law' });
    const lastSection = nth(document.content, document.content.length - 1);

    // "TRANSITORIOS" and "Artículo Primero" (an ordinal, not a numbered
    // article) have no structural pattern of their own, so they fold into
    // whatever section preceded them instead of being silently discarded.
    expect(lastSection.content).toContain('TRANSITORIOS');
    expect(lastSection.content).toContain('entrará en vigor');
  });

  it('links each section to its structural parent (artículo -> capítulo -> título)', async () => {
    const document = await parser.parse(SAMPLE_LAW, { documentType: 'law' });
    const titulo = nth(document.content, 0);
    const capitulo = nth(document.content, 1);
    const articulo1 = nth(document.content, 2);
    const articulo2Bis = nth(document.content, 3);

    expect(capitulo.parent).toBe(titulo.id);
    expect(articulo1.parent).toBe(capitulo.id);
    expect(articulo2Bis.parent).toBe(capitulo.id);
  });

  it('builds a LegalDocument with fullText preserved and reasonable defaults', async () => {
    const document = await parser.parse(SAMPLE_LAW, {
      documentType: 'law',
      metadata: { title: 'Ley de Prueba' }
    });

    expect(document.title).toBe('Ley de Prueba');
    expect(document.type).toBe('law');
    expect(document.fullText).toContain('Artículo 1');
    expect(document.hierarchy).toBe(3); // 'law' maps to hierarchy level 3
  });
});
