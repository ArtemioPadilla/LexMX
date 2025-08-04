// Secure storage manager with client-side encryption

import type { SecureStorage, EncryptedData, PrivacySettings } from '@/types/security';
import type { ProviderConfig } from '@/types/llm';
import { cryptoManager } from './encryption';

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

  constructor() {
    this.loadPrivacySettings();
    this.setupCleanupHandlers();
  }

  async initialize(masterPassword?: string): Promise<void> {
    // Initialize encryption key
    await cryptoManager.generateKey(masterPassword);
  }

  async store(key: string, data: any): Promise<void> {
    const storageKey = this.prefix + key;
    
    try {
      // Determine if data should be encrypted
      const shouldEncrypt = this.shouldEncryptData(key, data);
      
      if (shouldEncrypt) {
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
      throw new Error(`Failed to store data for key: ${key}`);
    }
  }

  async retrieve(key: string): Promise<any | null> {
    const storageKey = this.prefix + key;
    
    try {
      const storedData = this.retrieveFromBrowser(storageKey);
      if (!storedData) return null;

      if (storedData.encrypted) {
        // Decrypt encrypted data
        const decrypted = await cryptoManager.decrypt(storedData.data);
        return JSON.parse(decrypted);
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
    const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
    
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(this.prefix + 'provider_')) {
        const config = await this.retrieve(key.replace(this.prefix, ''));
        if (config) configs.push(config);
      }
    }
    
    return configs;
  }

  async removeProviderConfig(providerId: string): Promise<void> {
    await this.remove(`provider_${providerId}`);
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
    const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
    storage.setItem(key, JSON.stringify(data));
  }

  private retrieveFromBrowser(key: string): any | null {
    const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
    const item = storage.getItem(key);
    return item ? JSON.parse(item) : null;
  }

  private loadPrivacySettings(): void {
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
    const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
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
    const storage = this.privacySettings.sessionOnly ? sessionStorage : localStorage;
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