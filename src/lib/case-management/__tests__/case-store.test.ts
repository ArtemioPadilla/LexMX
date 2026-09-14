import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { CaseStore, LEGACY_KEY, MIGRATION_FLAG, deserializeCase, serializeCase } from '../case-store';
import type { LegalCase } from '@/types/cases';

function sample(id = 'c1'): LegalCase {
  return {
    id,
    title: 'Divorcio',
    description: 'Mutuo consentimiento',
    legalArea: 'family',
    jurisdiction: 'mx',
    status: 'active',
    createdAt: new Date('2024-01-15T00:00:00Z'),
    updatedAt: new Date('2024-01-20T00:00:00Z'),
    documents: [{ id: 'd1', name: 'demanda.txt', type: 'text/plain', size: 10, uploadedAt: new Date('2024-01-16T00:00:00Z'), content: 'x', tags: [] }],
    notes: [],
    conversations: [],
    deadlines: [{ id: 'dl1', title: 'Audiencia', date: new Date('2024-02-15T00:00:00Z'), type: 'court', completed: false }],
    parties: [{ id: 'p1', name: 'María', role: 'plaintiff' }],
    statusChanges: [],
  };
}

describe('CaseStore', () => {
  beforeEach(() => {
    // Fresh database and a real in-memory localStorage per test; the global
    // setup installs stubs for both.
    globalThis.indexedDB = new IDBFactory();
    const mem = new Map<string, string>();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => mem.get(k) ?? null,
        setItem: (k: string, v: string) => void mem.set(k, String(v)),
        removeItem: (k: string) => void mem.delete(k),
        clear: () => mem.clear(),
        key: (i: number) => [...mem.keys()][i] ?? null,
        get length() {
          return mem.size;
        },
      },
    });
  });

  it('round-trips a case with Date fields', async () => {
    const store = new CaseStore();
    await store.put(sample());
    const back = await store.get('c1');
    expect(back?.createdAt).toBeInstanceOf(Date);
    expect(back?.deadlines[0]?.date.toISOString()).toBe('2024-02-15T00:00:00.000Z');
    expect(back?.documents[0]?.uploadedAt).toBeInstanceOf(Date);
    expect((await store.list()).map((c) => c.id)).toEqual(['c1']);
    await store.delete('c1');
    expect(await store.list()).toEqual([]);
  });

  it('serializes to ISO strings and tolerates the legacy shape', () => {
    const s = serializeCase(sample());
    expect(typeof s.createdAt).toBe('string');
    const legacy = deserializeCase({ id: 'old', title: 'Viejo', createdAt: '2024-01-10', updatedAt: '2024-01-18', deadlines: [{ id: 'x', title: 'y', date: '2024-03-01', type: 'filing', completed: false }] } as never);
    expect(legacy.jurisdiction).toBe('mx');
    expect(legacy.status).toBe('active');
    expect(legacy.deadlines[0]?.date.getFullYear()).toBe(2024);
    expect(legacy.statusChanges).toEqual([]);
  });

  it('imports localStorage cases exactly once and keeps the legacy key', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([serializeCase(sample('a')), serializeCase(sample('b'))]));
    const store = new CaseStore();
    expect(await store.migrateFromLocalStorage()).toBe(2);
    expect((await store.list()).map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
    expect(localStorage.getItem(MIGRATION_FLAG)).not.toBeNull();
    expect(await store.migrateFromLocalStorage()).toBe(0);
  });

  it('lists most recently updated first', async () => {
    const store = new CaseStore();
    await store.put({ ...sample('old'), updatedAt: new Date('2023-01-01') });
    await store.put({ ...sample('new'), updatedAt: new Date('2025-01-01') });
    expect((await store.list()).map((c) => c.id)).toEqual(['new', 'old']);
  });
});
