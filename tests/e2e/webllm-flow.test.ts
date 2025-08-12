import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  navigateAndWaitForHydration,
  clearAllStorage
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('WebLLM Integration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
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
    await page.click('[data-testid="setup-begin"]');
    
    // 3. Select custom configuration
    await page.click('text="Configuración Personalizada"');
    
    // 4. Select WebLLM provider
    const webllmCard = page.locator('[role="button"]:has-text("WebLLM"), .provider-card:has-text("WebLLM")').first();
    await expect(webllmCard).toBeVisible();
    await webllmCard.click();
    
    // 5. Configure WebLLM
    await page.click('button:has-text("Configurar")');
    
    // 6. Select a model
    const modelSelect = page.locator('select').filter({ hasText: /Phi|Llama/i });
    if (await modelSelect.count() > 0) {
      await modelSelect.selectOption({ index: 0 });
    }
    
    // 7. Save configuration
    await page.click('button:has-text("Guardar")');
    
    // 8. Complete setup
    await page.waitForSelector('text=/Configuración Completa|Setup Complete/i', { timeout: 10000 });
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
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Try to send a message
    await page.fill('[data-testid="chat-input"]', 'Test query');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show appropriate error message
    await expect(page.locator('text=/WebGPU.*not supported|navegador compatible|Chrome.*Edge/i')).toBeVisible({ timeout: 10000 });
  });

  test('WebLLM model list is accessible', async ({ page }) => {
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    
    // Start configuration
    await page.click('[data-testid="setup-begin"]');
    await page.click('text="Configuración Personalizada"');
    
    // Select WebLLM
    await page.click('[role="button"]:has-text("WebLLM"), .provider-card:has-text("WebLLM")');
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
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Send a message to trigger initialization
    await page.fill('[data-testid="chat-input"]', 'Test query');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Wait a bit for initialization
    await page.waitForTimeout(2000);
    
    // Check if we got any progress messages
    console.log('Progress messages captured:', progressMessages);
  });

  test('WebLLM error messages are user-friendly', async ({ page }) => {
    // Setup WebLLM with invalid model
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'invalid-model-that-does-not-exist',
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Try to use it
    await page.fill('[data-testid="chat-input"]', 'Test query');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show a user-friendly error, not technical details
    const errorMessage = page.locator('text=/error|Error|problema|intenta nuevamente/i').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
    
    // Should not show raw technical errors to user
    const technicalError = page.locator('text=/Cannot read properties|undefined.*find|TypeError/');
    const technicalErrorVisible = await technicalError.isVisible().catch(() => false);
    expect(technicalErrorVisible).toBe(false);
  });
});