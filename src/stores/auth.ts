/**
 * Session shared across islands (plan § 11.9). `$session` mirrors Supabase
 * Auth; `$guardUser` adapts it ONCE to the GuardUser the route guard reads.
 * Roles come from `app_metadata.roles` (set server-side), never from the
 * client. Without a configured server both stay null and `$authReady` is
 * true immediately.
 */
import { atom, computed, onMount } from 'nanostores';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { GuardUser } from '@/lib/route-guard';

export const $session = atom<Session | null>(null);
export const $authReady = atom(false);

export function toGuardUser(session: Session | null): GuardUser | null {
  if (!session?.user) return null;
  const meta = (session.user.app_metadata ?? {}) as { roles?: unknown; flags?: unknown };
  const roles = Array.isArray(meta.roles) ? meta.roles.filter((r): r is string => typeof r === 'string') : [];
  const flags: Record<string, boolean | undefined> = {};
  if (meta.flags && typeof meta.flags === 'object') {
    for (const [k, v] of Object.entries(meta.flags as Record<string, unknown>)) flags[k] = v === true ? true : undefined;
  }
  flags.emailVerified = session.user.email_confirmed_at ? true : undefined;
  return { id: session.user.id, roles, flags };
}

export const $guardUser = computed($session, toGuardUser);

onMount($session, () => {
  if (!supabase) {
    $authReady.set(true);
    return;
  }
  void supabase.auth.getSession().then(({ data }) => {
    $session.set(data.session);
    $authReady.set(true);
  });
  const { data } = supabase.auth.onAuthStateChange((_event, session) => $session.set(session));
  return () => data.subscription.unsubscribe();
});
