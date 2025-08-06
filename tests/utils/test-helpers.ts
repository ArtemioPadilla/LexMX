import { Page, expect } from '@playwright/test';
import { waitForHydration, waitForComponentHydration } from './hydration-helpers';

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
        !msg.text().includes('favicon.ico')) {
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
  }
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
  await page.goto(path);
  await waitForHydration(page);
  await page.waitForLoadState('networkidle');
}

/**
 * Set up mock provider configuration
 * @param page - Playwright page object
 * @param providers - Array of provider configurations
 */
export async function setupMockProviders(
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