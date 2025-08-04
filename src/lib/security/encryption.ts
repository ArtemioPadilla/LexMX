// Client-side encryption utilities for secure data storage

import type { EncryptedData, CryptoManager, SecurityConfig } from '@/types/security';

export class ClientCryptoManager implements CryptoManager {
  private config: SecurityConfig = {
    encryptionAlgorithm: 'AES-GCM',
    keyDerivationRounds: 100000,
    saltLength: 16,
    ivLength: 12
  };

  private masterKey: CryptoKey | null = null;

  async generateKey(password?: string): Promise<CryptoKey> {
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

    // Generate salt
    const salt = new TextEncoder().encode('lexmx-legal-assistant-2024');

    // Derive AES key
    const derivedKey = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: this.config.keyDerivationRounds,
        hash: 'SHA-256'
      },
      importedKey,
      { name: this.config.encryptionAlgorithm, length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.masterKey = derivedKey;
    return derivedKey;
  }

  async encrypt(data: string, key?: CryptoKey): Promise<EncryptedData> {
    const encryptionKey = key || this.masterKey;
    if (!encryptionKey) {
      throw new Error('No encryption key available. Call generateKey() first.');
    }

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
      version: 1
    };
  }

  async decrypt(encryptedData: EncryptedData, key?: CryptoKey): Promise<string> {
    const decryptionKey = key || this.masterKey;
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
    } catch (error) {
      throw new Error('Failed to decrypt data. Key may be invalid.');
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
    const components = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      screen.colorDepth.toString(),
      new Date().getTimezoneOffset().toString(),
      navigator.hardwareConcurrency?.toString() || '0',
      navigator.deviceMemory?.toString() || '0'
    ];

    // Add canvas fingerprint if available
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('LexMX fingerprint', 2, 2);
        components.push(canvas.toDataURL());
      }
    } catch {
      // Canvas fingerprinting may be blocked
    }

    // Combine and hash
    const combined = components.join('|');
    return await this.hash(combined);
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