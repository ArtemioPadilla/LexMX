// accept-invite · turns an invite token into an org membership (plan § 11.9).
// The browser only ever sees the plaintext token in the link; the table holds
// its SHA-256. The caller must be signed in with the invited email. Writes use
// the service key here because org_members is admin-managed under RLS.
import { json, preflight, serviceClient, userClient } from '../_shared/client.ts';

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const caller = userClient(req);
  if (!caller) return json({ error: 'unauthenticated' }, 401);
  const { data: me } = await caller.auth.getUser();
  const email = me.user?.email?.toLowerCase();
  if (!me.user || !email) return json({ error: 'unauthenticated' }, 401);

  let token = '';
  try {
    token = String(((await req.json()) as { token?: unknown }).token ?? '');
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (token.length < 20) return json({ error: 'bad request' }, 400);

  const admin = serviceClient();
  const { data: invite } = await admin
    .from('invites')
    .select('id, org_id, email, role, expires_at, accepted_at')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle();
  if (!invite) return json({ error: 'invite not found' }, 404);
  if (invite.accepted_at) return json({ error: 'invite already used' }, 409);
  if (new Date(invite.expires_at).getTime() < Date.now()) return json({ error: 'invite expired' }, 410);
  if (invite.email.toLowerCase() !== email) return json({ error: 'invite is for another email' }, 403);

  const { error: memberError } = await admin
    .from('org_members')
    .upsert({ org_id: invite.org_id, user_id: me.user.id, role: invite.role }, { onConflict: 'org_id,user_id' });
  if (memberError) return json({ error: memberError.message }, 500);
  // audit_log rows come from the triggers on org_members and invites (0003).
  await admin.from('invites').update({ accepted_at: new Date().toISOString() }).eq('id', invite.id);

  return json({ orgId: invite.org_id, role: invite.role });
});
