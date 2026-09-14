import { describe, expect, it } from 'vitest';
import { fakeClient } from './fake-client';
import { COURT_ADAPTERS, addWatchedCase, listCourtEvents, listNotifications, watchLaw } from '../monitoring';

describe('monitoring', () => {
  it('has at least one court adapter for mx', () => {
    expect(COURT_ADAPTERS.mx?.length).toBeGreaterThan(0);
  });

  it('addWatchedCase trims and requires an expediente; never sets user_id from the client', async () => {
    const { client, log } = fakeClient([{ data: null }]);
    await addWatchedCase(client, { jurisdiction: 'mx', court: 'mx-pjf', expediente: ' 123/2026 ', label: ' Pérez ' });
    const insert = log[0]?.calls.find(([m]) => m === 'insert');
    expect(insert?.[1][0]).toEqual({ jurisdiction: 'mx', court: 'mx-pjf', expediente: '123/2026', label: 'Pérez', org_id: null });
    await expect(addWatchedCase(client, { jurisdiction: 'mx', court: 'mx-pjf', expediente: '  ' })).rejects.toThrow('expediente required');
  });

  it('listCourtEvents orders by date desc and maps columns', async () => {
    const { client, log } = fakeClient([{ data: [{ id: 'e', case_id: 'c', occurred_at: 'd', kind: 'acuerdo', summary: 's', source_url: null, seen_at: null }] }]);
    const events = await listCourtEvents(client, 'c');
    expect(events[0]).toEqual({ id: 'e', caseId: 'c', occurredAt: 'd', kind: 'acuerdo', summary: 's', sourceUrl: null, seenAt: null });
    expect(log[0]?.calls).toContainEqual(['order', ['occurred_at', { ascending: false }]]);
  });

  it('watchLaw upserts on the composite key', async () => {
    const { client, log } = fakeClient([{ data: null }]);
    await watchLaw(client, 'mx', 'lft');
    expect(log[0]?.calls[0]).toEqual(['upsert', [{ jurisdiction: 'mx', doc_id: 'lft' }, { onConflict: 'user_id,jurisdiction,doc_id' }]]);
  });

  it('listNotifications maps read_at', async () => {
    const { client } = fakeClient([{ data: [{ id: 'n', kind: 'reform', title: 't', body: 'b', url: null, created_at: 'c', read_at: 'r' }] }]);
    const items = await listNotifications(client);
    expect(items[0]?.readAt).toBe('r');
  });
});
