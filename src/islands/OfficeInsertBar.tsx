/**
 * Word add-in bridge (plan § 11.4 E). Reads the shared chat thread from the
 * Nano Store and inserts the last assistant answer into the open document
 * through Office.js. Outside Word (no `Office` global) it explains how to
 * install the add-in instead. Nothing leaves the device: Office.js only
 * talks to the document.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { FileInputIcon, DownloadIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { getUrl } from '@/utils/urls';
import { $chatMessages } from '@/stores/chat';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import ErrorBoundary from './ErrorBoundary';

interface OfficeLike {
  onReady?: (cb: (info: { host?: string }) => void) => Promise<unknown> | void;
  context?: { document?: { setSelectedDataAsync: (data: string, options: { coercionType: string }, cb: (r: { status: string; error?: { message: string } }) => void) => void } };
  CoercionType?: { Text: string };
  AsyncResultStatus?: { Succeeded: string };
}

function office(): OfficeLike | null {
  return typeof window === 'undefined' ? null : ((window as unknown as { Office?: OfficeLike }).Office ?? null);
}

export default function OfficeInsertBar() {
  return (
    <ErrorBoundary name="OfficeInsertBar">
      <Inner />
    </ErrorBoundary>
  );
}

/** Plain text for Word: markdown emphasis and citation brackets stripped. */
export function answerToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, ''))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^[ \t]*[-*]\s+/gm, '• ')
    .trim();
}

function Inner() {
  const { t } = useTranslation();
  const messages = useStore($chatMessages);
  const [inOffice, setInOffice] = useState<boolean | null>(null);
  const [withCitations, setWithCitations] = useState(true);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const o = office();
    if (!o?.onReady) { setInOffice(false); return; }
    let mounted = true;
    void o.onReady((info) => { if (mounted) setInOffice(info.host === 'Word' || Boolean(o.context?.document)); });
    return () => { mounted = false; };
  }, []);

  const last = [...messages].reverse().find((m) => m.type === 'assistant' && !m.isStreaming && m.content.trim());

  function insert() {
    const o = office();
    if (!last || !o?.context?.document) return;
    let text = answerToPlainText(last.content);
    const sources = last.legalResponse?.sources ?? [];
    if (withCitations && sources.length > 0) {
      text += '\n\nFuentes:\n' + sources.map((s) => `• ${s.title}${s.article ? `, artículo ${s.article}` : ''}${s.url ? ` (${s.url})` : ''}`).join('\n');
    }
    o.context.document.setSelectedDataAsync(text, { coercionType: o.CoercionType?.Text ?? 'text' }, (r) => {
      if (r.status === (o.AsyncResultStatus?.Succeeded ?? 'succeeded')) setStatus({ kind: 'success', text: t('office.inserted') });
      else setStatus({ kind: 'error', text: t('office.insertFailed', { error: r.error?.message ?? r.status }) });
    });
  }

  if (inOffice === false) {
    return (
      <Callout title={t('office.notInOffice')} variant="default" className="text-sm">
        <p>{t('office.notInOfficeHelp')}</p>
        <p className="mt-2 font-medium">{t('office.howTo')}</p>
        <p>{t('office.howToSteps')}</p>
        <p className="mt-2"><a className="inline-flex items-center gap-1 underline underline-offset-2" href={getUrl('office/manifest.xml')} download><DownloadIcon className="h-3 w-3" aria-hidden="true" />{t('office.manifest')}</a></p>
      </Callout>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-2 text-sm">
      <Button size="sm" disabled={!last || inOffice !== true} onClick={insert}>
        <FileInputIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('office.insertLast')}
      </Button>
      <label className="inline-flex items-center gap-1 text-xs">
        <input type="checkbox" checked={withCitations} onChange={(e) => setWithCitations(e.target.checked)} />{t('office.withCitations')}
      </label>
      {!last && <span className="text-xs text-muted-foreground">{t('office.noAnswer')}</span>}
      {status && <span role="status" aria-live="polite" className={`text-xs ${status.kind === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>{status.text}</span>}
    </div>
  );
}
