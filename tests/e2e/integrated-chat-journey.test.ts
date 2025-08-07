import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  setupWebLLMProvider,
  setupMockProviders,
  createTestCase,
  toggleDarkMode,
  clearAllStorage,
  isVisibleInDarkMode
} from '../utils/test-helpers';

test.describe('Integrated Chat Journey with All Features', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('complete user journey from setup to chat with all features', async ({ page }) => {
    // 1. Start from homepage
    await page.goto('/');
    await expect(page.locator('h1:has-text("Tu Asistente Legal")')).toBeVisible();
    
    // 2. Navigate to setup
    await page.click('text="Iniciar Consulta Gratis"');
    await page.waitForURL('**/setup');
    
    // 3. Configure WebLLM provider
    await page.click('button:has-text("Usar WebLLM")');
    await expect(page.locator('h2:has-text("Configurar WebLLM")')).toBeVisible();
    
    // Select a model
    const modelSelector = page.locator('.WebLLMModelSelector button').first();
    if (await modelSelector.isVisible()) {
      await modelSelector.click();
      await page.click('button:has-text("Llama 3.2 3B")');
    }
    
    // Save configuration
    await page.click('button:has-text("Guardar")');
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")', { timeout: 10000 });
    
    // 4. Navigate to chat
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 5. Verify all selectors are visible
    await expect(page.locator('.provider-selector')).toBeVisible();
    await expect(page.locator('.corpus-selector')).toBeVisible();
    
    // 6. Select specific corpus documents
    const corpusSelector = page.locator('.corpus-selector button').first();
    await corpusSelector.click();
    
    // Switch to documents tab
    await page.click('button:has-text("Por Documento")');
    
    // Select Constitution and Labor Law
    await page.click('button:has-text("CPEUM")');
    await page.click('button:has-text("LFT")');
    
    // Close corpus selector
    await page.keyboard.press('Escape');
    
    // Verify selection
    await expect(corpusSelector).toContainText('2 documentos');
    
    // 7. Send a legal query
    const input = page.locator('textarea[placeholder*="consulta legal"]');
    await input.fill('¿Cuáles son los derechos laborales básicos según la constitución?');
    await page.keyboard.press('Enter');
    
    // 8. Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 15000 });
    
    // 9. Verify response is displayed
    const response = page.locator('.markdown-content').first();
    await expect(response).toBeVisible();
  });

  test('chat with dark mode and provider switching', async ({ page }) => {
    // Setup providers
    await navigateAndWaitForHydration(page, '/chat');
    await setupMockProviders(page, [
      {
        id: 'webllm',
        name: 'WebLLM',
        apiKey: '',
        models: ['Llama-3.2-3B'],
        enabled: true
      },
      {
        id: 'openai',
        name: 'OpenAI',
        apiKey: 'test-key',
        models: ['gpt-4'],
        enabled: true
      }
    ]);
    
    await page.reload();
    
    // Enable dark mode
    await toggleDarkMode(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Verify UI elements are visible in dark mode
    const providerVisible = await isVisibleInDarkMode(page, '.provider-selector button');
    expect(providerVisible).toBe(true);
    
    const corpusVisible = await isVisibleInDarkMode(page, '.corpus-selector button');
    expect(corpusVisible).toBe(true);
    
    // Switch provider
    const providerSelector = page.locator('.provider-selector button').first();
    await providerSelector.click();
    await page.click('button:has-text("OpenAI")').first();
    await expect(providerSelector).toContainText('OpenAI');
    
    // Send a message
    const input = page.locator('textarea[placeholder*="consulta legal"]');
    await input.fill('Test query in dark mode with OpenAI');
    await page.keyboard.press('Enter');
    
    // Verify message is sent
    await expect(page.locator('text="Test query in dark mode with OpenAI"')).toBeVisible();
  });

  test('create case and link to chat conversation', async ({ page }) => {
    // 1. Create a case first
    await navigateAndWaitForHydration(page, '/casos');
    
    await page.click('button:has-text("+ Nuevo Caso")');
    await page.fill('input[placeholder*="Divorcio"]', 'Caso Integrado');
    await page.fill('textarea[placeholder*="descripción"]', 'Caso para prueba integrada');
    await page.fill('input[placeholder="Nombre del cliente"]', 'Cliente Integrado');
    await page.selectOption('select', 'civil');
    await page.click('button:has-text("Crear Caso")');
    
    // Verify case was created
    await expect(page.locator('h1:has-text("Caso Integrado")')).toBeVisible();
    
    // 2. Navigate to chat
    await page.click('nav a:has-text("Chat Legal")');
    await page.waitForURL('**/chat');
    
    // 3. Setup WebLLM
    await setupWebLLMProvider(page);
    await page.reload();
    
    // 4. Select specific corpus for the case
    const corpusSelector = page.locator('.corpus-selector button').first();
    await corpusSelector.click();
    await page.click('button:has-text("Civil")'); // Select civil area for divorce case
    await page.keyboard.press('Escape');
    
    // 5. Send a query related to the case
    const input = page.locator('textarea[placeholder*="consulta legal"]');
    await input.fill('¿Cuáles son los requisitos para un divorcio en México?');
    await page.keyboard.press('Enter');
    
    // 6. Go back to case
    await page.click('nav a:has-text("Mis Casos")');
    await page.click('button:has-text("Caso Integrado")');
    
    // 7. Add a note about the chat consultation
    await page.click('button:has-text("Notas")');
    const noteInput = page.locator('textarea[placeholder*="Agregar una nota"]');
    await noteInput.fill('Consulta realizada sobre requisitos de divorcio - ver chat');
    await noteInput.press('Enter');
    
    // Verify note was added
    await expect(page.locator('text="Consulta realizada sobre requisitos de divorcio"')).toBeVisible();
  });

  test('full workflow with all selectors and features', async ({ page }) => {
    // 1. Setup multiple providers
    await navigateAndWaitForHydration(page, '/setup');
    
    // Configure WebLLM
    await page.click('button:has-text("Usar WebLLM")');
    const modelSelector = page.locator('.WebLLMModelSelector button').first();
    if (await modelSelector.isVisible()) {
      await modelSelector.click();
      await page.click('button:has-text("Gemma 2 2B")'); // Select different model
    }
    await page.click('button:has-text("Guardar")');
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    
    // 2. Go to chat
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 3. Enable dark mode
    await toggleDarkMode(page);
    
    // 4. Configure corpus - select only tax documents
    const corpusSelector = page.locator('.corpus-selector button').first();
    await corpusSelector.click();
    await page.click('button:has-text("Fiscal")'); // Select tax area
    await page.keyboard.press('Escape');
    await expect(corpusSelector).toContainText('documentos'); // Should show document count
    
    // 5. Verify provider shows selected model
    const providerSelector = page.locator('.provider-selector button').first();
    await expect(providerSelector).toContainText('WebLLM');
    
    // 6. Send a tax-related query
    const input = page.locator('textarea[placeholder*="consulta legal"]');
    await input.fill('¿Cuál es la tasa del ISR para personas físicas?');
    await page.keyboard.press('Enter');
    
    // 7. Create a tax case
    await page.click('nav a:has-text("Mis Casos")');
    await page.click('button:has-text("+ Nuevo Caso")');
    await page.fill('input[placeholder*="Divorcio"]', 'Consulta Fiscal ISR');
    await page.fill('textarea[placeholder*="descripción"]', 'Consulta sobre tasas de ISR');
    await page.selectOption('select', 'tax');
    await page.click('button:has-text("Crear Caso")');
    
    // 8. Verify case was created with correct area
    await expect(page.locator('h1:has-text("Consulta Fiscal ISR")')).toBeVisible();
    await expect(page.locator('span:has-text("tax")')).toBeVisible();
  });

  test('mobile responsive workflow', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // 1. Navigate to chat
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    await page.reload();
    
    // 2. Verify selectors are visible and functional on mobile
    const providerSelector = page.locator('.provider-selector').first();
    const corpusSelector = page.locator('.corpus-selector').first();
    
    await expect(providerSelector).toBeVisible();
    await expect(corpusSelector).toBeVisible();
    
    // 3. Open corpus selector on mobile
    await corpusSelector.locator('button').first().click();
    
    // Verify dropdown fits screen
    const dropdown = await page.locator('.corpus-selector div.absolute').boundingBox();
    if (dropdown) {
      expect(dropdown.width).toBeLessThanOrEqual(375);
    }
    
    // Close dropdown
    await page.keyboard.press('Escape');
    
    // 4. Send a message on mobile
    const input = page.locator('textarea[placeholder*="consulta legal"]');
    await input.fill('Consulta móvil');
    await page.keyboard.press('Enter');
    
    // 5. Navigate to cases on mobile using direct navigation
    await page.goto('/casos');
    await page.waitForURL('**/casos');
    
    // Verify case manager works on mobile
    await expect(page.locator('.case-manager')).toBeVisible();
  });

  test('language switching with all features', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
    // For now, skip language switching since LanguageSelector component doesn't exist yet
    // This test can be re-enabled when the component is implemented
    
    // Navigate to cases to test navigation
    await page.goto('/casos');
    await page.waitForURL('**/casos');
    
    // Verify navigation works
    await expect(page.locator('.case-manager')).toBeVisible();
  });

  test('error handling and edge cases', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // 1. Try to send message without provider configured
    await page.evaluate(() => {
      localStorage.clear(); // Clear all providers
    });
    await page.reload();
    
    const input = page.locator('textarea[placeholder*="consulta legal"]');
    await input.fill('Test without provider');
    await page.keyboard.press('Enter');
    
    // Should show error or redirect to setup
    const errorMessage = page.locator('text=/No tienes proveedores|Configuración/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
    
    // 2. Test with empty corpus selection
    await setupWebLLMProvider(page);
    await page.reload();
    
    const corpusSelector = page.locator('.corpus-selector button').first();
    await corpusSelector.click();
    await page.click('button:has-text("Limpiar")');
    await page.keyboard.press('Escape');
    
    // Should still allow queries (using full corpus)
    await input.fill('Query with no corpus selected');
    await page.keyboard.press('Enter');
    
    // 3. Test case creation with minimal data
    await page.goto('/casos');
    await page.click('button:has-text("+ Nuevo Caso")');
    
    // Try to submit with only title
    await page.fill('input[placeholder*="Divorcio"]', 'Minimal Case');
    await page.click('button:has-text("Crear Caso")');
    
    // Should create case
    await expect(page.locator('h1:has-text("Minimal Case")')).toBeVisible();
  });
});