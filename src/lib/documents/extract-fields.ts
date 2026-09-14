/**
 * Tabular review (plan Fase 8): deterministic field extraction from N
 * documents into rows the user defines (parties, dates, amounts, clauses).
 * Pure functions, no model involved: every cell is traceable to a regex hit
 * in the source text, and the user can correct it in the table.
 */

export type FieldKind = 'date' | 'amount' | 'parties' | 'keyword' | 'regex' | 'clause';

export interface FieldSpec {
  id: string;
  label: string;
  kind: FieldKind;
  /** For `keyword`: the word or phrase; for `regex`: the pattern; for `clause`: the clause heading (e.g. "Vigencia"). */
  pattern?: string;
}

export interface FieldHit {
  value: string;
  /** Character offset in the source text, for "show me where". */
  offset: number;
  /** Short context around the hit. */
  context: string;
}

export interface ExtractedRow {
  documentName: string;
  cells: Record<string, FieldHit | null>;
}

const MONTHS: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8,
  septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};

const DATE_LONG = /\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de\s+|del\s+)?(\d{4})\b/giu;
const DATE_NUMERIC = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g;
const DATE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/g;
const AMOUNT = /(?:MXN|USD|MN|M\.N\.|\$)\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\b\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?\s?(?:pesos|MXN|USD|dólares)\b/giu;
const PARTIES =
  /\b(?:entre|celebran)[,:]?\s+(?:por\s+una\s+parte,?\s+)?(.{3,160}?)(?:,?\s+en\s+lo\s+sucesivo[^,]*,?)?\s+(?:y|e)\s+(?:por\s+la\s+otra\s+(?:parte,?\s+)?)?(.{3,160}?)(?:,|;|\s+a\s+quien|\s+en\s+lo\s+sucesivo|\s+representad|\.)/iu;

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** All dates found, normalized to ISO (YYYY-MM-DD), in document order. */
export function findDates(text: string): FieldHit[] {
  const hits: FieldHit[] = [];
  for (const m of text.matchAll(DATE_LONG)) {
    const month = MONTHS[m[2]!.toLowerCase()];
    if (!month) continue;
    hits.push({ value: `${m[3]}-${pad2(month)}-${pad2(Number(m[1]))}`, offset: m.index ?? 0, context: contextAt(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(DATE_NUMERIC)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    hits.push({ value: `${m[3]}-${pad2(month)}-${pad2(day)}`, offset: m.index ?? 0, context: contextAt(text, m.index ?? 0) });
  }
  for (const m of text.matchAll(DATE_ISO)) {
    hits.push({ value: m[0], offset: m.index ?? 0, context: contextAt(text, m.index ?? 0) });
  }
  return hits.sort((a, b) => a.offset - b.offset);
}

/** All money amounts, as written. */
export function findAmounts(text: string): FieldHit[] {
  return [...text.matchAll(AMOUNT)].map((m) => ({ value: m[0].trim(), offset: m.index ?? 0, context: contextAt(text, m.index ?? 0) }));
}

/** "entre A y B" style party clause; value is "A | B". */
export function findParties(text: string): FieldHit | null {
  const m = PARTIES.exec(text);
  if (!m) return null;
  const clean = (s: string) => s.replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '').trim();
  return { value: `${clean(m[1]!)} | ${clean(m[2]!)}`, offset: m.index, context: contextAt(text, m.index) };
}

/** Sentence containing the keyword (case- and accent-insensitive). */
export function findKeyword(text: string, keyword: string): FieldHit | null {
  const needle = fold(keyword);
  if (!needle) return null;
  const folded = fold(text);
  const idx = folded.indexOf(needle);
  if (idx < 0) return null;
  return { value: sentenceAt(text, idx), offset: idx, context: contextAt(text, idx) };
}

/** First match of a user regex (the first capture group when present). */
export function findRegex(text: string, pattern: string): FieldHit | null {
  let re: RegExp;
  try {
    re = new RegExp(pattern, 'iu');
  } catch {
    return null;
  }
  const m = re.exec(text);
  if (!m) return null;
  return { value: (m[1] ?? m[0]).trim(), offset: m.index, context: contextAt(text, m.index) };
}

/** Text of a clause introduced by a heading such as "DÉCIMA.- VIGENCIA" or "Cláusula de vigencia". */
export function findClause(text: string, heading: string): FieldHit | null {
  const needle = fold(heading);
  if (!needle) return null;
  const folded = fold(text);
  const idx = folded.indexOf(needle);
  if (idx < 0) return null;
  const start = text.lastIndexOf('\n', idx) + 1;
  const rest = text.slice(start);
  const end = rest.search(/\n\s*\n|\n(?=[A-ZÁÉÍÓÚ][A-ZÁÉÍÓÚ .]{3,}[.:-])/u);
  const clause = (end > 0 ? rest.slice(0, end) : rest).trim().slice(0, 1200);
  return { value: clause, offset: start, context: contextAt(text, start) };
}

export function extractField(text: string, spec: FieldSpec): FieldHit | null {
  switch (spec.kind) {
    case 'date':
      return findDates(text)[0] ?? null;
    case 'amount':
      return findAmounts(text)[0] ?? null;
    case 'parties':
      return findParties(text);
    case 'keyword':
      return findKeyword(text, spec.pattern ?? '');
    case 'regex':
      return findRegex(text, spec.pattern ?? '');
    case 'clause':
      return findClause(text, spec.pattern ?? '');
    default:
      return null;
  }
}

export function extractRow(documentName: string, text: string, specs: FieldSpec[]): ExtractedRow {
  const cells: Record<string, FieldHit | null> = {};
  for (const spec of specs) cells[spec.id] = extractField(text, spec);
  return { documentName, cells };
}

/** CSV with a header row; values quoted, newlines kept inside quotes. */
export function rowsToCsv(specs: FieldSpec[], rows: ExtractedRow[]): string {
  const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const header = ['Documento', ...specs.map((s) => s.label)].map(q).join(',');
  const lines = rows.map((r) => [r.documentName, ...specs.map((s) => r.cells[s.id]?.value ?? '')].map(q).join(','));
  return [header, ...lines].join('\n');
}

/** Default schema for contracts: what a reviewer fills first. */
export const CONTRACT_SCHEMA: FieldSpec[] = [
  { id: 'parties', label: 'Partes', kind: 'parties' },
  { id: 'date', label: 'Fecha', kind: 'date' },
  { id: 'amount', label: 'Monto', kind: 'amount' },
  { id: 'vigencia', label: 'Vigencia', kind: 'clause', pattern: 'vigencia' },
  { id: 'jurisdiccion', label: 'Jurisdicción', kind: 'keyword', pattern: 'tribunales' },
];

function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function contextAt(text: string, idx: number, span = 60): string {
  return text.slice(Math.max(0, idx - span), Math.min(text.length, idx + span)).replace(/\s+/g, ' ').trim();
}

function sentenceAt(text: string, idx: number): string {
  const start = Math.max(text.lastIndexOf('.', idx), text.lastIndexOf('\n', idx)) + 1;
  const endDot = text.indexOf('.', idx);
  const endNl = text.indexOf('\n', idx);
  const candidates = [endDot, endNl].filter((n) => n >= 0);
  const end = candidates.length ? Math.min(...candidates) + 1 : text.length;
  return text.slice(start, end).replace(/\s+/g, ' ').replace(/^[\s.\-–—:;]+/, '').trim().slice(0, 400);
}
