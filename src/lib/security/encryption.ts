// Client-side encryption utilities for secure data storage

import type { EncryptedData, CryptoManager, SecurityConfig } from '../../types/security';

// `deviceMemory` is a non-standard Navigator extension (Device Memory API);
// not every lib.dom.d.ts version declares it, so we type it explicitly
// instead of reaching for `any`.
interface NavigatorWithDeviceMemory extends Navigator {
  deviceMemory?: number;
}

/** Salt used by every payload written before version 2 (constant, documented in docs/DATA-COMPATIBILITY.md). */
export const LEGACY_SALT = 'lexmx-legal-assistant-2024';
/** localStorage key holding the per-installation salt (base64, 16 random bytes). */
export const SALT_STORAGE_KEY = 'lexmx_kdf_salt';
/** Payload version written by `encrypt()` since the random salt landed. */
export const ENCRYPTION_VERSION = 2;

export class ClientCryptoManager implements CryptoManager {
  private keyMaterialBuffer: Uint8Array<ArrayBuffer> | null = null;
  private legacyKey: CryptoKey | null = null;

  /** Reads or creates the per-installation salt. Falls back to an in-memory salt when storage is unavailable. */
  installationSalt(): Uint8Array<ArrayBuffer> {
    const fresh = (): Uint8Array<ArrayBuffer> => crypto.getRandomValues(new Uint8Array(new ArrayBuffer(this.config.saltLength)));
    try {
      const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(SALT_STORAGE_KEY) : null;
      if (stored) {
        const decoded = atob(stored);
        const salt = new Uint8Array(new ArrayBuffer(decoded.length));
        for (let i = 0; i < decoded.length; i++) salt[i] = decoded.charCodeAt(i);
        return salt;
      }
      const salt = fresh();
      if (typeof localStorage !== 'undefined') localStorage.setItem(SALT_STORAGE_KEY, btoa(String.fromCharCode(...salt)));
      return salt;
    } catch {
      return fresh();
    }
  }

  private deriveWithSalt(importedKey: CryptoKey, salt: BufferSource): Promise<CryptoKey> {
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: this.config.keyDerivationRounds, hash: 'SHA-256' },
      importedKey,
      { name: this.config.encryptionAlgorithm, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /** Key for version-1 payloads (constant salt), derived lazily from the same key material. */
  private async legacyMasterKey(): Promise<CryptoKey | null> {
    if (this.legacyKey) return this.legacyKey;
    if (!this.keyMaterialBuffer) return null;
    const importedKey = await crypto.subtle.importKey('raw', this.keyMaterialBuffer, 'PBKDF2', false, ['deriveKey']);
    this.legacyKey = await this.deriveWithSalt(importedKey, new TextEncoder().encode(LEGACY_SALT));
    return this.legacyKey;
  }

  /** True when a payload was written with the legacy constant salt and should be re-encrypted. */
  static isLegacyPayload(payload: EncryptedData): boolean {
    return payload.algorithm !== 'FALLBACK' && (payload.version ?? 1) < ENCRYPTION_VERSION;
  }
  private config: SecurityConfig = {
    encryptionAlgorithm: 'AES-GCM',
    keyDerivationRounds: 100000,
    saltLength: 16,
    ivLength: 12
  };

  private masterKey: CryptoKey | null = null;
  private fallbackKey: string | null = null;

  async generateKey(password?: string): Promise<CryptoKey> {
    // Check if crypto is available
    if (!ClientCryptoManager.isSupported()) {
      // Generate a fallback key for basic obfuscation
      const fingerprint = await this.generateFingerprint();
      this.fallbackKey = password ? `${fingerprint}-${password}` : fingerprint;
      // Return a mock key object
      return { type: 'secret', extractable: false } as CryptoKey;
    }
    
    try {
      // Generate browser fingerprint for key derivation
      const fingerprint = await this.generateFingerprint();
      
      // Combine fingerprint with optional password
      const keyMaterial = password ? `${fingerprint}-${password}` : fingerprint;
      const keyMaterialBuffer = new TextEncoder().encode(keyMaterial);
      
      // Import raw key material
      const importedKey = await crypto.subtle.importKey(
        'raw',
        keyMaterialBuffer,
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Per-installation random salt (version 2). Payloads written before
      // the salt existed (version 1) are decrypted with the legacy constant
      // salt and re-encrypted by SecureStorage on their next read.
      this.keyMaterialBuffer = keyMaterialBuffer;
      const derivedKey = await this.deriveWithSalt(importedKey, this.installationSalt());
      this.masterKey = derivedKey;
      this.legacyKey = null;
      return derivedKey;
    } catch (error) {
      console.error('Failed to generate crypto key:', error);
      // Fallback to basic key
      const fingerprint = await this.generateFingerprint();
      this.fallbackKey = password ? `${fingerprint}-${password}` : fingerprint;
      return { type: 'secret', extractable: false } as CryptoKey;
    }
  }

  async encrypt(data: string, key?: CryptoKey): Promise<EncryptedData> {
    // Check if we need to use fallback
    if (!ClientCryptoManager.isSupported() || this.fallbackKey) {
      // Simple XOR-based obfuscation as fallback
      const obfuscated = this.obfuscateData(data, this.fallbackKey || 'default-key');
      return {
        data: Array.from(new TextEncoder().encode(obfuscated)),
        iv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // Dummy IV
        algorithm: 'FALLBACK',
        version: 1
      };
    }
    
    const encryptionKey = key || this.masterKey;
    if (!encryptionKey) {
      throw new Error('No encryption key available. Call generateKey() first.');
    }

    try {
      // Generate random IV
      const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength));
      
      // Encode data
      const encodedData = new TextEncoder().encode(data);
      
      // Encrypt
      const encrypted = await crypto.subtle.encrypt(
        { name: this.config.encryptionAlgorithm, iv },
        encryptionKey,
        encodedData
      );

      return {
        data: Array.from(new Uint8Array(encrypted)),
        iv: Array.from(iv),
        algorithm: this.config.encryptionAlgorithm,
        version: ENCRYPTION_VERSION
      };
    } catch (error) {
      console.error('Encryption failed:', error);
      // Fall back to obfuscation
      const obfuscated = this.obfuscateData(data, this.fallbackKey || 'default-key');
      return {
        data: Array.from(new TextEncoder().encode(obfuscated)),
        iv: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        algorithm: 'FALLBACK',
        version: 1
      };
    }
  }
  
