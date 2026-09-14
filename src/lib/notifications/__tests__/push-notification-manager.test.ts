import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PushNotificationManager } from '../push-notification-manager';
import type { SubscriptionInfo } from '../push-notification-manager';

/**
 * The global test setup (src/test/setupTests.ts) stubs window.localStorage
 * with vi.fn() mocks that always return null, which can't round-trip data.
 * Replace it with a real in-memory Map-backed implementation for this file.
 * We do NOT `vi.mock` the module under test.
 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  });
});

describe('PushNotificationManager', () => {
  it('reports unsupported (and denied) when the browser has no Push API, without throwing', () => {
    const manager = PushNotificationManager.getInstance();

    // jsdom doesn't implement the Push API.
    expect(manager.isSupported()).toBe(false);
    expect(manager.getPermissionStatus()).toBe('denied');
  });

  it('round-trips subscription info through localStorage, restoring Date objects', async () => {
    const manager = PushNotificationManager.getInstance();
    const stored: SubscriptionInfo = {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'key1', auth: 'key2' },
      subscriptionId: 'sub_1',
      preferences: {
        legalUpdates: true,
        queryCompletions: true,
        documentUpdates: false,
        caseAlerts: false,
        systemAlerts: false,
      },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      lastActive: new Date('2025-01-02T00:00:00.000Z'),
    };
    localStorage.setItem('lexmx_push_subscription', JSON.stringify(stored));

    const info = await manager.getSubscriptionInfo();

    expect(info).not.toBeNull();
    expect(info?.createdAt).toBeInstanceOf(Date);
    expect(info?.lastActive).toBeInstanceOf(Date);
    expect(info?.endpoint).toBe(stored.endpoint);
  });

  it('returns null when there is no stored subscription', async () => {
    const manager = PushNotificationManager.getInstance();

    expect(await manager.getSubscriptionInfo()).toBeNull();
  });

  it('merges preference updates without dropping existing ones', async () => {
    const manager = PushNotificationManager.getInstance();
    const stored: SubscriptionInfo = {
      endpoint: 'https://push.example/abc',
      keys: { p256dh: 'key1', auth: 'key2' },
      subscriptionId: 'sub_1',
      preferences: {
        legalUpdates: true,
        queryCompletions: true,
        documentUpdates: true,
        caseAlerts: true,
        systemAlerts: false,
      },
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      lastActive: new Date('2025-01-01T00:00:00.000Z'),
    };
    localStorage.setItem('lexmx_push_subscription', JSON.stringify(stored));

    const ok = await manager.updatePreferences({ systemAlerts: true });
    expect(ok).toBe(true);

    const info = await manager.getSubscriptionInfo();
    expect(info?.preferences.systemAlerts).toBe(true);
    // Untouched preferences survive the merge.
    expect(info?.preferences.legalUpdates).toBe(true);
    expect(info?.preferences.documentUpdates).toBe(true);
  });

  it('does not send a local notification without permission', async () => {
    const manager = PushNotificationManager.getInstance();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await manager.sendLocalNotification({
      title: 'Prueba',
      body: 'Cuerpo de prueba',
      data: { type: 'system_alert', timestamp: new Date().toISOString() },
    });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('No permission for local notifications')
    );
    warnSpy.mockRestore();
  });
});
