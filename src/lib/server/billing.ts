/**
 * Plan and usage on LexMX Servidor (plan § 11.9, línea D). Read-only from
 * the browser: subscriptions and usage are written by Edge Functions
 * (payment-provider webhooks) with the service key.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export type Plan = 'free' | 'pro' | 'team' | 'enterprise';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'paused';

export interface Subscription {
  id: string;
  plan: Plan;
  status: SubscriptionStatus;
  seats: number;
  provider: string;
  currentPeriodEnd: string | null;
}

export interface Usage {
  period: string;
  queries: number;
  documents: number;
  tokensIn: number;
  tokensOut: number;
}

export type BillingScope = { userId: string } | { orgId: string };

/** Included quotas per plan, shown next to usage. Server-side limits live in the Edge Functions. */
export const PLAN_QUOTAS: Record<Plan, { queries: number; documents: number; seats: number }> = {
  free: { queries: 50, documents: 5, seats: 1 },
  pro: { queries: 1000, documents: 200, seats: 1 },
  team: { queries: 10000, documents: 2000, seats: 10 },
  enterprise: { queries: Number.POSITIVE_INFINITY, documents: Number.POSITIVE_INFINITY, seats: Number.POSITIVE_INFINITY },
};

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

function scopeColumn(scope: BillingScope): { column: 'user_id' | 'org_id'; value: string } {
  return 'orgId' in scope ? { column: 'org_id', value: scope.orgId } : { column: 'user_id', value: scope.userId };
}

/** First day of the current month, as the `usage.period` date string. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}

export async function getSubscription(client: SupabaseClient, scope: BillingScope): Promise<Subscription | null> {
  const { column, value } = scopeColumn(scope);
  const { data, error } = await client
    .from('subscriptions')
    .select('id, plan, status, seats, provider, current_period_end')
    .eq(column, value)
    .maybeSingle();
  fail(error);
  if (!data) return null;
  const r = data as { id: string; plan: Plan; status: SubscriptionStatus; seats: number; provider: string; current_period_end: string | null };
  return { id: r.id, plan: r.plan, status: r.status, seats: r.seats, provider: r.provider, currentPeriodEnd: r.current_period_end };
}

export async function getUsage(client: SupabaseClient, scope: BillingScope, period = currentPeriod()): Promise<Usage> {
  const { column, value } = scopeColumn(scope);
  const { data, error } = await client
    .from('usage')
    .select('period, queries, documents, tokens_in, tokens_out')
    .eq(column, value)
    .eq('period', period)
    .maybeSingle();
  fail(error);
  const r = (data ?? null) as { period: string; queries: number; documents: number; tokens_in: number; tokens_out: number } | null;
  return {
    period,
    queries: r?.queries ?? 0,
    documents: r?.documents ?? 0,
    tokensIn: r?.tokens_in ?? 0,
    tokensOut: r?.tokens_out ?? 0,
  };
}

/** Effective plan when there is no subscription row: free. */
export function effectivePlan(sub: Subscription | null): Plan {
  if (!sub) return 'free';
  return sub.status === 'active' || sub.status === 'trialing' ? sub.plan : 'free';
}

export function usageRatio(used: number, quota: number): number {
  if (!Number.isFinite(quota) || quota <= 0) return 0;
  return Math.min(1, used / quota);
}
