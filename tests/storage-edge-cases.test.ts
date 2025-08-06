import { test, expect, Page } from '@playwright/test';

// Helper to inject storage monitoring
async function injectStorageMonitor(page: Page) {
  await page.addInitScript(() => {
    // Monitor all storage operations
    const operations: any[] = [];
    
    // Wrap localStorage methods
    const originalSetItem = localStorage.setItem;
    const originalGetItem = localStorage.getItem;
    const originalRemoveItem = localStorage.removeItem;
    
    localStorage.setItem = function(key: string, value: string) {
      operations.push({ type: 'set', key, value, timestamp: Date.now() });
      try {
        return originalSetItem.call(this, key, value);
      } catch (e) {
        operations.push({ type: 'error', key, error: e.message });
        throw e;
      }
    };
    
    localStorage.getItem = function(key: string) {
      operations.push({ type: 'get', key, timestamp: Date.now() });
      return originalGetItem.call(this, key);
    };
    
    localStorage.removeItem = function(key: string) {
      operations.push({ type: 'remove', key, timestamp: Date.now() });
      return originalRemoveItem.call(this, key);
    };
    
    // Expose operations for testing
    (window as any).__storageOperations = operations;
  });
}

test.describe('Storage Edge Cases and Error Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await injectStorageMonitor(page);
  });

  test('should recover from corrupted storage data', async ({ page }) => {
    // Inject corrupted data
    await page.addInitScript(() => {
      // Valid encrypted data structure but corrupted content
      localStorage.setItem('lexmx_provider_openai', '{invalid json}');
      localStorage.setItem('lexmx_provider_claude', '{"encrypted":true,"data":[1,2,3],"iv":[0],"version":1}');
      
      // Valid structure but missing required fields
      localStorage.setItem('lexmx_provider_gemini', '{"encrypted":false}');
    });
    
    await page.goto('/setup');
    
    // Should handle corrupted data gracefully
    await expect(page.locator('.provider-setup')).toBeVisible();
    
    // Check that corrupted providers are not shown
    await page.click('button:has-text("View Configured Providers")');
    const providerCount = await page.locator('.provider-config-item').count();
    expect(providerCount).toBe(0);
  });

  test('should handle concurrent storage operations', async ({ page }) => {
    await page.goto('/setup');
    
    // Simulate concurrent storage operations
    await page.evaluate(() => {
      const promises = [];
      
      // Try to write multiple items concurrently
      for (let i = 0; i < 10; i++) {
        promises.push(
          new Promise((resolve) => {
            setTimeout(() => {
              try {
                localStorage.setItem(`lexmx_concurrent_${i}`, JSON.stringify({
                  data: `test_${i}`,
                  timestamp: Date.now()
                }));
                resolve(true);
              } catch (e) {
                resolve(false);
              }
            }, Math.random() * 100);
          })
        );
      }
      
      return Promise.all(promises);
    });
    
    // Verify all items were stored
    const storedCount = await page.evaluate(() => {
      let count = 0;
      for (let i = 0; i < 10; i++) {
        if (localStorage.getItem(`lexmx_concurrent_${i}`)) {
          count++;
        }
      }
      return count;
    });
    
    expect(storedCount).toBe(10);
  });

  test('should handle storage in private/incognito mode', async ({ browser }) => {
    // Create incognito context
    const context = await browser.newContext({
      storageState: undefined,
      // Simulate private mode restrictions
      permissions: []
    });
    
    const page = await context.newPage();
    
    // Override storage to simulate private mode behavior
    await page.addInitScript(() => {
      // In some browsers, localStorage in private mode throws on setItem
      const storage = new Map();
      
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: (key: string) => storage.get(key) || null,
          setItem: (key: string, value: string) => {
            // Simulate private mode quota (very limited)
            if (storage.size >= 2) {
              throw new Error('QuotaExceededError');
            }
            storage.set(key, value);
          },
          removeItem: (key: string) => storage.delete(key),
          clear: () => storage.clear(),
          key: (index: number) => Array.from(storage.keys())[index] || null,
          get length() { return storage.size; }
        }
      });
    });
    
    await page.goto('/setup');
    
    // Should show warning about limited storage
    await expect(page.locator('text=/Limited storage|Private browsing mode/')).toBeVisible();
    
    await context.close();
  });

  test('should handle storage persistence across tabs', async ({ browser }) => {
    const context = await browser.newContext();
    
    // First tab: Configure provider
    const page1 = await context.newPage();
    await page1.goto('/setup');
    
    // Configure a provider in first tab
    await page1.evaluate(() => {
      localStorage.setItem('lexmx_provider_test', JSON.stringify({
        encrypted: false,
        data: {
          id: 'test',
          name: 'Test Provider',
          apiKey: 'test-key-123'
        },
        timestamp: Date.now()
      }));
    });
    
    // Second tab: Check if configuration is visible
    const page2 = await context.newPage();
    await page2.goto('/setup');
    
    // Verify provider is available in second tab
    const hasProvider = await page2.evaluate(() => {
      const data = localStorage.getItem('lexmx_provider_test');
      return data !== null;
    });
    
    expect(hasProvider).toBe(true);
    
    // Modify in second tab
    await page2.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('lexmx_provider_test') || '{}');
      data.data.apiKey = 'modified-key-456';
      localStorage.setItem('lexmx_provider_test', JSON.stringify(data));
    });
    
    // Check modification is visible in first tab
    await page1.waitForTimeout(100); // Storage events are async
    const modifiedKey = await page1.evaluate(() => {
      const data = JSON.parse(localStorage.getItem('lexmx_provider_test') || '{}');
      return data.data?.apiKey;
    });
    
    expect(modifiedKey).toBe('modified-key-456');
    
    await context.close();
  });

  test('should handle different storage backends gracefully', async ({ page }) => {
    // Test sessionStorage fallback
    await page.addInitScript(() => {
      // Make localStorage throw errors
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: () => { throw new Error('localStorage disabled'); },
          setItem: () => { throw new Error('localStorage disabled'); },
          removeItem: () => { throw new Error('localStorage disabled'); },
          clear: () => { throw new Error('localStorage disabled'); },
          key: () => null,
          length: 0
        }
      });
    });
    
    await page.goto('/setup');
    
    // Should fall back to sessionStorage
    await page.evaluate(() => {
      // Try to store something
      const secureStorage = (window as any).secureStorage;
      if (secureStorage) {
        return secureStorage.store('test-key', { data: 'test' });
      }
    });
    
    // Verify it used sessionStorage
    const usedSessionStorage = await page.evaluate(() => {
      return sessionStorage.getItem('lexmx_test-key') !== null;
    });
    
    expect(usedSessionStorage).toBe(true);
  });

  test('should handle browser fingerprint changes', async ({ page }) => {
    await page.goto('/setup');
    
    // Store encrypted data with one fingerprint
    await page.evaluate(() => {
      // Mock initial fingerprint
      (window as any).__fingerprint = 'fingerprint-1';
      
      const secureStorage = (window as any).secureStorage;
      if (secureStorage) {
        return secureStorage.store('provider_test', {
          apiKey: 'sensitive-key-123',
          provider: 'openai'
        });
      }
    });
    
    // Change fingerprint (simulate browser update, different machine, etc)
    await page.evaluate(() => {
      (window as any).__fingerprint = 'fingerprint-2';
    });
    
    // Try to retrieve with different fingerprint
    const retrieved = await page.evaluate(async () => {
      const secureStorage = (window as any).secureStorage;
      if (secureStorage) {
        try {
          return await secureStorage.retrieve('provider_test');
        } catch (e) {
          return { error: e.message };
        }
      }
    });
    
    // Should handle gracefully (either return null or show error)
    expect(retrieved).toBeTruthy();
  });

  test('should monitor storage usage and warn about limits', async ({ page }) => {
    await page.goto('/setup');
    
    // Fill storage gradually
    for (let i = 0; i < 5; i++) {
      await page.evaluate((index) => {
        const largeData = {
          id: `provider_${index}`,
          data: 'x'.repeat(100 * 1024), // 100KB per item
          timestamp: Date.now()
        };
        localStorage.setItem(`lexmx_provider_${index}`, JSON.stringify(largeData));
      }, i);
    }
    
    // Check storage stats
    const stats = await page.evaluate(() => {
      const secureStorage = (window as any).secureStorage;
      if (secureStorage && secureStorage.getStorageStats) {
        return secureStorage.getStorageStats();
      }
      return null;
    });
    
    expect(stats).toBeTruthy();
    expect(stats.used).toBeGreaterThan(500 * 1024); // At least 500KB used
    expect(stats.keys).toBeGreaterThanOrEqual(5);
    
    // Should show storage warning if approaching limit
    if (stats.available < 1024 * 1024) { // Less than 1MB available
      await expect(page.locator('text=/Storage space running low/')).toBeVisible();
    }
  });

  test('should handle storage cleanup and optimization', async ({ page }) => {
    // Add various types of data
    await page.addInitScript(() => {
      // Old data
      localStorage.setItem('lexmx_old_1', JSON.stringify({
        data: 'old',
        timestamp: Date.now() - (48 * 60 * 60 * 1000) // 48 hours old
      }));
      
      // Recent data
      localStorage.setItem('lexmx_recent_1', JSON.stringify({
        data: 'recent',
        timestamp: Date.now() - (1 * 60 * 60 * 1000) // 1 hour old
      }));
      
      // Corrupted data
      localStorage.setItem('lexmx_corrupted_1', 'not-json');
      
      // Large data
      localStorage.setItem('lexmx_large_1', JSON.stringify({
        data: 'x'.repeat(500 * 1024), // 500KB
        timestamp: Date.now()
      }));
    });
    
    await page.goto('/setup');
    
    // Trigger cleanup
    await page.evaluate(() => {
      const secureStorage = (window as any).secureStorage;
      if (secureStorage && secureStorage.cleanupExpiredData) {
        secureStorage.cleanupExpiredData();
      }
    });
    
    // Check what remains
    const remaining = await page.evaluate(() => {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('lexmx_')) {
          keys.push(key);
        }
      }
      return keys;
    });
    
    // Old and corrupted data should be removed
    expect(remaining).not.toContain('lexmx_old_1');
    expect(remaining).not.toContain('lexmx_corrupted_1');
    
    // Recent and large data should remain
    expect(remaining).toContain('lexmx_recent_1');
    expect(remaining).toContain('lexmx_large_1');
  });

  test('should provide storage analytics', async ({ page }) => {
    await injectStorageMonitor(page);
    await page.goto('/setup');
    
    // Perform various operations
    await page.evaluate(() => {
      const storage = (window as any).secureStorage;
      if (storage) {
        // Write operations
        storage.store('test_1', { data: 'value1' });
        storage.store('test_2', { data: 'value2' });
        
        // Read operations
        storage.retrieve('test_1');
        storage.retrieve('test_2');
        storage.retrieve('non_existent');
        
        // Delete operation
        storage.remove('test_1');
      }
    });
    
    // Get analytics
    const operations = await page.evaluate(() => {
      return (window as any).__storageOperations;
    });
    
    // Verify operations were tracked
    const writeOps = operations.filter((op: any) => op.type === 'set').length;
    const readOps = operations.filter((op: any) => op.type === 'get').length;
    const deleteOps = operations.filter((op: any) => op.type === 'remove').length;
    
    expect(writeOps).toBeGreaterThanOrEqual(2);
    expect(readOps).toBeGreaterThanOrEqual(3);
    expect(deleteOps).toBeGreaterThanOrEqual(1);
  });
});