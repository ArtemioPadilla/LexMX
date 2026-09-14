import { describe, expect, it } from 'vitest';
import {
  normalizeArticleNumber,
  areaFromMateria,
  corpusIndexEntry,
  humanizeTitle,
  isoDate,
  parseSnapshotBody,
  parseSnapshotHeader,
  snapshotBody,
  statusFromVigencia,
  toLegalDocument,
  typeFromName,
} from '../legalia';

// Excerpt shaped exactly like a `scjn-leyes` snapshot published by LegalIA.
const SNAPSHOT = `---
fuente: scjn
ordenamiento: LEY DE ADQUISICIONES, ARRENDAMIENTOS Y SERVICIOS DEL SECTOR PUBLICO
fecha_publicacion: 16-04-2025
fecha_expedicion: 16-04-2025
categoria: LEY
ratio_similitud: 1.000
sospechoso: false
seccion_publicacion: 105/2025 EDICION VESPERTINA
materia: ADMINISTRATIVO
id_ordenamiento: 179570
reforma_id: 1
---

**LEY DE ADQUISICIONES, ARRENDAMIENTOS Y SERVICIOS DEL SECTOR PÚBLICO**

**TEXTO ORIGINAL.**

Ley publicada en la Edición Vespertina del Número 105/2025 del Diario Oficial de la Federación.

## Al margen un sello con el Escudo Nacional, que dice: Estados Unidos Mexicanos.- Presidencia de la República.

**DECRETO**

**Artículo Primero.-** Se expide la Ley de Adquisiciones, para quedar como sigue:

Título Primero

Disposiciones Generales

Capítulo Único

**Artículo 1.** La presente Ley es de orden público y tiene por objeto reglamentar la aplicación del artículo 134 constitucional.

**Artículo 2.** Para los efectos de la presente Ley, se entenderá por:

**I.** Secretaría: la Secretaría de Hacienda y Crédito Público;

**II.** Dependencias: las unidades administrativas de la Presidencia de la República.

Capítulo Segundo

De los Sujetos

**Artículo 3 Bis.** Los sujetos obligados observarán esta Ley.

## Transitorios

**Primero.** La presente Ley entrará en vigor al día siguiente de su publicación.

**Segundo.** Se abroga la Ley anterior.
`;

describe('parseSnapshotHeader / snapshotBody', () => {
  it('reads every header field and strips the header from the body', () => {
    const header = parseSnapshotHeader(SNAPSHOT);
    expect(header.fuente).toBe('scjn');
    expect(header.materia).toBe('ADMINISTRATIVO');
    expect(header.id_ordenamiento).toBe('179570');
    expect(header.reforma_id).toBe('1');
    expect(snapshotBody(SNAPSHOT).startsWith('\n**LEY DE ADQUISICIONES')).toBe(true);
  });

  it('returns an empty header when there is none', () => {
    expect(parseSnapshotHeader('**Artículo 1.** Texto')).toEqual({});
    expect(snapshotBody('hola')).toBe('hola');
  });
});

describe('parseSnapshotBody', () => {
  const content = parseSnapshotBody(snapshotBody(SNAPSHOT), 'laassp');
  const byId = Object.fromEntries(content.map((c) => [c.id, c]));

  it('produces one article per "**Artículo N.**" paragraph with fractions folded in', () => {
    const art2 = byId['laassp-art-2'];
    expect(art2?.type).toBe('article');
    expect(art2?.number).toBe('2');
    expect(art2?.content).toContain('se entenderá por');
    expect(art2?.content).toContain('I. Secretaría');
    expect(art2?.content).toContain('II. Dependencias');
  });

  it('keeps Bis articles and builds the container hierarchy', () => {
    const art3bis = byId['laassp-art-3-bis'];
    expect(art3bis?.number).toBe('3 Bis');
    expect(art3bis?.parent).toBe('laassp-chapter-segundo');
    expect(byId['laassp-title-primero']?.type).toBe('title');
    expect(byId['laassp-title-primero']?.content).toBe('Título Primero: Disposiciones Generales');
    expect(byId['laassp-chapter-unico']?.content).toBe('Capítulo Único');
    expect(byId['laassp-chapter-segundo']?.children).toEqual(['laassp-art-3-bis']);
  });

  it('separates transitorios from the numbered articles', () => {
    expect(byId['laassp-transitorios']?.type).toBe('section');
    expect(byId['laassp-trans-primero']?.parent).toBe('laassp-transitorios');
    expect(byId['laassp-trans-segundo']?.content).toContain('Se abroga');
  });

  it('does not index the decree preamble as an article of the law', () => {
    const preamble = content.filter((c) => c.content.includes('Se expide la Ley'));
    // "Artículo Primero.-" of the decree is an article-shaped lead; it is kept as an
    // ordinal article before Título Primero so nothing is silently lost.
    expect(preamble).toHaveLength(1);
    expect(preamble[0]?.parent).toBeUndefined();
    expect(content.some((c) => c.content.includes('Al margen un sello'))).toBe(false);
  });
});

