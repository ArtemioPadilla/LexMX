import { describe, it, expect, beforeEach } from 'vitest';
import { SecurityManager } from '../security-manager';

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

describe('SecurityManager - blocked users', () => {
  it('is not blocked by default', () => {
    expect(SecurityManager.isUserBlocked('user-a')).toBe(false);
  });

  it('blocks a user and reports it as blocked afterwards', async () => {
    await SecurityManager.blockUser('user-a', 'spam');

    expect(SecurityManager.isUserBlocked('user-a')).toBe(true);
    // Blocking one fingerprint must not affect another.
    expect(SecurityManager.isUserBlocked('user-b')).toBe(false);
  });

  it('auto-blocks a user once reports reach the threshold', async () => {
    for (let i = 0; i < 5; i++) {
      await SecurityManager.reportUser('reporter', 'repeat-offender', 'spam');
    }

    expect(SecurityManager.isUserBlocked('repeat-offender')).toBe(true);
  });

  it('flags a blocked user as high risk on validateRequest', async () => {
    await SecurityManager.blockUser('blocked-user', 'spam');

    const result = await SecurityManager.validateRequest(
      {
        title: 'Solicitud de la Ley Federal del Trabajo',
        description: 'Necesito el texto vigente de la Ley Federal del Trabajo, artículo 47.',
      },
      'blocked-user'
    );

    expect(result.action).toBe('block');
    expect(result.isValid).toBe(false);
    expect(result.violations).toContain('Usuario bloqueado previamente');
  });
});

describe('SecurityManager - rate limits', () => {
  it('allows requests under the limit and reports remaining correctly', async () => {
    const check = await SecurityManager.checkRateLimit('fresh-user', 'requests');

    expect(check.allowed).toBe(true);
    expect(check.remaining).toBe(5); // REQUESTS_PER_HOUR
    expect(check.requests).toBe(0);
  });

  it('decrements remaining as actions are recorded, and blocks once exhausted', async () => {
    const fingerprint = 'heavy-user';

    for (let i = 0; i < 5; i++) {
      await SecurityManager.recordAction(fingerprint, 'requests');
    }

    const check = await SecurityManager.checkRateLimit(fingerprint, 'requests');
    expect(check.allowed).toBe(false);
    expect(check.remaining).toBe(0);
    expect(check.requests).toBe(5);
  });

  it('tracks rate limits independently per action type', async () => {
    const fingerprint = 'multi-action-user';

    for (let i = 0; i < 5; i++) {
      await SecurityManager.recordAction(fingerprint, 'requests');
    }

    const votesCheck = await SecurityManager.checkRateLimit(fingerprint, 'votes');
    expect(votesCheck.allowed).toBe(true);
    expect(votesCheck.requests).toBe(0);
  });
});
