/**
 * Organizations & seats (plan § 11.9, línea D). Everything here talks to
 * LexMX Servidor; RLS decides what the session can see. Management actions
 * are only offered to owner/admin (explicit allowlist via `canManage`).
 */
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CopyIcon, PlusIcon, UsersIcon } from 'lucide-react';
import { useTranslation } from '@/i18n';
import { listJurisdictions } from '@/jurisdictions';
import {
  ASSIGNABLE_ROLES,
  canManage,
  createInvite,
  createOrg,
  inviteLink,
  listInvites,
  listMembers,
  listMyOrgs,
  removeMember,
  revokeInvite,
  updateMemberRole,
  type Invite,
  type Org,
  type OrgMember,
  type OrgRole,
} from '@/lib/server/orgs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Callout } from '@/components/ui/callout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const selectClass = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

export function OrgPanel({ client, userId }: { client: SupabaseClient; userId: string }) {
  const { t } = useTranslation();
  const [orgs, setOrgs] = useState<Org[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  async function reload() {
    try {
      const list = await listMyOrgs(client);
      setOrgs(list);
      setSelected((s) => s ?? list[0]?.id ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setOrgs([]);
    }
  }
  useEffect(() => { void reload(); }, []);

  if (orgs === null) return <Skeleton className="h-32 w-full" />;
  const org = orgs.find((o) => o.id === selected) ?? null;

  return (
    <section className="space-y-4" aria-labelledby="orgs-title">
      <div>
        <h2 id="orgs-title" className="text-lg font-semibold">{t('account.orgs.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('account.orgs.intro')}</p>
      </div>
      {error && <Callout title="Error" variant="error" className="text-sm">{t('account.orgs.loadError', { error })}</Callout>}
      <div className="flex flex-wrap items-center gap-2">
        {orgs.length > 0 && (
          <select aria-label={t('account.orgs.title')} className={selectClass} value={selected ?? ''} onChange={(e) => setSelected(e.target.value)}>
            {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} · {t(`account.orgs.roles.${o.role}`)}</option>)}
          </select>
        )}
        <Button size="sm" variant={orgs.length ? 'outline' : 'default'} onClick={() => setShowCreate((v) => !v)}>
          <PlusIcon className="mr-1 h-4 w-4" aria-hidden="true" />{t('account.orgs.create')}
        </Button>
      </div>
      {showCreate && (
        <CreateOrgForm
          client={client}
          onCreated={(o) => { setShowCreate(false); setSelected(o.id); void reload(); }}
        />
      )}
      {orgs.length === 0 && !showCreate && (
        <EmptyState icon={<UsersIcon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />} title={t('account.orgs.none')} />
      )}
      {org && <OrgDetail key={org.id} client={client} org={org} userId={userId} onChanged={() => void reload()} />}
    </section>
  );
}

function CreateOrgForm({ client, onCreated }: { client: SupabaseClient; onCreated: (o: Org) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [jurisdiction, setJurisdiction] = useState('mx');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onCreated(await createOrg(client, { name, jurisdiction }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
      <div className="space-y-1">
        <Label htmlFor="org-name">{t('account.orgs.name')}</Label>
        <Input id="org-name" required minLength={1} maxLength={120} placeholder={t('account.orgs.namePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="org-jurisdiction">{t('account.orgs.jurisdiction')}</Label>
        <select id="org-jurisdiction" className={selectClass} value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
          {listJurisdictions().map((j) => <option key={j.code} value={j.code}>{j.name}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={busy || !name.trim()}>{busy ? t('account.orgs.creating') : t('account.orgs.create')}</Button>
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-3">{error}</p>}
    </form>
  );
}

function OrgDetail({ client, org, userId, onChanged }: { client: SupabaseClient; org: Org; userId: string; onChanged: () => void }) {
  const { t } = useTranslation();
  const manage = canManage(org.role);
  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<OrgRole, 'owner'>>('member');
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      setMembers(await listMembers(client, org.id));
      setInvites(manage ? await listInvites(client, org.id) : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setMembers([]);
    }
  }
  useEffect(() => { void load(); }, [org.id]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const { token } = await createInvite(client, { orgId: org.id, email: inviteEmail, role: inviteRole });
      setLastLink(inviteLink(window.location.origin, import.meta.env.BASE_URL, token));
      setCopied(false);
      setInviteEmail('');
    });
  }

  if (members === null) return <Skeleton className="h-24 w-full" />;
  const now = Date.now();

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-medium">{org.name}</h3>
        <Badge variant="secondary">{org.slug}</Badge>
        <Badge variant="outline">{org.jurisdiction.toUpperCase()}</Badge>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

      <h4 className="text-sm font-medium">{t('account.orgs.members')}</h4>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>{t('account.orgs.role')}</TableHead>
            <TableHead>{t('account.orgs.since')}</TableHead>
            {manage && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {members.map((m) => (
            <TableRow key={m.userId}>
              <TableCell className="font-mono text-xs">{m.userId.slice(0, 8)}… {m.userId === userId && <Badge variant="secondary">{t('account.orgs.you')}</Badge>}</TableCell>
              <TableCell>
                {manage && m.role !== 'owner' && m.userId !== userId ? (
                  <select aria-label={t('account.orgs.role')} className={selectClass} value={m.role} disabled={busy} onChange={(e) => void run(() => updateMemberRole(client, org.id, m.userId, e.target.value as OrgRole))}>
                    {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{t(`account.orgs.roles.${r}`)}</option>)}
                  </select>
                ) : t(`account.orgs.roles.${m.role}`)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()}</TableCell>
              {manage && (
                <TableCell className="text-right">
                  {m.role !== 'owner' && m.userId !== userId && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => removeMember(client, org.id, m.userId))}>{t('account.orgs.remove')}</Button>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {manage ? (
        <>
          <h4 className="text-sm font-medium">{t('account.orgs.invites')}</h4>
          <form onSubmit={invite} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1 space-y-1">
              <Label htmlFor="invite-email">{t('account.orgs.inviteEmail')}</Label>
              <Input id="invite-email" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <select aria-label={t('account.orgs.role')} className={selectClass} value={inviteRole} onChange={(e) => setInviteRole(e.target.value as Exclude<OrgRole, 'owner'>)}>
              {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{t(`account.orgs.roles.${r}`)}</option>)}
            </select>
            <Button type="submit" size="sm" disabled={busy || !inviteEmail}>{t('account.orgs.invite')}</Button>
          </form>
          {lastLink && (
            <Callout title={t('account.orgs.inviteCreated')} variant="success" className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <code className="break-all text-xs">{lastLink}</code>
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(lastLink).then(() => setCopied(true)); }}>
                  <CopyIcon className="mr-1 h-3 w-3" aria-hidden="true" />{copied ? t('account.orgs.copied') : t('account.orgs.copyLink')}
                </Button>
              </div>
            </Callout>
          )}
          {invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('account.orgs.noInvites')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {invites.map((i) => {
                const state = i.acceptedAt ? 'accepted' : new Date(i.expiresAt).getTime() < now ? 'expired' : 'pending';
                return (
                  <li key={i.id} className="flex flex-wrap items-center gap-2">
                    <span>{i.email}</span>
                    <Badge variant="outline">{t(`account.orgs.roles.${i.role}`)}</Badge>
                    <Badge variant={state === 'pending' ? 'secondary' : state === 'accepted' ? 'default' : 'destructive'}>{t(`account.orgs.${state}`)}</Badge>
                    {state === 'pending' && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => revokeInvite(client, i.id))}>{t('account.orgs.revoke')}</Button>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('account.orgs.readOnly')}</p>
      )}
    </div>
  );
}
