import { describe, expect, it } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { toGuardUser } from '../auth';

function session(app_metadata: Record<string, unknown>, confirmed = true): Session {
  return { user: { id: 'u1', app_metadata, user_metadata: {}, aud: 'x', created_at: '', email_confirmed_at: confirmed ? '2026-01-01' : undefined }, access_token: 'a', refresh_token: 'r', expires_in: 1, token_type: 'bearer' } as unknown as Session;
}

describe('toGuardUser', () => {
  it('maps roles and only explicit true flags from app_metadata', () => {
    const u = toGuardUser(session({ roles: ['admin', 3], flags: { verified: true, beta: 'yes' } }));
    expect(u).toEqual({ id: 'u1', roles: ['admin'], flags: { verified: true, beta: undefined, emailVerified: true } });
  });

  it('returns null without a session and no roles by default', () => {
    expect(toGuardUser(null)).toBeNull();
    expect(toGuardUser(session({}, false))?.roles).toEqual([]);
    expect(toGuardUser(session({}, false))?.flags?.emailVerified).toBeUndefined();
  });
});
