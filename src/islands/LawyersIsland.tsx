/**
 * /abogados (plan § 11.9, línea D): verified lawyer directory by subject and
 * entity, referral requests, and the lawyer's own profile. Everything here
 * uses LexMX Servidor; without it the page explains local mode. Referrals
 * carry only a summary the user writes, never the expediente.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { BadgeCheckIcon, MailIcon, ScaleIcon } from 'lucide-react';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { $authReady, $session } from '@/stores/auth';
import { $jurisdictionCode } from '@/stores/jurisdiction';
import { getJurisdiction } from '@/jurisdictions';
import { closeReferral, createReferral, deleteMyProfile, getMyProfile, listMyReferrals, listVerifiedLawyers, upsertMyProfile, type LawyerProfile, type Referral } from '@/lib/server/lawyers';
import { useTranslation } from '@/i18n';
import { getUrl } from '@/utils/urls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ErrorBoundary from './ErrorBoundary';

const AREAS = ['labor', 'civil', 'criminal', 'tax', 'commercial', 'constitutional', 'administrative'] as const;
const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

export default function LawyersIsland() {
  return (
    <ErrorBoundary name="Lawyers">
      <Inner />
    </ErrorBoundary>
  );
}

function Inner() {
  const { t } = useTranslation();
  const ready = useStore($authReady);
  const session = useStore($session);
  if (!supabaseEnabled || !supabase) {
    return (
      <Callout title={t('lawyers.notConfigured.title')} variant="default" className="text-sm">
        <p>{t('lawyers.notConfigured.body')}</p>
        <p className="mt-2"><a className="underline underline-offset-2" href={getUrl('seguridad')}>{t('footer.security')}</a></p>
      </Callout>
    );
  }
  if (!ready) return <Skeleton className="h-40 w-full" />;
  const client = supabase;
  return (
    <Tabs defaultValue="directory" className="space-y-4">
      <TabsList>
        <TabsTrigger value="directory">{t('lawyers.tabs.directory')}</TabsTrigger>
        <TabsTrigger value="referrals">{t('lawyers.tabs.referrals')}</TabsTrigger>
        <TabsTrigger value="profile">{t('lawyers.tabs.profile')}</TabsTrigger>
      </TabsList>
      <TabsContent value="directory"><Directory client={client} signedIn={Boolean(session)} /></TabsContent>
      <TabsContent value="referrals">{session ? <Referrals client={client} /> : <SignInHint />}</TabsContent>
      <TabsContent value="profile">{session ? <Profile client={client} userId={session.user.id} /> : <SignInHint />}</TabsContent>
      <p className="text-xs text-muted-foreground">{t('account.usesServer')} {t('lawyers.privacy')}</p>
    </Tabs>
  );
}

function SignInHint() {
  const { t } = useTranslation();
  return <Callout title={t('lawyers.signIn.title')} variant="default" className="text-sm"><a className="underline underline-offset-2" href={getUrl('cuenta')}>{t('lawyers.signIn.body')}</a></Callout>;
}

function Directory({ client, signedIn }: { client: NonNullable<typeof supabase>; signedIn: boolean }) {
  const { t } = useTranslation();
  const jurisdiction = useStore($jurisdictionCode);
  const entities = getJurisdiction(jurisdiction).entities ?? [];
  const [entity, setEntity] = useState('');
  const [area, setArea] = useState('');
  const [rows, setRows] = useState<LawyerProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<LawyerProfile | null>(null);
  const [summary, setSummary] = useState('');
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    listVerifiedLawyers(client, { jurisdiction, entityCode: entity || undefined, area: area || undefined })
      .then((r) => { if (!cancelled) { setRows(r); setError(null); } })
      .catch((e: unknown) => { if (!cancelled) { setError(e instanceof Error ? e.message : String(e)); setRows([]); } });
    return () => { cancelled = true; };
  }, [client, jurisdiction, entity, area]);

  async function sendReferral() {
    if (!asking) return;
    try {
      await createReferral(client, { jurisdiction, entityCode: asking.entityCode, area: area || asking.areas[0] || 'civil', summary, lawyerId: asking.userId });
      setSent(asking.headline);
      setAsking(null);
      setSummary('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <section className="space-y-4" aria-labelledby="dir-title">
      <h2 id="dir-title" className="text-lg font-semibold">{t('lawyers.directory.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('lawyers.directory.intro')}</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="dir-entity">{t('lawyers.entity')}</label>
        <select id="dir-entity" className={selectClass} value={entity} onChange={(e) => setEntity(e.target.value)}>
          <option value="">{t('lawyers.anyEntity')}</option>
          {entities.map((e) => <option key={e.code} value={e.code}>{e.name}</option>)}
        </select>
        <label className="text-sm" htmlFor="dir-area">{t('lawyers.area')}</label>
        <select id="dir-area" className={selectClass} value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="">{t('lawyers.anyArea')}</option>
          {AREAS.map((a) => <option key={a} value={a}>{t(`lawyers.areas.${a}`)}</option>)}
        </select>
      </div>
      {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}
      {sent && <Callout title={t('lawyers.referral.sentTitle')} variant="success" className="text-sm" aria-live="polite">{t('lawyers.referral.sent', { name: sent })}</Callout>}
      {rows === null ? <Skeleton className="h-24 w-full" /> : rows.length === 0 ? (
        <EmptyState icon={<ScaleIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} title={t('lawyers.directory.empty')} description={t('lawyers.directory.emptyHelp')} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((p) => (
            <li key={p.userId} className="space-y-2 rounded-lg border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.headline}</span>
                <Badge variant="secondary"><BadgeCheckIcon className="mr-1 h-3 w-3" aria-hidden="true" />{t('lawyers.verified')}</Badge>
                {p.entityCode && <Badge variant="outline">{entities.find((e) => e.code === p.entityCode)?.name ?? p.entityCode}</Badge>}
              </div>
              <div className="flex flex-wrap gap-1">{p.areas.map((a) => <Badge key={a} variant="outline">{t(`lawyers.areas.${a}`) === `lawyers.areas.${a}` ? a : t(`lawyers.areas.${a}`)}</Badge>)}</div>
              {p.bio && <p className="text-sm text-muted-foreground">{p.bio}</p>}
              <div className="flex flex-wrap gap-2">
                {p.contactEmail && <a className="inline-flex items-center gap-1 text-sm underline underline-offset-2" href={`mailto:${p.contactEmail}`}><MailIcon className="h-3 w-3" aria-hidden="true" />{p.contactEmail}</a>}
                {signedIn && <Button size="sm" variant="outline" onClick={() => { setAsking(p); setSent(null); }}>{t('lawyers.referral.ask')}</Button>}
              </div>
              {asking?.userId === p.userId && (
                <div className="space-y-2 rounded-md bg-muted/40 p-3">
                  <Label htmlFor="ref-summary">{t('lawyers.referral.summary')}</Label>
                  <Textarea id="ref-summary" rows={4} maxLength={1000} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={t('lawyers.referral.placeholder')} />
                  <p className="text-xs text-muted-foreground">{t('lawyers.referral.note')}</p>
                  <div className="flex gap-2">
                    <Button size="sm" disabled={summary.trim().length < 10} onClick={() => void sendReferral()}>{t('lawyers.referral.send')}</Button>
                    <Button size="sm" variant="ghost" onClick={() => setAsking(null)}>{t('lawyers.referral.cancel')}</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Referrals({ client }: { client: NonNullable<typeof supabase> }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Referral[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => listMyReferrals(client).then(setRows).catch((e: unknown) => { setError(e instanceof Error ? e.message : String(e)); setRows([]); });
  useEffect(() => { void load(); }, []);
  if (rows === null) return <Skeleton className="h-24 w-full" />;
  return (
    <section className="space-y-3" aria-labelledby="ref-title">
      <h2 id="ref-title" className="text-lg font-semibold">{t('lawyers.referrals.title')}</h2>
      {error && <Callout title="Error" variant="error" className="text-sm">{error}</Callout>}
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{t('lawyers.referrals.empty')}</p> : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((r) => (
            <li key={r.id} className="space-y-1 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{t(`lawyers.areas.${r.area}`) === `lawyers.areas.${r.area}` ? r.area : t(`lawyers.areas.${r.area}`)}</Badge>
                <Badge variant={r.status === 'open' ? 'secondary' : r.status === 'matched' ? 'default' : 'outline'}>{t(`lawyers.referrals.status.${r.status}`)}</Badge>
                <span className="ml-auto text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                {r.status !== 'closed' && <Button size="sm" variant="ghost" onClick={() => { void closeReferral(client, r.id).then(load); }}>{t('lawyers.referrals.close')}</Button>}
              </div>
              <p>{r.summary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Profile({ client, userId }: { client: NonNullable<typeof supabase>; userId: string }) {
  const { t } = useTranslation();
  const jurisdiction = useStore($jurisdictionCode);
  const entities = getJurisdiction(jurisdiction).entities ?? [];
  const [loaded, setLoaded] = useState<LawyerProfile | null | undefined>(undefined);
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [entity, setEntity] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [accepting, setAccepting] = useState(true);
  const [status, setStatus] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    getMyProfile(client, userId).then((p) => {
      setLoaded(p);
      if (p) { setHeadline(p.headline); setBio(p.bio); setEntity(p.entityCode ?? ''); setAreas(p.areas); setEmail(p.contactEmail ?? ''); setAccepting(p.acceptingClients); }
    }).catch(() => setLoaded(null));
  }, [client, userId]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsertMyProfile(client, { jurisdiction, entityCode: entity || null, areas, headline, bio, languages: ['es'], contactEmail: email || null, acceptingClients: accepting });
      setStatus({ kind: 'success', text: t('lawyers.profile.saved') });
      setLoaded(await getMyProfile(client, userId));
    } catch (err) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    }
  }

  if (loaded === undefined) return <Skeleton className="h-40 w-full" />;
  return (
    <form onSubmit={save} className="space-y-4" aria-labelledby="prof-title">
      <h2 id="prof-title" className="text-lg font-semibold">{t('lawyers.profile.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('lawyers.profile.intro')}</p>
      {loaded && (
        <p className="text-sm">
          {loaded.verifiedAt ? <Badge variant="secondary"><BadgeCheckIcon className="mr-1 h-3 w-3" aria-hidden="true" />{t('lawyers.verified')}</Badge> : <Badge variant="outline">{t('lawyers.profile.pending')}</Badge>}
        </p>
      )}
      {status && <Callout title={status.kind === 'error' ? 'Error' : 'OK'} variant={status.kind} className="text-sm" aria-live="polite">{status.text}</Callout>}
      <div className="space-y-1">
        <Label htmlFor="prof-headline">{t('lawyers.profile.headline')}</Label>
        <Input id="prof-headline" required maxLength={160} value={headline} onChange={(e) => setHeadline(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="prof-bio">{t('lawyers.profile.bio')}</Label>
        <Textarea id="prof-bio" rows={4} maxLength={2000} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4">
        <div className="space-y-1">
          <Label htmlFor="prof-entity">{t('lawyers.entity')}</Label>
          <select id="prof-entity" className={selectClass} value={entity} onChange={(e) => setEntity(e.target.value)}>
            <option value="">{t('lawyers.anyEntity')}</option>
            {entities.map((e) => <option key={e.code} value={e.code}>{e.name}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="prof-email">{t('lawyers.profile.email')}</Label>
          <Input id="prof-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
      </div>
      <fieldset className="space-y-1">
        <legend className="text-sm font-medium">{t('lawyers.area')}</legend>
        <div className="flex flex-wrap gap-3">
          {AREAS.map((a) => (
            <label key={a} className="inline-flex items-center gap-1 text-sm">
              <input type="checkbox" checked={areas.includes(a)} onChange={(e) => setAreas((v) => (e.target.checked ? [...v, a] : v.filter((x) => x !== a)))} />{t(`lawyers.areas.${a}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={accepting} onChange={(e) => setAccepting(e.target.checked)} />{t('lawyers.profile.accepting')}</label>
      <p className="text-xs text-muted-foreground">{t('lawyers.profile.credential')}</p>
      <div className="flex gap-2">
        <Button type="submit" disabled={!headline.trim() || areas.length === 0}>{t('lawyers.profile.save')}</Button>
        {loaded && <Button type="button" variant="ghost" onClick={() => { void deleteMyProfile(client, userId).then(() => { setLoaded(null); setStatus({ kind: 'success', text: t('lawyers.profile.deleted') }); }); }}>{t('lawyers.profile.delete')}</Button>}
      </div>
    </form>
  );
}
