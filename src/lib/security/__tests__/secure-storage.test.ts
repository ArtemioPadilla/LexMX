import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { SecureStorageManager } from '../secure-storage';
import type { ProviderConfig } from '../../../types/llm';

// See encryption.test.ts for why: jsdom/the global test setup only provide
// no-op WebCrypto stubs, so we install Node's real implementation for the
// duration of this file and restore it afterwards.
let originalCrypto: Crypto;

beforeAll(() => {
  originalCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });

  // See encryption.test.ts: silence jsdom's noisy (and behaviourally
  // harmless) "getContext not implemented" logging triggered indirectly by
  // generateKey() -> generateFingerprint().
  HTMLCanvasElement.prototype.getContext = vi
    .fn()
    .mockReturnValue(null) as typeof HTMLCanvasElement.prototype.getContext;
});

afterAll(() => {
  Object.defineProperty(globalThis, 'crypto', {
    value: originalCrypto,
    configurable: true,
  });
});

// The global test setup (src/test/setupTests.ts) stubs window.localStorage /
// window.sessionStorage with vi.fn() mocks that always return null, which
// can't round-trip data. Replace both with a real in-memory Map-backed
// implementation for this file. We do NOT `vi.mock` the module under test.
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

function installMemoryStorages(): void {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, 'sessionStorage', {
    value: createMemoryStorage(),
    writable: true,
    configurable: true,
  });
}

function keysOf(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key) keys.push(key);
  }
  return keys;
}

const testConfig: ProviderConfig = {
  id: 'openai',
  name: 'OpenAI',
  type: 'cloud',
  enabled: true,
  priority: 1,
  apiKey: 'sk-test-not-a-real-key',
  createdAt: Date.UTC(2025, 0, 1),
};

describe('SecureStorageManager', () => {
  beforeEach(() => {
    installMemoryStorages();
  });

  it('round-trips a provider config through AES-GCM encryption (default sessionStorage)', async () => {
    const storage = new SecureStorageManager();

    await storage.storeProviderConfig(testConfig);

    // Provider configs always contain credentials, so they must be
    // encrypted at rest and, by default privacy settings (sessionOnly:
    // true), land in sessionStorage rather than localStorage.
    const raw = window.sessionStorage.getItem('lexmx_provider_openai');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as { encrypted: boolean; data: { algorithm: string; iv: number[] } };
    expect(parsed.encrypted).toBe(true);
    expect(parsed.data.algorithm).toBe('AES-GCM');
    expect(parsed.data.iv).toHaveLength(12);

    const retrieved = await storage.getProviderConfig('openai');
    expect(retrieved).toEqual(testConfig);
  });

  it('clears corrupted ciphertext instead of returning garbage', async () => {
    const storage = new SecureStorageManager();
    await storage.initialize();

    // Hand-craft a stored envelope whose ciphertext cannot possibly decrypt
    // with the manager's key (wrong data for a valid-looking IV).
    window.sessionStorage.setItem(
      'lexmx_provider_broken',
      JSON.stringify({
        encrypted: true,
        data: {
          data: Array.from({ length: 32 }, (_, i) => i),
          iv: Array.from({ length: 12 }, () => 0),
          algorithm: 'AES-GCM',
          version: 1,
        },
        timestamp: Date.now(),
        version: 1,
      })
    );

    const result = await storage.getProviderConfig('broken');

    expect(result).toBeNull();
    // The corrupted entry must be cleared, not left behind.
    expect(window.sessionStorage.getItem('lexmx_provider_broken')).toBeNull();
  });

  it('namespaces every persisted key under the documented "lexmx_" prefix', async () => {
    const storage = new SecureStorageManager();

    await storage.setPreferredProvider('openai');
    await storage.storeProviderConfig(testConfig);

    const keys = keysOf(window.sessionStorage);
    expect(keys).toContain('lexmx_preferred_provider');
    expect(keys).toContain('lexmx_provider_openai');
    keys.forEach((key) => expect(key.startsWith('lexmx_')).toBe(true));
  });

  it('does not encrypt non-sensitive data', async () => {
    const storage = new SecureStorageManager();

    await storage.setPreferredProvider('openai');

    const raw = window.sessionStorage.getItem('lexmx_preferred_provider');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw as string) as { encrypted: boolean; data: unknown };
    expect(parsed.encrypted).toBe(false);
    expect(parsed.data).toBe('openai');
  });
});
