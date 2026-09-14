import { describe, expect, it } from 'vitest';
import { fakeClient } from './fake-client';
import {
  ASSIGNABLE_ROLES,
  acceptInvite,
  canManage,
  createInvite,
  createOrg,
  inviteLink,
  listMyOrgs,
  sha256Hex,
  slugify,
  updateMemberRole,
} from '../orgs';

describe('orgs helpers', () => {
  it('slugify normalizes accents, spaces and length', () => {
    expect(slugify('Despacho Núñez & Asociados')).toBe('despacho-nunez-asociados');
    expect(slugify('   ')).toBe('');
    expect(slugify('a'.repeat(100))).toHaveLength(64);
  });

  it('canManage is an explicit allowlist (deny by default)', () => {
    expect(canManage('owner')).toBe(true);
    expect(canManage('admin')).toBe(true);
    expect(canManage('member')).toBe(false);
    expect(canManage('viewer')).toBe(false);
    expect(canManage(undefined)).toBe(false);
    expect(canManage(null)).toBe(false);
    expect(ASSIGNABLE_ROLES).not.toContain('owner');
  });

  it('inviteLink lands on /cuenta with the token, base-path aware', () => {
    expect(inviteLink('https://x.test', '/LexMX', 'a b')).toBe('https://x.test/LexMX/cuenta?invite=a%20b');
    expect(inviteLink('https://x.test', '/', 't')).toBe('https://x.test/cuenta?invite=t');
  });
});

describe('orgs queries', () => {
  it('listMyOrgs flattens the membership join and drops dangling rows', async () => {
    const { client, log } = fakeClient([
      {
        data: [
          { role: 'owner', orgs: { id: 'o1', name: 'Uno', slug: 'uno', jurisdiction: 'mx', created_at: '2026-01-01' } },
          { role: 'member', orgs: null },
        ],
      },
    ]);
    const orgs = await listMyOrgs(client);
    expect(orgs).toEqual([{ id: 'o1', name: 'Uno', slug: 'uno', jurisdiction: 'mx', createdAt: '2026-01-01', role: 'owner' }]);
    expect(log[0]?.table).toBe('org_members');
  });

  it('createOrg derives the slug and never sets created_by from the client', async () => {
    const { client, log } = fakeClient([{ data: { id: 'o2', name: 'Firma López', slug: 'firma-lopez', jurisdiction: 'mx', created_at: 'now' } }]);
    const org = await createOrg(client, { name: ' Firma López ', jurisdiction: 'mx' });
    expect(org.role).toBe('owner');
    const insert = log[0]?.calls.find(([m]) => m === 'insert');
    expect(insert?.[1][0]).toEqual({ name: 'Firma López', slug: 'firma-lopez', jurisdiction: 'mx' });
  });

  it('createOrg rejects names that produce no slug', async () => {
    const { client } = fakeClient();
    await expect(createOrg(client, { name: '!!!', jurisdiction: 'mx' })).rejects.toThrow('invalid slug');
  });

  it('surfaces server errors', async () => {
    const { client } = fakeClient([{ error: { message: 'permission denied' } }]);
    await expect(listMyOrgs(client)).rejects.toThrow('permission denied');
  });

  it('updateMemberRole refuses to grant owner', async () => {
    const { client, log } = fakeClient();
    await expect(updateMemberRole(client, 'o', 'u', 'owner')).rejects.toThrow('not assignable');
    expect(log).toHaveLength(0);
  });

  it('createInvite stores only the SHA-256 of the token and returns the plaintext once', async () => {
    const { client, log } = fakeClient([{ data: { id: 'i1', org_id: 'o1', email: 'ana@x.test', role: 'member', expires_at: 'e', accepted_at: null, created_at: 'c' } }]);
    const { invite, token } = await createInvite(client, { orgId: 'o1', email: ' Ana@X.test ', role: 'member' });
    expect(invite.email).toBe('ana@x.test');
    expect(token.length).toBeGreaterThanOrEqual(40);
    const insert = log[0]?.calls.find(([m]) => m === 'insert');
    const payload = insert?.[1][0] as { token_hash: string; email: string };
    expect(payload.email).toBe('ana@x.test');
    expect(payload.token_hash).toBe(await sha256Hex(token));
    expect(payload.token_hash).not.toContain(token);
  });

  it('acceptInvite goes through the Edge Function and rejects on error payloads', async () => {
    const { client, invoked } = fakeClient([{ data: { orgId: 'o1', role: 'member' } }, { data: { error: 'expired' } }]);
    await expect(acceptInvite(client, 'tok')).resolves.toEqual({ orgId: 'o1', role: 'member' });
    expect(invoked[0]).toEqual({ name: 'accept-invite', body: { token: 'tok' } });
    await expect(acceptInvite(client, 'tok')).rejects.toThrow('expired');
  });
});