describe('metadata mapping', () => {
  it('maps SCOW materia to LexMX legal areas', () => {
    expect(areaFromMateria('SEGURIDAD SOCIAL, LABORAL')).toBe('labor');
    expect(areaFromMateria('FISCAL')).toBe('tax');
    expect(areaFromMateria('PENAL')).toBe('criminal');
    expect(areaFromMateria(null, 'CÓDIGO Civil Federal')).toBe('civil');
    expect(areaFromMateria(undefined, 'LEY de Migración')).toBe('migration');
    expect(areaFromMateria('OTRA COSA')).toBe('administrative');
  });

  it('derives type and hierarchy from the instrument name', () => {
    expect(typeFromName('CONSTITUCIÓN Política de los Estados Unidos Mexicanos')).toEqual({ type: 'constitution', hierarchy: 1 });
    expect(typeFromName('CÓDIGO Penal Federal')).toEqual({ type: 'code', hierarchy: 3 });
    expect(typeFromName('LEY Federal del Trabajo', 'LEY')).toEqual({ type: 'law', hierarchy: 3 });
    expect(typeFromName('REGLAMENTO de la Ley Federal del Trabajo')).toEqual({ type: 'regulation', hierarchy: 4 });
    // The header's categoria describes the latest reform, not the instrument.
    expect(typeFromName('LEY Federal de Protección al Consumidor', 'ACUERDO')).toEqual({ type: 'law', hierarchy: 3 });
    expect(typeFromName('LEY Federal del Trabajo', 'DECRETO')).toEqual({ type: 'law', hierarchy: 3 });
    expect(typeFromName('ESTATUTO de Gobierno del Distrito Federal')).toEqual({ type: 'format', hierarchy: 7 });
  });

  it('maps vigencia to status', () => {
    expect(statusFromVigencia('VIGENTE')).toBe('active');
    expect(statusFromVigencia('ABROGADO')).toBe('repealed');
    expect(statusFromVigencia('DEROGADO')).toBe('repealed');
    expect(statusFromVigencia('SIN EFECTO')).toBe('suspended');
    expect(statusFromVigencia(undefined)).toBe('active');
  });

  it('formats dates and titles', () => {
    expect(isoDate('16-04-2025')).toBe('2025-04-16');
    expect(isoDate(undefined)).toBeUndefined();
    expect(humanizeTitle('LEY Federal del Trabajo')).toBe('Ley Federal del Trabajo');
    expect(humanizeTitle('CÓDIGO Civil Federal')).toBe('Código Civil Federal');
  });
});

describe('toLegalDocument', () => {
  const doc = toLegalDocument(
    {
      slug: 'laassp',
      nombre: 'LEY de Adquisiciones, Arrendamientos y Servicios del Sector Público',
      materia: 'ADMINISTRATIVO',
      vigencia: 'VIGENTE',
      resumen: 'Ley que regula las adquisiciones del sector público.',
      fechaPublicacion: '16-04-2025',
      fechaOriginal: '16-04-2025',
      totalSnapshots: 1,
    },
    SNAPSHOT,
  );

  it('builds a LegalDocument LexMX can index', () => {
    expect(doc.id).toBe('laassp');
    expect(doc.title).toBe('Ley de Adquisiciones, Arrendamientos y Servicios del Sector Público');
    expect(doc.type).toBe('law');
    expect(doc.hierarchy).toBe(3);
    expect(doc.primaryArea).toBe('administrative');
    expect(doc.status).toBe('active');
    expect(doc.territorialScope).toBe('federal');
    expect(doc.publicationDate).toBe('2025-04-16');
    expect(doc.lastReform).toBe('2025-04-16');
    expect(doc.officialUrl).toContain('idOrdenamiento=179570');
    expect(doc.content.filter((c) => c.type === 'article').length).toBeGreaterThanOrEqual(5);
    expect(doc.fullText).toContain('Artículo 1. La presente Ley');
    expect(doc.applicability).toBe('Ley que regula las adquisiciones del sector público.');
  });

  it('produces the public corpus index entry', () => {
    const entry = corpusIndexEntry(doc, 1234);
    expect(entry).toMatchObject({
      id: 'laassp',
      type: 'law',
      hierarchy: 3,
      status: 'active',
      jurisdiction: 'mx-federal',
      source: 'legalia:scjn-leyes',
      size: 1234,
      url: '/legal-corpus/laassp.json',
    });
  });
});

