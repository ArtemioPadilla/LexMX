/**
 * Consolidated test helpers for E2E testing
 * Combines all helper functions into a single source of truth
 */

import { Page, test as base, expect as baseExpect } from '@playwright/test';
import { TestContextManager } from './test-context-manager';
import { MockProviderManager } from '../../src/utils/test-mocks';
import { 
  mockWebLLM, 
  setupMockWebLLMProvider as setupMockWebLLM,
  isWebLLMMockMode,
  simulateModelDownload 
} from './mock-webllm';

// ============================================================================
// Test Fixtures
// ============================================================================

export interface IsolatedTestFixtures {
  page: Page;
  contextManager: TestContextManager;
}

/**
 * Isolated test fixture with proper context management
 */
export const test = base.extend<IsolatedTestFixtures>({
  page: async ({ page, browser }, use, testInfo) => {
    // Create isolated context manager
    const contextManager = new TestContextManager(
      testInfo.title,
      testInfo.workerIndex
    );
    
    // Setup isolation
    await setupIsolatedPage(page, contextManager);
    
    // Use the page
    await use(page);
    
    // Cleanup
    await cleanupIsolatedTest(page, contextManager);
  },
  
  contextManager: async ({}, use, testInfo) => {
    const contextManager = new TestContextManager(
      testInfo.title,
      testInfo.workerIndex
    );
    await use(contextManager);
  }
});

export const expect = baseExpect;

// ============================================================================
// Hydration Helpers
// ============================================================================

/**
 * Comprehensive hydration wait that checks multiple conditions
 */
export async function waitForHydration(page: Page, timeout = 15000): Promise<void> {
  // Wait for initial DOM content
  await page.waitForLoadState('domcontentloaded');
  
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout: timeout / 2 }).catch(() => {
    // Network idle might timeout on pages with continuous updates
  });
  
  // Wait for Astro islands to hydrate
  await page.waitForFunction(
    () => {
      // Check for Astro islands
      const islands = document.querySelectorAll('astro-island[uid]');
      if (islands.length === 0) return true;
      
      const allHydrated = Array.from(islands).every(island => {
        // Check various hydration indicators
        const hasHydrated = 
          island.hasAttribute('hydrate') === false || 
          island.classList.contains('hydrated') ||
          island.querySelector(':scope > *:not(template)') !== null;
        return hasHydrated;
      });
      
      if (!allHydrated) return false;
      
      // Check for React hydration
      const reactRoots = document.querySelectorAll('[data-reactroot], #root, .app-root');
      if (reactRoots.length > 0) {
        // Check if React components have rendered
        return Array.from(reactRoots).every(root => {
          return root.children.length > 0;
        });
      }
      
      // Check for any loading indicators
      const loadingElements = document.querySelectorAll(
        '[data-loading="true"], .loading, .skeleton, [data-testid*="loading"]'
      );
      
      return loadingElements.length === 0;
    },
    { timeout }
  );
  
  // Small delay to ensure interactivity
  await page.waitForTimeout(200);
}

/**
 * Wait for a specific component to be hydrated and interactive
 */
export async function waitForComponentHydration(
  page: Page, 
  selector: string, 
  timeout = 10000
): Promise<void> {
  // Wait for element to exist
  await page.waitForSelector(selector, { state: 'attached', timeout });
  
  // Wait for element to be visible
  await page.waitForSelector(selector, { state: 'visible', timeout });
  
  // Wait for element to be interactive
  await page.waitForFunction(
    (sel) => {
      const element = document.querySelector(sel);
      if (!element) return false;
      
      // Check if element is interactive
      const isInteractive = 
        !element.hasAttribute('disabled') &&
        !element.classList.contains('disabled') &&
        !element.closest('[aria-disabled="true"]');
      
      // Check if element has event listeners (for inputs/buttons)
      if (element.tagName === 'INPUT' || element.tagName === 'BUTTON') {
        // Try to focus the element to check if it's interactive
        try {
          (element as HTMLElement).focus();
          return document.activeElement === element && isInteractive;
        } catch {
          return false;
        }
      }
      
      return isInteractive;
    },
    selector,
    { timeout }
  );
}

// ============================================================================
// Page Setup and Navigation
// ============================================================================

/**
 * Setup page with all necessary configurations
 */
export async function setupPage(page: Page): Promise<void> {
  // Set viewport
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Setup console error monitoring
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error(`[Browser Error] ${msg.text()}`);
    }
  });
  
  // Setup uncaught exception monitoring
  page.on('pageerror', error => {
    console.error(`[Page Error] ${error.message}`);
  });
}

