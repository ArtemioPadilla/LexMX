/**
 * Enhanced test helpers using centralized test IDs and data
 */

import { Page, expect } from '@playwright/test';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

/**
 * Wait for hydration to complete on a page
 */
export async function waitForHydration(page: Page, timeout = 5000): Promise<void> {
  // Wait for hydration boundary to be replaced with actual content
  await page.waitForSelector('[data-testid*="-loading"]', { 
    state: 'hidden', 
    timeout 
  }).catch(() => {
    // If no loading state, assume already hydrated
  });

  // Additional wait for React to settle
  await page.waitForTimeout(TEST_DATA.timing.hydration);
}

/**
 * Navigate to a page and wait for hydration
 */
export async function navigateWithHydration(
  page: Page, 
  url: string,
  timeout = 10000
): Promise<void> {
  await page.goto(url);
  await waitForHydration(page, timeout);
}

/**
 * Setup WebLLM provider using test IDs
 */
export async function setupWebLLMWithTestIds(page: Page): Promise<void> {
  // Navigate to setup if not already there
  const currentUrl = page.url();
  if (!currentUrl.includes('/setup')) {
    await navigateWithHydration(page, '/setup');
  }

  // Click WebLLM button using test ID
  await page.click(`[data-testid="${TEST_IDS.provider.webllmButton}"]`);
  
  // Wait for configuration screen
  await page.waitForSelector('h2:has-text("Configurar WebLLM")', { timeout: 5000 });
  
  // Save configuration
  await page.click(`[data-testid="${TEST_IDS.provider.saveButton}"]`);
  
  // Wait for success
  await page.waitForSelector(`[data-testid="${TEST_IDS.provider.successMessage}"]`, { 
    timeout: 10000 
  });
}

/**
 * Select corpus using test IDs
 */
export async function selectCorpusWithTestIds(
  page: Page,
  areas?: string[],
  documents?: string[]
): Promise<void> {
  // Open corpus selector
  await page.click(`[data-testid="${TEST_IDS.corpus.selectorToggle}"]`);
  
  // Wait for dropdown
  await page.waitForSelector(`[data-testid="${TEST_IDS.corpus.dropdown}"]`, { 
    timeout: 5000 
  });
  
  // Select areas if provided
  if (areas && areas.length > 0) {
    for (const area of areas) {
      const areaTestId = TEST_IDS.corpus.areaButton(area);
      await page.click(`[data-testid="${areaTestId}"]`);
    }
  }
  
  // Select documents if provided
  if (documents && documents.length > 0) {
    // Switch to documents tab
    await page.click(`[data-testid="${TEST_IDS.corpus.documentTab}"]`);
    
    for (const doc of documents) {
      const docTestId = TEST_IDS.corpus.documentButton(doc);
      await page.click(`[data-testid="${docTestId}"]`);
    }
  }
  
  // Close dropdown
  await page.keyboard.press('Escape');
}

/**
 * Create a case using test IDs
 */
export async function createCaseWithTestIds(
  page: Page,
  caseData: {
    title: string;
    description?: string;
    client?: string;
    area?: string;
  }
): Promise<void> {
  // Click new case button
  await page.click(`[data-testid="${TEST_IDS.cases.newCaseButton}"]`);
  
  // Fill in case details
  await page.fill(`[data-testid="${TEST_IDS.cases.caseTitle}"]`, caseData.title);
  
  if (caseData.description) {
    await page.fill(`[data-testid="${TEST_IDS.cases.caseDescription}"]`, caseData.description);
  }
  
  if (caseData.client) {
    await page.fill(`[data-testid="${TEST_IDS.cases.caseClient}"]`, caseData.client);
  }
  
  if (caseData.area) {
    await page.selectOption(`[data-testid="${TEST_IDS.cases.caseArea}"]`, caseData.area);
  }
  
  // Create the case
  await page.click(`[data-testid="${TEST_IDS.cases.createButton}"]`);
  
  // Wait for case to be created
  await page.waitForSelector(`h1:has-text("${caseData.title}")`, { timeout: 5000 });
}

/**
 * Send a chat message using test IDs
 */
export async function sendChatMessageWithTestIds(
  page: Page,
  message: string
): Promise<void> {
  // Type message
  const input = page.locator(`[data-testid="${TEST_IDS.chat.input}"]`);
  await input.fill(message);
  
  // Send message
  await page.keyboard.press('Enter');
  
  // Wait for message to appear in chat
  await page.waitForSelector(`text="${message}"`, { timeout: 5000 });
}

/**
 * Toggle theme using test IDs
 */
