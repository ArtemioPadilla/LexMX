/**
 * "Guardar en expediente" (plan Fase 8: expediente = documentos +
 * comparaciones + tablas + notas). Appends a text artifact produced by a tool
 * (diff, CSV, transcript) to a case in IndexedDB as a CaseDocument. Renders
 * nothing until the user opens it; lists cases lazily.
 */
import { useEffect, useState } from 'react';
import { FolderPlusIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { caseStore } from '@/lib/case-management/case-store';
import type { LegalCase } from '@/types/cases';
import { Button } from '@/components/ui/button';

export interface SaveToCaseProps {
  /** File name stored in the case, e.g. "comparacion.diff". */
  name: string;
  /** MIME type recorded on the document. */
  type: string;
  /** Lazily produced content (only built when the user saves). */
  content: () => string;
  tag: string;
  disabled?: boolean;
}

export function SaveToCase({ name, type, content, tag, disabled }: SaveToCaseProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [cases, setCases] = useState<LegalCase[] | null>(null);
  const [selected, setSelected] = useState('');
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || cases !== null) return;
    let cancelled = false;
    caseStore
      .list()
      .then((list) => { if (!cancelled) { setCases(list); setSelected(list[0]?.id ?? ''); } })
      .catch((e: unknown) => { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setCases([]); } });
    return () => { cancelled = true; };
  }, [open, cases]);

  async function save() {
    const c = cases?.find((x) => x.id === selected);
    if (!c) return;
    setError(null);
    try {
      const text = content();
      const doc = { id: `d-${Date.now().toString(36)}`, name, type, size: new Blob([text]).size, uploadedAt: new Date(), content: text, tags: [tag] };
      await caseStore.put({ ...c, documents: [...c.documents, doc], updatedAt: new Date() });
      setDone(c.title);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!open) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => { setDone(null); setOpen(true); }}>
          <FolderPlusIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('saveToCase.button')}
        </Button>
        {done && <span role="status" className="text-xs text-muted-foreground">{t('saveToCase.saved', { title: done })}</span>}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {cases === null ? (
        <span className="text-xs text-muted-foreground">{t('common.loading')}</span>
      ) : cases.length === 0 ? (
        <span className="text-xs text-muted-foreground">{t('saveToCase.noCases')}</span>
      ) : (
        <select aria-label={t('saveToCase.pick')} className="h-8 rounded-md border border-input bg-background px-2 text-xs" value={selected} onChange={(e) => setSelected(e.target.value)}>
          {cases.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
        </select>
      )}
      <Button size="sm" disabled={!selected} onClick={() => void save()}>{t('saveToCase.confirm')}</Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('saveToCase.cancel')}</Button>
      {error && <span role="alert" className="text-xs text-destructive">{error}</span>}
    </span>
  );
}
