import { test as base, Page } from '@playwright/test';
import { TestContextManager } from './test-context-manager';
import { setupIsolatedPage, cleanupIsolatedTest, deepCleanState } from './test-helpers';

/**
 * Extended test fixture with isolated context
 */
export interface IsolatedTestFixtures {
  isolatedPage: Page;
  contextManager: TestContextManager;
}

/**
 * Create isolated test fixture
 * This fixture provides complete isolation for parallel test execution
 */
export const test = base.extend<IsolatedTestFixtures>({
  // Override the default page fixture with isolated version
  isolatedPage: async ({ page, browser }, use, testInfo) => {
    // Create isolated context manager
    const contextManager = new TestContextManager(
      testInfo.title,
      testInfo.workerIndex
    );
    
    // For parallel execution, create a new context
    if (testInfo.parallelIndex > 0) {
      // Create new browser context for complete isolation
      const context = await browser.newContext({
        // Each test gets its own storage state
        storageState: undefined,
        // Unique user agent to prevent detection
        userAgent: `LexMX-Test-${contextManager.getTestId()}`,
      });
      
      // Create new page in isolated context
      const isolatedPage = await context.newPage();
      
      // Setup isolation
      await contextManager.injectIsolation(isolatedPage);
      
      // Use the isolated page
      await use(isolatedPage);
      
      // Cleanup
      await cleanupIsolatedTest(isolatedPage, contextManager);
      await context.close();
    } else {
      // For non-parallel execution, use existing page with isolation
      await contextManager.injectIsolation(page);
      await use(page);
      await cleanupIsolatedTest(page, contextManager);
    }
  },
  
  // Provide context manager as a fixture
  contextManager: async ({}, use, testInfo) => {
    const manager = new TestContextManager(
      testInfo.title,
      testInfo.workerIndex
    );
    await use(manager);
  },
});

/**
 * Export expect from playwright for convenience
 */
export { expect } from '@playwright/test';

/**
 * Helper to create test with automatic isolation
 */
export const isolatedTest = test.extend({
  // Automatic setup and teardown
  page: async ({ page }, use, testInfo) => {
    // Setup isolation
    const contextManager = await setupIsolatedPage(page, {
      title: testInfo.title,
      workerIndex: testInfo.workerIndex,
    });
    
    // Store context manager on page for access in tests
    (page as any).contextManager = contextManager;
    
    // Use the page
    await use(page);
    
    // Cleanup
    await cleanupIsolatedTest(page, contextManager);
    await deepCleanState(page);
  },
});

/**
 * Test fixture for sequential execution (debugging)
 */
export const sequentialTest = base.extend({
  // Force sequential execution
  page: async ({ page }, use) => {
    // Clear state before test
    await deepCleanState(page);
    
    // Use page
    await use(page);
    
    // Clear state after test
    await deepCleanState(page);
  },
});

/**
 * Test fixture with mock providers pre-configured
 */
export const testWithMocks = isolatedTest.extend({
  page: async ({ page }, use) => {
    // Setup mock providers
    await page.evaluate(() => {
      // Mock OpenAI
      (window as any).mockOpenAI = {
        initialized: true,
        testConnection: async () => true,
        isAvailable: async () => true,
        chat: async (messages: any[]) => ({
          choices: [{
            message: {
              content: 'Mock legal response from OpenAI',
              role: 'assistant'
            }
          }]
        })
      };
      
      // Mock Claude
      (window as any).mockClaude = {
        initialized: true,
        testConnection: async () => true,
        isAvailable: async () => true,
        chat: async (messages: any[]) => ({
          choices: [{
            message: {
              content: 'Mock legal response from Claude',
              role: 'assistant'
            }
          }]
        })
      };
      
      // Mock WebLLM
      (window as any).webllm = {
        ChatModule: class {
          async reload() { return this; }
          async chat() {
            return {
              choices: [{
                message: {
                  content: 'Mock legal response from WebLLM',
                  role: 'assistant'
                }
              }]
            };
          }
        },
        isWebGPUAvailable: () => true,
      };
    });
    
    // Use page with mocks
    await use(page);
  },
});

/**
 * Describe block with isolated context
 */
export const describe = base.describe;

/**
 * Skip test conditionally
 */
export const skip = test.skip;

/**
 * Run test only
 */
export const only = test.only;