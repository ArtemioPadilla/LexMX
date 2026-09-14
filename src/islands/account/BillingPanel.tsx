/** Plan & usage (plan § 11.9, línea D). Read-only view over `subscriptions` and `usage`. */
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useTranslation } from '@/i18n';
import { PLAN_QUOTAS, effectivePlan, getSubscription, getUsage, usageRatio, type BillingScope, type Subscription, type Usage } from '@/lib/server/billing';
import type { Org } from '@/lib/server/orgs';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Skeleton } from '@/components/ui/skeleton';

const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

export function BillingPanel({ client, userId, orgs }: { client: SupabaseClient; userId: string; orgs: Org[] }) {
  const { t } = useTranslation();
  const [scopeId, setScopeId] = useState<string>('me');
  const [state, setState] = useState<{ sub: Subscription | null; usage: Usage } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const scope: BillingScope = scopeId === 'me' ? { userId } : { orgId: scopeId };
    let cancelled = false;
    setState(null);
    Promise.all([getSubscription(client, scope), getUsage(client, scope)])
      .then(([sub, usage]) => { if (!cancelled) { setState({ sub, usage }); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setState({ sub: null, usage: { period: '', queries: 0, documents: 0, tokensIn: 0, tokensOut: 0 } }); } });
    return () => { cancelled = true; };
  }, [client, scopeId, userId]);

  const plan = effectivePlan(state?.sub ?? null);
  const quota = PLAN_QUOTAS[plan];
  const fmt = (n: number) => (Number.isFinite(n) ? n.toLocaleString() : t('account.billing.unlimited'));

  return (
    <section className="space-y-4" aria-labelledby="billing-title">
      <div>
        <h2 id="billing-title" className="text-lg font-semibold">{t('account.billing.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('account.billing.intro')}</p>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm" htmlFor="billing-scope">{t('account.billing.scope')}</label>
        <select id="billing-scope" className={selectClass} value={scopeId} onChange={(e) => setScopeId(e.target.value)}>
          <option value="me">{t('account.billing.personal')}</option>
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>
      {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}
      {!state ? <Skeleton className="h-32 w-full" /> : (
        <>
          <div className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">{t('account.billing.plan')}</p>
              <p className="flex items-center gap-2 font-medium"><Badge>{plan}</Badge>{!state.sub && <span className="text-sm text-muted-foreground">{t('account.billing.noSubscription')}</span>}</p>
            </div>
            {state.sub && (
              <>
                <div><p className="text-xs text-muted-foreground">{t('account.billing.status')}</p><p className="font-medium">{t(`account.billing.statuses.${state.sub.status}`)}</p></div>
                <div><p className="text-xs text-muted-foreground">{t('account.billing.seats')}</p><p className="font-medium">{state.sub.seats}</p></div>
                {state.sub.currentPeriodEnd && <div><p className="text-xs text-muted-foreground">{t('account.billing.renews')}</p><p className="font-medium">{new Date(state.sub.currentPeriodEnd).toLocaleDateString()}</p></div>}
              </>
            )}
          </div>
          <div className="space-y-3 rounded-lg border border-border p-4">
            <p className="text-xs text-muted-foreground">{t('account.billing.period')}: {state.usage.period}</p>
            <UsageRow label={t('account.billing.queries')} used={state.usage.queries} quota={quota.queries} fmt={fmt} of={t('account.billing.of')} />
            <UsageRow label={t('account.billing.documents')} used={state.usage.documents} quota={quota.documents} fmt={fmt} of={t('account.billing.of')} />
            <p className="text-sm">{t('account.billing.tokens')}: {state.usage.tokensIn.toLocaleString()} / {state.usage.tokensOut.toLocaleString()}</p>
          </div>
          <p className="text-xs text-muted-foreground">{t('account.billing.manage')}</p>
        </>
      )}
    </section>
  );
}

function UsageRow({ label, used, quota, fmt, of }: { label: string; used: number; quota: number; fmt: (n: number) => string; of: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm"><span>{label}</span><span>{fmt(used)} {of} {fmt(quota)}</span></div>
      <ProgressBar value={usageRatio(used, quota) * 100} label={label} />
    </div>
  );
}
