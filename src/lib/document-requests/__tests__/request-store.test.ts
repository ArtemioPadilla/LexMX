import { beforeEach, describe, expect, it } from 'vitest';
import { addComment, addLocalRequest, applyVote, mergeRequests, queueEntryToRequest, readLocal, requestIssueBody, voterId, writeLocal } from '../request-store';

describe('request-store', () => {
  beforeEach(() => {
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 },
    });
  });

  it('maps queue entries to full requests', () => {
    const r = queueEntryToRequest({ id: 'lft-2024', title: 'LFT', url: 'https://x/lft.pdf', type: 'law', primaryArea: 'labor', hierarchy: 3, priority: 'high', status: 'pending' });
    expect(r.sources[0]?.isOfficial).toBe(true);
    expect(r.priority).toBe('high');
    expect(r.votes).toBe(0);
  });

  it('merges local votes, comments and requests over the queue', () => {
    let state = readLocal();
    state = applyVote(state, 'a', 'v1', 'up');
    state = applyVote(state, 'a', 'v1', 'up'); // double vote ignored
    state = applyVote(state, 'a', 'v2', 'down');
    state = addComment(state, 'a', 'v1', 'Urgente');
    state = addLocalRequest(state, { ...queueEntryToRequest({ id: 'mine', title: 'Mi ley' }), requestedBy: 'v1' });
    writeLocal(state);
    const merged = mergeRequests([{ id: 'a', title: 'A' }], readLocal());
    const a = merged.find((r) => r.id === 'a')!;
    expect(a.votes).toBe(0);
    expect(a.voters).toEqual(['v1', 'v2']);
    expect(a.comments[0]?.content).toBe('Urgente');
    expect(merged.map((r) => r.id)).toEqual(['a', 'mine']);
  });

  it('keeps a stable anonymous voter id', () => {
    expect(voterId()).toBe(voterId());
  });

  it('builds a GitHub issue body without personal data', () => {
    const body = requestIssueBody({ title: 'Ley X', type: 'law', hierarchy: 3, primaryArea: 'tax', territorialScope: 'federal', description: 'Necesaria', sources: [{ id: 's', type: 'url', url: 'https://dof.gob.mx/x', isOfficial: true, verified: false }] });
    expect(body).toContain('**Documento**: Ley X');
    expect(body).toContain('https://dof.gob.mx/x (oficial)');
    expect(body).not.toMatch(/@/);
  });
});