export async function toggleThemeWithTestIds(
  page: Page,
  theme: 'light' | 'dark' | 'system'
): Promise<void> {
  // Open theme dropdown
  await page.click(`[data-testid="${TEST_IDS.theme.toggle}"]`);
  
  // Select theme
  const themeOption = theme === 'light' 
    ? TEST_IDS.theme.lightOption
    : theme === 'dark' 
    ? TEST_IDS.theme.darkOption
    : TEST_IDS.theme.systemOption;
    
  await page.click(`[data-testid="${themeOption}"]`);
  
  // Verify theme applied
  if (theme === 'dark') {
    await expect(page.locator('html')).toHaveClass(/dark/);
  } else if (theme === 'light') {
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  }
}

/**
 * Switch language using test IDs
 */
export async function switchLanguageWithTestIds(
  page: Page,
  language: 'es' | 'en'
): Promise<void> {
  // Open language dropdown
  await page.click(`[data-testid="${TEST_IDS.language.selector}"]`);
  
  // Select language
  const langOption = language === 'es' 
    ? TEST_IDS.language.spanishOption
    : TEST_IDS.language.englishOption;
    
  await page.click(`[data-testid="${langOption}"]`);
  
  // Wait for language change to take effect
  await page.waitForTimeout(TEST_DATA.timing.animation);
}

/**
 * Verify element is visible in dark mode
 */
export async function verifyDarkModeVisibility(
  page: Page,
  testId: string
): Promise<boolean> {
  const element = page.locator(`[data-testid="${testId}"]`);
  
  if (!await element.isVisible()) {
    return false;
  }
  
  // Check text contrast
  const color = await element.evaluate((el) => {
    const styles = window.getComputedStyle(el);
    return styles.color;
  });
  
  // Parse RGB and check brightness
  const rgb = color.match(/\d+/g);
  if (rgb) {
    const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
    return brightness > 100; // Should be bright in dark mode
  }
  
  return false;
}

/**
 * Wait for loading to complete
 */
export async function waitForLoadingComplete(
  page: Page,
  testId: string = TEST_IDS.loading.spinner,
  timeout = 10000
): Promise<void> {
  // Wait for loading indicator to disappear
  await page.waitForSelector(`[data-testid="${testId}"]`, { 
    state: 'hidden', 
    timeout 
  }).catch(() => {
    // Loading might not appear at all
  });
}

/**
 * Clear all storage and reset state
 */
export async function clearAndReset(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Clear IndexedDB
    if ('indexedDB' in window) {
      indexedDB.databases().then(databases => {
        databases.forEach(db => {
          if (db.name) indexedDB.deleteDatabase(db.name);
        });
      });
    }
  });
  
  // Clear cookies
  const context = page.context();
  await context.clearCookies();
}

/**
 * Setup mock providers using test data
 */
export async function setupMockProvidersWithTestData(page: Page): Promise<void> {
  await page.evaluate((providers) => {
    localStorage.setItem('providers', JSON.stringify(providers));
  }, [TEST_DATA.providers.webllm, TEST_DATA.providers.openai]);
}

/**
 * Verify responsive layout
 */
export async function verifyResponsiveLayout(
  page: Page,
  viewport: 'mobile' | 'tablet' | 'desktop'
): Promise<void> {
  const size = TEST_DATA.viewports[viewport];
  await page.setViewportSize(size);
  await page.waitForTimeout(TEST_DATA.timing.animation);
  
  // Verify key elements are visible and properly sized
  const container = page.locator(`[data-testid="${TEST_IDS.chat.container}"]`);
  const box = await container.boundingBox();
  
  if (box) {
    expect(box.width).toBeLessThanOrEqual(size.width);
  }
}

/**
 * Setup all mock providers with test data
 */
export async function setupAllMockProvidersWithTestData(page: Page): Promise<void> {
  // Set up multiple providers using test data
  await page.evaluate((testData) => {
    // WebLLM provider
    localStorage.setItem('lexmx_provider_webllm', JSON.stringify(testData.providers.webllm));
    
    // OpenAI provider
    localStorage.setItem('lexmx_provider_openai', JSON.stringify(testData.providers.openai));
    
    // Claude provider
    localStorage.setItem('lexmx_provider_claude', JSON.stringify(testData.providers.claude));
    
    // Set WebLLM as preferred
    localStorage.setItem('lexmx_preferred_provider', 'webllm');
    
    // Store all providers list
    localStorage.setItem('lexmx_providers', JSON.stringify([
      testData.providers.webllm,
      testData.providers.openai,
      testData.providers.claude
    ]));
  }, TEST_DATA);
  
  // Wait for providers to initialize
  await page.waitForTimeout(TEST_DATA.timing.providerInit || 500);
}