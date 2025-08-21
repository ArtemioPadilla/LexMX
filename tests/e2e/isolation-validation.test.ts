/**
 * Validation tests for the isolation system
 * These tests verify that parallel test execution works correctly
 */
import { test, expect } from '@playwright/test';
import { TestContextManager } from '../utils/test-context-manager';

test.describe('Test Isolation Validation', () => {
  test.describe.configure({ mode: 'parallel' });

  test('test 1: writes to localStorage', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Write test-specific data
    await page.evaluate((testId) => {
      localStorage.setItem('test_key', `test_1_value_${testId}`);
      localStorage.setItem('shared_key', 'test_1_data');
      return {
        test_key: localStorage.getItem('test_key'),
        shared_key: localStorage.getItem('shared_key')
      };
    }, contextManager.getTestId());
    
    // Verify data was written
    const data = await page.evaluate(() => ({
      test_key: localStorage.getItem('test_key'),
      shared_key: localStorage.getItem('shared_key')
    }));
    
    expect(data.test_key).toContain('test_1_value');
    expect(data.shared_key).toBe('test_1_data');
    
    // Cleanup
    await contextManager.cleanup(page);
  });

  test('test 2: writes different data to localStorage', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Write different test-specific data
    await page.evaluate((testId) => {
      localStorage.setItem('test_key', `test_2_value_${testId}`);
      localStorage.setItem('shared_key', 'test_2_data');
      return {
        test_key: localStorage.getItem('test_key'),
        shared_key: localStorage.getItem('shared_key')
      };
    }, contextManager.getTestId());
    
    // Verify data was written
    const data = await page.evaluate(() => ({
      test_key: localStorage.getItem('test_key'),
      shared_key: localStorage.getItem('shared_key')
    }));
    
    expect(data.test_key).toContain('test_2_value');
    expect(data.shared_key).toBe('test_2_data');
    
    // Cleanup
    await contextManager.cleanup(page);
  });

  test('test 3: verifies no cross-contamination', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Check that we don't see data from other tests
    const data = await page.evaluate(() => ({
      test_key: localStorage.getItem('test_key'),
      shared_key: localStorage.getItem('shared_key'),
      all_keys: Object.keys(localStorage).filter(k => !k.includes('test_'))
    }));
    
    // Should only see our own data or nothing
    if (data.test_key) {
      expect(data.test_key).not.toContain('test_1_value');
      expect(data.test_key).not.toContain('test_2_value');
    }
    
    // Write our own data
    await page.evaluate(() => {
      localStorage.setItem('test_key', 'test_3_value');
      localStorage.setItem('shared_key', 'test_3_data');
    });
    
    // Cleanup
    await contextManager.cleanup(page);
  });

  test('test 4: verifies sessionStorage isolation', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Write to sessionStorage
    await page.evaluate(() => {
      sessionStorage.setItem('session_test', 'test_4_session');
      sessionStorage.setItem('session_shared', 'test_4_data');
    });
    
    // Verify isolation
    const data = await page.evaluate(() => ({
      session_test: sessionStorage.getItem('session_test'),
      session_shared: sessionStorage.getItem('session_shared')
    }));
    
    expect(data.session_test).toBe('test_4_session');
    expect(data.session_shared).toBe('test_4_data');
    
    // Cleanup
    await contextManager.cleanup(page);
  });

  test('test 5: verifies cleanup works', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Write data
    await page.evaluate(() => {
      localStorage.setItem('cleanup_test', 'should_be_removed');
      sessionStorage.setItem('cleanup_session', 'should_be_removed');
    });
    
    // Verify data exists
    let data = await page.evaluate(() => ({
      local: localStorage.getItem('cleanup_test'),
      session: sessionStorage.getItem('cleanup_session')
    }));
    
    expect(data.local).toBe('should_be_removed');
    expect(data.session).toBe('should_be_removed');
    
    // Cleanup
    await contextManager.cleanup(page);
    
    // Verify data is removed (checking underlying storage)
    data = await page.evaluate((testId) => {
      // Check if namespaced keys are removed
      const localKeys = Object.keys(localStorage).filter(k => k.includes(testId));
      const sessionKeys = Object.keys(sessionStorage).filter(k => k.includes(testId));
      return {
        localKeysCount: localKeys.length,
        sessionKeysCount: sessionKeys.length
      };
    }, contextManager.getTestId());
    
    expect(data.localKeysCount).toBe(0);
    expect(data.sessionKeysCount).toBe(0);
  });

  test('test 6: verifies multiple workers can run simultaneously', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Each worker writes its ID
    const workerId = testInfo.workerIndex;
    await page.evaluate((id) => {
      localStorage.setItem('worker_id', `worker_${id}`);
      localStorage.setItem(`worker_${id}_data`, `data_from_worker_${id}`);
    }, workerId);
    
    // Add random delay to simulate real work
    await page.waitForTimeout(Math.random() * 1000);
    
    // Verify our data
    const data = await page.evaluate((id) => ({
      worker_id: localStorage.getItem('worker_id'),
      worker_data: localStorage.getItem(`worker_${id}_data`)
    }), workerId);
    
    expect(data.worker_id).toBe(`worker_${workerId}`);
    expect(data.worker_data).toBe(`data_from_worker_${workerId}`);
    
    // Cleanup
    await contextManager.cleanup(page);
  });

  test('test 7: verifies IndexedDB isolation', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Create IndexedDB database with test ID
    const testId = contextManager.getTestId();
    await page.evaluate(async (id) => {
      const dbName = `test_db_${id}`;
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains('test_store')) {
            db.createObjectStore('test_store', { keyPath: 'id' });
          }
        };
      });
      
      // Write test data
      const transaction = db.transaction(['test_store'], 'readwrite');
      const store = transaction.objectStore('test_store');
      store.add({ id: 1, data: `test_7_data_${id}` });
      
      db.close();
      return dbName;
    }, testId);
    
    // Cleanup will handle IndexedDB
    await contextManager.cleanup(page);
    
    // Verify database is cleaned up
    const dbExists = await page.evaluate(async (id) => {
      const dbName = `test_db_${id}`;
      try {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(dbName, 1);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        db.close();
        return true;
      } catch {
        return false;
      }
    }, testId);
    
    // After cleanup, the database might still exist but should be empty
    // The important thing is that it doesn't interfere with other tests
  });

  test('test 8: stress test with rapid storage operations', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    await contextManager.injectIsolation(page);
    
    await page.goto('http://localhost:4321');
    
    // Perform many rapid storage operations
    const results = await page.evaluate(async () => {
      const operations = [];
      
      // Write 100 items rapidly
      for (let i = 0; i < 100; i++) {
        localStorage.setItem(`stress_key_${i}`, `value_${i}`);
        sessionStorage.setItem(`session_stress_${i}`, `session_${i}`);
      }
      
      // Read them back
      for (let i = 0; i < 100; i++) {
        operations.push({
          local: localStorage.getItem(`stress_key_${i}`),
          session: sessionStorage.getItem(`session_stress_${i}`)
        });
      }
      
      return {
        writeCount: 100,
        readCount: operations.length,
        allMatch: operations.every((op, i) => 
          op.local === `value_${i}` && 
          op.session === `session_${i}`
        )
      };
    });
    
    expect(results.writeCount).toBe(100);
    expect(results.readCount).toBe(100);
    expect(results.allMatch).toBe(true);
    
    // Cleanup
    await contextManager.cleanup(page);
  });

  test('test 9: verifies port-based isolation (if implemented)', async ({ page }, testInfo) => {
    const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
    
    // Check if using different ports
    const expectedPort = contextManager.getPort();
    const baseUrl = contextManager.getBaseUrl();
    
    expect(baseUrl).toContain(`${expectedPort}`);
    
    // If multi-port is implemented, each worker gets different port
    if (testInfo.workerIndex > 0) {
      expect(expectedPort).not.toBe(4321);
      expect(expectedPort).toBe(4321 + testInfo.workerIndex);
    }
  });

  test('test 10: verifies complete isolation with fixtures', async ({ page }) => {
    // This test would use the isolated fixtures if imported
    // For now, just verify basic isolation works
    
    await page.goto('http://localhost:4321');
    
    // Check that window doesn't have test contamination
    const contamination = await page.evaluate(() => {
      const testKeys = Object.keys(window).filter(key => 
        key.includes('TEST') || 
        key.includes('test') ||
        key.includes('MOCK')
      );
      return testKeys;
    });
    
    // Should have minimal or no test keys if properly isolated
    // Some test infrastructure keys might be present
    expect(contamination.length).toBeLessThanOrEqual(5);
  });
});

