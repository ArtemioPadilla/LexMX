/**
 * Organizations, seats and invites on LexMX Servidor (plan § 11.9, línea D).
 *
 * Thin, typed wrappers over the Supabase client. Row Level Security is the
 * boundary: these functions never bypass it, and the caller's session decides
 * what each query returns. Nothing here runs without a configured server.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type OrgRole = 'owner' | 'admin' | 'member' | 'viewer';
export const ORG_ROLES: readonly OrgRole[] = ['owner', 'admin', 'member', 'viewer'];
/** Roles an admin may grant (owner is only set by the creation trigger). */
export const ASSIGNABLE_ROLES: readonly OrgRole[] = ['admin', 'member', 'viewer'];

export interface Org {
  id: string;
  name: string;
  slug: string;
  jurisdiction: string;
  createdAt: string;
  /** The caller's role in this org. */
  role: OrgRole;
}

export interface OrgMember {
  orgId: string;
  userId: string;
  role: OrgRole;
  createdAt: string;
}

export interface Invite {
  id: string;
  orgId: string;
  email: string;
  role: OrgRole;
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
}

interface OrgMembershipRow {
  role: OrgRole;
  orgs: { id: string; name: string; slug: string; jurisdiction: string; created_at: string } | null;
}

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
}

/** Whether `role` may manage members and invites (explicit allowlist). */
export function canManage(role: OrgRole | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export async function listMyOrgs(client: SupabaseClient): Promise<Org[]> {
  const { data, error } = await client
    .from('org_members')
    .select('role, orgs(id, name, slug, jurisdiction, created_at)')
    .order('created_at', { ascending: true });
  fail(error);
  const rows = (data ?? []) as unknown as OrgMembershipRow[];
  return rows
    .filter((r): r is OrgMembershipRow & { orgs: NonNullable<OrgMembershipRow['orgs']> } => r.orgs !== null)
    .map((r) => ({
      id: r.orgs.id,
      name: r.orgs.name,
      slug: r.orgs.slug,
      jurisdiction: r.orgs.jurisdiction,
      createdAt: r.orgs.created_at,
      role: r.role,
    }));
}

export async function createOrg(
  client: SupabaseClient,
  input: { name: string; jurisdiction: string; slug?: string },
): Promise<Org> {
  const slug = input.slug ?? slugify(input.name);
  if (!slug) throw new Error('invalid slug');
  const { data, error } = await client
    .from('orgs')
    .insert({ name: input.name.trim(), slug, jurisdiction: input.jurisdiction })
    .select('id, name, slug, jurisdiction, created_at')
    .single();
  fail(error);
  const row = data as { id: string; name: string; slug: string; jurisdiction: string; created_at: string };
  return { id: row.id, name: row.name, slug: row.slug, jurisdiction: row.jurisdiction, createdAt: row.created_at, role: 'owner' };
}

export async function listMembers(client: SupabaseClient, orgId: string): Promise<OrgMember[]> {
  const { data, error } = await client
    .from('org_members')
    .select('org_id, user_id, role, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true });
  fail(error);
  return ((data ?? []) as Array<{ org_id: string; user_id: string; role: OrgRole; created_at: string }>).map((r) => ({
    orgId: r.org_id,
    userId: r.user_id,
    role: r.role,
    createdAt: r.created_at,
  }));
}

export async function updateMemberRole(client: SupabaseClient, orgId: string, userId: string, role: OrgRole): Promise<void> {
  if (!ASSIGNABLE_ROLES.includes(role)) throw new Error('role not assignable');
  const { error } = await client.from('org_members').update({ role }).eq('org_id', orgId).eq('user_id', userId);
  fail(error);
}

export async function removeMember(client: SupabaseClient, orgId: string, userId: string): Promise<void> {
  const { error } = await client.from('org_members').delete().eq('org_id', orgId).eq('user_id', userId);
  fail(error);
}

export async function listInvites(client: SupabaseClient, orgId: string): Promise<Invite[]> {
  const { data, error } = await client
    .from('invites')
    .select('id, org_id, email, role, expires_at, accepted_at, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as Array<{ id: string; org_id: string; email: string; role: OrgRole; expires_at: string; accepted_at: string | null; created_at: string }>).map((r) => ({
    id: r.id,
    orgId: r.org_id,
    email: r.email,
    role: r.role,
    expiresAt: r.expires_at,
    acceptedAt: r.accepted_at,
    createdAt: r.created_at,
  }));
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Creates an invite. Only the SHA-256 of the token is stored; the plaintext
 * token goes into the link the admin shares and is validated by the
 * `accept-invite` Edge Function.
 */
export async function createInvite(
  client: SupabaseClient,
  input: { orgId: string; email: string; role: Exclude<OrgRole, 'owner'> },
): Promise<{ invite: Invite; token: string }> {
  if (!ASSIGNABLE_ROLES.includes(input.role)) throw new Error('role not assignable');
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = base64url(bytes);
  const tokenHash = await sha256Hex(token);
  const { data, error } = await client
    .from('invites')
    .insert({ org_id: input.orgId, email: input.email.trim().toLowerCase(), role: input.role, token_hash: tokenHash })
    .select('id, org_id, email, role, expires_at, accepted_at, created_at')
    .single();
  fail(error);
  const r = data as { id: string; org_id: string; email: string; role: OrgRole; expires_at: string; accepted_at: string | null; created_at: string };
  return {
    invite: { id: r.id, orgId: r.org_id, email: r.email, role: r.role, expiresAt: r.expires_at, acceptedAt: r.accepted_at, createdAt: r.created_at },
    token,
  };
}

export async function revokeInvite(client: SupabaseClient, inviteId: string): Promise<void> {
  const { error } = await client.from('invites').delete().eq('id', inviteId);
  fail(error);
}

export function inviteLink(origin: string, basePath: string, token: string): string {
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`;
  return `${origin}${base}cuenta?invite=${encodeURIComponent(token)}`;
}

/** Accepts an invite through the `accept-invite` Edge Function (service key stays there). */
export async function acceptInvite(client: SupabaseClient, token: string): Promise<{ orgId: string; role: OrgRole }> {
  const { data, error } = await client.functions.invoke<{ orgId: string; role: OrgRole; error?: string }>('accept-invite', { body: { token } });
  if (error) throw new Error(error.message);
  if (!data || data.error) throw new Error(data?.error ?? 'invite rejected');
  return { orgId: data.orgId, role: data.role };
}
