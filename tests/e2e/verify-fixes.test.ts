import { expect, test, waitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of verify-fixes tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test('verify hydration and service worker fixes', async ({ page }) => {
  // Capture console logs and errors
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    consoleErrors.push(`Page error: ${err.message}`);
  });

  // Navigate to chat page
  await page.goto('http://localhost:4321/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);// Wait for hydration
  await page.waitForSelector('[data-testid="chat-container"]', { state: 'visible', timeout: 5000 });
  // await smartWait(page, "network"); // TODO: Replace with proper wait condition; // Give time for all hydration to complete
  
  // Check that no critical errors occurred
  const criticalErrors = consoleErrors.filter(err => 
    err.includes('Cannot access') || 
    err.includes('before initialization') ||
    err.includes('ReferenceError')
  );
  
  if (criticalErrors.length > 0) {
    console.log('Critical errors found:', criticalErrors);
  }
  
  expect(criticalErrors).toHaveLength(0);
  
  // Verify chat interface is functional
  const textarea = page.locator('[data-testid="chat-input"]');
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeEnabled();
  
  // Check that service worker registered (no cache errors)
  const swErrors = consoleErrors.filter(err => 
    err.includes('Failed to execute') || 
    err.includes('addAll') ||
    err.includes('Cache')
  );
  
  expect(swErrors).toHaveLength(0);
});

test('verify provider setup to chat flow works', async ({ page }) => {
  // Clear storage
  await page.goto('http://localhost:4321');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Complete minimal setup
  await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
  await page.waitForSelector('text=/Configuración Personalizada/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Configuración Personalizada/i');
  
  // Select Ollama (simplest setup)
  await page.locator('div').filter({ hasText: /^Ollama.*Modelos locales/ }).first().click();
  await page.waitForSelector('button:has-text("Configurar")/i)', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")/i)');
  await page.fill('input[type="url"]', 'http://localhost:11434');
  await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
  
  // Wait for completion
  await expect(page.locator('h2:text="¡Configuración Completa!", :has-text(/¡Configuración Completa!/i)')).toBeVisible({ timeout: 5000 });
  
  // Click button and verify navigation
  await page.waitForSelector('button:has-text("Comenzar a Usar LexMX")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Comenzar a Usar LexMX")');
  await expect(page).toHaveURL(/.*\/chat/, { timeout: 5000 });
  
  // Verify chat loads without errors
  await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
});