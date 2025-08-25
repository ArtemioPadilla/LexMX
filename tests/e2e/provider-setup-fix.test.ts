import { expect, test, waitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of provider-setup-fix tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Provider Setup Fix Verification (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    // Clear storage
    await page.goto('http://localhost:4321');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('basic provider setup and navigation', async ({ page }) => {
    // 1. Go to setup page
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Verify setup page loads
    const setupContainer = page.locator(`[data-testid="${TEST_IDS.provider.container}"]`);
    await expect(setupContainer).toBeVisible({ timeout: 5000 });
    
    // 3. Click start configuration
    const startButton = page.locator('[data-testid="setup-begin"]');
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // 4. Wait for profile selection
    await expect(page.locator('h2:text="Elige tu Perfil", :has-text(/Elige tu Perfil/i)')).toBeVisible({ timeout: 5000 });
    
    // 5. Click custom configuration
    await page.waitForSelector('text=/Configuración Personalizada/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Configuración Personalizada/i');
    
    // 6. Wait for provider selection
    await expect(page.locator('h2:text="Selecciona Proveedores", :has-text(/Selecciona Proveedores/i)')).toBeVisible({ timeout: 5000 });
    
    // 7. Select Ollama (local provider)
    await page.waitForSelector('div:text="Ollama", :has-text(/Ollama/i):text="Modelos locales", :has-text(/Modelos locales/i)', { state: 'visible', timeout: 5000 });
    await page.click('div:text="Ollama", :has-text(/Ollama/i):text="Modelos locales", :has-text(/Modelos locales/i)');
    
    // 8. Click configure
    await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
    
    // 9. Configure Ollama
    await expect(page.locator('h2:text="Configurar Ollama", :has-text(/Configurar Ollama/i)')).toBeVisible({ timeout: 5000 });
    await page.fill('input[type="url"]', 'http://localhost:11434');
    await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
    
    // 10. Wait for completion
    await expect(page.locator('h2:text="¡Configuración Completa!", :has-text(/¡Configuración Completa!/i)')).toBeVisible({ timeout: 5000 });
    
    // 11. Check that the button exists
    const startUsingButton = page.locator('button:has-text("Comenzar a Usar LexMX")');
    await expect(startUsingButton).toBeVisible();
    
    // 12. Click the button
    await startUsingButton.click();
    
    // 13. Verify navigation to chat
    await expect(page).toHaveURL(/.*\/chat/, { timeout: 5000 });
    
    // 14. Verify chat interface loads
    await expect(page.locator(`[data-testid="${TEST_IDS.chat.container}"]`)).toBeVisible({ timeout: 5000 });
  });

  test('provider configuration persists', async ({ page }) => {
    // First, complete a quick setup
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    await page.waitForSelector('text=/Configuración Personalizada/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Configuración Personalizada/i');
    await page.waitForSelector('div:text="Ollama", :has-text(/Ollama/i)', { state: 'visible', timeout: 5000 });
    await page.click('div:text="Ollama", :has-text(/Ollama/i)');
    await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
    await page.fill('input[type="url"]', 'http://localhost:11434');
    await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
    await expect(page.locator('h2:text="¡Configuración Completa!", :has-text(/¡Configuración Completa!/i)')).toBeVisible({ timeout: 5000 });
    
    // Navigate to chat
    await page.waitForSelector('button:has-text("Comenzar a Usar LexMX")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await expect(page).toHaveURL(/.*\/chat/);
    
    // Reload the page
    await page.reload();
    
    // Check that the chat interface still loads without errors
    await expect(page.locator(`[data-testid="${TEST_IDS.chat.container}"]`)).toBeVisible({ timeout: 5000 });
    
    // Check that we don't see the "no providers" error immediately
    const noProvidersError = page.locator('text=/No tienes proveedores de IA configurados/i');
    
    // Wait a bit to ensure initialization happens
    // await smartWait(page, "network"); // TODO: Replace with proper wait condition;
    
    // The error should not be visible if provider is configured
    const isErrorVisible = await noProvidersError.isVisible();
    expect(isErrorVisible).toBe(false);
  });

  test('shows message when no providers configured', async ({ page }) => {
    // Go directly to chat without setup
    await page.goto('http://localhost:4321/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Wait for chat interface
    await expect(page.locator(`[data-testid="${TEST_IDS.chat.container}"]`)).toBeVisible({ timeout: 5000 });
    
    // Should show info message about no providers
    const infoMessage = page.locator('text=/No tienes proveedores configurados/i');
    await expect(infoMessage).toBeVisible({ timeout: 5000 });
    
    // Try to send a message
    const textarea = page.locator(`[data-testid="${TEST_IDS.chat.input}"]`);
    await textarea.fill('Test message');
    await page.waitForSelector('button[aria-label="Enviar mensaje"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show error about no providers
    const errorMessage = page.locator('text=/No tienes proveedores de IA configurados.*Configuración/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});