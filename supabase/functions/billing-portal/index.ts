// billing-portal · Stripe Checkout and Customer Portal links (plan § 11.9,
// línea D). The browser never sees Stripe keys: it asks this function for a
// URL and redirects. `stripe-webhook` remains the only writer of
// `subscriptions`; this function only creates sessions.
//
// POST { action: 'checkout', plan: 'pro'|'team', orgId?: string, seats?: number }
// POST { action: 'portal', orgId?: string }
// Env: STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM, SITE_URL
import Stripe from 'npm:stripe@17';
import { json, preflight, serviceClient, userClient } from '../_shared/client.ts';

const PLANS: Record<string, string | undefined> = {
  pro: Deno.env.get('STRIPE_PRICE_PRO'),
  team: Deno.env.get('STRIPE_PRICE_TEAM'),
};

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const key = Deno.env.get('STRIPE_SECRET_KEY');
  const site = (Deno.env.get('SITE_URL') ?? 'https://artemiopadilla.github.io/LexMX').replace(/\/$/, '');
  if (!key) return json({ error: 'billing not configured' }, 503);

  const caller = userClient(req);
  if (!caller) return json({ error: 'unauthenticated' }, 401);
  const { data: me } = await caller.auth.getUser();
  if (!me.user?.email) return json({ error: 'unauthenticated' }, 401);

  let body: { action?: string; plan?: string; orgId?: string; seats?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: 'bad request' }, 400);
  }

  const admin = serviceClient();
  // Org billing requires owner/admin (RLS on org_members enforces membership; role is checked here).
  if (body.orgId) {
    const { data: member } = await admin
      .from('org_members')
      .select('role')
      .eq('org_id', body.orgId)
      .eq('user_id', me.user.id)
      .maybeSingle();
    if (!member || !['owner', 'admin'].includes(member.role)) return json({ error: 'forbidden' }, 403);
  }

  const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });
  const scope = body.orgId ? { column: 'org_id', value: body.orgId } : { column: 'user_id', value: me.user.id };
  const { data: sub } = await admin
    .from('subscriptions')
    .select('external_id, provider')
    .eq(scope.column, scope.value)
    .maybeSingle();

  // Stripe customer id is stored as `external_id` (cus_...) or derived from the subscription.
  let customerId: string | undefined;
  if (sub?.provider === 'stripe' && sub.external_id) {
    if (sub.external_id.startsWith('cus_')) customerId = sub.external_id;
    else if (sub.external_id.startsWith('sub_')) {
      const s = await stripe.subscriptions.retrieve(sub.external_id);
      customerId = typeof s.customer === 'string' ? s.customer : s.customer.id;
    }
  }

  if (body.action === 'portal') {
    if (!customerId) return json({ error: 'no subscription' }, 404);
    const session = await stripe.billingPortal.sessions.create({ customer: customerId, return_url: `${site}/cuenta` });
    return json({ url: session.url });
  }

  if (body.action === 'checkout') {
    const price = PLANS[body.plan ?? ''];
    if (!price) return json({ error: 'unknown plan' }, 400);
    const seats = body.plan === 'team' ? Math.max(1, Math.min(500, Number(body.seats ?? 1))) : 1;
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      customer_email: customerId ? undefined : me.user.email,
      line_items: [{ price, quantity: seats }],
      success_url: `${site}/cuenta?billing=success`,
      cancel_url: `${site}/cuenta?billing=cancel`,
      // The webhook reads these to attach the subscription to the right row.
      subscription_data: { metadata: { user_id: body.orgId ? '' : me.user.id, org_id: body.orgId ?? '', plan: body.plan ?? '' } },
      metadata: { user_id: body.orgId ? '' : me.user.id, org_id: body.orgId ?? '', plan: body.plan ?? '' },
    });
    return json({ url: session.url });
  }

  return json({ error: 'unknown action' }, 400);
});
