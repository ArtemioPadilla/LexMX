import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach } from 'vitest';

import { EnhancedOfflineStorage } from '../enhanced-offline-storage';
import type { LegalDocument } from '@/types/legal';

// EnhancedOfflineStorage is a singleton (private constructor). To get a
// fresh instance bound to a fresh in-memory IndexedDB per test, reset the
// private static handle via a narrow, non-`any` type punch.
type SingletonHolder = { instance?: EnhancedOfflineStorage };

function resetSingleton(): void {
  (EnhancedOfflineStorage as unknown as SingletonHolder).instance = undefined;
}

function makeLegalDocument(overrides: Partial<LegalDocument> = {}): LegalDocument {
  return {
    id: 'ccf-1',
    title: 'Código Civil Federal',
    shortTitle: 'CCF',
    type: 'code',
    hierarchy: 3,
    primaryArea: 'civil',
    secondaryAreas: [],
    authority: 'Congreso de la Unión',
    publicationDate: '1928-05-26',
    status: 'active',
    territorialScope: 'federal',
    applicability: 'nacional',
    content: [],
    relatedDependencies: [],
    importance: 'high',
    updateFrequency: 'low',
    ...overrides
  };
}

function openRawDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

describe('EnhancedOfflineStorage', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    resetSingleton();
  });

  it('creates the LexMX_Enhanced_Storage database (v4) with all documented stores', async () => {
    const storage = EnhancedOfflineStorage.getInstance();
    // Any public method waits for the DB to open before doing work.
    await storage.getStats();

    const rawDb = await openRawDb('LexMX_Enhanced_Storage');
    try {
      expect(rawDb.version).toBe(4);
      expect(Array.from(rawDb.objectStoreNames).sort()).toEqual([
        'api_cache',
        'case_data',
        'chunks',
        'embeddings',
        'file_cache',
        'legal_documents',
        'performance_metrics',
        'search_cache',
        'storage_metadata',
        'sync_metadata',
        'user_queries'
      ]);
    } finally {
      rawDb.close();
    }
  });

  it('round-trips arbitrary data through store/retrieve and remove deletes it', async () => {
    const storage = EnhancedOfflineStorage.getInstance();

    await storage.store('api_cache', 'key-1', { hello: 'world' });
    await expect(storage.retrieve('api_cache', 'key-1')).resolves.toEqual({ hello: 'world' });

    await storage.remove('api_cache', 'key-1');
    await expect(storage.retrieve('api_cache', 'key-1')).resolves.toBeNull();
  });

  it('retrieve returns null and evicts data past its expiry (TTL)', async () => {
    const storage = EnhancedOfflineStorage.getInstance();

    await storage.store('api_cache', 'stale', { value: 1 }, { expires: new Date(Date.now() - 1000) });

    await expect(storage.retrieve('api_cache', 'stale')).resolves.toBeNull();

    // Confirm it was actually evicted, not just filtered on read.
    const remaining = await storage.query('api_cache');
    expect(remaining).toEqual([]);
  });

  it('clearExpired removes only expired entries across stores', async () => {
    const storage = EnhancedOfflineStorage.getInstance();

    await storage.store('api_cache', 'expired', { v: 1 }, { expires: new Date(Date.now() - 1000) });
    await storage.store('api_cache', 'valid', { v: 2 }, { expires: new Date(Date.now() + 60_000) });

    const cleared = await storage.clearExpired();
    expect(cleared).toBeGreaterThanOrEqual(1);

    await expect(storage.retrieve('api_cache', 'valid')).resolves.toEqual({ v: 2 });
    const remaining = await storage.query('api_cache');
    expect(remaining).toEqual([{ v: 2 }]);
  });

  it('getStats aggregates item counts and sizes across stores', async () => {
    const storage = EnhancedOfflineStorage.getInstance();

    await storage.store('api_cache', 'a', { v: 1 });
    await storage.store('search_cache', 'b', { v: 2 });

    const stats = await storage.getStats();
    expect(stats.itemCount).toBe(2);
    expect(stats.stores.api_cache?.itemCount).toBe(1);
    expect(stats.stores.search_cache?.itemCount).toBe(1);
    expect(stats.totalSize).toBeGreaterThan(0);
  });

  it('getDocument reads unwrapped LegalDocument records stored via store()', async () => {
    const storage = EnhancedOfflineStorage.getInstance();
    const doc = makeLegalDocument();

    await storage.store('legal_documents', doc.id, doc);

    await expect(storage.getDocument(doc.id)).resolves.toEqual(doc);
  });

  it('getDocument reads legacy double-wrapped ({ data }) LegalDocument records', async () => {
    const storage = EnhancedOfflineStorage.getInstance();
    const doc = makeLegalDocument({ id: 'wrapped-doc' });

    // Simulate a historical bug where the payload itself was wrapped again.
    await storage.store('legal_documents', doc.id, { data: doc });

    await expect(storage.getDocument(doc.id)).resolves.toEqual(doc);
  });

  it('getDocument returns null for an unknown id', async () => {
    const storage = EnhancedOfflineStorage.getInstance();
    await expect(storage.getDocument('missing')).resolves.toBeNull();
  });

  it('getAllDocuments unwraps CachedData envelopes written by store()', async () => {
    const storage = EnhancedOfflineStorage.getInstance();
    const docA = makeLegalDocument({ id: 'a' });
    const docB = makeLegalDocument({ id: 'b' });

    await storage.store('legal_documents', docA.id, docA);
    await storage.store('legal_documents', docB.id, docB);

    const all = await storage.getAllDocuments();
    expect(all.map(d => d.id).sort()).toEqual(['a', 'b']);
  });

  it('getDocument and getAllDocuments fail closed (return null/[]) when the underlying DB call throws', async () => {
    const storage = EnhancedOfflineStorage.getInstance();
    await storage.store('legal_documents', 'x', makeLegalDocument({ id: 'x' }));

    // Force the internal connection closed to make the next transaction throw,
    // exercising the catch branches without touching module internals' types.
    (storage as unknown as { db: IDBDatabase | null }).db?.close();

    await expect(storage.getDocument('x')).resolves.toBeNull();
    await expect(storage.getAllDocuments()).resolves.toEqual([]);
  });
});
