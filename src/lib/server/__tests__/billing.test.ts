import { describe, expect, it } from 'vitest';
import { fakeClient } from './fake-client';
import { PLAN_QUOTAS, currentPeriod, effectivePlan, getSubscription, getUsage, usageRatio } from '../billing';

describe('billing', () => {
  it('currentPeriod is the first day of the UTC month', () => {
    expect(currentPeriod(new Date('2026-09-14T23:00:00Z'))).toBe('2026-09-01');
    expect(currentPeriod(new Date('2026-01-31T12:00:00Z'))).toBe('2026-01-01');
  });

  it('effectivePlan falls back to free unless active or trialing', () => {
    expect(effectivePlan(null)).toBe('free');
    expect(effectivePlan({ id: '1', plan: 'pro', status: 'active', seats: 1, provider: 'stripe', currentPeriodEnd: null })).toBe('pro');
    expect(effectivePlan({ id: '1', plan: 'team', status: 'trialing', seats: 5, provider: 'stripe', currentPeriodEnd: null })).toBe('team');
    expect(effectivePlan({ id: '1', plan: 'pro', status: 'past_due', seats: 1, provider: 'stripe', currentPeriodEnd: null })).toBe('free');
    expect(effectivePlan({ id: '1', plan: 'pro', status: 'canceled', seats: 1, provider: 'stripe', currentPeriodEnd: null })).toBe('free');
  });

  it('usageRatio clamps and treats unlimited quotas as 0', () => {
    expect(usageRatio(25, 50)).toBe(0.5);
    expect(usageRatio(80, 50)).toBe(1);
    expect(usageRatio(5, PLAN_QUOTAS.enterprise.queries)).toBe(0);
  });

  it('getSubscription filters by org or user and maps columns', async () => {
    const { client, log } = fakeClient([{ data: { id: 's', plan: 'team', status: 'active', seats: 10, provider: 'stripe', current_period_end: '2026-10-01' } }]);
    const sub = await getSubscription(client, { orgId: 'o1' });
    expect(sub?.currentPeriodEnd).toBe('2026-10-01');
    expect(log[0]?.calls).toContainEqual(['eq', ['org_id', 'o1']]);
  });

  it('getUsage returns zeros when there is no row for the period', async () => {
    const { client, log } = fakeClient([{ data: null }]);
    const usage = await getUsage(client, { userId: 'u1' }, '2026-09-01');
    expect(usage).toEqual({ period: '2026-09-01', queries: 0, documents: 0, tokensIn: 0, tokensOut: 0 });
    expect(log[0]?.calls).toContainEqual(['eq', ['user_id', 'u1']]);
    expect(log[0]?.calls).toContainEqual(['eq', ['period', '2026-09-01']]);
  });
});
