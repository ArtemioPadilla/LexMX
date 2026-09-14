/**
 * /admin/corpus (plan Fase 5): corpus manager on TanStack Table + the
 * Inceptor kit. Sorting, global search, type/area filters, row actions,
 * validation report and the corpus install status from $corpusInstall.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { createColumnHelper, flexRender, getCoreRowModel, getFilteredRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table';
import { ArrowUpDownIcon, DatabaseIcon, DownloadIcon, RefreshCwIcon, ShieldCheckIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import type { DocumentMetrics, CorpusFilter } from '@/lib/admin/corpus-service';
import { corpusService } from '@/lib/admin/corpus-service';
import { adminDataService, type CorpusStats } from '@/lib/admin/admin-data-service';
import type { LegalDocument, DocumentType, LegalArea } from '@/types/legal';
import { $corpusInstall } from '@/stores/corpus';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Callout } from '@/components/ui/callout';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type Validation = Awaited<ReturnType<typeof corpusService.validateCorpus>>;
const TYPES: DocumentType[] = ['law', 'code', 'regulation', 'norm'];
const AREAS: LegalArea[] = ['civil', 'criminal', 'labor', 'tax', 'commercial'];
const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export default function CorpusManager() {
  const { t } = useTranslation();
  const install = useStore($corpusInstall);
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [stats, setStats] = useState<CorpusStats | null>(null);
  const [selected, setSelected] = useState<LegalDocument | null>(null);
  const [filter, setFilter] = useState<CorpusFilter>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([{ id: 'title', desc: false }]);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [docs, s] = await Promise.all([corpusService.getDocuments(filter), adminDataService.getCorpusStats()]);
      setDocuments(docs);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [filter.type, filter.legalArea]);

  async function run(name: string, fn: () => Promise<void>, errorKey: string) {
    setOperation(name);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : t(errorKey));
    } finally {
      setOperation(null);
    }
  }

  const metrics: DocumentMetrics | null = useMemo(() => {
    if (!selected) return null;
    return {
      id: selected.id,
      title: selected.title,
      type: selected.type,
      legalArea: selected.primaryArea,
      chunks: selected.content?.length ?? 0,
      embeddings: selected.content?.length ?? 0,
      lastUpdated: selected.lastReform || selected.publicationDate || new Date().toISOString(),
      size: JSON.stringify(selected).length,
      quality: 85,
    };
  }, [selected]);

  const columnHelper = createColumnHelper<LegalDocument>();
  const columns = useMemo(
    () => [
      columnHelper.accessor('title', { header: () => t('admin.corpus.table.title'), cell: (info) => <span className="font-medium">{info.getValue()}<span className="block font-mono text-[0.65rem] text-muted-foreground">{info.row.original.id}</span></span> }),
      columnHelper.accessor('type', { header: () => t('admin.corpus.table.type'), cell: (info) => <Badge variant="outline">{t(`admin.corpus.types.${info.getValue()}`)}</Badge> }),
      columnHelper.accessor('primaryArea', { header: () => t('admin.corpus.table.area'), cell: (info) => t(`admin.corpus.areas.${info.getValue()}`) }),
      columnHelper.accessor((d) => d.content?.length ?? 0, { id: 'chunks', header: () => t('admin.corpus.table.chunks'), cell: (info) => info.getValue().toLocaleString() }),
      columnHelper.display({
        id: 'actions',
        header: () => t('admin.corpus.table.actions'),
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" aria-label={t('admin.corpus.reindex')} disabled={operation !== null} onClick={(e) => { e.stopPropagation(); void run('reindex', async () => { await corpusService.reindexDocument(row.original.id); await load(); }, 'admin.corpus.reindexError'); }}>
              <RefreshCwIcon className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" aria-label={t('admin.corpus.delete')} disabled={operation !== null} onClick={(e) => { e.stopPropagation(); if (!window.confirm(t('admin.corpus.confirmDelete'))) return; void run('delete', async () => { await adminDataService.deleteDocument(row.original.id); setSelected(null); await load(); }, 'admin.corpus.deleteError'); }}>
              <Trash2Icon className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ),
      }),
    ],
    [t, operation],
  );

  const table = useReactTable({
    data: documents,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _col, value: string) => {
      const q = value.toLowerCase();
      return row.original.title.toLowerCase().includes(q) || row.original.id.toLowerCase().includes(q);
    },
  });

  return (
    <div className="space-y-6 p-6">
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          {[
            [t('admin.corpus.stats.totalDocuments'), stats.totalDocuments.toLocaleString()],
            [t('admin.corpus.stats.totalChunks'), stats.totalChunks.toLocaleString()],
            [t('admin.corpus.stats.totalSize'), formatBytes(stats.totalSize)],
            [t('admin.corpus.stats.lastUpdate'), new Date(stats.lastUpdate).toLocaleDateString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-card p-4">
              <h3 className="text-xs font-medium text-muted-foreground">{label}</h3>
              <p className="mt-1 text-2xl font-semibold">{value}</p>
            </div>
          ))}
        </div>
      )}

      {install.phase !== 'idle' && (
        <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
          <DatabaseIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {install.phase === 'installing' ? `${install.installed}/${install.total}` : install.phase} · {install.chunks.toLocaleString()} chunks
        </p>
      )}

      {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}

      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label={t('admin.corpus.search')} placeholder={t('admin.corpus.search')} value={globalFilter} onChange={(e) => setGlobalFilter(e.target.value)} className="max-w-xs" />
        <select aria-label={t('admin.corpus.table.type')} className={selectClass} value={filter.type ?? ''} onChange={(e) => setFilter((f) => ({ ...f, type: (e.target.value || undefined) as DocumentType | undefined }))}>
          <option value="">{t('admin.corpus.allTypes')}</option>
          {TYPES.map((x) => <option key={x} value={x}>{t(`admin.corpus.types.${x}`)}</option>)}
        </select>
        <select aria-label={t('admin.corpus.table.area')} className={selectClass} value={filter.legalArea ?? ''} onChange={(e) => setFilter((f) => ({ ...f, legalArea: (e.target.value || undefined) as LegalArea | undefined }))}>
          <option value="">{t('admin.corpus.allAreas')}</option>
          {AREAS.map((x) => <option key={x} value={x}>{t(`admin.corpus.areas.${x}`)}</option>)}
        </select>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={operation !== null} onClick={() => void run('validate', async () => setValidation(await corpusService.validateCorpus()), 'admin.corpus.validateError')}>
            <ShieldCheckIcon className="mr-1 h-4 w-4" aria-hidden="true" />{operation === 'validate' ? t('admin.corpus.validating') : t('admin.corpus.validate')}
          </Button>
          <Button variant="outline" size="sm" disabled={operation !== null} onClick={() => void run('export', async () => {
            const blob = await adminDataService.exportCorpus();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `corpus-${new Date().toISOString()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          }, 'admin.corpus.exportError')}>
            <DownloadIcon className="mr-1 h-4 w-4" aria-hidden="true" />{operation === 'export' ? t('admin.corpus.exporting') : t('admin.corpus.export')}
          </Button>
          <Button variant="outline" size="sm" disabled title={t('admin.corpus.import')}>
            <UploadIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('admin.corpus.import')}
          </Button>
        </div>
      </div>

      {validation && (
        <Callout title={t('admin.corpus.validationResults')} variant={validation.invalid ? 'warning' : 'success'} className="text-sm">
          <p>{t('admin.corpus.validDocuments')}: {validation.valid} · {t('admin.corpus.invalidDocuments')}: {validation.invalid}</p>
          {validation.issues.length > 0 && (
            <div className="mt-2 max-h-60 overflow-y-auto">
              <h4 className="mb-1 font-medium">{t('admin.corpus.issues')}</h4>
              {validation.issues.map((item) => (
                <div key={item.documentId} className="mb-2">
                  <span className="font-mono">{item.documentId}:</span>
                  <ul className="ml-4 list-disc text-destructive">{item.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 overflow-x-auto rounded-lg border border-border">
          {loading ? (
            <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : (
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((hg) => (
                  <TableRow key={hg.id}>
                    {hg.headers.map((header) => (
                      <TableHead key={header.id} className={cn(header.column.getCanSort() && 'cursor-pointer select-none', header.id === 'actions' && 'text-right')} onClick={header.column.getToggleSortingHandler()} aria-sort={header.column.getIsSorted() === 'asc' ? 'ascending' : header.column.getIsSorted() === 'desc' ? 'descending' : undefined}>
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && <ArrowUpDownIcon className="h-3 w-3 text-muted-foreground" aria-hidden="true" />}
                        </span>
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length === 0 ? (
                  <TableRow><TableCell colSpan={columns.length} className="py-8 text-center text-muted-foreground">{t('admin.corpus.noDocuments')}</TableCell></TableRow>
                ) : (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id} data-state={selected?.id === row.original.id ? 'selected' : undefined} className="cursor-pointer" onClick={() => setSelected(row.original)}>
                      {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>)}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <aside className="rounded-lg border border-border p-4">
          <h3 className="mb-3 font-medium">{t('admin.corpus.documentDetails')}</h3>
          {selected && metrics ? (
            <dl className="space-y-2 text-sm">
              {[
                [t('admin.corpus.details.id'), selected.id],
                [t('admin.corpus.details.hierarchy'), String(selected.hierarchy)],
                [t('admin.corpus.table.chunks'), metrics.chunks.toLocaleString()],
                [t('admin.corpus.details.embeddings'), metrics.embeddings.toLocaleString()],
                [t('admin.corpus.details.size'), formatBytes(metrics.size)],
                [t('admin.corpus.details.lastUpdated'), new Date(metrics.lastUpdated).toLocaleDateString()],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-mono text-xs">{v}</dd></div>
              ))}
              <div>
                <dt className="text-muted-foreground">{t('admin.corpus.details.quality')}</dt>
                <dd className="mt-1 h-2 w-full overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${metrics.quality}%` }} /></dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.corpus.noDocuments')}</p>
          )}
        </aside>
      </div>
    </div>
  );
}
