/**
 * /casos island (plan Fase 5): expedientes on the Inceptor kit, backed by
 * IndexedDB through src/stores/cases.ts (legacy localStorage imported once).
 * Replaces CaseManager.tsx (1 407 lines). CaseChat and CaseTimeline stay
 * lazy child islands with the same props. Test ids keep the e2e contract.
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PlusIcon, SearchIcon, Trash2Icon, PencilIcon, SparklesIcon, UploadIcon, CalendarIcon, UsersIcon, FileTextIcon, Loader2Icon } from 'lucide-react';
import type { LegalArea } from '@/types/legal';
import type { CaseStatus, Deadline, LegalCase, Party } from '@/types/cases';
import { $cases, $casesReady, $selectedCase, $selectedCaseId, createCase, loadCases, newId, removeCase, updateCase } from '@/stores/cases';
import { CaseFormSchema, DeadlineSchema, PartySchema, type CaseFormValues, type DeadlineValues, type PartyValues } from '@/schemas/case';
import { LegalRAGEngine } from '@/lib/rag/engine';
import { providerManager } from '@/lib/llm/provider-manager';
import { promptBuilder } from '@/lib/llm/prompt-builder';
import { createDisposer } from '@/lib/disposer';
import { useTranslation } from '@/i18n';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import { AIOutputLabel } from '@/components/ui/ai/ai-output-label';
import MessageContent from '@/components/MessageContent';
import WebLLMProgress from '@/components/WebLLMProgress';
import ErrorBoundary from './ErrorBoundary';

const CaseChat = lazy(() => import('./CaseChat'));
const CaseTimeline = lazy(() => import('./CaseTimeline'));

const AREAS: LegalArea[] = ['civil', 'criminal', 'labor', 'tax', 'commercial', 'administrative', 'constitutional', 'family', 'property'];
const STATUSES: CaseStatus[] = ['active', 'pending', 'resolved', 'archived'];
const STATUS_KEY: Record<CaseStatus, string> = { active: 'cases.statuses.active', pending: 'cases.statuses.pending', resolved: 'cases.statuses.closed', archived: 'cases.statuses.archived' };
const STATUS_BADGE: Record<CaseStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = { active: 'default', pending: 'secondary', resolved: 'outline', archived: 'outline' };
const ROLES: Party['role'][] = ['plaintiff', 'defendant', 'witness', 'expert', 'other'];
const DEADLINE_TYPES: Deadline['type'][] = ['court', 'filing', 'meeting', 'other'];

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function CaseWorkspace() {
  return (
    <ErrorBoundary name="CaseWorkspace">
      <CaseWorkspaceInner />
    </ErrorBoundary>
  );
}

function CaseWorkspaceInner() {
  const { t } = useTranslation();
  const cases = useStore($cases);
  const ready = useStore($casesReady);
  const selected = useStore($selectedCase);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | CaseStatus>('all');
  const [area, setArea] = useState<'all' | LegalArea>('all');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void loadCases();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases.filter((c) => {
      const text = `${c.title} ${c.description} ${c.client ?? ''} ${c.caseNumber ?? ''}`.toLowerCase();
      return (!q || text.includes(q)) && (status === 'all' || c.status === status) && (area === 'all' || c.legalArea === area);
    });
  }, [cases, query, status, area]);

  return (
    <div className="flex h-full min-h-[32rem] bg-background text-foreground" data-testid="case-manager">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border">
        <div className="space-y-2 border-b border-border p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('cases.title')}</h2>
            <Button size="sm" data-testid="new-case-button" onClick={() => { setCreating(true); $selectedCaseId.set(null); }}>
              <PlusIcon className="mr-1 h-4 w-4" aria-hidden="true" />
              {t('cases.newCase')}
            </Button>
          </div>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input aria-label={t('cases.searchCases')} placeholder={t('cases.searchCases')} value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" data-testid="search-cases-input" />
          </div>
          <div className="flex gap-2">
            <select aria-label={t('cases.status')} value={status} onChange={(e) => setStatus(e.target.value as 'all' | CaseStatus)} className={selectClass} data-testid="filter-status-select">
              <option value="all">{t('common.all')}</option>
              {STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_KEY[s])}</option>)}
            </select>
            <select aria-label={t('cases.legalArea')} value={area} onChange={(e) => setArea(e.target.value as 'all' | LegalArea)} className={selectClass} data-testid="filter-area-select">
              <option value="all">{t('chat.legalArea.all')}</option>
              {AREAS.map((a) => <option key={a} value={a}>{t(`chat.legalArea.${a}`)}</option>)}
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {!ready ? (
            <div className="space-y-2 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground" data-testid="empty-cases-message">{cases.length === 0 ? t('cases.noCases') : t('cases.noResults')}</p>
          ) : (
            <ul className="space-y-1" data-testid="cases-list">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => { $selectedCaseId.set(c.id); setCreating(false); }}
                    aria-current={selected?.id === c.id ? 'true' : undefined}
                    data-testid={`case-item-${c.id}`}
                    className={cn('w-full rounded-lg p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', selected?.id === c.id && 'bg-accent')}
                  >
                    <span className="block font-medium">{c.title}</span>
                    {c.client && <span className="block text-xs text-muted-foreground">{c.client}</span>}
                    <span className="mt-1 flex items-center gap-2">
                      <Badge variant={STATUS_BADGE[c.status]} className="text-[0.65rem]" data-testid={`case-status-${c.status}`}>{t(STATUS_KEY[c.status])}</Badge>
                      <span className="text-xs text-muted-foreground">{t(`chat.legalArea.${c.legalArea}`)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {creating ? (
          <CaseForm
            title={t('cases.createNewCase')}
            submitLabel={t('cases.createCase')}
            onCancel={() => setCreating(false)}
            onSubmit={async (values) => {
              await createCase(values);
              setCreating(false);
            }}
          />
        ) : selected ? (
          <CaseDetail key={selected.id} legalCase={selected} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-muted-foreground">
            <FileTextIcon className="h-10 w-10" aria-hidden="true" />
            <p data-testid="select-case-message">{t('cases.selectCase')}</p>
            <Button variant="link" data-testid="or-create-new-message" onClick={() => setCreating(true)}>{t('cases.orCreateNew')}</Button>
          </div>
        )}
      </main>
    </div>
  );
}

function CaseForm({ title, submitLabel, defaults, onSubmit, onCancel, testPrefix = 'case' }: { title: string; submitLabel: string; defaults?: Partial<CaseFormValues>; onSubmit: (v: CaseFormValues) => Promise<void>; onCancel: () => void; testPrefix?: 'case' | 'edit' }) {
  const { t } = useTranslation();
  const form = useForm<CaseFormValues>({
    resolver: zodResolver(CaseFormSchema),
    defaultValues: { title: '', description: '', client: '', caseNumber: '', legalArea: 'civil', status: 'active', ...defaults },
  });
  const err = (name: keyof CaseFormValues) => form.formState.errors[name]?.message;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="mx-auto w-full max-w-2xl space-y-4 p-6" data-testid={testPrefix === 'case' ? 'case-creation-form' : 'edit-case-modal'}>
        <h2 className="text-xl font-semibold">{title}</h2>
        <FormField control={form.control} name="title" render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={`${testPrefix}-title`}>{t('cases.caseTitle')}</FormLabel>
            <FormControl><Input id={`${testPrefix}-title`} placeholder={t('cases.exampleTitle')} data-testid={`${testPrefix}-title-input`} {...field} /></FormControl>
            {err('title') && <p role="alert" className="text-sm text-destructive">{t(String(err('title')))}</p>}
          </FormItem>
        )} />
        <FormField control={form.control} name="description" render={({ field }) => (
          <FormItem>
            <FormLabel htmlFor={`${testPrefix}-description`}>{t('cases.caseDescription')}</FormLabel>
            <FormControl><Textarea id={`${testPrefix}-description`} rows={4} placeholder={t('cases.briefDescription')} data-testid={testPrefix === 'case' ? 'case-description-input' : 'edit-description-textarea'} {...field} /></FormControl>
          </FormItem>
        )} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="client" render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={`${testPrefix}-client`}>{t('cases.client')}</FormLabel>
              <FormControl><Input id={`${testPrefix}-client`} placeholder={t('cases.clientName')} data-testid={`${testPrefix}-client-input`} {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="caseNumber" render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={`${testPrefix}-number`}>{t('cases.caseNumber')}</FormLabel>
              <FormControl><Input id={`${testPrefix}-number`} placeholder={t('cases.caseNumberExample')} data-testid="case-number-input" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={form.control} name="legalArea" render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor={`${testPrefix}-area`}>{t('cases.legalArea')}</FormLabel>
              <FormControl>
                <select id={`${testPrefix}-area`} className={selectClass} data-testid="case-legal-area-select" {...field}>
                  {AREAS.map((a) => <option key={a} value={a}>{t(`chat.legalArea.${a}`)}</option>)}
                </select>
              </FormControl>
            </FormItem>
          )} />
          {testPrefix === 'edit' && (
            <FormField control={form.control} name="status" render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="edit-status">{t('cases.status')}</FormLabel>
                <FormControl>
                  <select id="edit-status" className={selectClass} data-testid="edit-status-select" {...field}>
                    {STATUSES.map((s) => <option key={s} value={s}>{t(STATUS_KEY[s])}</option>)}
                  </select>
                </FormControl>
              </FormItem>
            )} />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} data-testid={`${testPrefix}-cancel-button`}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={form.formState.isSubmitting} data-testid={testPrefix === 'case' ? 'case-submit-button' : 'edit-save-button'}>{submitLabel}</Button>
        </div>
      </form>
    </Form>
  );
}

function CaseDetail({ legalCase: c }: { legalCase: LegalCase }) {
  const { t, language } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [note, setNote] = useState('');
  const [summaryStream, setSummaryStream] = useState('');
  const [generating, setGenerating] = useState(false);
  const [webllm, setWebllm] = useState<{ progress: number; message: string } | null>(null);

  useEffect(() => {
    const d = createDisposer();
    const listener = (progress: number, message: string) => {
      setWebllm({ progress, message });
      if (progress === 100) d.timeout(3000, () => setWebllm(null));
    };
    providerManager.addWebLLMProgressListener(listener);
    d.add(() => providerManager.removeWebLLMProgressListener(listener));
    return d.dispose;
  }, []);

  const pendingDeadlines = c.deadlines.filter((d) => !d.completed).sort((a, b) => a.date.getTime() - b.date.getTime());

  async function generateSummary() {
    setGenerating(true);
    setSummaryStream('');
    try {
      const engine = new LegalRAGEngine();
      await engine.initialize();
      const lines = [
        `## Caso: ${c.title}`,
        `**Descripción:** ${c.description}`,
        `**Área legal:** ${t(`chat.legalArea.${c.legalArea}`)} · **Estado:** ${t(STATUS_KEY[c.status])} · **Creado:** ${c.createdAt.toLocaleDateString('es-MX')}`,
        c.client ? `**Cliente:** ${c.client}` : '',
        c.caseNumber ? `**Expediente:** ${c.caseNumber}` : '',
        c.parties.length ? `### Partes\n${c.parties.map((p) => `- ${p.name} (${p.role})`).join('\n')}` : '',
        c.documents.length ? `### Documentos\n${c.documents.map((d) => `- ${d.name}`).join('\n')}` : '',
        pendingDeadlines.length ? `### Plazos pendientes\n${pendingDeadlines.map((d) => `- ${d.date.toLocaleDateString('es-MX')}: ${d.title}${d.date < new Date() ? ' (VENCIDO)' : ''}`).join('\n')}` : '',
        c.notes.length ? `### Notas\n${c.notes.slice(-5).map((n) => `- ${n.createdAt.toLocaleDateString('es-MX')}: ${n.content.slice(0, 150)}`).join('\n')}` : '',
      ].filter(Boolean).join('\n\n');
      const prompt = promptBuilder.buildQueryPrompt({ query: lines, language, template: 'caseSummary' });
      let full = '';
      const response = await engine.processLegalQueryStreaming(prompt, (chunk) => { full += chunk; setSummaryStream(full); }, { legalArea: c.legalArea, queryType: 'analytical', includeReferences: false });
      await updateCase(c.id, { summary: response.answer });
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setGenerating(false);
      setSummaryStream('');
    }
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const docs = await Promise.all(
      Array.from(files).map(async (file) => ({
        id: newId('doc'),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        content: file.type.startsWith('text/') || /\.(txt|md|csv)$/i.test(file.name) ? await file.text() : undefined,
        tags: [],
      })),
    );
    await updateCase(c.id, (cur) => ({ documents: [...cur.documents, ...docs] }));
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold">{c.title}</h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={STATUS_BADGE[c.status]}>{t(STATUS_KEY[c.status])}</Badge>
            <span>{t(`chat.legalArea.${c.legalArea}`)}</span>
            {c.caseNumber && <span>· {c.caseNumber}</span>}
            {c.client && <span>· {c.client}</span>}
            <span>· {t('cases.lastModified')}: {c.updatedAt.toLocaleDateString()}</span>
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" aria-label={t('cases.editCase')} data-testid="edit-case-button" onClick={() => setEditing(true)}><PencilIcon className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" aria-label={t('cases.deleteCase')} data-testid="delete-case-button" onClick={() => { if (window.confirm(t('cases.confirmDelete'))) void removeCase(c.id); }}><Trash2Icon className="h-4 w-4 text-destructive" /></Button>
        </div>
      </header>

      {webllm && <div className="border-b border-border bg-accent/40 p-3"><WebLLMProgress progress={webllm.progress} message={webllm.message} variant="inline" /></div>}

      <Tabs defaultValue="overview" className="flex flex-1 flex-col">
        <TabsList className="mx-4 mt-3 w-fit">
          <TabsTrigger value="overview">{t('cases.tabs.summary')}</TabsTrigger>
          <TabsTrigger value="documents">{t('cases.tabs.documents')} ({c.documents.length})</TabsTrigger>
          <TabsTrigger value="notes">{t('cases.tabs.notes')} ({c.notes.length})</TabsTrigger>
          <TabsTrigger value="chat">{t('cases.tabs.chat')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('cases.tabs.timeline')}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 p-4">
          {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
          <section className="rounded-lg border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-medium"><SparklesIcon className="h-4 w-4 text-primary" aria-hidden="true" />{t('cases.summary')}</h3>
              <Button size="sm" variant="outline" onClick={() => void generateSummary()} disabled={generating}>
                {generating ? <Loader2Icon className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                {generating ? t('cases.generatingSummary') : c.summary ? t('cases.regenerateSummary') : t('cases.generateSummary')}
              </Button>
            </div>
            {summaryStream || c.summary ? (
              <div className="text-sm"><MessageContent content={summaryStream || c.summary || ''} /><AIOutputLabel className="mt-2" /></div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('cases.noSummary')}</p>
            )}
          </section>
          <div className="grid gap-4 md:grid-cols-2">
            <section className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-medium"><UsersIcon className="h-4 w-4" aria-hidden="true" />{t('cases.partiesInvolved')}</h3>
                <Button size="sm" variant="ghost" onClick={() => setPartyOpen(true)}><PlusIcon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{t('common.add')}</Button>
              </div>
              {c.parties.length === 0 ? <p className="text-sm text-muted-foreground">{t('cases.noParties')}</p> : (
                <ul className="space-y-1 text-sm">{c.parties.map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{p.name}{p.contact ? <span className="text-muted-foreground"> · {p.contact}</span> : null}</span><Badge variant="outline" className="text-[0.65rem]">{p.role}</Badge></li>)}</ul>
              )}
            </section>
            <section className="rounded-lg border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-medium"><CalendarIcon className="h-4 w-4" aria-hidden="true" />{t('cases.upcomingDeadlines')}</h3>
                <Button size="sm" variant="ghost" onClick={() => setDeadlineOpen(true)}><PlusIcon className="mr-1 h-3.5 w-3.5" aria-hidden="true" />{t('common.add')}</Button>
              </div>
              {pendingDeadlines.length === 0 ? <p className="text-sm text-muted-foreground">{t('cases.noPendingDeadlines')}</p> : (
                <ul className="space-y-1 text-sm">
                  {pendingDeadlines.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={d.completed} onChange={() => void updateCase(c.id, (cur) => ({ deadlines: cur.deadlines.map((x) => (x.id === d.id ? { ...x, completed: !x.completed } : x)) }))} aria-label={d.title} />
                        <span className={cn(d.date < new Date() && 'text-destructive')}>{d.date.toLocaleDateString()} · {d.title}</span>
                      </label>
                      <Badge variant="secondary" className="text-[0.65rem]">{t(`cases.deadlineTypes.${d.type}`)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 p-4">
          <label htmlFor="case-file-input" className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:bg-muted/40" data-testid="upload-area"
            onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void upload(e.dataTransfer.files); }}>
            <UploadIcon className="h-6 w-6" aria-hidden="true" />
            <span data-testid="upload-text">{t('cases.upload.dragDrop')}</span>
            <span className="text-xs">{t('cases.upload.supportedFormats')}</span>
            <input id="case-file-input" type="file" multiple className="sr-only" data-testid="file-input" onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          </label>
          {c.documents.length === 0 ? <p className="text-sm text-muted-foreground">{t('cases.noDocuments')}</p> : (
            <ul className="divide-y divide-border rounded-lg border border-border text-sm">
              {c.documents.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0 truncate"><FileTextIcon className="mr-2 inline h-4 w-4 text-muted-foreground" aria-hidden="true" />{d.name} <span className="text-xs text-muted-foreground">({Math.max(1, Math.round(d.size / 1024))} KB · {d.uploadedAt.toLocaleDateString()})</span></span>
                  <Button variant="ghost" size="icon" aria-label={t('common.delete')} data-testid="delete-document" onClick={() => void updateCase(c.id, (cur) => ({ documents: cur.documents.filter((x) => x.id !== d.id) }))}><Trash2Icon className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="notes" className="space-y-4 p-4">
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); const text = note.trim(); if (!text) return; void updateCase(c.id, (cur) => ({ notes: [...cur.notes, { id: newId('n'), content: text, createdAt: new Date(), updatedAt: new Date(), tags: [] }] })); setNote(''); }}>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('cases.addNote')} aria-label={t('cases.addNote')} data-testid="notes-textarea" />
            <div className="flex justify-end"><Button type="submit" size="sm" disabled={!note.trim()}>{t('cases.addNote')}</Button></div>
          </form>
          {c.notes.length === 0 ? <p className="text-sm text-muted-foreground">{t('cases.noNotes')}</p> : (
            <ul className="space-y-2">
              {[...c.notes].reverse().map((n) => (
                <li key={n.id} className="rounded-lg border border-border p-3 text-sm">
                  <p className="whitespace-pre-wrap">{n.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{n.createdAt.toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="chat" className="flex-1 p-0">
          <Suspense fallback={<div className="p-4"><Skeleton className="h-64 w-full" /></div>}>
            <CaseChat caseId={c.id} caseTitle={c.title} caseDescription={c.description} legalArea={c.legalArea} documents={c.documents} notes={c.notes} parties={c.parties} deadlines={c.deadlines} statusChanges={c.statusChanges} summary={c.summary} createdAt={c.createdAt} updatedAt={c.updatedAt} />
          </Suspense>
        </TabsContent>

        <TabsContent value="timeline" className="p-4">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <CaseTimeline caseId={c.id} caseCreatedAt={c.createdAt} caseUpdatedAt={c.updatedAt} documents={c.documents} notes={c.notes} deadlines={c.deadlines} parties={c.parties} statusChanges={c.statusChanges} />
          </Suspense>
        </TabsContent>
      </Tabs>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="max-w-2xl p-0">
          <CaseForm
            testPrefix="edit"
            title={t('cases.editCase')}
            submitLabel={t('common.save')}
            defaults={{ title: c.title, description: c.description, client: c.client ?? '', caseNumber: c.caseNumber ?? '', legalArea: c.legalArea, status: c.status }}
            onCancel={() => setEditing(false)}
            onSubmit={async (v) => { await updateCase(c.id, { title: v.title, description: v.description, client: v.client || undefined, caseNumber: v.caseNumber || undefined, legalArea: v.legalArea, status: v.status }); setEditing(false); }}
          />
        </DialogContent>
      </Dialog>

      <PartyDialog open={partyOpen} onOpenChange={setPartyOpen} onSubmit={async (v) => { await updateCase(c.id, (cur) => ({ parties: [...cur.parties, { id: newId('p'), ...v, contact: v.contact || undefined, notes: v.notes || undefined }] })); setPartyOpen(false); }} />
      <DeadlineDialog open={deadlineOpen} onOpenChange={setDeadlineOpen} onSubmit={async (v) => { await updateCase(c.id, (cur) => ({ deadlines: [...cur.deadlines, { id: newId('dl'), title: v.title, date: new Date(`${v.date}T12:00:00`), type: v.type, completed: false, notes: v.notes || undefined }] })); setDeadlineOpen(false); }} />
    </div>
  );
}

function PartyDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (v: PartyValues) => Promise<void> }) {
  const { t } = useTranslation();
  const form = useForm<PartyValues>({ resolver: zodResolver(PartySchema), defaultValues: { name: '', role: 'plaintiff', contact: '', notes: '' } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('cases.partiesInvolved')}</DialogTitle><DialogDescription>{t('common.add')}</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(async (v) => { await onSubmit(v); form.reset(); })} noValidate className="space-y-3">
            <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel htmlFor="party-name">{t('name')}</FormLabel><FormControl><Input id="party-name" {...field} /></FormControl>{form.formState.errors.name && <p role="alert" className="text-sm text-destructive">{t(String(form.formState.errors.name.message))}</p>}</FormItem>)} />
            <FormField control={form.control} name="role" render={({ field }) => (<FormItem><FormLabel htmlFor="party-role">{t('role')}</FormLabel><FormControl><select id="party-role" className={selectClass} {...field}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select></FormControl></FormItem>)} />
            <FormField control={form.control} name="contact" render={({ field }) => (<FormItem><FormLabel htmlFor="party-contact">{t('contact')}</FormLabel><FormControl><Input id="party-contact" {...field} /></FormControl></FormItem>)} />
            <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button type="submit">{t('common.add')}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeadlineDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (v: DeadlineValues) => Promise<void> }) {
  const { t } = useTranslation();
  const form = useForm<DeadlineValues>({ resolver: zodResolver(DeadlineSchema), defaultValues: { title: '', date: new Date().toISOString().slice(0, 10), type: 'court', notes: '' } });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{t('cases.upcomingDeadlines')}</DialogTitle><DialogDescription>{t('common.add')}</DialogDescription></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(async (v) => { await onSubmit(v); form.reset(); })} noValidate className="space-y-3">
            <FormField control={form.control} name="title" render={({ field }) => (<FormItem><FormLabel htmlFor="deadline-title">{t('title')}</FormLabel><FormControl><Input id="deadline-title" {...field} /></FormControl>{form.formState.errors.title && <p role="alert" className="text-sm text-destructive">{t(String(form.formState.errors.title.message))}</p>}</FormItem>)} />
            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="date" render={({ field }) => (<FormItem><FormLabel htmlFor="deadline-date">{t('date')}</FormLabel><FormControl><Input id="deadline-date" type="date" {...field} /></FormControl></FormItem>)} />
              <FormField control={form.control} name="type" render={({ field }) => (<FormItem><FormLabel htmlFor="deadline-type">{t('type')}</FormLabel><FormControl><select id="deadline-type" className={selectClass} {...field}>{DEADLINE_TYPES.map((d) => <option key={d} value={d}>{t(`cases.deadlineTypes.${d}`)}</option>)}</select></FormControl></FormItem>)} />
            </div>
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel htmlFor="deadline-notes">{t('notes')}</FormLabel><FormControl><Textarea id="deadline-notes" rows={2} {...field} /></FormControl></FormItem>)} />
            <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button><Button type="submit">{t('common.add')}</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
