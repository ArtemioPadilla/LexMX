import { describe, it, expect, beforeEach } from 'vitest';
import { NotificationSystem } from '../notification-system';

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

describe('NotificationSystem - create / list / mark read', () => {
  it('creates a status-change notification and lists it for its recipient', async () => {
    const notification = await NotificationSystem.createStatusChangeNotification(
      'req-1',
      'user-1',
      'pending',
      'completed',
      'Ley Federal del Trabajo'
    );

    expect(notification.read).toBe(false);
    expect(notification.type).toBe('status_change');

    const list = await NotificationSystem.getNotifications('user-1');
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe(notification.id);
  });

  it('does not leak notifications between recipients', async () => {
    await NotificationSystem.createCommentNotification('req-1', 'user-1', 'Código Civil', 'user');
    await NotificationSystem.createCommentNotification('req-2', 'user-2', 'Código Penal', 'moderator');

    const user1Notifications = await NotificationSystem.getNotifications('user-1');
    const user2Notifications = await NotificationSystem.getNotifications('user-2');

    expect(user1Notifications).toHaveLength(1);
    expect(user2Notifications).toHaveLength(1);
    expect(user1Notifications[0]?.requestId).toBe('req-1');
    expect(user2Notifications[0]?.requestId).toBe('req-2');
  });

  it('marks a notification as read without affecting others', async () => {
    const first = await NotificationSystem.createStatusChangeNotification(
      'req-1',
      'user-1',
      'pending',
      'under_review',
      'Ley del ISSSTE'
    );
    const second = await NotificationSystem.createCommentNotification(
      'req-1',
      'user-1',
      'Ley del ISSSTE',
      'user'
    );

    await NotificationSystem.markAsRead(first.id);

    const list = await NotificationSystem.getNotifications('user-1');
    const updatedFirst = list.find((n) => n.id === first.id);
    const updatedSecond = list.find((n) => n.id === second.id);

    expect(updatedFirst?.read).toBe(true);
    expect(updatedSecond?.read).toBe(false);
    expect(await NotificationSystem.getUnreadCount('user-1')).toBe(1);
  });

  it('marks all notifications as read for a user', async () => {
    await NotificationSystem.createStatusChangeNotification('req-1', 'user-1', 'pending', 'completed', 'A');
    await NotificationSystem.createStatusChangeNotification('req-2', 'user-1', 'pending', 'rejected', 'B');

    await NotificationSystem.markAllAsRead('user-1');

    expect(await NotificationSystem.getUnreadCount('user-1')).toBe(0);
  });

  it('deletes a notification', async () => {
    const notification = await NotificationSystem.createCompletionNotification('req-1', 'user-1', 'Ley X');

    await NotificationSystem.deleteNotification(notification.id);

    const list = await NotificationSystem.getNotifications('user-1');
    expect(list).toHaveLength(0);
  });
});
