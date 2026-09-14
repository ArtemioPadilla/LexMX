import { describe, expect, it } from 'vitest';
import { diffDocuments, diffTokens, diffWords, toUnifiedText, tokenizeWords } from '../diff';

describe('diffTokens', () => {
  it('aligns with a longest common subsequence', () => {
    expect(diffTokens(['a', 'b', 'c'], ['a', 'c'])).toEqual([
      { op: 'equal', value: 'a' },
      { op: 'delete', value: 'b' },
      { op: 'equal', value: 'c' },
    ]);
  });
  it('handles empty sides', () => {
    expect(diffTokens([], ['x'])).toEqual([{ op: 'insert', value: 'x' }]);
    expect(diffTokens(['x'], [])).toEqual([{ op: 'delete', value: 'x' }]);
    expect(diffTokens([], [])).toEqual([]);
  });
  it('round-trips both inputs', () => {
    const a = tokenizeWords('el patrón deberá pagar tres meses de salario');
    const b = tokenizeWords('el patrón deberá pagar tres meses de salario más veinte días por año');
    const segs = diffTokens(a, b);
    expect(segs.filter((s) => s.op !== 'insert').map((s) => s.value).join('')).toBe(a.join(''));
    expect(segs.filter((s) => s.op !== 'delete').map((s) => s.value).join('')).toBe(b.join(''));
  });
});

describe('diffWords', () => {
  it('keeps whitespace so text re-joins verbatim', () => {
    const segs = diffWords('Artículo 47.  Son causas', 'Artículo 47.  Son causales');
    expect(segs.map((s) => s.value).join('')).toContain('Artículo 47.  Son ');
    expect(segs.find((s) => s.op === 'delete')?.value).toBe('causas');
    expect(segs.find((s) => s.op === 'insert')?.value).toBe('causales');
  });
});

describe('diffDocuments', () => {
  it('numbers lines on each side and pairs replaced lines with word refinement', () => {
    const r = diffDocuments('uno\ndos tres\ncuatro\n', 'uno\ndos cuatro\ncuatro\ncinco');
    expect(r.lines.map((l) => l.op)).toEqual(['equal', 'delete', 'insert', 'equal', 'insert']);
    expect(r.lines[1]).toMatchObject({ leftNo: 2, rightNo: null });
    expect(r.lines[1]?.segments).toEqual([{ op: 'equal', value: 'dos ' }, { op: 'delete', value: 'tres' }]);
    expect(r.lines[2]?.segments).toEqual([{ op: 'equal', value: 'dos ' }, { op: 'insert', value: 'cuatro' }]);
    expect(r.lines[4]).toMatchObject({ op: 'insert', leftNo: null, rightNo: 4 });
    expect(r.stats).toEqual({ added: 2, removed: 1, unchanged: 2, similarity: 0.5 });
  });
  it('treats identical documents as fully similar', () => {
    const r = diffDocuments('a\nb', 'a\nb');
    expect(r.stats.similarity).toBe(1);
    expect(r.lines.every((l) => l.op === 'equal')).toBe(true);
  });
  it('handles CRLF and trailing newline differences', () => {
    const r = diffDocuments('a\r\nb\r\n', 'a\nb');
    expect(r.stats.similarity).toBe(1);
  });
  it('stays bounded on large inputs', () => {
    const big = Array.from({ length: 5000 }, (_, i) => `línea ${i}`).join('\n');
    const changed = big.replace('línea 2500', 'línea 2500 reformada');
    const r = diffDocuments(big, changed);
    expect(r.stats.removed).toBe(1);
    expect(r.stats.added).toBe(1);
  });
});

describe('toUnifiedText', () => {
  it('prefixes lines with the classic markers', () => {
    const text = toUnifiedText(diffDocuments('a\nb', 'a\nc'), 'vigente', 'reforma');
    expect(text.split('\n')).toEqual(['--- vigente', '+++ reforma', ' a', '-b', '+c']);
  });
});
