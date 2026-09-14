/**
 * Court, gazette and reform monitoring on LexMX Servidor (plan § 11.9).
 * The user registers WHAT to watch; adapters write events with the service
 * key; RLS limits reads to the owner (or org members).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { ADAPTERS } from '@/lib/monitoring/adapters';

export interface WatchedCase {
  id: string;
  jurisdiction: string;
  court: string;
  expediente: string;
  label: string;
  active: boolean;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface CourtEvent {
  id: string;
  caseId: string;
  occurredAt: string;
  kind: string;
  summary: string;
  sourceUrl: string | null;
  seenAt: string | null;
}

export interface LawWatch {
  jurisdiction: string;
  docId: string;
  notifyPush: boolean;
  notifyEmail: boolean;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  url: string | null;
  createdAt: string;
  readAt: string | null;
}

/** Court adapters known per jurisdiction (ids match `src/lib/monitoring/adapters.ts`, what the scheduled job runs). */
export const COURT_ADAPTERS: Record<string, ReadonlyArray<{ id: string; name: string }>> = {
  mx: ADAPTERS.map((a) => ({ id: a.id, name: a.name })),
};

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function listWatchedCases(client: SupabaseClient): Promise<WatchedCase[]> {
  const { data, error } = await client
    .from('watched_cases')
    .select('id, jurisdiction, court, expediente, label, active, last_checked_at, created_at')
    .order('created_at', { ascending: false });
  fail(error);
  return ((data ?? []) as Array<{ id: string; jurisdiction: string; court: string; expediente: string; label: string; active: boolean; last_checked_at: string | null; created_at: string }>).map((r) => ({
    id: r.id,
    jurisdiction: r.jurisdiction,
    court: r.court,
    expediente: r.expediente,
    label: r.label,
    active: r.active,
    lastCheckedAt: r.last_checked_at,
    createdAt: r.created_at,
  }));
}

export async function addWatchedCase(
  client: SupabaseClient,
  input: { jurisdiction: string; court: string; expediente: string; label?: string; orgId?: string | null },
): Promise<void> {
  const expediente = input.expediente.trim();
  if (!expediente) throw new Error('expediente required');
  const { error } = await client.from('watched_cases').insert({
    jurisdiction: input.jurisdiction,
    court: input.court,
    expediente,
    label: (input.label ?? '').trim(),
    org_id: input.orgId ?? null,
  });
  fail(error);
}

export async function setWatchedCaseActive(client: SupabaseClient, id: string, active: boolean): Promise<void> {
  const { error } = await client.from('watched_cases').update({ active }).eq('id', id);
  fail(error);
}

export async function removeWatchedCase(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('watched_cases').delete().eq('id', id);
  fail(error);
}

export async function listCourtEvents(client: SupabaseClient, caseId: string, limit = 50): Promise<CourtEvent[]> {
  const { data, error } = await client
    .from('court_events')
    .select('id, case_id, occurred_at, kind, summary, source_url, seen_at')
    .eq('case_id', caseId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  fail(error);
  return ((data ?? []) as Array<{ id: string; case_id: string; occurred_at: string; kind: string; summary: string; source_url: string | null; seen_at: string | null }>).map((r) => ({
    id: r.id,
    caseId: r.case_id,
    occurredAt: r.occurred_at,
    kind: r.kind,
    summary: r.summary,
    sourceUrl: r.source_url,
    seenAt: r.seen_at,
  }));
}

export async function listLawWatches(client: SupabaseClient): Promise<LawWatch[]> {
  const { data, error } = await client.from('law_watches').select('jurisdiction, doc_id, notify_push, notify_email');
  fail(error);
  return ((data ?? []) as Array<{ jurisdiction: string; doc_id: string; notify_push: boolean; notify_email: boolean }>).map((r) => ({
    jurisdiction: r.jurisdiction,
    docId: r.doc_id,
    notifyPush: r.notify_push,
    notifyEmail: r.notify_email,
  }));
}

export async function watchLaw(client: SupabaseClient, jurisdiction: string, docId: string): Promise<void> {
  const { error } = await client.from('law_watches').upsert({ jurisdiction, doc_id: docId }, { onConflict: 'user_id,jurisdiction,doc_id' });
  fail(error);
}

export async function unwatchLaw(client: SupabaseClient, jurisdiction: string, docId: string): Promise<void> {
  const { error } = await client.from('law_watches').delete().eq('jurisdiction', jurisdiction).eq('doc_id', docId);
  fail(error);
}

export async function listNotifications(client: SupabaseClient, limit = 30): Promise<Notification[]> {
  const { data, error } = await client
    .from('notifications')
    .select('id, kind, title, body, url, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  fail(error);
  return ((data ?? []) as Array<{ id: string; kind: string; title: string; body: string; url: string | null; created_at: string; read_at: string | null }>).map((r) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    body: r.body,
    url: r.url,
    createdAt: r.created_at,
    readAt: r.read_at,
  }));
}

export async function markNotificationRead(client: SupabaseClient, id: string): Promise<void> {
  const { error } = await client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  fail(error);
}
