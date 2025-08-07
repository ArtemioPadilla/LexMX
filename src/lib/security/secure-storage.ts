// Secure storage manager with client-side encryption

import type { SecureStorage, EncryptedData, PrivacySettings } from '../../types/security';
import type { ProviderConfig } from '../../types/llm';
import { cryptoManager, ClientCryptoManager } from './encryption';

export class SecureStorageManager implements SecureStorage {
  private readonly prefix = 'lexmx_';
  private privacySettings: PrivacySettings = {
    encryptTokens: true,
    encryptQueries: false,
    encryptResponses: false,
    clearDataOnExit: false,
    sessionOnly: true,
    analytics: 'none'
  };
  private isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  private cryptoAvailable = false;
  private initialized = false;

  constructor() {
    if (this.isBrowser) {
      this.loadPrivacySettings();
      this.setupCleanupHandlers();
      this.checkCryptoAvailability();
    }
  }

  private checkCryptoAvailability(): void {
    this.cryptoAvailable = ClientCryptoManager.isSupported();
    if (!this.cryptoAvailable) {
      console.warn('Web Crypto API not available. Storage will use fallback mode.');
    }
  }

  async initialize(masterPassword?: string): Promise<void> {
    if (this.initialized) return;
    
    try {
      if (this.cryptoAvailable) {
        // Initialize encryption key
        await cryptoManager.generateKey(masterPassword);
      }
      this.initialized = true;
    } catch (error) {
      console.warn('Failed to initialize encryption:', error);
      // Continue without encryption
      this.initialized = true;
    }
  }

