import { Page, expect, test } from '@playwright/test';
import { waitForHydration as waitForHydrationHelper, waitForComponentHydration } from './hydration-helpers';
import { MockProviderManager, setupMockProviders, ProviderScenarios } from './mock-provider-manager';
import { TestContextManager } from './test-context-manager';

// Re-export waitForHydration
export const waitForHydration = waitForHydrationHelper;

/**
 * Common setup for LexMX tests
 * @param page - Playwright page object
 */
export async function setupPage(page: Page): Promise<void> {
  // Set up console error monitoring
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && 
        !msg.text().includes('Failed to load resource') &&
        !msg.text().includes('favicon.ico') &&
        !msg.text().includes('initialization warning')) {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', (error) => {
    errors.push(error.toString());
  });
  
  // Store errors on page object for later assertion
  (page as any).consoleErrors = errors;
  
  // Ensure page is navigated to a valid URL before any operations
  if (page.url() === 'about:blank') {
    await page.goto('http://localhost:4321');
    await page.waitForLoadState('domcontentloaded');
  }
  
  // Set Spanish as default language for all tests with consistent format
  await page.evaluate(() => {
    localStorage.setItem('language', JSON.stringify('es'));
    document.documentElement.setAttribute('data-language', 'es');
    document.documentElement.lang = 'es';
    // Also set on window for immediate access
    (window as any).__INITIAL_LANGUAGE__ = 'es';
  });
  
  // Wait a bit for language initialization to complete
  await page.waitForTimeout(200);
}

/**
 * Setup page with complete test isolation
 * @param page - Playwright page object
 * @param testInfo - Test information from Playwright
 * @returns TestContextManager instance for this test
 */
export async function setupIsolatedPage(
  page: Page,
  testInfo: { title: string; workerIndex: number }
): Promise<TestContextManager> {
  // Create test context manager
  const contextManager = new TestContextManager(testInfo.title, testInfo.workerIndex);
  
  // Inject isolation before navigation
  await contextManager.injectIsolation(page);
  
  // Navigate to base URL with isolated context
  const baseUrl = contextManager.getBaseUrl();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  
  // Set up error monitoring (isolated per test)
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && 
        !msg.text().includes('Failed to load resource') &&
        !msg.text().includes('favicon.ico') &&
        !msg.text().includes('initialization warning') &&
        !msg.text().includes('Test Isolation')) {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', (error) => {
    errors.push(error.toString());
  });
  
  // Store errors on page object for later assertion
  (page as any).consoleErrors = errors;
  
  // Set Spanish as default language with isolated key
  await page.evaluate((testId) => {
    // Using the namespaced localStorage (already overridden)
    localStorage.setItem('language', JSON.stringify('es'));
    document.documentElement.setAttribute('data-language', 'es');
    document.documentElement.lang = 'es';
    (window as any).__INITIAL_LANGUAGE__ = 'es';
    (window as any).__TEST_ID__ = testId;
  }, contextManager.getTestId());
  
  // Wait for language initialization
  await page.waitForTimeout(200);
  
  return contextManager;
}

/**
 * Clean up isolated test context
 * @param page - Playwright page object
 * @param contextManager - TestContextManager instance
 */
export async function cleanupIsolatedTest(
  page: Page,
  contextManager: TestContextManager
): Promise<void> {
  // Clean up all storage used by this test
  await contextManager.cleanup(page);
  
  // Clear any remaining state
  await page.evaluate(() => {
    // Reset any global state
    if ((window as any).__TEST_CONTEXT__) {
      delete (window as any).__TEST_CONTEXT__;
    }
    if ((window as any).__TEST_ID__) {
      delete (window as any).__TEST_ID__;
    }
  });
}

/**
 * Navigate to a page and wait for hydration
 * @param page - Playwright page object
 * @param path - Path to navigate to
 */
export async function navigateAndWaitForHydration(
  page: Page,
  path: string
): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
  await page.waitForLoadState('networkidle');
  // Additional wait for React components to fully initialize
  await page.waitForTimeout(500);
}

/**
 * Navigate to a page
 * @param page - Playwright page object
 * @param path - Path to navigate to (relative to localhost:4321)
 */