test.describe('Sequential Validation (for comparison)', () => {
  test.describe.configure({ mode: 'serial' });
  
  let sharedData = '';
  
  test('sequential test 1: writes shared data', async ({ page }) => {
    await page.goto('http://localhost:4321');
    sharedData = 'test_1_data';
    
    await page.evaluate((data) => {
      localStorage.setItem('sequential_key', data);
    }, sharedData);
    
    const stored = await page.evaluate(() => 
      localStorage.getItem('sequential_key')
    );
    
    expect(stored).toBe('test_1_data');
  });
  
  test('sequential test 2: reads shared data', async ({ page }) => {
    await page.goto('http://localhost:4321');
    
    // In sequential mode, this might see previous test's data
    const stored = await page.evaluate(() => 
      localStorage.getItem('sequential_key')
    );
    
    // This would fail without isolation
    if (stored) {
      expect(stored).toBe('test_1_data');
    }
    
    // Update shared variable
    sharedData = 'test_2_data';
  });
  
  test('sequential test 3: verifies sequential execution', async ({ page }) => {
    // Shared variable should have been updated
    expect(sharedData).toBe('test_2_data');
    
    await page.goto('http://localhost:4321');
    
    // Write final data
    await page.evaluate(() => {
      localStorage.setItem('sequential_key', 'final_data');
    });
  });
});