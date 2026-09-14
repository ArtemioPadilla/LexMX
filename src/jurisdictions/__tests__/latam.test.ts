import { describe, expect, it } from 'vitest';
import { getJurisdiction, listJurisdictions, parseCorpusScope } from '../index';

const CODES = ['mx', 'cl', 'ar', 'co', 'pe', 'br', 'uy', 'ec', 'cr', 'pa'];

describe('LATAM registry', () => {
  it('registers the ten countries of the program in wave order', () => {
    expect(listJurisdictions().map((j) => j.code)).toEqual(CODES);
  });

  it.each(CODES)('%s satisfies the Jurisdiction contract', (code) => {
    const j = getJurisdiction(code);
    expect(j.entities.length).toBeGreaterThan(0);
    expect(new Set(j.entities.map((e) => e.code)).size).toBe(j.entities.length);
    expect(j.hierarchy.map((h) => h.level)).toEqual(j.hierarchy.map((_, i) => i + 1));
    expect(j.hierarchy[0]?.name.toLowerCase()).toMatch(/constitu/);
    expect(j.sources.some((s) => s.kind === 'legislation' || s.kind === 'gazette')).toBe(true);
    expect(j.sources.every((s) => s.url.startsWith('http'))).toBe(true);
    expect(j.corpusScopes[0]).toMatch(new RegExp(`^${code}-`));
    expect(j.corpusScopes.slice(1)).toEqual(j.entities.map((e) => e.code.toLowerCase()));
    expect(j.legal.privacyLaw.name.length).toBeGreaterThan(5);
    expect(j.legal.disclaimer).toMatch(/fuente oficial|fonte oficial/);
    expect(j.languages).toContain(j.defaultLanguage);
  });

  it('parses national scopes per country', () => {
    expect(parseCorpusScope('cl')).toEqual({ jurisdiction: 'cl', scope: 'nacional' });
    expect(parseCorpusScope('br-sp')).toEqual({ jurisdiction: 'br', scope: 'sp' });
    expect(parseCorpusScope('br')).toEqual({ jurisdiction: 'br', scope: 'federal' });
    expect(parseCorpusScope('zz-x')).toEqual({ jurisdiction: 'mx', scope: 'x' });
  });

  it('counts subnational entities as the official lists', () => {
    const counts = Object.fromEntries(listJurisdictions().map((j) => [j.code, j.entities.length]));
    expect(counts).toEqual({ mx: 32, cl: 16, ar: 24, co: 33, pe: 26, br: 27, uy: 19, ec: 24, cr: 7, pa: 14 });
  });
});

describe('Spanish citation factory', () => {
  it('formats with the right connector', () => {
    const cl = getJurisdiction('cl').citation;
    expect(cl.formatArticle({ number: '160', instrument: 'Código del Trabajo' })).toBe('Artículo 160 del Código del Trabajo');
    expect(cl.formatArticle({ number: '19', instrument: 'Constitución Política de la República' })).toBe('Artículo 19 de la Constitución Política de la República');
    expect(cl.formatArticle({ number: '4', suffix: 'Bis', instrument: 'Ley N° 19.628' })).toBe('Artículo 4 Bis de la Ley N° 19.628');
  });

  it('parses Chilean, Argentine, Colombian and Peruvian prose', () => {
    const cl = getJurisdiction('cl').citation.parse('Según el artículo 19 N° 4 de la Constitución Política de la República y el art. 160 del Código del Trabajo, la Ley N° 19.628 aplica; ver Rol N° 12.345-2020.');
    expect(cl.map((c) => c.kind)).toEqual(['constitutional', 'article', 'law', 'ruling']);
    expect(cl[1]).toMatchObject({ number: '160', instrument: 'Código del Trabajo' });
    expect(cl[3]?.number).toBe('12.345-2020');

    const ar = getJurisdiction('ar').citation.parse('El artículo 14 bis de la Constitución Nacional y el artículo 245 de la Ley 20.744 (Fallos: 335:1129).');
    expect(ar.map((c) => c.kind)).toEqual(['constitutional', 'article', 'law', 'ruling']);
    expect(ar[0]).toMatchObject({ number: '14', suffix: 'Bis', instrument: 'Constitución Nacional' });

    const co = getJurisdiction('co').citation.parse('Conforme al artículo 53 de la Constitución Política, la Ley 1581 de 2012 y la Sentencia C-355 de 2006.');
    expect(co.map((c) => c.kind)).toEqual(['constitutional', 'law', 'ruling']);
    expect(co[2]?.number).toBe('C-355 de 2006');

    const pe = getJurisdiction('pe').citation.parse('Véase el artículo 22 del Decreto Legislativo N.° 728 y la STC Exp. N.° 00001-2010-PI/TC; Ley N.° 29733.');
    expect(pe.map((c) => c.kind)).toEqual(['article', 'decree', 'ruling', 'law']);
  });

  it('handles Portuguese for Brazil', () => {
    const br = getJurisdiction('br').citation;
    expect(br.formatArticle({ number: '482', instrument: 'CLT' })).toBe('art. 482 da CLT');
    expect(br.formatArticle({ number: '5', instrument: 'Código Civil' })).toBe('art. 5 do Código Civil');
    const cites = br.parse('Nos termos do art. 5º, inciso X, da Constituição Federal e do art. 482 da CLT; ver Lei nº 13.709/2018, RE 1.010.606 e Súmula Vinculante 37.');
    expect(cites.map((c) => c.kind)).toEqual(['constitutional', 'article', 'law', 'ruling', 'ruling']);
    expect(cites[0]).toMatchObject({ number: '5', instrument: 'Constituição Federal' });
    expect(cites[2]?.number).toBe('13.709/2018');
    expect(cites[4]?.number).toBe('37');
  });
});
