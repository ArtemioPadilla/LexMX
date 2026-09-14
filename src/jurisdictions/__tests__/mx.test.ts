import { describe, expect, it } from 'vitest';
import { getJurisdiction, listJurisdictions, parseCorpusScope } from '../index';
import { MX_ENTITIES, mx, mxCitation } from '../mx';

describe('jurisdictions registry', () => {
  it('returns Mexico by default and lists it', () => {
    expect(getJurisdiction().code).toBe('mx');
    expect(getJurisdiction('mx')).toBe(mx);
    expect(listJurisdictions().map((j) => j.code)).toEqual(['mx']);
  });

  it('rejects unknown codes with the available list', () => {
    expect(() => getJurisdiction('xx')).toThrow(/mx/);
  });

  it('parses corpus scopes', () => {
    expect(parseCorpusScope('mx-federal')).toEqual({ jurisdiction: 'mx', scope: 'federal' });
    expect(parseCorpusScope('mx-jal')).toEqual({ jurisdiction: 'mx', scope: 'jal' });
    expect(parseCorpusScope('mx')).toEqual({ jurisdiction: 'mx', scope: 'federal' });
  });
});

describe('Mexico module', () => {
  it('has the 32 entidades federativas and the 7-level hierarchy', () => {
    expect(MX_ENTITIES).toHaveLength(32);
    expect(mx.entities.find((e) => e.code === 'MX-CMX')?.name).toBe('Ciudad de México');
    expect(mx.hierarchy.map((h) => h.level)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(mx.corpusScopes[0]).toBe('mx-federal');
    expect(mx.corpusScopes).toContain('mx-jal');
  });

  it('declares open sources with verification links', () => {
    const sjf = mx.sources.find((s) => s.id === 'sjf');
    expect(sjf?.verifyUrl?.replace('{id}', '2031002')).toBe('https://sjf2.scjn.gob.mx/detalle/tesis/2031002');
    expect(mx.sources.filter((s) => s.access === 'open-api').map((s) => s.id)).toEqual(['scjn-scow', 'sidof']);
  });

  it('formats citations in the Mexican style', () => {
    expect(mxCitation.formatArticle({ number: '123', instrument: 'Constitución Política de los Estados Unidos Mexicanos' })).toBe('Artículo 123 constitucional');
    expect(mxCitation.formatArticle({ number: '47', instrument: 'Ley Federal del Trabajo' })).toBe('Artículo 47 de la Ley Federal del Trabajo');
    expect(mxCitation.formatArticle({ number: '15', instrument: 'Reglamento de la Ley Federal del Trabajo' })).toBe('Artículo 15 del Reglamento de la Ley Federal del Trabajo');
    expect(mxCitation.formatArticle({ number: '3', suffix: 'Bis' })).toBe('Artículo 3 Bis');
  });

  it('parses constitutional, statutory, thesis and registro citations from prose', () => {
    const text =
      'Conforme al artículo 123 constitucional y al artículo 47 de la Ley Federal del Trabajo, así como al artículo 3° Bis del Código Civil Federal; véase la tesis 1a./J. 15/2019 (registro digital 2019876).';
    const cites = mxCitation.parse(text);
    expect(cites.map((c) => c.kind)).toEqual(['constitutional', 'article', 'article', 'thesis', 'registro']);
    expect(cites[0]).toMatchObject({ number: '123', instrument: 'Constitución Política de los Estados Unidos Mexicanos' });
    expect(cites[1]).toMatchObject({ number: '47', instrument: 'Ley Federal del Trabajo' });
    expect(cites[2]).toMatchObject({ number: '3', suffix: 'Bis', instrument: 'Código Civil Federal' });
    expect(cites[3]?.number).toBe('1a./J. 15/2019');
    expect(cites[4]?.number).toBe('2019876');
  });

  it('carries the legal framework every answer must show', () => {
    expect(mx.legal.privacyLaw.name).toMatch(/LFPDPPP/);
    expect(mx.legal.disclaimer).toMatch(/no constituye asesoría legal/);
  });
});
