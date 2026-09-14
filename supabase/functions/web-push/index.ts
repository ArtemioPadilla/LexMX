// web-push · delivers pending `notifications` rows to the user's push
// subscriptions (plan § 11.9). Invoked by pg_cron (`select net.http_post(...)`)
// or manually. VAPID keys live in the function's secrets.
import webpush from 'npm:web-push@3';
import { json, preflight, serviceClient } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const secret = Deno.env.get('CRON_SECRET');
  if (secret && req.headers.get('x-cron-secret') !== secret) return json({ error: 'forbidden' }, 403);

  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:hola@lexmx.mx';
  if (!pub || !priv) return json({ error: 'VAPID keys not configured' }, 500);
  webpush.setVapidDetails(subject, pub, priv);

  const supabase = serviceClient();
  const { data: pending, error } = await supabase
    .from('notifications')
    .select('id, user_id, title, body, url')
    .is('delivered_at', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) return json({ error: error.message }, 500);

  let sent = 0;
  const stale: string[] = [];
  for (const n of pending ?? []) {
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', n.user_id);
    for (const s of subs ?? []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title: n.title, body: n.body, url: n.url }),
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(s.id);
      }
    }
    await supabase.from('notifications').update({ delivered_at: new Date().toISOString() }).eq('id', n.id);
  }
  if (stale.length) await supabase.from('push_subscriptions').delete().in('id', stale);
  return json({ processed: pending?.length ?? 0, sent, removedSubscriptions: stale.length });
});
