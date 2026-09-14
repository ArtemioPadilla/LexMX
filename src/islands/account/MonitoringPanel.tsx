/** Court/gazette/reform monitoring (plan § 11.9). The user registers what to watch; adapters write events. */
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BellIcon, EyeIcon } from 'lucide-react';
import { useStore } from '@nanostores/react';
import { useTranslation } from '@/i18n';
import { $jurisdictionCode } from '@/stores/jurisdiction';
import {
  COURT_ADAPTERS,
  addWatchedCase,
  listCourtEvents,
  listLawWatches,
  listNotifications,
  listWatchedCases,
  markNotificationRead,
  removeWatchedCase,
  setWatchedCaseActive,
  unwatchLaw,
  watchLaw,
  type CourtEvent,
  type LawWatch,
  type Notification,
  type WatchedCase,
} from '@/lib/server/monitoring';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';

const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

export function MonitoringPanel({ client }: { client: SupabaseClient }) {
  const { t } = useTranslation();
  const jurisdiction = useStore($jurisdictionCode);
  const adapters = COURT_ADAPTERS[jurisdiction] ?? [];
  const [cases, setCases] = useState<WatchedCase[] | null>(null);
  const [laws, setLaws] = useState<LawWatch[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [court, setCourt] = useState(adapters[0]?.id ?? '');
  const [expediente, setExpediente] = useState('');
  const [label, setLabel] = useState('');
  const [docId, setDocId] = useState('');
  const [openCase, setOpenCase] = useState<string | null>(null);
  const [events, setEvents] = useState<CourtEvent[] | null>(null);

  async function load() {
    try {
      const [c, l, n] = await Promise.all([listWatchedCases(client), listLawWatches(client), listNotifications(client)]);
      setCases(c);
      setLaws(l);
      setNotifications(n);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCases([]);
    }
  }
  useEffect(() => { void load(); }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function toggleEvents(id: string) {
    if (openCase === id) { setOpenCase(null); return; }
    setOpenCase(id);
    setEvents(null);
    try { setEvents(await listCourtEvents(client, id)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); setEvents([]); }
  }

  if (cases === null) return <Skeleton className="h-32 w-full" />;

  return (
    <section className="space-y-6" aria-labelledby="monitoring-title">
      <div>
        <h2 id="monitoring-title" className="text-lg font-semibold">{t('account.monitoring.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('account.monitoring.intro')}</p>
      </div>
      {error && <Callout title="Error" variant="error" className="text-sm">{t('account.monitoring.loadError', { error })}</Callout>}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('account.monitoring.cases')}</h3>
        <form
          className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          onSubmit={(e) => { e.preventDefault(); void run(async () => { await addWatchedCase(client, { jurisdiction, court, expediente, label }); setExpediente(''); setLabel(''); }); }}
        >
          <div className="space-y-1">
            <Label htmlFor="watch-court">{t('account.monitoring.court')}</Label>
            <select id="watch-court" className={`${selectClass} w-full`} value={court} onChange={(e) => setCourt(e.target.value)}>
              {adapters.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="watch-expediente">{t('account.monitoring.expediente')}</Label>
            <Input id="watch-expediente" required placeholder={t('account.monitoring.expedientePlaceholder')} value={expediente} onChange={(e) => setExpediente(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="watch-label">{t('account.monitoring.label')}</Label>
            <Input id="watch-label" placeholder={t('account.monitoring.labelPlaceholder')} value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={busy || !court || !expediente.trim()}>{busy ? t('account.monitoring.adding') : t('account.monitoring.add')}</Button>
        </form>
        {cases.length === 0 ? (
          <EmptyState icon={<EyeIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} title={t('account.monitoring.noCases')} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {cases.map((c) => (
              <li key={c.id} className="space-y-2 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="font-medium underline-offset-2 hover:underline" onClick={() => void toggleEvents(c.id)} aria-expanded={openCase === c.id}>
                    {c.label || c.expediente}
                  </button>
                  <Badge variant="outline">{c.expediente}</Badge>
                  <Badge variant="secondary">{adapters.find((a) => a.id === c.court)?.name ?? c.court}</Badge>
                  {!c.active && <Badge variant="destructive">{t('account.monitoring.pause')}</Badge>}
                  <span className="ml-auto text-xs text-muted-foreground">{t('account.monitoring.lastChecked')}: {c.lastCheckedAt ? new Date(c.lastCheckedAt).toLocaleString() : t('account.monitoring.never')}</span>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => setWatchedCaseActive(client, c.id, !c.active))}>{c.active ? t('account.monitoring.pause') : t('account.monitoring.resume')}</Button>
                  <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => removeWatchedCase(client, c.id))}>{t('account.monitoring.remove')}</Button>
                </div>
                {openCase === c.id && (
                  <div className="rounded-md bg-muted/40 p-2">
                    <p className="text-xs font-medium">{t('account.monitoring.events')}</p>
                    {events === null ? <Skeleton className="h-8 w-full" /> : events.length === 0 ? <p className="text-xs text-muted-foreground">{t('account.monitoring.noEvents')}</p> : (
                      <ul className="mt-1 space-y-1">
                        {events.map((ev) => (
                          <li key={ev.id} className="text-xs">
                            <span className="text-muted-foreground">{new Date(ev.occurredAt).toLocaleDateString()}</span> · <strong>{ev.kind}</strong> · {ev.summary}
                            {ev.sourceUrl && <> · <a className="underline" href={ev.sourceUrl} target="_blank" rel="noopener noreferrer">↗</a></>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium">{t('account.monitoring.laws')}</h3>
        <p className="text-xs text-muted-foreground">{t('account.monitoring.lawsIntro')}</p>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void run(async () => { await watchLaw(client, jurisdiction, docId.trim().toLowerCase()); setDocId(''); }); }}>
          <div className="space-y-1">
            <Label htmlFor="watch-law">{t('account.monitoring.docId')}</Label>
            <Input id="watch-law" required value={docId} onChange={(e) => setDocId(e.target.value)} />
          </div>
          <Button type="submit" size="sm" disabled={busy || !docId.trim()}>{t('account.monitoring.follow')}</Button>
        </form>
        {laws.length === 0 ? <p className="text-sm text-muted-foreground">{t('account.monitoring.noLaws')}</p> : (
          <ul className="flex flex-wrap gap-2">
            {laws.map((l) => (
              <li key={`${l.jurisdiction}/${l.docId}`} className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-sm">
                <span>{l.jurisdiction.toUpperCase()} · {l.docId}</span>
                <button type="button" className="text-xs text-muted-foreground hover:text-foreground" disabled={busy} onClick={() => void run(() => unwatchLaw(client, l.jurisdiction, l.docId))} aria-label={`${t('account.monitoring.unfollow')} ${l.docId}`}>×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="flex items-center gap-1 text-sm font-medium"><BellIcon className="h-4 w-4" aria-hidden="true" />{t('account.monitoring.notifications')}</h3>
        {notifications.length === 0 ? <p className="text-sm text-muted-foreground">{t('account.monitoring.noNotifications')}</p> : (
          <ul className="space-y-1">
            {notifications.map((n) => (
              <li key={n.id} className={`rounded-md border border-border p-2 text-sm ${n.readAt ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{n.title}</strong>
                  <Badge variant="outline">{n.kind}</Badge>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
                  {!n.readAt && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => markNotificationRead(client, n.id))}>{t('account.monitoring.markRead')}</Button>}
                </div>
                <p className="text-xs">{n.body} {n.url && <a className="underline" href={n.url} target="_blank" rel="noopener noreferrer">↗</a>}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
