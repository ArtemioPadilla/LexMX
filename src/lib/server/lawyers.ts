/**
 * Verified lawyer directory and referrals on LexMX Servidor (plan § 11.9,
 * línea D). RLS shows the public only verified profiles; a lawyer edits
 * their own profile; verification is set by an operator with the service
 * key. Referrals never carry the expediente: only a short summary the user
 * writes, and the user chooses whom to contact.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface LawyerProfile {
  userId: string;
  jurisdiction: string;
  entityCode: string | null;
  areas: string[];
  headline: string;
  bio: string;
  languages: string[];
  contactEmail: string | null;
  verifiedAt: string | null;
  acceptingClients: boolean;
}

export interface Referral {
  id: string;
  jurisdiction: string;
  entityCode: string | null;
  area: string;
  summary: string;
  status: 'open' | 'matched' | 'closed';
  lawyerId: string | null;
  createdAt: string;
}

interface ProfileRow {
  user_id: string;
  jurisdiction: string;
  entity_code: string | null;
  areas: string[];
  headline: string;
  bio: string;
  languages: string[];
  contact_email: string | null;
  verified_at: string | null;
  accepting_clients: boolean;
}

const PROFILE_COLUMNS = 'user_id, jurisdiction, entity_code, areas, headline, bio, languages, contact_email, verified_at, accepting_clients';

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function toProfile(r: ProfileRow): LawyerProfile {
  return {
    userId: r.user_id,
    jurisdiction: r.jurisdiction,
    entityCode: r.entity_code,
    areas: r.areas ?? [],
    headline: r.headline,
    bio: r.bio,
    languages: r.languages ?? [],
    contactEmail: r.contact_email,
    verifiedAt: r.verified_at,
    acceptingClients: r.accepting_clients,
  };
}

export interface DirectoryFilter {
  jurisdiction: string;
  entityCode?: string;
  area?: string;
  acceptingOnly?: boolean;
}

/** Verified profiles matching the filter (RLS already hides unverified ones from other users). */
export async function listVerifiedLawyers(client: SupabaseClient, filter: DirectoryFilter, limit = 50): Promise<LawyerProfile[]> {
  let q = client.from('lawyer_profiles').select(PROFILE_COLUMNS).eq('jurisdiction', filter.jurisdiction).not('verified_at', 'is', null);
  if (filter.entityCode) q = q.eq('entity_code', filter.entityCode);
  if (filter.area) q = q.contains('areas', [filter.area]);
  if (filter.acceptingOnly !== false) q = q.eq('accepting_clients', true);
  const { data, error } = await q.order('verified_at', { ascending: false }).limit(limit);
  fail(error);
  return ((data ?? []) as unknown as ProfileRow[]).map(toProfile);
}

export async function getMyProfile(client: SupabaseClient, userId: string): Promise<LawyerProfile | null> {
  const { data, error } = await client.from('lawyer_profiles').select(PROFILE_COLUMNS).eq('user_id', userId).maybeSingle();
  fail(error);
  return data ? toProfile(data as unknown as ProfileRow) : null;
}

export interface ProfileInput {
  jurisdiction: string;
  entityCode: string | null;
  areas: string[];
  headline: string;
  bio: string;
  languages: string[];
  contactEmail: string | null;
  acceptingClients: boolean;
}

/** Validates the editable fields against the schema's own limits. */
export function validateProfile(input: ProfileInput): string[] {
  const errors: string[] = [];
  if (input.headline.trim().length === 0 || input.headline.length > 160) errors.push('headline');
  if (input.bio.length > 2000) errors.push('bio');
  if (input.areas.length === 0) errors.push('areas');
  const email = input.contactEmail?.trim() ?? '';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('contactEmail');
  return errors;
}

/** Creates or updates the caller's profile; `verified_at` is never sent (RLS rejects it anyway). */
export async function upsertMyProfile(client: SupabaseClient, input: ProfileInput): Promise<void> {
  const errors = validateProfile(input);
  if (errors.length) throw new Error(`invalid profile: ${errors.join(', ')}`);
  const { error } = await client.from('lawyer_profiles').upsert(
    {
      jurisdiction: input.jurisdiction,
      entity_code: input.entityCode,
      areas: input.areas,
      headline: input.headline.trim(),
      bio: input.bio.trim(),
      languages: input.languages,
      contact_email: input.contactEmail?.trim().toLowerCase() || null,
      accepting_clients: input.acceptingClients,
    },
    { onConflict: 'user_id' },
  );
  fail(error);
}

export async function deleteMyProfile(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.from('lawyer_profiles').delete().eq('user_id', userId);
  fail(error);
}

export interface ReferralInput {
  jurisdiction: string;
  entityCode: string | null;
  area: string;
  summary: string;
  lawyerId?: string | null;
}

/** Opens a referral request with a short summary (10–1000 chars); never the case file. */
export async function createReferral(client: SupabaseClient, input: ReferralInput): Promise<void> {
  const summary = input.summary.trim();
  if (summary.length < 10 || summary.length > 1000) throw new Error('summary length');
  const { error } = await client.from('referrals').insert({
    jurisdiction: input.jurisdiction,
    entity_code: input.entityCode,
    area: input.area,
    summary,
    lawyer_id: input.lawyerId ?? null,
    status: input.lawyerId ? 'matched' : 'open',
  });
  fail(error);
}

export async function listMyReferrals(client: SupabaseClient): Promise<Referral[]> {
  const { data, error } = await client
    .from('referrals')
    .select('id, jurisdiction, entity_code, area, summary, status, lawyer_id, created_at')
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as Array<{ id: string; jurisdiction: string; entity_code: string | null; area: string; summary: string; status: Referral['status']; lawyer_id: string | null; created_at: string }>).map((r) => ({
    id: r.id,
    jurisdiction: r.jurisdiction,
    entityCode: r.entity_code,
    area: r.area,
    summary: r.summary,
    status: r.status,
    lawyerId: r.lawyer_id,
    createdAt: r.created_at,
  }));
}

export async function closeReferral(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('referrals').update({ status: 'closed' }).eq('id', id);
  fail(error);
}