/**
 * Setup isolated page with context manager
 */
export async function setupIsolatedPage(
  page: Page,
  contextManager: TestContextManager
): Promise<void> {
  await setupPage(page);
  
  // Inject isolation scripts
  await contextManager.injectIsolation(page);
  
  // Navigate to base URL
  const baseUrl = contextManager.getBaseUrl();
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  
  // Wait for hydration
  await waitForHydration(page);
}

/**
 * Navigate to a page and wait for hydration
 */
export async function navigateToPage(
  page: Page,
  path: string,
  options: { waitForHydration?: boolean } = { waitForHydration: true }
): Promise<void> {
  const url = path.startsWith('http') ? path : `http://localhost:4321${path}`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  
  if (options.waitForHydration) {
    await waitForHydration(page);
  }
}

/**
 * Navigate and wait for hydration (alias for common pattern)
 */
export async function navigateAndWaitForHydration(
  page: Page,
  path: string
): Promise<void> {
  await navigateToPage(page, path, { waitForHydration: true });
  
  // For casos page, ensure empty cases to prevent example data
  if (path.includes('casos')) {
    await page.evaluate(() => {
      localStorage.setItem('lexmx_cases', JSON.stringify([]));
    });
  }
}

/**
 * Check if element is visible in dark mode
 */
export async function isVisibleInDarkMode(
  page: Page,
  selector: string
): Promise<boolean> {
  const element = page.locator(selector);
  if (!await element.isVisible()) return false;
  
  // Check if element has sufficient contrast in dark mode
  const hasContrast = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return false;
    
    const styles = window.getComputedStyle(el);
    const color = styles.color;
    const bgColor = styles.backgroundColor;
    
    // Simple check - in dark mode, text should not be too dark
    return color !== 'rgb(0, 0, 0)' && color !== '#000000';
  }, selector);
  
  return hasContrast;
}

/**
 * Setup legacy mock providers (for compatibility)
 */
export async function setupLegacyMockProviders(
  page: Page,
  providers: Array<{ id: string; name: string; apiKey?: string; models?: string[]; enabled?: boolean }>
): Promise<void> {
  return setupMockProviders(page, providers);
}

/**
 * Setup provider scenario
 */
export async function setupProviderScenario(
  page: Page,
  scenario: string
): Promise<void> {
  // Setup common provider scenarios
  switch (scenario) {
    case 'webllm-only':
      await setupWebLLMProvider(page);
      break;
    case 'multi-provider':
      await setupMockProviders(page, [
        { id: 'webllm', name: 'WebLLM', models: ['Llama-3.2-3B'] },
        { id: 'openai', name: 'OpenAI', apiKey: 'test-key', models: ['gpt-4'] },
        { id: 'claude', name: 'Claude', apiKey: 'test-key', models: ['claude-3'] }
      ]);
      break;
    default:
      await setupWebLLMProvider(page);
  }
}

/**
 * Setup all mock providers
 */
export async function setupAllMockProviders(page: Page): Promise<any> {
  await setupMockProviders(page, [
    { id: 'webllm', name: 'WebLLM', models: ['Llama-3.2-3B'] },
    { id: 'openai', name: 'OpenAI', apiKey: 'test-key', models: ['gpt-4'] },
    { id: 'claude', name: 'Claude', apiKey: 'test-key', models: ['claude-3'] },
    { id: 'gemini', name: 'Gemini', apiKey: 'test-key', models: ['gemini-pro'] }
  ]);
  
  // Return mock manager for compatibility
  return {
    getProvider: (id: string) => ({ id, name: id, status: 'connected' }),
    getAllProviders: () => ['webllm', 'openai', 'claude', 'gemini']
  };
}

// ============================================================================
// Selector Helpers
// ============================================================================

/**
 * Get element by test ID with fallback to other selectors
 */
export async function getByTestId(
  page: Page,
  testId: string,
  options: { timeout?: number; fallback?: string } = {}
): Promise<any> {
  const { timeout = 5000, fallback } = options;
  
  // Try data-testid first
  const testIdSelector = `[data-testid="${testId}"]`;
  try {
    await page.waitForSelector(testIdSelector, { state: 'visible', timeout: timeout / 2 });
    return page.locator(testIdSelector);
  } catch {
    // Try fallback selector if provided
    if (fallback) {
      await page.waitForSelector(fallback, { state: 'visible', timeout: timeout / 2 });
      return page.locator(fallback);
    }
    throw new Error(`Element with test ID "${testId}" not found`);
  }
}

