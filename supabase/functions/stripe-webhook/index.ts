// stripe-webhook · keeps `subscriptions` in sync with Stripe (plan § 11.9).
// The browser never writes subscriptions; this function is the only writer,
// with the service key. Local payment providers (OXXO/SPEI, Mercado Pago, Pix)
// get sibling functions `payments-<país>` following the same shape.
import Stripe from 'npm:stripe@17';
import { json, serviceClient } from '../_shared/client.ts';

const STATUS: Record<string, string> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  canceled: 'canceled',
  unpaid: 'past_due',
  paused: 'paused',
  incomplete: 'trialing',
  incomplete_expired: 'canceled',
};

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = Deno.env.get('STRIPE_SECRET_KEY');
  const whsec = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!key || !whsec) return json({ error: 'Stripe not configured' }, 500);
  const stripe = new Stripe(key, { apiVersion: '2024-12-18.acacia' });

  const sig = req.headers.get('stripe-signature') ?? '';
  const payload = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, sig, whsec);
  } catch (e) {
    return json({ error: `signature: ${(e as Error).message}` }, 400);
  }

  if (!event.type.startsWith('customer.subscription.')) return json({ ignored: event.type });
  const sub = event.data.object as Stripe.Subscription;
  const meta = sub.metadata ?? {};
  const target = meta.org_id ? { org_id: meta.org_id } : meta.user_id ? { user_id: meta.user_id } : null;
  if (!target) return json({ error: 'subscription without org_id/user_id metadata' }, 422);

  const supabase = serviceClient();
  const { error } = await supabase.from('subscriptions').upsert(
    {
      ...target,
      plan: meta.plan ?? 'pro',
      status: STATUS[sub.status] ?? 'trialing',
      seats: sub.items.data[0]?.quantity ?? 1,
      provider: 'stripe',
      external_id: sub.id,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    },
    { onConflict: meta.org_id ? 'org_id' : 'user_id' },
  );
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
});
