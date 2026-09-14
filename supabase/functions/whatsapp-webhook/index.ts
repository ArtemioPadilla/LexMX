// whatsapp-webhook · Meta Cloud API webhook (plan § 11.9). Only organizations
// that enable the bot reach here; the reply is produced by the same RAG the
// web app uses, run in this function with the ORGANIZATION's provider key.
// The message text is never stored: only aggregated usage via record_usage.
import { json } from '../_shared/client.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // Verification handshake.
  if (req.method === 'GET') {
    const token = Deno.env.get('WHATSAPP_VERIFY_TOKEN');
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === token) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    }
    return json({ error: 'verification failed' }, 403);
  }
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const body = await req.json().catch(() => null) as
    | { entry?: Array<{ changes?: Array<{ value?: { messages?: Array<{ from: string; text?: { body: string } }> } }> }> }
    | null;
  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message?.text?.body) return json({ ignored: true });

  // Resolve the organization that owns this WhatsApp number → its provider key
  // and plan. Table `whatsapp_channels` (org_id, phone_number_id, provider,
  // encrypted_key) arrives with the WhatsApp line of work; until then, reply
  // with a fixed onboarding message so the webhook stays healthy.
  const reply = 'LexMX: este canal aún no está habilitado para tu organización. Usa la aplicación web para consultas.';
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  if (accessToken && phoneId) {
    await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: message.from, text: { body: reply } }),
    });
  }
  return json({ ok: true });
});