describe('article header shapes across LegalIA snapshots', () => {
  it.each([
    ['**Artículo 47.** Texto', '47'],
    ['**Artículo  452.** (DEROGADO)', '452'],
    ['Art. 1o.- En los Estados Unidos Mexicanos', '1'],
    ['Art. 115. (DEROGADO POR EL ARTÍCULO 4° TRANSITORIO)', '115'],
    ['Art. 1,000. (DEROGADO)', '1000'],
    ['Art. 1,390 Bis 15. El emplazamiento', '1390 Bis 15'],
    ['**ARTICULO 1**,002.- El usufructuario', '1002'],
    ['**ARTICULO 2o.-**A.- El impuesto se calculará', '2-A'],
    ['**Artículo 17-H.-** Los certificados', '17-H'],
    ['**ARTICULO 10 BIS.-** Los proveedores', '10 Bis'],
    ['**ARTICULO 107 bis.-** El término', '107 Bis'],
    ['**ARTICULO 13.- (DEROGADO, D.O.F. 31 DE DICIEMBRE DE 1998)**', '13'],
    ['**ARTICULO PRIMERO.-** La presente Ley', 'Primero'],
    ['**Artículo Único.** El presente Decreto', 'Único'],
    ['**Primero.** Entrará en vigor', 'Primero'],
  ])('%s → %s', (lead, expected) => {
    expect(normalizeArticleNumber(lead)).toBe(expected);
  });

  it('does not treat a paragraph that starts with a cross-reference as a header', () => {
    const body = '**Artículo 1.** Uno.\n\nArtículo 17-H Bis de este Código no aplica aquí.\n\nArtículos 5o. y 6o. se citan.';
    const content = parseSnapshotBody(body, 'x');
    expect(content.map((c) => c.number)).toEqual(['1']);
    expect(content[0]?.content).toContain('17-H Bis de este Código');
  });

  it('parses CPEUM-style plain "Art. No.-" leads and CCF-style broken bold', () => {
    const body = ['**CAPITULO I.**', '**DE LOS DERECHOS HUMANOS.**', 'Art. 1o.- Todas las personas.', '**(REFORMADO, D.O.F. 2011)**', 'Segundo párrafo del 1o.', 'Art. 2o.- La Nación.', '**ARTICULO 1**,910.- El que obrando ilícitamente.'].join('\n\n');
    const content = parseSnapshotBody(body, 'c');
    expect(content.filter((c) => c.type === 'article').map((c) => c.number)).toEqual(['1', '2', '1910']);
    expect(content.find((c) => c.number === '1')?.content).toContain('Segundo párrafo');
    expect(content.find((c) => c.number === '1')?.parent).toBe('c-chapter-i');
  });

  it('splits long articles into self-describing parts', () => {
    const long = Array.from({ length: 12 }, (_, i) => `Párrafo ${i + 1}. ${'texto '.repeat(60)}`).join('\n\n');
    const content = parseSnapshotBody(`**Artículo 47.** ${long}`, 'lft');
    expect(content.length).toBeGreaterThan(1);
    expect(content.every((c) => c.number === '47' && c.content.length <= 1900)).toBe(true);
    expect(content[0]?.partNumber).toBe(1);
    expect(content[0]?.totalParts).toBe(content.length);
    expect(content[1]?.id).toBe('lft-art-47-p2');
    expect(content[1]?.content.startsWith('Artículo 47. ')).toBe(true);
    expect(content[1]?.title).toMatch(/parte 2\//);
  });
});
