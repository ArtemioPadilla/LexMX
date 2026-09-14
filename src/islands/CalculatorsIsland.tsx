/**
 * /herramientas (plan § 11.4 C): deterministic calculators per jurisdiction,
 * rendered generically from `Calculator.fields`. No AI involved; every line
 * shows its legal basis and the dated parameters used.
 */
import { useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { CalculatorIcon } from 'lucide-react';
import { $jurisdictionCode } from '@/stores/jurisdiction';
import { getJurisdiction, listJurisdictions, type Calculator, type CalculatorResult } from '@/jurisdictions';
import { setJurisdiction } from '@/stores/jurisdiction';
import { useTranslation } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Callout } from '@/components/ui/callout';
import { Badge } from '@/components/ui/badge';
import ErrorBoundary from './ErrorBoundary';

const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

export default function CalculatorsIsland() {
  return (
    <ErrorBoundary name="Calculators">
      <Inner />
    </ErrorBoundary>
  );
}

function Inner() {
  const { t } = useTranslation();
  const code = useStore($jurisdictionCode);
  const jurisdiction = getJurisdiction(code);
  const calculators = jurisdiction.calculators ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = calculators.find((c) => c.id === activeId) ?? calculators[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm" htmlFor="calc-jurisdiction">{t('chat.jurisdiction')}</label>
        <select id="calc-jurisdiction" className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={code} onChange={(e) => { setJurisdiction(e.target.value); setActiveId(null); }}>
          {listJurisdictions().map((j) => <option key={j.code} value={j.code}>{j.name}{(j.calculators?.length ?? 0) === 0 ? ` · ${t('tools.none')}` : ''}</option>)}
        </select>
      </div>
      {calculators.length === 0 ? (
        <Callout title={t('tools.none')} variant="default" className="text-sm">{t('tools.noneBody', { country: jurisdiction.name })}</Callout>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <ul className="space-y-2">
            {calculators.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => setActiveId(c.id)} aria-current={active?.id === c.id ? 'true' : undefined} className={`w-full rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/60 ${active?.id === c.id ? 'border-primary bg-accent' : 'border-border'}`}>
                  <span className="flex items-center gap-2 font-medium"><CalculatorIcon className="h-4 w-4 text-primary" aria-hidden="true" />{c.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{c.description}</span>
                </button>
              </li>
            ))}
          </ul>
          {active && <CalculatorForm key={active.id} calculator={active} currencyLocale={jurisdiction.defaultLanguage === 'pt' ? 'pt-BR' : 'es-MX'} />}
        </div>
      )}
    </div>
  );
}

function CalculatorForm({ calculator, currencyLocale }: { calculator: Calculator; currencyLocale: string }) {
  const { t } = useTranslation();
  const initial = useMemo(() => Object.fromEntries(calculator.fields.map((f) => [f.name, f.type === 'boolean' ? false : f.type === 'select' ? (f.options?.[0]?.value ?? '') : ''])), [calculator]);
  const [values, setValues] = useState<Record<string, string | boolean>>(initial);
  const [result, setResult] = useState<CalculatorResult | null>(null);
  const fmt = (n: number, currency: string) => new Intl.NumberFormat(currencyLocale, { style: 'currency', currency }).format(n);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: Record<string, unknown> = {};
    for (const f of calculator.fields) {
      const v = values[f.name];
      if (f.type === 'number') input[f.name] = v === '' || v === undefined ? undefined : Number(v);
      else input[f.name] = v;
    }
    setResult(calculator.compute(input));
  }

  return (
    <div className="space-y-4 lg:col-span-2">
      <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
        {calculator.fields.map((f) => (
          <div key={f.name} className={f.type === 'boolean' ? 'flex items-center gap-2 sm:col-span-2' : ''}>
            {f.type === 'boolean' ? (
              <>
                <input id={`f-${f.name}`} type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked }))} />
                <label htmlFor={`f-${f.name}`} className="text-sm">{f.label}</label>
              </>
            ) : (
              <>
                <label htmlFor={`f-${f.name}`} className="mb-1 block text-xs font-medium text-muted-foreground">{f.label}{f.required ? ' *' : ''}</label>
                {f.type === 'select' ? (
                  <select id={`f-${f.name}`} className={selectClass} value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} required={f.required}>
                    {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input id={`f-${f.name}`} type={f.type} min={f.min} step={f.step} required={f.required} value={String(values[f.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                )}
                {f.help && <p className="mt-1 text-xs text-muted-foreground">{f.help}</p>}
              </>
            )}
          </div>
        ))}
        <div className="sm:col-span-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {Object.entries(calculator.parameters).map(([k, p]) => `${k}: ${p.value} (${p.asOf})`).join(' · ')}
          </p>
          <Button type="submit">{t('tools.compute')}</Button>
        </div>
      </form>

      {result && (
        <div className="space-y-3">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">{t('tools.concept')}</th><th className="py-1">{t('tools.basis')}</th><th className="py-1 text-right">{t('tools.amount')}</th></tr></thead>
            <tbody className="divide-y divide-border">
              {result.lines.map((l) => (
                <tr key={l.label}>
                  <td className="py-2 pr-2">{l.label}{l.note && <span className="block text-xs text-muted-foreground">{l.note}</span>}</td>
                  <td className="py-2 pr-2 text-xs text-muted-foreground">{l.basis}</td>
                  <td className="py-2 text-right font-mono">{l.text ?? fmt(l.amount, result.currency)}</td>
                </tr>
              ))}
            </tbody>
            {result.lines.some((l) => l.text === undefined) && result.total !== 0 && (
              <tfoot><tr className="border-t border-border font-semibold"><td className="py-2" colSpan={2}>{t('tools.total')}</td><td className="py-2 text-right font-mono">{fmt(result.total, result.currency)}</td></tr></tfoot>
            )}
          </table>
          {result.warnings.length > 0 && (
            <Callout title={t('tools.notes')} variant="warning" className="text-xs">
              <ul className="list-inside list-disc space-y-1">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </Callout>
          )}
          <p className="text-xs text-muted-foreground"><Badge variant="outline" className="mr-2">{t('tools.deterministic')}</Badge>{t('tools.disclaimer')}</p>
        </div>
      )}
    </div>
  );
}
