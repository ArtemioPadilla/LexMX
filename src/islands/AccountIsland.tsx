/**
 * /cuenta (plan § 11.9): optional account on LexMX Servidor (Supabase Auth).
 * Local-first stays the default: without a configured server this island
 * says so and nothing else changes. Everything that touches the server is
 * labelled. Roles come from the session (app_metadata), never from the UI.
 */
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CloudIcon, LogOutIcon, ShieldIcon } from 'lucide-react';
import { supabase, supabaseEnabled } from '@/lib/supabase';
import { acceptInvite, listMyOrgs, type Org } from '@/lib/server/orgs';
import { OrgPanel } from './account/OrgPanel';
import { BillingPanel } from './account/BillingPanel';
import { MonitoringPanel } from './account/MonitoringPanel';
import type { Session } from '@supabase/supabase-js';
import { $authReady, $guardUser, $session } from '@/stores/auth';
import { LoginSchema, RegisterSchema, type LoginValues, type RegisterValues } from '@/schemas/auth';
import { useTranslation } from '@/i18n';
import { getUrl } from '@/utils/urls';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Skeleton } from '@/components/ui/skeleton';
import ErrorBoundary from './ErrorBoundary';

export default function AccountIsland() {
  return (
    <ErrorBoundary name="Account">
      <Inner />
    </ErrorBoundary>
  );
}

function ServerLabel() {
  const { t } = useTranslation();
  return (
    <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <CloudIcon className="h-3 w-3" aria-hidden="true" />
      {t('account.usesServer')}
    </p>
  );
}

function Inner() {
  const { t } = useTranslation();
  const ready = useStore($authReady);
  const session = useStore($session);
  const user = useStore($guardUser);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  if (!supabaseEnabled || !supabase) {
    return (
      <Callout title={t('account.notConfigured.title')} variant="default" className="text-sm">
        <p>{t('account.notConfigured.body')}</p>
        <p className="mt-2"><a className="underline underline-offset-2" href={getUrl('seguridad')}>{t('footer.security')}</a></p>
      </Callout>
    );
  }
  if (!ready) return <Skeleton className="h-40 w-full" />;

  if (session) {
    return <SignedIn session={session} roles={[...(user?.roles ?? [])]} emailVerified={user?.flags?.emailVerified === true} onSignOut={() => setMessage(null)} />;
  }

  return (
    <Tabs defaultValue="login" className="space-y-4">
      <TabsList>
        <TabsTrigger value="login">{t('account.login')}</TabsTrigger>
        <TabsTrigger value="register">{t('account.register')}</TabsTrigger>
      </TabsList>
      {pendingInviteToken() && <Callout title={t('account.orgs.invites')} variant="default" className="text-sm">{t('account.invite.signInFirst')}</Callout>}
      {message && <Callout title={message.kind === 'error' ? 'Error' : 'OK'} variant={message.kind} className="text-sm">{message.text}</Callout>}
      <TabsContent value="login"><LoginForm onMessage={setMessage} /></TabsContent>
      <TabsContent value="register"><RegisterForm onMessage={setMessage} /></TabsContent>
      <ServerLabel />
    </Tabs>
  );
}

/** Reads `?invite=` once; the token never touches storage. */
function pendingInviteToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = new URLSearchParams(window.location.search).get('invite');
  return token && token.length >= 20 ? token : null;
}

