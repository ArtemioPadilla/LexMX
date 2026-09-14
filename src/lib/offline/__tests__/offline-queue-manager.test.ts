import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OfflineQueueManager as OfflineQueueManagerType } from '../offline-queue-manager';

/**
 * `OfflineQueueManager` is a module-level singleton (`export const
 * offlineQueueManager = OfflineQueueManager.getInstance();`), so each test
 * resets the fake IndexedDB *and* the module cache, then re-imports the
 * module fresh. That gives every test its own singleton bound to its own
 * database, instead of leaking state across tests.
 */
async function freshManager(): Promise<{ Manager: typeof OfflineQueueManagerType; manager: OfflineQueueManagerType }> {
  vi.resetModules();
  globalThis.indexedDB = new IDBFactory();
  const mod = await import('../offline-queue-manager');
  return { Manager: mod.OfflineQueueManager, manager: mod.OfflineQueueManager.getInstance() };
}

describe('OfflineQueueManager', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('persists the queue under the documented database name and version (data-compatibility contract)', async () => {
    const { manager } = await freshManager();

    await manager.queueQuery('¿Cuál es el plazo para presentar una demanda laboral?');

    const databases = await indexedDB.databases();
    expect(databases).toContainEqual({ name: 'LexMX_OfflineQueue', version: 2 });
  });

  it('enqueues a query so it shows up as pending', async () => {
    const { manager } = await freshManager();

    const queryId = await manager.queueQuery('¿Qué dice el artículo 123 constitucional?', {
      legalArea: 'laboral',
    });

    const pending = await manager.getPendingQueries();
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      id: queryId,
      status: 'pending',
      retryCount: 0,
    });
  });

  it('dequeues a query once it completes successfully', async () => {
    const { manager } = await freshManager();
    // `processQuery` treats `Math.random() > 0.1` as success, and derives its
    // simulated delay from the same call: with 0.5 that's a fixed 2s, well
    // under this test's timeout.
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await manager.queueQuery('¿Qué es el amparo directo?');
    await manager.processPendingQueries();

    const pending = await manager.getPendingQueries();
    expect(pending).toHaveLength(0);

    const stats = await manager.getQueueStats();
    expect(stats.queries.completed).toBe(1);
    expect(stats.queries.pending).toBe(0);
  }, 15000);

  it('retries a failing query and marks it failed once retries are exhausted', async () => {
    const { manager } = await freshManager();
    // `processQuery` treats `Math.random() > 0.1` as failure when false,
    // with a fixed 1s simulated delay.
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const queryId = await manager.queueQuery('Consulta que siempre falla');

    // `maxRetries` defaults to 3: the first two failures should reset the
    // query back to `pending` (for another attempt) and bump `retryCount`.
    for (let attempt = 0; attempt < 2; attempt++) {
      await manager.processPendingQueries();

      const pending = await manager.getPendingQueries();
      expect(pending).toHaveLength(1);
      expect(pending[0]).toMatchObject({ id: queryId, status: 'pending', retryCount: attempt + 1 });
    }

    // Third failure exhausts retries and the query is marked `failed`.
    await manager.processPendingQueries();

    const pending = await manager.getPendingQueries();
    expect(pending).toHaveLength(0);

    const stats = await manager.getQueueStats();
    expect(stats.queries.failed).toBe(1);
  }, 15000);
});
