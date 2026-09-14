/**
 * /plantillas (plan § 11.4 C): fill a jurisdiction template anchored to
 * articles and export it as Markdown, Word (.docx) or print/PDF. Everything
 * runs in the browser; the text never leaves the device.
 */
import { useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { FileTextIcon, DownloadIcon, PrinterIcon, CopyIcon } from 'lucide-react';
import { $jurisdictionCode, setJurisdiction } from '@/stores/jurisdiction';
import { getJurisdiction, listJurisdictions, renderTemplate, type DocumentTemplate } from '@/jurisdictions';
import { markdownToDocx, downloadBlob } from '@/lib/export/docx';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Callout } from '@/components/ui/callout';
import { Badge } from '@/components/ui/badge';
import MessageContent from '@/components/MessageContent';
import ErrorBoundary from './ErrorBoundary';

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function TemplatesIsland() {
  return (
    <ErrorBoundary name="Templates">
      <Inner />
    </ErrorBoundary>
  );
}

function Inner() {
  const { t } = useTranslation();
  const code = useStore($jurisdictionCode);
  const jurisdiction = getJurisdiction(code);
  const templates = jurisdiction.templates ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = templates.find((x) => x.id === activeId) ?? templates[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="tpl-jurisdiction">{t('chat.jurisdiction')}</label>
        <select id="tpl-jurisdiction" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={code} onChange={(e) => { setJurisdiction(e.target.value); setActiveId(null); }}>
          {listJurisdictions().map((j) => <option key={j.code} value={j.code}>{j.name}{(j.templates?.length ?? 0) === 0 ? ` · ${t('templates.none')}` : ''}</option>)}
        </select>
      </div>
      {templates.length === 0 ? (
        <Callout title={t('templates.none')} variant="default" className="text-sm">{t('templates.noneBody', { country: jurisdiction.name })}</Callout>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <ul className="space-y-2">
            {templates.map((tpl) => (
              <li key={tpl.id}>
                <button type="button" onClick={() => setActiveId(tpl.id)} aria-current={active?.id === tpl.id ? 'true' : undefined} className={`w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60 ${active?.id === tpl.id ? 'border-primary bg-accent' : 'border-border'}`}>
                  <span className="flex items-center gap-2 font-medium"><FileTextIcon className="h-4 w-4 text-primary" aria-hidden="true" />{tpl.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{tpl.description}</span>
                </button>
              </li>
            ))}
          </ul>
          {active && <TemplateEditor key={active.id} template={active} />}
        </div>
      )}
    </div>
  );
}

function TemplateEditor({ template }: { template: DocumentTemplate }) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(template.fields.map((f) => [f.name, f.type === 'select' ? (f.options?.[0]?.value ?? '') : ''])));
  const [busy, setBusy] = useState(false);
  const rendered = useMemo(() => renderTemplate(template, values), [template, values]);
  const slug = template.id.replace(/^[a-z]{2}-/, '');

  async function exportDocx() {
    setBusy(true);
    try {
      downloadBlob(await markdownToDocx(rendered.markdown, template.name), `${slug}.docx`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 lg:col-span-2">
      <div className="flex flex-wrap gap-1">{template.basis.map((b) => <Badge key={b} variant="outline" className="text-[0.65rem]">{b}</Badge>)}</div>
      {template.warnings?.length ? (
        <Callout title={t('templates.beforeUsing')} variant="warning" className="text-xs"><ul className="list-inside list-disc space-y-1">{template.warnings.map((w) => <li key={w}>{w}</li>)}</ul></Callout>
      ) : null}
      <form className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2" onSubmit={(e) => e.preventDefault()}>
        {template.fields.map((f) => (
          <div key={f.name} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
            <label htmlFor={`t-${f.name}`} className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}{f.required ? ' *' : ''}</label>
            {f.type === 'textarea' ? (
              <Textarea id={`t-${f.name}`} rows={3} placeholder={f.placeholder} value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
            ) : f.type === 'select' ? (
              <select id={`t-${f.name}`} className={selectClass} value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
                {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <Input id={`t-${f.name}`} type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'} placeholder={f.placeholder} value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
            )}
            {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
          </div>
        ))}
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(rendered.markdown)}><CopyIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('templates.copy')}</Button>
        <Button size="sm" variant="outline" onClick={() => downloadBlob(new Blob([rendered.markdown], { type: 'text/markdown;charset=utf-8' }), `${slug}.md`)}><DownloadIcon className="mr-1 h-4 w-4" aria-hidden="true" />Markdown</Button>
        <Button size="sm" disabled={busy} onClick={() => void exportDocx()}><DownloadIcon className="mr-1 h-4 w-4" aria-hidden="true" />Word (.docx)</Button>
        <Button size="sm" variant="outline" onClick={() => window.print()}><PrinterIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('templates.print')}</Button>
        {rendered.missing.length > 0 && <span className="text-xs text-muted-foreground">{t('templates.missing', { count: rendered.missing.length })}</span>}
      </div>
      <article className="prose prose-sm max-w-none rounded-lg border border-border bg-card p-6 print:border-0 dark:prose-invert" data-testid="template-preview">
        <MessageContent content={rendered.markdown} />
      </article>
      <p className="text-xs text-muted-foreground">{t('templates.disclaimer')}</p>
    </div>
  );
}