/**
 * Click element with proper wait
 */
export async function clickElement(
  page: Page,
  selector: string,
  options: { timeout?: number; force?: boolean } = {}
): Promise<void> {
  const { timeout = 10000, force = false } = options;
  
  // Wait for element to be clickable
  await page.waitForSelector(selector, { state: 'visible', timeout });
  await waitForComponentHydration(page, selector, timeout);
  
  // Click with retry logic
  let retries = 3;
  while (retries > 0) {
    try {
      await page.click(selector, { force, timeout: 5000 });
      break;
    } catch (error) {
      retries--;
      if (retries === 0) throw error;
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Fill input with proper wait
 */
export async function fillInput(
  page: Page,
  selector: string,
  value: string,
  options: { timeout?: number; clear?: boolean } = {}
): Promise<void> {
  const { timeout = 10000, clear = true } = options;
  
  // Wait for input to be ready
  await page.waitForSelector(selector, { state: 'visible', timeout });
  await waitForComponentHydration(page, selector, timeout);
  
  // Clear and fill
  if (clear) {
    await page.fill(selector, '');
  }
  await page.fill(selector, value);
}

/**
 * Get text content with i18n support
 */
export async function getTextContent(
  page: Page,
  selector: string,
  options: { timeout?: number } = {}
): Promise<string> {
  const { timeout = 5000 } = options;
  
  await page.waitForSelector(selector, { state: 'visible', timeout });
  const element = page.locator(selector);
  return await element.textContent() || '';
}

// ============================================================================
// Provider and Mock Setup
// ============================================================================

/**
 * Setup WebLLM provider for testing
 * Uses mock by default unless USE_REAL_WEBLLM env var is set
 */
export async function setupWebLLMProvider(page: Page): Promise<void> {
  const useRealWebLLM = process.env.USE_REAL_WEBLLM === 'true';
  
  if (useRealWebLLM) {
    // Use real WebLLM (slow, requires model download)
    await page.evaluate(() => {
      const config = {
        id: 'webllm',
        name: 'WebLLM',
        type: 'local',
        enabled: true,
        apiKey: '',
        baseUrl: '',
        model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        models: ['Llama-3.2-3B-Instruct-q4f16_1-MLC'],
        isConfigured: true,
        status: 'connected',
        isLocalProvider: true,
        priority: 1
      };
      
      localStorage.setItem('provider_webllm', JSON.stringify(config));
      localStorage.setItem('selectedProvider', 'webllm');
      localStorage.setItem('lexmx_providers', JSON.stringify([config]));
      localStorage.setItem('configuredProviders', JSON.stringify(['webllm']));
    });
  } else {
    // Use mock WebLLM (fast, no model download)
    await setupMockWebLLM(page);
  }
}

/**
 * Setup mock providers for testing
 */
export async function setupMockProviders(
  page: Page,
  providers: Array<{ id: string; name: string; apiKey?: string; models?: string[] }>
): Promise<void> {
  await page.evaluate((providerList) => {
    const configuredProviders: string[] = [];
    
    providerList.forEach(provider => {
      const config = {
        id: provider.id,
        name: provider.name,
        enabled: true,
        apiKey: provider.apiKey || 'test-key',
        baseUrl: '',
        models: provider.models || ['test-model'],
        isConfigured: true,
        status: 'connected'
      };
      
      localStorage.setItem(`provider_${provider.id}`, JSON.stringify(config));
      configuredProviders.push(provider.id);
    });
    
    localStorage.setItem('configuredProviders', JSON.stringify(configuredProviders));
    if (configuredProviders.length > 0) {
      localStorage.setItem('selectedProvider', configuredProviders[0]);
    }
  }, providers);
}

// ============================================================================
// Storage and State Management
// ============================================================================

/**
 * Clear all storage and state
 */
export async function clearAllStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear IndexedDB
    if ('indexedDB' in window) {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }
  });
}

/**
 * Cleanup after isolated test
 */
export async function cleanupIsolatedTest(
  page: Page,
  contextManager: TestContextManager
): Promise<void> {
  // Clean up test-specific data
  await contextManager.cleanup(page);
  
  // Clear all storage
  await clearAllStorage(page);
}

// ============================================================================
// UI Interaction Helpers
// ============================================================================

/**
 * Toggle dark mode
 */