  async store(key: string, data: any): Promise<void> {
    const storageKey = this.prefix + key;
    
    // Ensure we're initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      // Check if storage is available
      if (!this.isBrowser) {
        throw new Error('Storage not available in non-browser environment');
      }
      
      // Determine if data should be encrypted
      const shouldEncrypt = this.shouldEncryptData(key, data) && this.cryptoAvailable;
      
      if (shouldEncrypt) {
        try {
          // Encrypt sensitive data
          const jsonData = JSON.stringify(data);
          const encrypted = await cryptoManager.encrypt(jsonData);
          
          const secureData = {
            encrypted: true,
            data: encrypted,
            timestamp: Date.now(),
            version: 1
          };
          
          this.storeInBrowser(storageKey, secureData);
        } catch (encryptError) {
          console.warn('Encryption failed, storing with base64 encoding:', encryptError);
          // Fallback to base64 encoding for sensitive data
          const jsonData = JSON.stringify(data);
          const encoded = btoa(encodeURIComponent(jsonData));
          
          const fallbackData = {
            encrypted: false,
            encoded: true,
            data: encoded,
            timestamp: Date.now()
          };
          
          this.storeInBrowser(storageKey, fallbackData);
        }
      } else {
        // Store non-sensitive data in plain text
        const plainData = {
          encrypted: false,
          data,
          timestamp: Date.now()
        };
        
        this.storeInBrowser(storageKey, plainData);
      }
    } catch (error) {
      console.error('Error storing secure data:', error);
      // Provide more specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to store data for key "${key}": ${errorMessage}`);
    }
  }

  async retrieve(key: string): Promise<any | null> {
    const storageKey = this.prefix + key;
    
    // Ensure we're initialized
    if (!this.initialized) {
      await this.initialize();
    }
    
    try {
      const storedData = this.retrieveFromBrowser(storageKey);
      if (!storedData) return null;

      if (storedData.encrypted && this.cryptoAvailable) {
        try {
          // Decrypt encrypted data
          const decrypted = await cryptoManager.decrypt(storedData.data);
          return JSON.parse(decrypted);
        } catch (decryptError) {
          console.warn('Decryption failed, clearing corrupted data:', decryptError);
          // Clear corrupted data
          await this.remove(key);
          return null;
        }
      } else if (storedData.encoded) {
        // Decode base64 encoded data
        try {
          const decoded = decodeURIComponent(atob(storedData.data));
          return JSON.parse(decoded);
        } catch (decodeError) {
          console.error('Base64 decode failed:', decodeError);
          return null;
        }
      } else {
        // Return plain data
        return storedData.data;
      }
    } catch (error) {
      console.error('Error retrieving secure data:', error);
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    const storageKey = this.prefix + key;
    
    // Remove from both storage types
    if (this.privacySettings.sessionOnly) {
      sessionStorage.removeItem(storageKey);
    } else {
      localStorage.removeItem(storageKey);
    }
  }

  async clear(): Promise<void> {
    // Clear all LexMX data
    const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
    
    const keysToRemove: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => storage.removeItem(key));
    
    // Clear encryption key from memory
    cryptoManager.clearKey();
  }

  async exists(key: string): Promise<boolean> {
    const storageKey = this.prefix + key;
    const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
    return storage.getItem(storageKey) !== null;
  }

  // Privacy settings management
  updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    this.privacySettings = { ...this.privacySettings, ...settings };
    this.savePrivacySettings();
  }

  getPrivacySettings(): PrivacySettings {
    return { ...this.privacySettings };
  }

  // Provider configuration methods with encryption
  async storeProviderConfig(config: ProviderConfig): Promise<void> {
    await this.store(`provider_${config.id}`, config);
  }

  async getProviderConfig(providerId: string): Promise<ProviderConfig | null> {
    return await this.retrieve(`provider_${providerId}`);
  }

  async getAllProviderConfigs(): Promise<ProviderConfig[]> {
    const configs: ProviderConfig[] = [];
    
    try {
      const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
      
      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key && key.startsWith(this.prefix + 'provider_')) {
          try {
            const config = await this.retrieve(key.replace(this.prefix, ''));
            if (config) configs.push(config);
          } catch (error) {
            console.warn(`Failed to retrieve provider config from key ${key}:`, error);
            // Continue with other configs even if one fails
          }
        }
      }
    } catch (error) {
      console.error('Error accessing storage in getAllProviderConfigs:', error);
      // Return empty array if storage access fails
    }
    
    return configs;
  }

  async removeProviderConfig(providerId: string): Promise<void> {
    await this.remove(`provider_${providerId}`);
  }

  // Preferred provider management
  async getPreferredProvider(): Promise<string | null> {
    return await this.retrieve('preferred_provider');
  }

  async setPreferredProvider(providerId: string): Promise<void> {
    await this.store('preferred_provider', providerId);
  }

  // Query and response caching with privacy controls
  async storeQuery(queryId: string, query: string, response: any): Promise<void> {
    if (!this.privacySettings.encryptQueries && !this.privacySettings.encryptResponses) {
      return; // Don't store if not allowed
    }

    const queryData = {
      query: this.privacySettings.encryptQueries ? query : '[PRIVATE]',
      response: this.privacySettings.encryptResponses ? response : '[PRIVATE]',
      timestamp: Date.now()
    };

    await this.store(`query_${queryId}`, queryData);
  }

  // Utility methods
  private shouldEncryptData(key: string, data: any): boolean {
    // Always encrypt provider configurations (contain API keys)
    if (key.startsWith('provider_')) return true;
    
    // Encrypt queries if enabled
    if (key.startsWith('query_') && this.privacySettings.encryptQueries) return true;
    
    // Check for sensitive data patterns
    if (typeof data === 'object' && data !== null) {
      const jsonStr = JSON.stringify(data).toLowerCase();
      const sensitivePatterns = ['apikey', 'token', 'password', 'secret', 'key'];
      return sensitivePatterns.some(pattern => jsonStr.includes(pattern));
    }
    
    return false;
  }

  private storeInBrowser(key: string, data: any): void {
    if (!this.isBrowser) {
      throw new Error('Browser storage not available');
    }
    
    try {
      const storage = this.getStorage();
      const serialized = JSON.stringify(data);
      
      // Check storage quota
      const stats = this.getStorageStats();
      const dataSize = new Blob([serialized]).size;
      
      if (stats.available < dataSize) {
        // Try to clean up old data
        this.cleanupExpiredData();
        
        // Check again
        const newStats = this.getStorageStats();
        if (newStats.available < dataSize) {
          throw new Error(`Storage quota exceeded. Need ${dataSize} bytes, have ${newStats.available} bytes available.`);
        }
      }
      
      storage.setItem(key, serialized);
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'QuotaExceededError' || error.message.includes('quota')) {
          throw new Error('Storage quota exceeded. Please clear some data and try again.');
        }
        throw error;
      }
      throw new Error('Failed to store data in browser');
    }
  }
  
  private getStorage(): Storage {
    if (!this.isBrowser) {
      throw new Error('Browser storage not available');
    }
    
    // Test storage availability
    const testKey = '_test_storage_' + Date.now();
    
    try {
      if (this.privacySettings.sessionOnly && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(testKey, 'test');
        sessionStorage.removeItem(testKey);
        return sessionStorage;
      }
    } catch {
      console.warn('SessionStorage not available, falling back to localStorage');
    }
    
    try {
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
      return localStorage;
    } catch {
      throw new Error('No storage available. Check browser settings and privacy mode.');
    }
  }

  private retrieveFromBrowser(key: string): any | null {
    if (!this.isBrowser) return null;
    
    try {
      const storage = this.getStorage();
      const item = storage.getItem(key);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Error accessing browser storage:', error);
      return null;
    }
  }

  private loadPrivacySettings(): void {
    if (!this.isBrowser) return;
    
    try {
      // Privacy settings are stored in localStorage (not encrypted) for persistence
      const stored = localStorage.getItem(this.prefix + 'privacy_settings');
      if (stored) {
        this.privacySettings = { ...this.privacySettings, ...JSON.parse(stored) };
      }
    } catch {
      // Use defaults if loading fails
    }
  }

  private savePrivacySettings(): void {
    if (!this.isBrowser) return;
    
    try {
      localStorage.setItem(
        this.prefix + 'privacy_settings',
        JSON.stringify(this.privacySettings)
      );
    } catch {
      // Ignore save errors
    }
  }

  private setupCleanupHandlers(): void {
    if (!this.isBrowser) return;
    
    // Clear data on exit if enabled
    if (this.privacySettings.clearDataOnExit) {
      window.addEventListener('beforeunload', () => {
        this.clear().catch(() => {
          // Ignore cleanup errors
        });
      });
    }

    // Clear session data periodically
    setInterval(() => {
      this.cleanupExpiredData();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  private cleanupExpiredData(): void {
    if (!this.isBrowser) return;
    
    const storage = this.privacySettings.sessionOnly && typeof sessionStorage !== 'undefined'
      ? sessionStorage 
      : localStorage;
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        try {
          const item = JSON.parse(storage.getItem(key) || '{}');
          if (item.timestamp && (now - item.timestamp > maxAge)) {
            keysToRemove.push(key);
          }
        } catch {
          // Remove corrupted entries
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => storage.removeItem(key));
  }

  // Data export for user control
  async exportData(): Promise<any> {
    const exportData: any = {
      version: 1,
      timestamp: Date.now(),
      privacySettings: this.privacySettings,
      providers: {},
      queries: {}
    };

    // Export provider configs (encrypted)
    const configs = await this.getAllProviderConfigs();
    configs.forEach(config => {
      exportData.providers[config.id] = {
        ...config,
        apiKey: config.apiKey ? '[ENCRYPTED]' : undefined
      };
    });

    return exportData;
  }

  // Get storage usage stats
  getStorageStats(): { used: number; available: number; keys: number } {
    if (!this.isBrowser) {
      return { used: 0, available: 0, keys: 0 };
    }
    
    const storage = this.privacySettings.sessionOnly && typeof sessionStorage !== 'undefined'
      ? sessionStorage 
      : localStorage;
    let used = 0;
    let keys = 0;

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.prefix)) {
        const item = storage.getItem(key);
        if (item) {
          used += new Blob([item]).size;
          keys++;
        }
      }
    }

    // Estimate available space (browsers typically allow 5-10MB)
    const available = 5 * 1024 * 1024 - used; // Conservative 5MB limit

    return { used, available, keys };
  }
}

// Global secure storage instance
export const secureStorage = new SecureStorageManager();