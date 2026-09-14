import { describe, expect, it } from 'vitest';
import { CONTRACT_SCHEMA, extractRow, findAmounts, findClause, findDates, findKeyword, findParties, findRegex, rowsToCsv } from '../extract-fields';

const CONTRACT = `CONTRATO DE ARRENDAMIENTO que celebran, por una parte, Inmobiliaria Sol, S.A. de C.V., en lo sucesivo "EL ARRENDADOR", y por la otra parte María López Ruiz, en lo sucesivo "LA ARRENDATARIA".

En la Ciudad de México, a 15 de marzo de 2026.

PRIMERA.- OBJETO. El arrendador otorga el uso del inmueble.

SEGUNDA.- RENTA. La renta mensual será de $18,500.00 (dieciocho mil quinientos pesos 00/100 M.N.), pagadera el día 01/04/2026.

TERCERA.- VIGENCIA. El presente contrato tendrá una vigencia de doce meses forzosos para ambas partes,
contados a partir de la firma.

CUARTA.- JURISDICCIÓN. Las partes se someten a los tribunales de la Ciudad de México.
`;

describe('extract-fields', () => {
  it('finds long, numeric and ISO dates normalized to ISO in document order', () => {
    const dates = findDates(CONTRACT).map((d) => d.value);
    expect(dates).toEqual(['2026-03-15', '2026-04-01']);
    expect(findDates('firmado el 2025-12-31')[0]?.value).toBe('2025-12-31');
    expect(findDates('el 31/13/2026 no existe')).toEqual([]);
  });

  it('finds amounts as written', () => {
    expect(findAmounts(CONTRACT)[0]?.value).toBe('$18,500.00');
    expect(findAmounts('pagará 2,000 pesos')[0]?.value).toBe('2,000 pesos');
  });

  it('extracts the two parties from a "celebran ... y por la otra" clause', () => {
    const p = findParties(CONTRACT);
    expect(p?.value).toContain('Inmobiliaria Sol, S.A. de C.V.');
    expect(p?.value).toContain('María López Ruiz');
  });

  it('returns the sentence around a keyword, accent-insensitive', () => {
    expect(findKeyword(CONTRACT, 'TRIBUNALES')?.value).toContain('Ciudad de México');
    expect(findKeyword(CONTRACT, 'jurisdiccion')?.value).toMatch(/JURISDICCIÓN/);
    expect(findKeyword(CONTRACT, 'garantía')).toBeNull();
  });

  it('extracts a clause by heading until the blank line', () => {
    const c = findClause(CONTRACT, 'vigencia');
    expect(c?.value).toMatch(/^TERCERA\.- VIGENCIA/);
    expect(c?.value).toContain('contados a partir de la firma');
    expect(c?.value).not.toContain('CUARTA');
  });

  it('uses the first capture group of a user regex and tolerates bad patterns', () => {
    expect(findRegex(CONTRACT, 'renta mensual será de (\\$[\\d,.]+)')?.value).toBe('$18,500.00');
    expect(findRegex(CONTRACT, '(')).toBeNull();
  });

  it('builds a row with the contract schema and exports CSV', () => {
    const row = extractRow('arrendamiento.pdf', CONTRACT, CONTRACT_SCHEMA);
    expect(row.cells.date?.value).toBe('2026-03-15');
    expect(row.cells.amount?.value).toBe('$18,500.00');
    const csv = rowsToCsv(CONTRACT_SCHEMA, [row]);
    expect(csv.split('\n')[0]).toBe('"Documento","Partes","Fecha","Monto","Vigencia","Jurisdicción"');
    expect(csv).toContain('"arrendamiento.pdf"');
    expect(csv).toContain('"2026-03-15"');
  });
});