export async function toggleDarkMode(page: Page): Promise<void> {
  const themeToggle = await getByTestId(page, 'theme-toggle', {
    fallback: '[data-testid="toggle"]'
  });
  
  await clickElement(page, themeToggle);
  await page.waitForTimeout(300); // Wait for theme transition
  
  // Select dark mode option
  const darkOption = page.locator('button:has-text("Oscuro"), button:has-text("Dark")').first();
  if (await darkOption.isVisible()) {
    await clickElement(page, darkOption);
  }
}

/**
 * Select corpus documents
 */
export async function selectCorpusDocuments(
  page: Page,
  documents: string[]
): Promise<void> {
  // Open corpus selector
  const corpusSelector = await getByTestId(page, 'corpus-selector', {
    fallback: '.corpus-selector button'
  });
  await clickElement(page, corpusSelector);
  
  // Wait for dropdown
  await page.waitForSelector('.corpus-selector .absolute', { state: 'visible' });
  
  // Select documents
  for (const doc of documents) {
    const docButton = page.locator(`button:has-text("${doc}")`).first();
    if (await docButton.isVisible()) {
      await clickElement(page, docButton);
      await page.waitForTimeout(200);
    }
  }
  
  // Close selector
  await page.keyboard.press('Escape');
}

/**
 * Create a test case
 */
export async function createTestCase(
  page: Page,
  caseData: {
    title: string;
    description?: string;
    client?: string;
    area?: string;
  }
): Promise<void> {
  // Import selectors for this helper
  const { CASE_SELECTORS } = await import('../constants/selectors');
  
  // Navigate to cases
  await navigateToPage(page, '/casos');
  
  // Click new case button using centralized selector
  await clickElement(page, CASE_SELECTORS.NEW_CASE_BUTTON);
  
  // Wait for form to appear
  await page.waitForSelector(CASE_SELECTORS.CREATION_FORM);
  
  // Fill case details using data-testid selectors
  await fillInput(page, CASE_SELECTORS.TITLE_INPUT, caseData.title);
  
  if (caseData.description) {
    await fillInput(page, CASE_SELECTORS.DESCRIPTION_INPUT, caseData.description);
  }
  
  if (caseData.client) {
    await fillInput(page, CASE_SELECTORS.CLIENT_INPUT, caseData.client);
  }
  
  if (caseData.area) {
    await page.selectOption(CASE_SELECTORS.LEGAL_AREA_SELECT, { value: caseData.area });
  }
  
  // Create case using submit button selector
  await clickElement(page, CASE_SELECTORS.SUBMIT_BUTTON);
  
  // Wait for case to be created
  await page.waitForSelector(`h1:has-text("${caseData.title}")`, { timeout: 10000 });
}

// ============================================================================
// Assertions
// ============================================================================

/**
 * Assert element is visible with retry logic
 */
export async function assertVisible(
  page: Page,
  selector: string,
  options: { timeout?: number; message?: string } = {}
): Promise<void> {
  const { timeout = 10000, message } = options;
  
  try {
    await page.waitForSelector(selector, { state: 'visible', timeout });
  } catch (error) {
    throw new Error(message || `Element ${selector} is not visible`);
  }
}

/**
 * Assert text content with i18n support
 */
export async function assertTextContent(
  page: Page,
  selector: string,
  expectedTexts: string | string[],
  options: { timeout?: number; exact?: boolean } = {}
): Promise<void> {
  const { timeout = 5000, exact = false } = options;
  const texts = Array.isArray(expectedTexts) ? expectedTexts : [expectedTexts];
  
  await page.waitForSelector(selector, { state: 'visible', timeout });
  const actualText = await getTextContent(page, selector);
  
  const found = texts.some(text => {
    if (exact) {
      return actualText === text;
    } else {
      return actualText.includes(text);
    }
  });
  
  if (!found) {
    throw new Error(`Expected text "${texts.join('" or "')}" not found in "${actualText}"`);
  }
}

// ============================================================================
// Export all functions
// ============================================================================

// Named exports for convenience
export {
  setupMockWebLLM as setupMockWebLLMProvider,
  mockWebLLM,
  isWebLLMMockMode,
  simulateModelDownload
};

export default {
  test,
  expect,
  waitForHydration,
  waitForComponentHydration,
  setupPage,
  setupIsolatedPage,
  navigateToPage,
  getByTestId,
  clickElement,
  fillInput,
  getTextContent,
  setupWebLLMProvider,
  setupMockWebLLMProvider: setupMockWebLLM,
  setupMockProviders,
  clearAllStorage,
  cleanupIsolatedTest,
  toggleDarkMode,
  selectCorpusDocuments,
  createTestCase,
  assertVisible,
  assertTextContent,
  mockWebLLM,
  isWebLLMMockMode,
  simulateModelDownload
};