/**
 * Document comparison in the browser (plan § 11.4 C): line diff with a
 * word-level refinement inside changed blocks. Dependency-free, pure, and
 * bounded (a size cap keeps the DP table under a few million cells).
 */

export type DiffOp = 'equal' | 'insert' | 'delete';

export interface DiffSegment {
  op: DiffOp;
  value: string;
}

export interface DiffLine {
  op: DiffOp;
  /** Line number on the left (deletes/equals) or right (inserts/equals). */
  leftNo: number | null;
  rightNo: number | null;
  /** Word-level segments; for equal lines a single equal segment. */
  segments: DiffSegment[];
}

export interface DiffStats {
  added: number;
  removed: number;
  unchanged: number;
  /** 0..1 share of lines that survive unchanged. */
  similarity: number;
}

export interface DiffResult {
  lines: DiffLine[];
  stats: DiffStats;
}

const MAX_CELLS = 4_000_000;

/** Longest-common-subsequence alignment of two token arrays (adjacent same-op tokens merged). */
export function diffTokens(a: string[], b: string[]): DiffSegment[] {
  return mergeAdjacent(alignTokens(a, b));
}

function alignTokens(a: string[], b: string[]): DiffSegment[] {
  const n = a.length;
  const m = b.length;
  if (n === 0) return b.map((value) => ({ op: 'insert' as const, value }));
  if (m === 0) return a.map((value) => ({ op: 'delete' as const, value }));

  // Trim the common prefix and suffix first: cheap and shrinks the table.
  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start++;
  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }
  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const out: DiffSegment[] = a.slice(0, start).map((value) => ({ op: 'equal' as const, value }));

  if ((midA.length + 1) * (midB.length + 1) > MAX_CELLS) {
    // Too big to align: report as a replacement.
    for (const value of midA) out.push({ op: 'delete', value });
    for (const value of midB) out.push({ op: 'insert', value });
  } else {
    const w = midB.length + 1;
    const table = new Uint32Array((midA.length + 1) * w);
    for (let i = midA.length - 1; i >= 0; i--) {
      for (let j = midB.length - 1; j >= 0; j--) {
        table[i * w + j] =
          midA[i] === midB[j]
            ? (table[(i + 1) * w + j + 1] ?? 0) + 1
            : Math.max(table[(i + 1) * w + j] ?? 0, table[i * w + j + 1] ?? 0);
      }
    }
    let i = 0;
    let j = 0;
    while (i < midA.length && j < midB.length) {
      if (midA[i] === midB[j]) {
        out.push({ op: 'equal', value: midA[i]! });
        i++;
        j++;
      } else if ((table[(i + 1) * w + j] ?? 0) >= (table[i * w + j + 1] ?? 0)) {
        out.push({ op: 'delete', value: midA[i]! });
        i++;
      } else {
        out.push({ op: 'insert', value: midB[j]! });
        j++;
      }
    }
    while (i < midA.length) out.push({ op: 'delete', value: midA[i++]! });
    while (j < midB.length) out.push({ op: 'insert', value: midB[j++]! });
  }

  for (const value of a.slice(endA)) out.push({ op: 'equal', value });
  return out;
}

function mergeAdjacent(segments: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const s of segments) {
    const last = merged[merged.length - 1];
    if (last && last.op === s.op) last.value += s.value;
    else merged.push({ ...s });
  }
  return merged;
}

/** Splits into words and whitespace so the diff can be re-joined verbatim. */
export function tokenizeWords(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

export function diffWords(a: string, b: string): DiffSegment[] {
  return diffTokens(tokenizeWords(a), tokenizeWords(b));
}

function splitLines(text: string): string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Line diff. Consecutive delete/insert runs are paired and refined to words
 * so a reformed article shows exactly which words changed.
 */
export function diffDocuments(left: string, right: string): DiffResult {
  const a = splitLines(left);
  const b = splitLines(right);
  const raw = alignTokens(a, b);
  const lines: DiffLine[] = [];
  let leftNo = 0;
  let rightNo = 0;
  let i = 0;
  while (i < raw.length) {
    const cur = raw[i]!;
    if (cur.op === 'equal') {
      leftNo++;
      rightNo++;
      lines.push({ op: 'equal', leftNo, rightNo, segments: [{ op: 'equal', value: cur.value }] });
      i++;
      continue;
    }
    const deletes: string[] = [];
    const inserts: string[] = [];
    while (i < raw.length && raw[i]!.op !== 'equal') {
      if (raw[i]!.op === 'delete') deletes.push(raw[i]!.value);
      else inserts.push(raw[i]!.value);
      i++;
    }
    const pairs = Math.min(deletes.length, inserts.length);
    for (let k = 0; k < deletes.length; k++) {
      leftNo++;
      const paired = k < pairs ? inserts[k]! : null;
      const segments =
        paired === null
          ? [{ op: 'delete' as const, value: deletes[k]! }]
          : diffWords(deletes[k]!, paired).filter((s) => s.op !== 'insert');
      lines.push({ op: 'delete', leftNo, rightNo: null, segments });
    }
    for (let k = 0; k < inserts.length; k++) {
      rightNo++;
      const paired = k < pairs ? deletes[k]! : null;
      const segments =
        paired === null
          ? [{ op: 'insert' as const, value: inserts[k]! }]
          : diffWords(paired, inserts[k]!).filter((s) => s.op !== 'delete');
      lines.push({ op: 'insert', leftNo: null, rightNo, segments });
    }
  }
  const added = lines.filter((l) => l.op === 'insert').length;
  const removed = lines.filter((l) => l.op === 'delete').length;
  const unchanged = lines.filter((l) => l.op === 'equal').length;
  const similarity = a.length === 0 && b.length === 0 ? 1 : unchanged / Math.max(a.length, b.length, 1);
  return { lines, stats: { added, removed, unchanged, similarity } };
}

/** Unified-diff text for sharing or attaching to an expediente. */
export function toUnifiedText(result: DiffResult, leftName = 'A', rightName = 'B'): string {
  const body = result.lines.map((l) => {
    const text = l.segments.map((s) => s.value).join('');
    return l.op === 'equal' ? ` ${text}` : l.op === 'delete' ? `-${text}` : `+${text}`;
  });
  return [`--- ${leftName}`, `+++ ${rightName}`, ...body].join('\n');
}
