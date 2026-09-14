import { describe, expect, it } from 'vitest';
import { fakeClient } from './fake-client';
import { createReferral, listVerifiedLawyers, upsertMyProfile, validateProfile } from '../lawyers';

const profile = { jurisdiction: 'mx', entityCode: 'MX-JAL', areas: ['labor'], headline: 'Laboralista', bio: '', languages: ['es'], contactEmail: 'ana@x.test', acceptingClients: true };

describe('lawyer directory', () => {
  it('validates the fields the schema constrains', () => {
    expect(validateProfile(profile)).toEqual([]);
    expect(validateProfile({ ...profile, headline: '' })).toContain('headline');
    expect(validateProfile({ ...profile, headline: 'x'.repeat(161) })).toContain('headline');
    expect(validateProfile({ ...profile, areas: [] })).toContain('areas');
    expect(validateProfile({ ...profile, contactEmail: 'nope' })).toContain('contactEmail');
    expect(validateProfile({ ...profile, bio: 'b'.repeat(2001) })).toContain('bio');
  });

  it('lists only verified, accepting profiles with the requested filters', async () => {
    const { client, log } = fakeClient([{ data: [{ user_id: 'u', jurisdiction: 'mx', entity_code: 'MX-JAL', areas: ['labor'], headline: 'h', bio: '', languages: ['es'], contact_email: null, verified_at: 'v', accepting_clients: true }] }]);
    const rows = await listVerifiedLawyers(client, { jurisdiction: 'mx', entityCode: 'MX-JAL', area: 'labor' });
    expect(rows[0]).toMatchObject({ userId: 'u', verifiedAt: 'v', entityCode: 'MX-JAL' });
    const calls = log[0]!.calls;
    expect(calls).toContainEqual(['not', ['verified_at', 'is', null]]);
    expect(calls).toContainEqual(['eq', ['entity_code', 'MX-JAL']]);
    expect(calls).toContainEqual(['contains', ['areas', ['labor']]]);
    expect(calls).toContainEqual(['eq', ['accepting_clients', true]]);
  });

  it('never sends verified_at when saving a profile and rejects invalid input', async () => {
    const { client, log } = fakeClient([{ data: null }]);
    await upsertMyProfile(client, { ...profile, contactEmail: ' Ana@X.test ' });
    const payload = (log[0]!.calls.find(([m]) => m === 'upsert')![1][0]) as Record<string, unknown>;
    expect(payload).not.toHaveProperty('verified_at');
    expect(payload.contact_email).toBe('ana@x.test');
    await expect(upsertMyProfile(client, { ...profile, areas: [] })).rejects.toThrow('invalid profile');
  });

  it('creates referrals with a bounded summary and matches when a lawyer is chosen', async () => {
    const { client, log } = fakeClient([{ data: null }]);
    await createReferral(client, { jurisdiction: 'mx', entityCode: null, area: 'labor', summary: 'Despido sin liquidación tras 5 años.', lawyerId: 'L1' });
    const payload = (log[0]!.calls.find(([m]) => m === 'insert')![1][0]) as Record<string, unknown>;
    expect(payload).toMatchObject({ status: 'matched', lawyer_id: 'L1' });
    await expect(createReferral(client, { jurisdiction: 'mx', entityCode: null, area: 'labor', summary: 'corto' })).rejects.toThrow('summary length');
  });
});
