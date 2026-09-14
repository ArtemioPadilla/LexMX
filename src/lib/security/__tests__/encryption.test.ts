import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { ClientCryptoManager } from '../encryption';

// jsdom (and the global Vitest setup in src/test/setupTests.ts) do not ship a
// working WebCrypto implementation -- `crypto.subtle` there is a bag of
// no-op `vi.fn()` stubs. Swap in Node's real implementation for this file so
// encrypt/decrypt round trips actually exercise AES-GCM/PBKDF2, then restore
// whatever was there before so other test files are unaffected.
let originalCrypto: Crypto;

beforeAll(() => {
  originalCrypto = globalThis.crypto;
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });

  // jsdom has no real canvas backend and logs a noisy "not implemented"
  // error for every getContext() call. generateFingerprint() already
  // treats a missing/falsy 2D context as "no canvas fingerprint
  // available" (see the `if (ctx)` guard), so stubbing this out changes
  // nothing observable -- it just keeps test output about assertions.
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

// Shape of the PBKDF2 params object passed to `crypto.subtle.deriveKey`,
// declared locally so the contract test below can assert on it without an
// explicit `any`.
interface Pbkdf2LikeParams {
  name: string;
  hash: string;
  salt: ArrayBufferView;
  iterations: number;
}

describe('ClientCryptoManager', () => {
  it('round-trips data through encrypt/decrypt with the derived key', async () => {
    const manager = new ClientCryptoManager();
    const key = await manager.generateKey('correct-password');
    const plaintext = 'Artículo 123 constitucional';

    const encrypted = await manager.encrypt(plaintext, key);
    const decrypted = await manager.decrypt(encrypted, key);

    expect(decrypted).toBe(plaintext);
  });

  it('fails to decrypt when using a key derived from the wrong password', async () => {
    const manager = new ClientCryptoManager();
    const key = await manager.generateKey('correct-password');
    const encrypted = await manager.encrypt('secret data', key);

    const wrongKey = await manager.generateKey('wrong-password');

    await expect(manager.decrypt(encrypted, wrongKey)).rejects.toThrow(
      'Failed to decrypt data. Key may be invalid.'
    );
  });

  it('generates a fresh random IV of the configured length for every call', async () => {
    const manager = new ClientCryptoManager();
    const key = await manager.generateKey('password');

    const first = await manager.encrypt('hello', key);
    const second = await manager.encrypt('hello', key);

    expect(first.iv).toHaveLength(12);
    expect(second.iv).toHaveLength(12);
    expect(first.iv).not.toEqual(second.iv);
    expect(first.algorithm).toBe('AES-GCM');
  });

  it('hashes deterministically with SHA-256', async () => {
    const manager = new ClientCryptoManager();
    const first = await manager.hash('lexmx');
    const second = await manager.hash('lexmx');

    expect(first).toBe(second);
    expect(first).toHaveLength(64); // 32 bytes, hex-encoded
    expect(first).toMatch(/^[0-9a-f]{64}$/);
  });
});

// These assertions pin the parameters documented as a data-compatibility
// contract in docs/DATA-COMPATIBILITY.md: changing any of them makes
// previously-encrypted provider keys unreadable. See also
// secure-storage.test.ts for the `lexmx_` storage-key prefix contract.
describe('encryption contract (docs/DATA-COMPATIBILITY.md)', () => {
  it('uses AES-GCM with a 12-byte IV for every encrypted payload', async () => {
    const manager = new ClientCryptoManager();
    const key = await manager.generateKey('password');
    const encrypted = await manager.encrypt('probe', key);

    expect(encrypted.algorithm).toBe('AES-GCM');
    expect(encrypted.iv).toHaveLength(12);
  });

  it('derives the master key via PBKDF2/SHA-256', async () => {
    const manager = new ClientCryptoManager();
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, 'deriveKey');

    await manager.generateKey('password');

    expect(deriveKeySpy).toHaveBeenCalledTimes(1);
    const params = deriveKeySpy.mock.calls[0]?.[0] as Pbkdf2LikeParams;
    expect(params.name).toBe('PBKDF2');
    expect(params.hash).toBe('SHA-256');
    // NOTE: docs/DATA-COMPATIBILITY.md documents the salt as "16 bytes
    // aleatorios", and `SecurityConfig.saltLength` is set to 16, but the
    // actual salt baked into generateKey() is the fixed 26-byte string
    // 'lexmx-legal-assistant-2024' -- constant across installs/passwords,
    // not random, and not derived from `saltLength`. This test pins the
    // *current* behaviour rather than the documented one; see the Forja
    // report for this module for a flag to fix under a proper migration
    // (changing the salt would make existing encrypted provider keys
    // unreadable without one).
    expect(params.salt.byteLength).toBe(26);

    deriveKeySpy.mockRestore();
  });
});
