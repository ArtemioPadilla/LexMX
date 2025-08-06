import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  navigateAndWaitForHydration,
  clearAllStorage
} from '../utils/test-helpers';

test.describe('WebLLM Fix Verification', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
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

  test('WebLLM provider is recognized in ProviderFactory', async ({ page }) => {
    // Setup WebLLM in localStorage
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Check console for provider factory errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().includes('Unknown provider')) {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit for initialization
    await page.waitForTimeout(2000);
    
    // Verify no "Unknown provider: webllm" errors
    expect(consoleErrors.filter(err => err.includes('Unknown provider: webllm'))).toHaveLength(0);
  });

  test('No Cache.add() network errors during initialization', async ({ page }) => {
    const cacheErrors: string[] = [];
    
    page.on('pageerror', error => {
      if (error.message.includes('Cache') || error.message.includes('cache')) {
        cacheErrors.push(error.message);
      }
    });
    
    // Navigate to setup
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    
    // Configure WebLLM
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("WebLLM")');
    await page.click('button:has-text("Configurar (1)")');
    
    // Save configuration (don't wait for model download)
    await page.click('button:has-text("Guardar")');
    
    // Wait for any cache errors to appear
    await page.waitForTimeout(3000);
    
    // Verify no Cache.add() errors
    expect(cacheErrors.filter(err => err.includes('Failed to execute \'add\' on \'Cache\''))).toHaveLength(0);
  });

  test('React hydration works correctly on setup page', async ({ page }) => {
    const hydrationErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error' && 
          (msg.text().includes('Hydration') || 
           msg.text().includes('Invalid hook call') ||
           msg.text().includes('Cannot access \'\_\_SECRET_INTERNALS'))) {
        hydrationErrors.push(msg.text());
      }
    });
    
    // Navigate to setup
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    
    // Interact with the page
    await page.click('button:has-text("Comenzar Configuración")');
    
    // Wait for any hydration errors
    await page.waitForTimeout(2000);
    
    // Verify no React hydration errors
    expect(hydrationErrors).toHaveLength(0);
  });

  test('WebLLM testConnection does not trigger model download', async ({ page }) => {
    let modelDownloadStarted = false;
    
    // Monitor for model download attempts
    page.on('console', msg => {
      if (msg.text().includes('Loading model') || 
          msg.text().includes('Downloading') ||
          msg.text().includes('initProgressCallback')) {
        modelDownloadStarted = true;
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
    
    // Navigate to chat (this triggers testConnection)
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Wait for initialization
    await page.waitForTimeout(3000);
    
    // Verify model download was not triggered during testConnection
    expect(modelDownloadStarted).toBe(false);
  });

  test('WebLLM progress modal shows during actual model use', async ({ page }) => {
    // Quick setup with WebLLM
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Send a message to trigger model download
    await page.fill('textarea[placeholder*="consulta legal"]', 'Test query');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Check if progress modal appears (or loading state)
    const progressModal = page.locator('text=/Descargando modelo|Loading model|Analizando/');
    await expect(progressModal).toBeVisible({ timeout: 5000 });
  });
});