export async function navigateToPage(
  page: Page,
  path: string
): Promise<void> {
  const url = path.startsWith('http') ? path : `http://localhost:4321${path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500); // Allow initial hydration
}

/**
 * Wait for page to be ready
 * @param page - Playwright page object
 */
export async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await waitForHydration(page);
  await page.waitForTimeout(300);
}

/**
 * Set up mock provider configuration
 * @param page - Playwright page object
 * @param providers - Array of provider configurations
 */
export async function setupLegacyMockProviders(
  page: Page,
  providers = [{
    id: 'openai',
    name: 'OpenAI',
    apiKey: 'encrypted-mock-key',
    models: ['gpt-4', 'gpt-3.5-turbo'],
    enabled: true
  }]
): Promise<void> {
  await page.evaluate((providerList) => {
    const mockConfig = {
      providers: providerList,
      activeProvider: providerList[0]?.id || 'openai',
      activeModel: providerList[0]?.models?.[0] || 'gpt-3.5-turbo'
    };
    localStorage.setItem('lexmx_providers', JSON.stringify(mockConfig));
  }, providers);
}

/**
 * Clear all storage data
 * @param page - Playwright page object
 */
export async function clearAllStorage(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      try {
        localStorage.clear();
      } catch (e) {
        // Handle cases where localStorage is not accessible
        console.warn('Could not clear localStorage:', e);
      }
      
      try {
        sessionStorage.clear();
      } catch (e) {
        // Handle cases where sessionStorage is not accessible
        console.warn('Could not clear sessionStorage:', e);
      }
      
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(name => caches.delete(name));
        }).catch(e => {
          console.warn('Could not clear caches:', e);
        });
      }
    });
  } catch (error) {
    // If page is not yet navigated or accessible, ignore the error
    console.warn('Could not clear storage:', error);
  }
}

/**
 * Deep clean all state including DOM, storage, and event listeners
 * @param page - Playwright page object
 */
export async function deepCleanState(page: Page): Promise<void> {
  await page.evaluate(() => {
    // 1. Clear all storage types
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
    
    // 2. Clear IndexedDB databases
    if (window.indexedDB && window.indexedDB.databases) {
      window.indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name) {
            window.indexedDB.deleteDatabase(db.name);
          }
        });
      }).catch(() => {});
    }
    
    // 3. Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      }).catch(() => {});
    }
    
    // 4. Clear all cookies
    document.cookie.split(";").forEach(c => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, 
        "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    
    // 5. Remove all event listeners by cloning body
    const oldBody = document.body;
    const newBody = oldBody.cloneNode(true) as HTMLElement;
    oldBody.parentNode?.replaceChild(newBody, oldBody);
    
    // 6. Clear all intervals and timeouts
    const highestId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestId; i++) {
      clearTimeout(i);
      clearInterval(i);
    }
    
    // 7. Clear any global test state
    const globalKeys = Object.keys(window).filter(key => 
      key.startsWith('__TEST') || 
      key.startsWith('__MOCK') ||
      key.includes('test') ||
      key.includes('Test')
    );
    globalKeys.forEach(key => {
      try { delete (window as any)[key]; } catch (e) {}
    });
    
    // 8. Reset document attributes
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-language');
    document.documentElement.className = '';
    document.body.className = '';
    
    // 9. Clear any React Fiber nodes
    const reactRoot = document.getElementById('root') || document.querySelector('[data-reactroot]');
    if (reactRoot) {
      reactRoot.innerHTML = '';
    }
    
    // 10. Clear console
    if (console.clear) console.clear();
  });
  
  // Wait for cleanup to complete
  await page.waitForTimeout(100);
}

/**
 * Wait for a component to be visible and hydrated
 * @param page - Playwright page object
 * @param selector - CSS selector
 */
export async function waitForComponent(
  page: Page,
  selector: string
): Promise<void> {
  await page.waitForSelector(selector, { state: 'visible' });
  await waitForComponentHydration(page, selector);
}

/**
 * Check that no console errors occurred
 * @param page - Playwright page object
 */
export function assertNoConsoleErrors(page: Page): void {
  const errors = (page as any).consoleErrors || [];
  expect(errors, 'Console errors detected').toHaveLength(0);
}

/**
 * Mock user session
 * @param page - Playwright page object
 * @param user - User data
 */
export async function mockUserSession(
  page: Page,
  user = {
    id: 'test-user-123',
    name: 'Test User',
    email: 'test@example.com'
  }
): Promise<void> {
  await page.evaluate((userData) => {
    localStorage.setItem('lexmx_user', JSON.stringify(userData));
  }, user);
}

/**
 * Wait for API mocking to be ready
 * @param page - Playwright page object
 */
export async function setupAPIMocks(page: Page): Promise<void> {
  // Mock successful API responses
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    
    // Mock different API endpoints
    if (url.includes('/api/validate-key')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true })
      });
    } else if (url.includes('/api/chat')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: 'Mocked legal response',
          sources: [],
          confidence: 0.95
        })
      });
    } else {
      route.continue();
    }
  });
}

/**
 * Helper to fill form fields with proper waits
 * @param page - Playwright page object
 * @param selector - Field selector
 * @param value - Value to fill
 */
export async function fillFormField(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const field = page.locator(selector);
  await field.waitFor({ state: 'visible' });
  await field.click();
  await field.fill('');
  await field.fill(value);
  await expect(field).toHaveValue(value);
}

/**
 * Helper to test mobile responsiveness
 * @param page - Playwright page object
 * @param testCallback - Callback to run tests
 */
export async function testMobileView(
  page: Page,
  testCallback: () => Promise<void>
): Promise<void> {
  const originalSize = page.viewportSize();
  
  // Test mobile view
  await page.setViewportSize({ width: 375, height: 667 });
  await testCallback();
  
  // Restore original size
  if (originalSize) {
    await page.setViewportSize(originalSize);
  }
}

/**
 * Helper to test dark mode
 * @param page - Playwright page object
 * @param testCallback - Callback to run tests
 */
export async function testDarkMode(
  page: Page,
  testCallback: () => Promise<void>
): Promise<void> {
  // Enable dark mode
  await page.evaluate(() => {
    localStorage.setItem('theme', JSON.stringify('dark'));
    document.documentElement.classList.add('dark');
  });
  
  await testCallback();
  
  // Restore light mode
  await page.evaluate(() => {
    localStorage.setItem('theme', JSON.stringify('light'));
    document.documentElement.classList.remove('dark');
  });
}

/**
 * Helper to test language switching
 * @param page - Playwright page object
 * @param language - Language code (es, en)
 */
export async function switchLanguage(
  page: Page,
  language: 'es' | 'en'
): Promise<void> {
  await page.evaluate((lang) => {
    localStorage.setItem('language', lang);
    // Dispatch custom event for language change
    window.dispatchEvent(new CustomEvent('languagechange', { detail: lang }));
  }, language);
  
  // Wait for UI to update
  await page.waitForTimeout(300);
}

/**
 * Set up WebLLM mock provider
 * @param page - Playwright page object
 */
export async function setupWebLLMProvider(page: Page): Promise<void> {
  // First inject the WebLLM mock
  await page.evaluate(() => {
    // Create comprehensive WebLLM mock
    (window as any).webllm = {
      ChatModule: class {
        private engine: any = null;
        
        async reload(modelId: string, config?: any, progressCallback?: any): Promise<any> {
          // Simulate instant initialization
          if (progressCallback) {
            progressCallback({ progress: 1.0, text: 'Mock model ready!' });
          }
          
          this.engine = {
            chat: async (messages: any[]) => ({
              choices: [{
                message: {
                  content: 'Mock legal response from WebLLM',
                  role: 'assistant'
                }
              }]
            }),
            generate: async (prompt: string) => 'Mock legal response from WebLLM',
            resetChat: async () => {},
            unload: async () => {}
          };
          
          return this.engine;
        }
        
        getEngine() {
          return this.engine;
        }
      },
      
      MLCEngine: class {
        async reload() { return this; }
        async chat() { 
          return { 
            choices: [{ 
              message: { 
                content: 'Mock legal response', 
                role: 'assistant' 
              } 
            }] 
          }; 
        }
        async generate() { return 'Mock legal response'; }
        async resetChat() {}
        async unload() {}
      },
      
      prebuiltAppConfig: {
        model_list: [
          {
            model_id: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
            model_name: 'Llama 3.2 3B',
            vram_required_MB: 2048,
          },
          {
            model_id: 'Gemma-2-2b-it-q4f16_1-MLC',
            model_name: 'Gemma 2 2B',
            vram_required_MB: 1536,
          }
        ]
      },
      
      isWebGPUAvailable: () => true,
      hasModelInCache: () => false,
      deleteModelFromCache: async () => {}
    };
    
    // Mark WebLLM as initialized
    (window as any).webllmInitialized = true;
    (window as any).__webllmMockLoaded = true;
  });
  
  // Then set up the provider configuration
  await page.evaluate(() => {
    const webllmConfig = {
      id: 'webllm',
      name: 'WebLLM',
      type: 'local',
      enabled: true,
      model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
      priority: 1
    };
    
    // Store provider config
    localStorage.setItem('lexmx_provider_webllm', JSON.stringify(webllmConfig));
    localStorage.setItem('lexmx_preferred_provider', 'webllm');
    localStorage.setItem('lexmx_providers', JSON.stringify([webllmConfig]));
  });
}

/**
 * Create a test case in case manager
 * @param page - Playwright page object
 * @param caseData - Case data
 */
export async function createTestCase(
  page: Page,
  caseData: any = {
    title: 'Test Case',
    description: 'Test case description',
    client: 'Test Client',
    caseNumber: '123/2024',
    legalArea: 'civil'
  }
): Promise<void> {
  // Get existing cases first
  const existingCases = await page.evaluate(() => {
    return JSON.parse(localStorage.getItem('lexmx_cases') || '[]');
  });
  
  const newCase = {
    id: Date.now().toString(),
    ...caseData,
    status: caseData.status || 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    documents: caseData.documents || [],
    notes: caseData.notes || [],
    conversations: caseData.conversations || [],
    deadlines: caseData.deadlines || [],
    parties: caseData.parties || []
  };
  
  const updatedCases = [...existingCases, newCase];
  
  await page.evaluate((casesData) => {
    localStorage.setItem('lexmx_cases', JSON.stringify(casesData));
  }, updatedCases);
  
  // Force page reload to ensure CaseManager picks up the new case
  await page.reload();
  await page.waitForSelector('.case-manager', { timeout: 5000 });
}

/**
 * Select corpus documents
 * @param page - Playwright page object
 * @param documentIds - Array of document IDs to select
 */
export async function selectCorpusDocuments(
  page: Page,
  documentIds: string[]
): Promise<void> {
  // Open corpus selector
  await page.click('.corpus-selector button').first();
  await page.waitForSelector('.corpus-selector div.absolute', { state: 'visible' });
  
  // Switch to documents tab
  await page.click('button:has-text("Por Documento")');
  
  // Select each document
  for (const docId of documentIds) {
    await page.click(`button[data-doc-id="${docId}"]`);
  }
  
  // Close selector
  await page.keyboard.press('Escape');
}

/**
 * Wait for provider selector to be ready
 * @param page - Playwright page object
 */
export async function waitForProviderSelector(page: Page): Promise<void> {
  await page.waitForSelector('.provider-selector', { state: 'visible' });
  await waitForComponentHydration(page, '.provider-selector');
}

/**
 * Select a provider from the dropdown
 * @param page - Playwright page object
 * @param providerId - Provider ID to select
 */
export async function selectProvider(
  page: Page,
  providerId: string
): Promise<void> {
  // Open provider selector
  await page.click('.provider-selector button').first();
  await page.waitForSelector('.provider-selector div.absolute', { state: 'visible' });
  
  // Select provider by its text content
  const providerName = providerId.charAt(0).toUpperCase() + providerId.slice(1);
  await page.click(`.provider-selector button:has-text("${providerName}")`).first();
}

/**
 * Toggle dark mode using the theme toggle
 * @param page - Playwright page object
 */
export async function toggleDarkMode(page: Page): Promise<void> {
  const themeToggle = page.locator('.theme-toggle button').first();
  await themeToggle.waitFor({ state: 'visible' });
  await themeToggle.click();
  
  // Wait for dropdown to appear - it's a div, not a menu with role
  await page.waitForSelector('.theme-toggle div.absolute', { state: 'visible' });
  
  // Click dark mode option - try both Spanish and English
  const darkButton = page.locator('.theme-toggle button:has-text("Oscuro"), .theme-toggle button:has-text("Dark")').first();
  await darkButton.click();
  
  // Wait for theme to apply
  await page.waitForTimeout(300);
}

/**
 * Check if element is visible in dark mode
 * @param page - Playwright page object
 * @param selector - Element selector
 */
export async function isVisibleInDarkMode(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector).first();
  
  // Check if element exists and is visible
  if (!await element.isVisible()) {
    return false;
  }
  
  // Check if text is readable (contrast check)
  const color = await element.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return styles.color;
  });
  
  // Parse RGB values
  const rgb = color.match(/\d+/g);
  if (!rgb) return false;
  
  // Simple brightness check (higher values = brighter)
  const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
  
  // In dark mode, text should be bright (> 128)
  return brightness > 128;
}

/**
 * Set up all mock providers for testing
 * @param page - Playwright page object
 * @returns MockProviderManager instance
 */
export async function setupAllMockProviders(page: Page): Promise<MockProviderManager> {
  // Setup WebLLM mock (existing function)
  await setupWebLLMProvider(page);
  
  // Setup general provider mocks
  const providerManager = await setupMockProviders(page);
  
  return providerManager;
}

/**
 * Set up provider scenarios for testing
 * @param page - Playwright page object
 * @param scenario - The scenario to set up
 */
export async function setupProviderScenario(
  page: Page, 
  scenario: 'all-need-keys' | 'only-webllm' | 'mixed' | 'rate-limited'
): Promise<void> {
  const manager = await setupAllMockProviders(page);
  const scenarios = new ProviderScenarios(manager);
  
  switch (scenario) {
    case 'all-need-keys':
      await scenarios.allCloudProvidersNeedKeys(page);
      break;
    case 'only-webllm':
      await scenarios.onlyWebLLMAvailable(page);
      break;
    case 'mixed':
      await scenarios.mixedAvailability(page);
      break;
    case 'rate-limited':
      await scenarios.providerWithRateLimit(page, 'openai');
      break;
  }
}