  private obfuscateData(data: string, key: string): string {
    // Simple XOR obfuscation (not secure, but better than plaintext)
    const result = [];
    for (let i = 0; i < data.length; i++) {
      result.push(String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
    }
    return btoa(result.join(''));
  }

  async decrypt(encryptedData: EncryptedData, key?: CryptoKey): Promise<string> {
    // Check if this is fallback encrypted data
    if (encryptedData.algorithm === 'FALLBACK') {
      const encoded = new TextDecoder().decode(new Uint8Array(encryptedData.data));
      return this.deobfuscateData(encoded, this.fallbackKey || 'default-key');
    }
    
    const legacy = !key && ClientCryptoManager.isLegacyPayload(encryptedData);
    const decryptionKey = key || (legacy ? await this.legacyMasterKey() : this.masterKey);
    if (!decryptionKey) {
      throw new Error('No decryption key available. Call generateKey() first.');
    }

    // Convert arrays back to Uint8Array
    const data = new Uint8Array(encryptedData.data);
    const iv = new Uint8Array(encryptedData.iv);

    try {
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: encryptedData.algorithm, iv },
        decryptionKey,
        data
      );

      // Decode result
      return new TextDecoder().decode(decrypted);
    } catch (_error) {
      void _error;
      throw new Error('Failed to decrypt data. Key may be invalid.');
    }
  }
  
  private deobfuscateData(encoded: string, key: string): string {
    try {
      const decoded = atob(encoded);
      const result = [];
      for (let i = 0; i < decoded.length; i++) {
        result.push(String.fromCharCode(decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length)));
      }
      return result.join('');
    } catch (_error) {
      void _error;
      throw new Error('Failed to deobfuscate data');
    }
  }

  async hash(data: string): Promise<string> {
    const encodedData = new TextEncoder().encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async generateFingerprint(): Promise<string> {
    // Create a browser fingerprint using available APIs
    const components = [];
    
    // Safe properties that should always be available
    try {
      components.push(navigator.userAgent || 'unknown-ua');
      components.push(navigator.language || 'en');
      components.push(typeof screen !== 'undefined' ? `${screen.width}x${screen.height}` : '1920x1080');
      components.push(typeof screen !== 'undefined' ? screen.colorDepth?.toString() || '24' : '24');
      components.push(new Date().getTimezoneOffset().toString());
      components.push(navigator.hardwareConcurrency?.toString() || '4');
      components.push((navigator as NavigatorWithDeviceMemory).deviceMemory?.toString() || '8');
    } catch (error) {
      console.warn('Error collecting fingerprint components:', error);
      // Use fallback values
      components.push('fallback-fingerprint');
    }

    // Add canvas fingerprint if available and not blocked
    if (typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 50;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.textBaseline = 'top';
          ctx.font = '14px Arial';
          ctx.fillText('LexMX fingerprint test', 2, 2);
          components.push(canvas.toDataURL().substring(0, 100)); // Use only part of the data URL
        }
      } catch {
        // Canvas fingerprinting may be blocked
        components.push('canvas-blocked');
      }
    }

    // Add random component for uniqueness if we have too few components
    if (components.length < 3) {
      components.push(`lexmx-${Date.now()}-${Math.random()}`);
    }

    // Combine and hash
    const combined = components.join('|');
    
    // If crypto is not available, use a simple hash
    if (!ClientCryptoManager.isSupported()) {
      return this.simpleHash(combined);
    }
    
    return await this.hash(combined);
  }
  
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  // Test if crypto APIs are available
  static isSupported(): boolean {
    return (
      typeof crypto !== 'undefined' &&
      typeof crypto.subtle !== 'undefined' &&
      typeof crypto.getRandomValues !== 'undefined'
    );
  }

  // Clear master key from memory
  clearKey(): void {
    this.masterKey = null;
  }
}

export const cryptoManager = new ClientCryptoManager();