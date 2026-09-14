/**
 * /comparar (plan § 11.4 C): compare two texts or documents in the browser.
 * Paste text, load .txt/.pdf/.docx (scanned PDFs go through OCR on the
 * device) and see line + word differences, unified or side by side. Nothing
 * leaves the device.
 */
import { useMemo, useState } from 'react';
import { ArrowLeftRightIcon, CopyIcon, FileUpIcon, MessageSquareIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { diffDocuments, toUnifiedText, type DiffLine, type DiffResult } from '@/lib/compare/diff';
import { setPendingPrompt } from '@/stores/chat';
import { getUrl } from '@/utils/urls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Callout } from '@/components/ui/callout';
import { cn } from '@/lib/cn';
import { SaveToCase } from '@/components/SaveToCase';
import ErrorBoundary from './ErrorBoundary';

export default function CompareIsland() {
  return (
    <ErrorBoundary name="Compare">
      <Inner />
    </ErrorBoundary>
  );
}

type View = 'unified' | 'split';

function Inner() {
  const { t } = useTranslation();
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [leftName, setLeftName] = useState('');
  const [rightName, setRightName] = useState('');
  const [view, setView] = useState<View>('unified');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const result = useMemo<DiffResult | null>(() => (left || right ? diffDocuments(left, right) : null), [left, right]);

  async function loadFile(side: 'left' | 'right', file: File) {
    setError(null);
    setStatus(t('compare.extracting', { name: file.name }));
    try {
      let text: string;
      if (file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name)) {
        text = await file.text();
      } else {
        const { contentExtractor } = await import('@/lib/ingestion/document-content-extractors');
        const extracted = await contentExtractor.extractFromArrayBuffer(await file.arrayBuffer(), file.type, {
          ocr: 'auto',
          onOcrProgress: (p) => setStatus(t('compare.ocrRunning', { progress: Math.round(p.progress * 100) })),
        });
        text = extracted.text;
      }
      if (side === 'left') { setLeft(text); setLeftName(file.name); } else { setRight(text); setRightName(file.name); }
    } catch (e) {
      setError(t('compare.fileError', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setStatus(null);
    }
  }

  async function copyDiff() {
    if (!result) return;
    await navigator.clipboard.writeText(toUnifiedText(result, leftName || 'A', rightName || 'B'));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Side id="left" label={t('compare.left')} name={leftName} value={left} placeholder={t('compare.leftPlaceholder')} onChange={(v) => { setLeft(v); setLeftName(''); }} onFile={(f) => void loadFile('left', f)} loadLabel={t('compare.loadFile')} />
        <Side id="right" label={t('compare.right')} name={rightName} value={right} placeholder={t('compare.rightPlaceholder')} onChange={(v) => { setRight(v); setRightName(''); }} onFile={(f) => void loadFile('right', f)} loadLabel={t('compare.loadFile')} />
      </div>
      <p className="text-xs text-muted-foreground">{t('compare.privacy')}</p>
      {status && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>}
      {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}

      {result && (
        <section className="space-y-3" aria-label={t('compare.title')}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{t('compare.stats.similarity')}: {Math.round(result.stats.similarity * 100)}%</Badge>
            <Badge className="bg-green-600 text-white hover:bg-green-600">+{result.stats.added} {t('compare.stats.added')}</Badge>
            <Badge variant="destructive">−{result.stats.removed} {t('compare.stats.removed')}</Badge>
            <Badge variant="outline">{result.stats.unchanged} {t('compare.stats.unchanged')}</Badge>
            <div className="ml-auto flex gap-1">
              <Button size="sm" variant={view === 'unified' ? 'default' : 'outline'} onClick={() => setView('unified')}>{t('compare.viewUnified')}</Button>
              <Button size="sm" variant={view === 'split' ? 'default' : 'outline'} onClick={() => setView('split')}><ArrowLeftRightIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('compare.viewSplit')}</Button>
              <Button size="sm" variant="outline" onClick={() => { setPendingPrompt(t('compare.explainPrompt', { diff: toUnifiedText(result, leftName || 'A', rightName || 'B').slice(0, 12000) })); window.location.href = getUrl('chat'); }}><MessageSquareIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('compare.explain')}</Button>
              <Button size="sm" variant="outline" onClick={() => void copyDiff()}><CopyIcon className="mr-1 h-4 w-4" aria-hidden="true" />{copied ? t('compare.copied') : t('compare.copyDiff')}</Button>
              <SaveToCase name={`comparacion-${(leftName || 'A').replace(/\.[^.]+$/, '')}-vs-${(rightName || 'B').replace(/\.[^.]+$/, '')}.diff`} type="text/x-diff" tag="comparacion" content={() => toUnifiedText(result, leftName || 'A', rightName || 'B')} />
              <Button size="sm" variant="ghost" onClick={() => { setLeft(''); setRight(''); setLeftName(''); setRightName(''); }}><Trash2Icon className="mr-1 h-4 w-4" aria-hidden="true" />{t('compare.clear')}</Button>
            </div>
          </div>
          {view === 'unified' ? <Unified lines={result.lines} /> : <Split lines={result.lines} />}
        </section>
      )}
    </div>
  );
}

