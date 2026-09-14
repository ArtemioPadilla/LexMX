/**
 * /tablas (plan Fase 8, "revisión tabular"): load N documents, define the
 * fields to extract (parties, dates, amounts, clauses, keywords, regex) and
 * review them in a table you can edit and export as CSV. Extraction is
 * deterministic and runs on the device; every cell shows where it came from.
 */
import { useMemo, useState } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table';
import { DownloadIcon, FileUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { CONTRACT_SCHEMA, extractRow, rowsToCsv, type ExtractedRow, type FieldKind, type FieldSpec } from '@/lib/documents/extract-fields';
import { downloadBlob } from '@/lib/export/docx';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout } from '@/components/ui/callout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { SaveToCase } from '@/components/SaveToCase';
import ErrorBoundary from './ErrorBoundary';

export default function TablesIsland() {
  return (
    <ErrorBoundary name="Tables">
      <Inner />
    </ErrorBoundary>
  );
}

interface Doc {
  name: string;
  text: string;
}

/** .txt/.md need no extractor (and no pdfjs chunk). */
const isPlainText = (f: File) => f.type.startsWith('text/') || /\.(txt|md)$/i.test(f.name);

const KINDS: FieldKind[] = ['parties', 'date', 'amount', 'clause', 'keyword', 'regex'];
const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

function Inner() {
  const { t } = useTranslation();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [specs, setSpecs] = useState<FieldSpec[]>(CONTRACT_SCHEMA);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const rows = useMemo<ExtractedRow[]>(() => docs.map((d) => extractRow(d.name, d.text, specs)), [docs, specs]);
  const cellValue = (row: ExtractedRow, spec: FieldSpec) => overrides[`${row.documentName}::${spec.id}`] ?? row.cells[spec.id]?.value ?? '';

  async function addFiles(files: File[]) {
    setError(null);
    const { contentExtractor } = await import('@/lib/ingestion/document-content-extractors');
    const loaded: Doc[] = [];
    for (const file of files) {
      setStatus(t('tables.extracting', { name: file.name }));
      try {
        if (isPlainText(file)) {
          loaded.push({ name: file.name, text: await file.text() });
          continue;
        }
        const r = await contentExtractor.extractFromArrayBuffer(await file.arrayBuffer(), file.type, { ocr: 'auto' });
        loaded.push({ name: file.name, text: r.text });
      } catch (e) {
        setError(t('tables.fileError', { name: file.name, error: e instanceof Error ? e.message : String(e) }));
      }
    }
    setStatus(null);
    setDocs((d) => [...d, ...loaded]);
  }

  function csv(): string {
    const merged = rows.map((r) => ({
      ...r,
      cells: Object.fromEntries(specs.map((s) => [s.id, { value: cellValue(r, s), offset: 0, context: '' }])),
    }));
    return rowsToCsv(specs, merged);
  }

  function exportCsv() {
    downloadBlob(new Blob(['\ufeff' + csv()], { type: 'text/csv;charset=utf-8' }), 'revision.csv');
  }

  const helper = createColumnHelper<ExtractedRow>();
  const columns = useMemo(
    () => [
      helper.accessor('documentName', { header: t('tables.document'), cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
      ...specs.map((spec) =>
        helper.display({
          id: spec.id,
          header: spec.label,
          cell: ({ row }) => {
            const hit = row.original.cells[spec.id];
            const key = `${row.original.documentName}::${spec.id}`;
            return (
              <textarea
                aria-label={`${spec.label} · ${row.original.documentName}`}
                title={hit?.context ?? t('tables.notFound')}
                className={`w-full min-w-40 resize-y rounded border bg-transparent p-1 text-xs ${hit ? 'border-transparent' : 'border-dashed border-destructive/50'}`}
                rows={2}
                value={overrides[key] ?? hit?.value ?? ''}
                onChange={(e) => setOverrides((o) => ({ ...o, [key]: e.target.value }))}
              />
            );
          },
        }),
      ),
    ],
    [specs, overrides, t],
  );

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });

  return (
    <div className="space-y-6">
      <section className="space-y-2" aria-labelledby="tables-fields">
        <h2 id="tables-fields" className="text-lg font-semibold">{t('tables.fields')}</h2>
        <ul className="space-y-2">
          {specs.map((spec, i) => (
            <li key={spec.id} className="flex flex-wrap items-center gap-2">
              <Input aria-label={t('tables.fieldLabel')} className="w-40" value={spec.label} onChange={(e) => setSpecs((s) => s.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <select aria-label={t('tables.fieldKind')} className={selectClass} value={spec.kind} onChange={(e) => setSpecs((s) => s.map((x, k) => (k === i ? { ...x, kind: e.target.value as FieldKind } : x)))}>
                {KINDS.map((k) => <option key={k} value={k}>{t(`tables.kinds.${k}`)}</option>)}
              </select>
              {['keyword', 'regex', 'clause'].includes(spec.kind) && (
                <Input aria-label={t('tables.fieldPattern')} className="w-56" placeholder={t(`tables.patternHint.${spec.kind}`)} value={spec.pattern ?? ''} onChange={(e) => setSpecs((s) => s.map((x, k) => (k === i ? { ...x, pattern: e.target.value } : x)))} />
              )}
              <Button size="sm" variant="ghost" aria-label={t('tables.removeField')} onClick={() => setSpecs((s) => s.filter((_, k) => k !== i))}><Trash2Icon className="h-4 w-4" aria-hidden="true" /></Button>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="outline" onClick={() => setSpecs((s) => [...s, { id: `f${Date.now()}`, label: t('tables.newField'), kind: 'keyword', pattern: '' }])}>
          <PlusIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('tables.addField')}
        </Button>
      </section>

      <section className="space-y-2" aria-labelledby="tables-docs">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="tables-docs" className="text-lg font-semibold">{t('tables.documents')} ({docs.length})</h2>
          <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted">
            <FileUpIcon className="h-4 w-4" aria-hidden="true" />{t('tables.addDocuments')}
            <input type="file" multiple className="sr-only" accept=".txt,.md,.pdf,.doc,.docx,text/plain,application/pdf" onChange={(e) => { const list = Array.from(e.target.files ?? []); e.target.value = ''; if (list.length) void addFiles(list); }} />
          </label>
          {docs.length > 0 && (
            <>
              <Button size="sm" onClick={exportCsv}><DownloadIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('tables.exportCsv')}</Button>
              <SaveToCase name="revision.csv" type="text/csv" tag="tabla" content={csv} />
              <Button size="sm" variant="ghost" onClick={() => { setDocs([]); setOverrides({}); }}>{t('tables.clear')}</Button>
            </>
          )}
        </div>
        {status && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{status}</p>}
        {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}
        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('tables.empty')}</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border" data-testid="review-table">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((h) => (
                      <TableHead key={h.id} onClick={h.column.getToggleSortingHandler()} className="cursor-pointer select-none whitespace-nowrap">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => <TableCell key={cell.id} className="align-top">{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">{t('tables.privacy')}</p>
    </div>
  );
}