function SignedIn({ session, roles, emailVerified, onSignOut }: { session: Session; roles: string[]; emailVerified: boolean; onSignOut: () => void }) {
  const { t } = useTranslation();
  const client = supabase!;
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsVersion, setOrgsVersion] = useState(0);
  const [invite, setInvite] = useState<{ kind: 'info' | 'success' | 'error'; text: string } | null>(() => (pendingInviteToken() ? { kind: 'info', text: t('account.invite.accepting') } : null));

  useEffect(() => {
    const token = pendingInviteToken();
    if (!token) return;
    acceptInvite(client, token)
      .then((r) => {
        setInvite({ kind: 'success', text: t('account.invite.accepted', { role: t(`account.orgs.roles.${r.role}`) }) });
        setOrgsVersion((v) => v + 1);
      })
      .catch((e: unknown) => setInvite({ kind: 'error', text: t('account.invite.failed', { error: e instanceof Error ? e.message : String(e) }) }))
      .finally(() => window.history.replaceState(null, '', window.location.pathname));
  }, [client, t]);

  useEffect(() => {
    let cancelled = false;
    listMyOrgs(client).then((list) => { if (!cancelled) setOrgs(list); }).catch(() => { if (!cancelled) setOrgs([]); });
    return () => { cancelled = true; };
  }, [client, orgsVersion]);

  return (
    <div className="space-y-4">
      {invite && <Callout title={invite.kind === 'error' ? 'Error' : t('account.orgs.invites')} variant={invite.kind === 'info' ? 'default' : invite.kind} className="text-sm" aria-live="polite">{invite.text}</Callout>}
      <div className="rounded-lg border border-border p-4">
        <p className="text-sm text-muted-foreground">{t('account.signedInAs')}</p>
        <p className="font-medium">{session.user.email}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {roles.map((r) => <Badge key={r} variant="secondary">{r}</Badge>)}
          {emailVerified ? <Badge variant="outline"><ShieldIcon className="mr-1 h-3 w-3" aria-hidden="true" />{t('account.emailVerified')}</Badge> : <Badge variant="destructive">{t('account.emailUnverified')}</Badge>}
        </div>
      </div>
      <Tabs defaultValue="orgs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orgs">{t('account.tabs.orgs')}</TabsTrigger>
          <TabsTrigger value="billing">{t('account.tabs.billing')}</TabsTrigger>
          <TabsTrigger value="monitoring">{t('account.tabs.monitoring')}</TabsTrigger>
        </TabsList>
        <TabsContent value="orgs"><OrgPanel key={orgsVersion} client={client} userId={session.user.id} /></TabsContent>
        <TabsContent value="billing"><BillingPanel client={client} userId={session.user.id} orgs={orgs} /></TabsContent>
        <TabsContent value="monitoring"><MonitoringPanel client={client} /></TabsContent>
      </Tabs>
      <ServerLabel />
      <Button variant="outline" onClick={async () => { await client.auth.signOut(); onSignOut(); }}>
        <LogOutIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('account.signOut')}
      </Button>
    </div>
  );
}

function LoginForm({ onMessage }: { onMessage: (m: { kind: 'error' | 'success'; text: string } | null) => void }) {
  const { t } = useTranslation();
  const form = useForm<LoginValues>({ resolver: zodResolver(LoginSchema), defaultValues: { email: '', password: '' } });
  async function submit(values: LoginValues) {
    onMessage(null);
    const { error } = await supabase!.auth.signInWithPassword(values);
    if (error) onMessage({ kind: 'error', text: t('account.invalidCredentials') });
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-3">
        <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel htmlFor="login-email">{t('account.email')}</FormLabel><FormControl><Input id="login-email" type="email" autoComplete="email" {...field} /></FormControl>{form.formState.errors.email && <p role="alert" className="text-sm text-destructive">{t(String(form.formState.errors.email.message))}</p>}</FormItem>)} />
        <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel htmlFor="login-password">{t('account.password')}</FormLabel><FormControl><PasswordInput id="login-password" autoComplete="current-password" {...field} /></FormControl></FormItem>)} />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{t('account.login')}</Button>
      </form>
    </Form>
  );
}

function RegisterForm({ onMessage }: { onMessage: (m: { kind: 'error' | 'success'; text: string } | null) => void }) {
  const { t } = useTranslation();
  const form = useForm<RegisterValues>({ resolver: zodResolver(RegisterSchema), defaultValues: { name: '', email: '', password: '' } });
  async function submit(values: RegisterValues) {
    onMessage(null);
    const { data, error } = await supabase!.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { name: values.name }, emailRedirectTo: `${window.location.origin}${getUrl('cuenta')}` },
    });
    if (error) onMessage({ kind: 'error', text: error.message });
    else if (!data.session) onMessage({ kind: 'success', text: t('account.checkEmail') });
  }
  const err = (k: keyof RegisterValues) => form.formState.errors[k]?.message;
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} noValidate className="space-y-3">
        <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel htmlFor="reg-name">{t('account.name')}</FormLabel><FormControl><Input id="reg-name" autoComplete="name" {...field} /></FormControl>{err('name') && <p role="alert" className="text-sm text-destructive">{t(String(err('name')))}</p>}</FormItem>)} />
        <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel htmlFor="reg-email">{t('account.email')}</FormLabel><FormControl><Input id="reg-email" type="email" autoComplete="email" {...field} /></FormControl>{err('email') && <p role="alert" className="text-sm text-destructive">{t(String(err('email')))}</p>}</FormItem>)} />
        <FormField control={form.control} name="password" render={({ field }) => (<FormItem><FormLabel htmlFor="reg-password">{t('account.password')}</FormLabel><FormControl><PasswordInput id="reg-password" autoComplete="new-password" {...field} /></FormControl>{err('password') && <p role="alert" className="text-sm text-destructive">{t(String(err('password')))}</p>}</FormItem>)} />
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>{t('account.register')}</Button>
      </form>
    </Form>
  );
}
