import { Page } from '@playwright/test';

/**
 * Test Context Manager - Provides complete isolation for parallel test execution
 * Each test gets its own namespaced storage and state
 */
export class TestContextManager {
  private testId: string;
  private workerId: number;
  private testTitle: string;
  private storageKeys: Set<string> = new Set();

  constructor(testTitle: string, workerId: number) {
    this.testTitle = testTitle;
    this.workerId = workerId;
    // Create unique ID per test and worker
    this.testId = `test_${workerId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getTestId(): string {
    return this.testId;
  }

  getWorkerId(): number {
    return this.workerId;
  }

  /**
   * Create namespaced storage key
   */
  getStorageKey(key: string): string {
    const namespacedKey = `${this.testId}_${key}`;
    this.storageKeys.add(namespacedKey);
    return namespacedKey;
  }

  /**
   * Get all storage keys used by this test
   */
  getUsedKeys(): string[] {
    return Array.from(this.storageKeys);
  }

  /**
   * Inject isolation script into the page
   * This overrides localStorage and sessionStorage to use namespaced keys
   */
  async injectIsolation(page: Page): Promise<void> {
    await page.addInitScript((context) => {
      const { testId } = context;
      
      // Store original methods
      const originalLocalStorageSetItem = Storage.prototype.setItem;
      const originalLocalStorageGetItem = Storage.prototype.getItem;
      const originalLocalStorageRemoveItem = Storage.prototype.removeItem;
      const originalLocalStorageClear = Storage.prototype.clear;
      const originalLocalStorageKey = Storage.prototype.key;
      
      // Track all keys for this test
      const testKeys = new Set<string>();
      
      // Override localStorage methods with namespacing
      Storage.prototype.setItem = function(key: string, value: string) {
        const namespacedKey = `${testId}_${key}`;
        testKeys.add(namespacedKey);
        return originalLocalStorageSetItem.call(this, namespacedKey, value);
      };
      
      Storage.prototype.getItem = function(key: string) {
        const namespacedKey = `${testId}_${key}`;
        return originalLocalStorageGetItem.call(this, namespacedKey);
      };
      
      Storage.prototype.removeItem = function(key: string) {
        const namespacedKey = `${testId}_${key}`;
        testKeys.delete(namespacedKey);
        return originalLocalStorageRemoveItem.call(this, namespacedKey);
      };
      
      Storage.prototype.clear = function() {
        // Only clear keys belonging to this test
        testKeys.forEach(key => {
          originalLocalStorageRemoveItem.call(this, key);
        });
        testKeys.clear();
      };
      
      Storage.prototype.key = function(index: number) {
        // Return only keys belonging to this test
        const filteredKeys = Array.from(testKeys);
        if (index >= 0 && index < filteredKeys.length) {
          // Remove namespace prefix when returning key
          return filteredKeys[index].replace(`${testId}_`, '');
        }
        return null;
      };
      
      // Override length property
      Object.defineProperty(Storage.prototype, 'length', {
        get: function() {
          return testKeys.size;
        },
        configurable: true
      });
      
      // Store test context on window for debugging
      (window as any).__TEST_CONTEXT__ = {
        testId,
        testKeys,
        originalStorage: {
          setItem: originalLocalStorageSetItem,
          getItem: originalLocalStorageGetItem,
          removeItem: originalLocalStorageRemoveItem,
          clear: originalLocalStorageClear
        }
      };
      
      // Also override sessionStorage with same logic
      const sessionTestKeys = new Set<string>();
      const originalSessionSetItem = sessionStorage.setItem.bind(sessionStorage);
      const originalSessionGetItem = sessionStorage.getItem.bind(sessionStorage);
      const originalSessionRemoveItem = sessionStorage.removeItem.bind(sessionStorage);
      
      sessionStorage.setItem = function(key: string, value: string) {
        const namespacedKey = `${testId}_${key}`;
        sessionTestKeys.add(namespacedKey);
        return originalSessionSetItem(namespacedKey, value);
      };
      
      sessionStorage.getItem = function(key: string) {
        const namespacedKey = `${testId}_${key}`;
        return originalSessionGetItem(namespacedKey);
      };
      
      sessionStorage.removeItem = function(key: string) {
        const namespacedKey = `${testId}_${key}`;
        sessionTestKeys.delete(namespacedKey);
        return originalSessionRemoveItem(namespacedKey);
      };
      
      // Log for debugging
      console.log(`[Test Isolation] Initialized for test: ${testId}`);
    }, { testId: this.testId });
  }

  /**
   * Clean up all storage used by this test
   */
  async cleanup(page: Page): Promise<void> {
    await page.evaluate((testId) => {
      // Clean localStorage
      const localKeys = Object.keys(localStorage);
      localKeys.forEach(key => {
        if (key.startsWith(testId)) {
          localStorage.removeItem(key);
        }
      });
      
      // Clean sessionStorage
      const sessionKeys = Object.keys(sessionStorage);
      sessionKeys.forEach(key => {
        if (key.startsWith(testId)) {
          sessionStorage.removeItem(key);
        }
      });
      
      // Clean IndexedDB if needed
      if (window.indexedDB && window.indexedDB.databases) {
        window.indexedDB.databases().then(databases => {
          databases.forEach(db => {
            if (db.name && db.name.includes(testId)) {
              window.indexedDB.deleteDatabase(db.name);
            }
          });
        });
      }
      
      console.log(`[Test Isolation] Cleaned up test: ${testId}`);
    }, this.testId);
  }

  /**
   * Get port for this worker (for multi-port development server)
   */
  getPort(): number {
    return 4321 + this.workerId;
  }

  /**
   * Get base URL for this worker
   */
  getBaseUrl(): string {
    return `http://localhost:${this.getPort()}`;
  }
}