function Side({ id, label, name, value, placeholder, onChange, onFile, loadLabel }: { id: string; label: string; name: string; value: string; placeholder: string; onChange: (v: string) => void; onFile: (f: File) => void; loadLabel: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={`cmp-${id}`}>{label}{name && <span className="ml-2 text-xs font-normal text-muted-foreground">{name}</span>}</Label>
        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-2 py-1 text-xs hover:bg-muted">
          <FileUpIcon className="h-3 w-3" aria-hidden="true" />{loadLabel}
          <input type="file" className="sr-only" accept=".txt,.md,.pdf,.doc,.docx,text/plain,application/pdf" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
        </label>
      </div>
      <Textarea id={`cmp-${id}`} rows={10} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className="font-mono text-xs" />
    </div>
  );
}

function Segments({ line }: { line: DiffLine }) {
  return (
    <>
      {line.segments.map((s, i) => (
        <span
          key={i}
          className={cn(
            s.op === 'insert' && 'rounded bg-green-200 dark:bg-green-900/60',
            s.op === 'delete' && 'rounded bg-red-200 line-through dark:bg-red-900/60',
          )}
        >
          {s.value}
        </span>
      ))}
    </>
  );
}

const rowClass = (op: DiffLine['op']) =>
  cn('whitespace-pre-wrap break-words px-2 py-0.5 font-mono text-xs', op === 'insert' && 'bg-green-50 dark:bg-green-950/40', op === 'delete' && 'bg-red-50 dark:bg-red-950/40');

function Unified({ lines }: { lines: DiffLine[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border" data-testid="diff-unified">
      <table className="w-full border-collapse">
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className={rowClass(l.op)}>
              <td className="w-10 select-none pr-2 text-right text-muted-foreground">{l.leftNo ?? ''}</td>
              <td className="w-10 select-none pr-2 text-right text-muted-foreground">{l.rightNo ?? ''}</td>
              <td className="w-4 select-none">{l.op === 'insert' ? '+' : l.op === 'delete' ? '−' : ' '}</td>
              <td><Segments line={l} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Split({ lines }: { lines: DiffLine[] }) {
  // Pair deletes with the following inserts so replaced lines sit side by side.
  const rows: Array<{ left: DiffLine | null; right: DiffLine | null }> = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i]!;
    if (l.op === 'equal') { rows.push({ left: l, right: l }); i++; continue; }
    const dels: DiffLine[] = [];
    const ins: DiffLine[] = [];
    while (i < lines.length && lines[i]!.op !== 'equal') { (lines[i]!.op === 'delete' ? dels : ins).push(lines[i]!); i++; }
    for (let k = 0; k < Math.max(dels.length, ins.length); k++) rows.push({ left: dels[k] ?? null, right: ins[k] ?? null });
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border" data-testid="diff-split">
      <table className="w-full table-fixed border-collapse">
        <tbody>
          {rows.map((r, idx) => (
            <tr key={idx}>
              <td className={cn(rowClass(r.left?.op ?? 'equal'), 'w-1/2 border-r border-border align-top')}>
                {r.left && <><span className="mr-2 select-none text-muted-foreground">{r.left.leftNo}</span><Segments line={r.left} /></>}
              </td>
              <td className={cn(rowClass(r.right?.op ?? 'equal'), 'w-1/2 align-top')}>
                {r.right && <><span className="mr-2 select-none text-muted-foreground">{r.right.rightNo}</span><Segments line={r.right} /></>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
