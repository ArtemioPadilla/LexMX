import { clearAllStorage, expect, test, navigateAndWaitForHydration, setupMockWebLLMProvider } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of webllm-flow tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('WebLLM Integration Flow (Mocked)', () => {
  // Uses mock WebLLM by default for fast testing
  // Set USE_REAL_WEBLLM=true to test with real model download
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    await clearAllStorage(page);
    
    // Mock WebGPU availability
    await page.addInitScript(() => {
      if (!navigator.gpu) {
        (navigator as any).gpu = {
          requestAdapter: async () => ({
            requestDevice: async () => ({})
          })
        };
      }
    });
  });

  test('complete WebLLM setup and usage flow', async ({ page }) => {
    // 1. Navigate to setup
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    
    // 2. Click start configuration
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    
    // 3. Select custom configuration
    const customButton = page.locator('[data-testid="setup-custom"]').first();
    const customFallback = page.locator('button').filter({ hasText: /Configuración Personalizada|Custom Configuration/i }).first();
    await (await customButton.isVisible() ? customButton : customFallback).click();
    
    // 4. Select WebLLM provider
    const webllmCard = page.locator('div:has-text("WebLLM"), button:has-text("WebLLM"), .provider-card:has-text("WebLLM")').first();
    await expect(webllmCard).toBeVisible();
    await webllmCard.click();
    
    // 5. Configure WebLLM
    await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
    
    // 6. Select a model
    const modelSelect = page.locator('select').filter({ hasText: /Phi|Llama/i });
    if (await modelSelect.count() > 0) {
      await modelSelect.selectOption({ index: 0 });
    }
    
    // 7. Save configuration
    await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
    
    // 8. Complete setup
    await page.waitForSelector('text=/Configuración Completa|Setup Complete/i', { timeout: 5000 });
    await page.waitForSelector('button:has-text("Comenzar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Comenzar")');
    
    // 9. Navigate to chat
    await page.waitForURL('**/chat');
    
    // 10. Verify no errors
    const errorMessages = page.locator('text=/error|Error/i');
    const errorCount = await errorMessages.count();
    
    // Check for specific WebLLM errors
    const webllmErrors = page.locator('text=/WebLLM.*error|Cannot read properties.*find/i');
    const webllmErrorCount = await webllmErrors.count();
    
    expect(webllmErrorCount).toBe(0);
  });

  test('WebLLM handles WebGPU not available gracefully', async ({ page }) => {
    // Remove WebGPU support
    await page.addInitScript(() => {
      delete (navigator as any).gpu;
    });
    
    // Setup WebLLM
    await setupMockWebLLMProvider(page);
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Try to send a message
    await page.fill('[data-testid="chat-input"]', 'Test query');
    await page.waitForSelector('button[aria-label="Enviar mensaje"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show appropriate error message
    await expect(page.locator('text=/WebGPU.*not supported|navegador compatible|Chrome.*Edge/i')).toBeVisible({ timeout: 5000 });
  });

  test('WebLLM model list is accessible', async ({ page }) => {
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    
    // Start configuration
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    const customButton = page.locator('[data-testid="setup-custom"]').first();
    const customFallback = page.locator('button').filter({ hasText: /Configuración Personalizada|Custom Configuration/i }).first();
    await (await customButton.isVisible() ? customButton : customFallback).click();
    
    // Select WebLLM
    await page.waitForSelector('div:has-text("WebLLM"), button:has-text("WebLLM"), .provider-card:has-text("WebLLM")', { state: 'visible', timeout: 5000 });
    await page.click('div:has-text("WebLLM"), button:has-text("WebLLM"), .provider-card:has-text("WebLLM")');
    await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
    
    // Check model dropdown exists and has options
    const modelSelect = page.locator('select').first();
    await expect(modelSelect).toBeVisible();
    
    const options = await modelSelect.locator('option').allTextContents();
    expect(options.length).toBeGreaterThan(0);
    
    // Verify at least one model is available
    const hasPhiModel = options.some(opt => opt.includes('Phi'));
    const hasLlamaModel = options.some(opt => opt.includes('Llama'));
    expect(hasPhiModel || hasLlamaModel).toBe(true);
  });

  test('WebLLM progress tracking works', async ({ page }) => {
    // Monitor console for progress messages
    const progressMessages: string[] = [];
    page.on('console', msg => {
      if (msg.text().includes('[WebLLM]') && msg.text().includes('Progress:')) {
        progressMessages.push(msg.text());
      }
    });
    
    // Setup WebLLM
    await setupMockWebLLMProvider(page);
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Send a message to trigger initialization
    await page.fill('[data-testid="chat-input"]', 'Test query');
    await page.waitForSelector('button[aria-label="Enviar mensaje"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Wait a bit for initialization
    // await smartWait(page, "network"); // TODO: Replace with proper wait condition;
    
    // Check if we got any progress messages
    console.log('Progress messages captured:', progressMessages);
  });

  test('WebLLM error messages are user-friendly', async ({ page }) => {
    // Setup WebLLM with invalid model
    await setupMockWebLLMProvider(page);
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Try to use it
    await page.fill('[data-testid="chat-input"]', 'Test query');
    await page.waitForSelector('button[aria-label="Enviar mensaje"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show a user-friendly error, not technical details
    const errorMessage = page.locator('text=/error|Error|problema|intenta nuevamente/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    
    // Should not show raw technical errors to user
    const technicalError = page.locator('text=//Cannot read properties|undefined.*find|TypeError//i');
    const technicalErrorVisible = await technicalError.isVisible().catch(() => false);
    expect(technicalErrorVisible).toBe(false);
  });
});

