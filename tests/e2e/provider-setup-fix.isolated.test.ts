/**
 * Isolated version of provider-setup-fix tests
 * Uses the new test isolation system for parallel execution
 */
import { isolatedTest as test, expect } from '../utils/isolated-fixtures';
import { setupPage, navigateToPage, waitForPageReady, setupAllMockProviders, setupProviderScenario, waitForHydration } from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Provider Setup Fix Verification - Isolated', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    // Clear storage
    await page.goto('http://localhost:4321');
    await waitForHydration(page);await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('basic provider setup and navigation', async ({ page }) => {
    // 1. Go to setup page
    await page.goto('http://localhost:4321/setup');
    await waitForHydration(page);// 2. Verify setup page loads
    const setupContainer = page.locator('.provider-setup');
    await expect(setupContainer).toBeVisible({ timeout: 10000 });
    
    // 3. Click start configuration
    const startButton = page.locator('[data-testid="setup-begin"]');
    await expect(startButton).toBeVisible();
    await startButton.click();
    
    // 4. Wait for profile selection
    await expect(page.locator('h2:has-text("Elige tu Perfil")')).toBeVisible({ timeout: 10000 });
    
    // 5. Click custom configuration
    await page.click('text=//Configuración Personalizada/i/i');
    
    // 6. Wait for provider selection
    await expect(page.locator('h2:has-text("Selecciona Proveedores")')).toBeVisible({ timeout: 10000 });
    
    // 7. Select Ollama (local provider)
    await page.click('div:has-text("Ollama"):has-text("Modelos locales")');
    
    // 8. Click configure
    await page.click('button:has-text("Configurar (1)")');
    
    // 9. Configure Ollama
    await expect(page.locator('h2:has-text("Configurar Ollama")')).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="url"]', 'http://localhost:11434');
    await page.click('button:has-text("Guardar")');
    
    // 10. Wait for completion
    await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
    
    // 11. Check that the button exists
    const startUsingButton = page.locator('button:has-text("Comenzar a Usar LexMX")');
    await expect(startUsingButton).toBeVisible();
    
    // 12. Click the button
    await startUsingButton.click();
    
    // 13. Verify navigation to chat
    await expect(page).toHaveURL(/.*\/chat/, { timeout: 10000 });
    
    // 14. Verify chat interface loads
    await expect(page.locator('[data-testid={${TEST_IDS.chat.container}}]')).toBeVisible({ timeout: 10000 });
  });

  test('provider configuration persists', async ({ page }) => {
    // First, complete a quick setup
    await page.goto('http://localhost:4321/setup');
    await waitForHydration(page);await page.click('[data-testid="setup-begin"]');
    await page.click('text=//Configuración Personalizada/i/i');
    await page.click('div:has-text("Ollama")');
    await page.click('button:has-text("Configurar (1)")');
    await page.fill('input[type="url"]', 'http://localhost:11434');
    await page.click('button:has-text("Guardar")');
    await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
    
    // Navigate to chat
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await expect(page).toHaveURL(/.*\/chat/);
    
    // Reload the page
    await page.reload();
    
    // Check that the chat interface still loads without errors
    await expect(page.locator('[data-testid={${TEST_IDS.chat.container}}]')).toBeVisible({ timeout: 10000 });
    
    // Check that we don't see the "no providers" error immediately
    const noProvidersError = page.locator('text=//No tienes proveedores de IA configurados/i/i');
    
    // Wait a bit to ensure initialization happens
    await page.waitForTimeout(2000);
    
    // The error should not be visible if provider is configured
    const isErrorVisible = await noProvidersError.isVisible();
    expect(isErrorVisible).toBe(false);
  });

  test('shows message when no providers configured', async ({ page }) => {
    // Go directly to chat without setup
    await page.goto('http://localhost:4321/chat');
    await waitForHydration(page);// Wait for chat interface
    await expect(page.locator('[data-testid={${TEST_IDS.chat.container}}]')).toBeVisible({ timeout: 10000 });
    
    // Should show info message about no providers
    const infoMessage = page.locator('text=//No tienes proveedores configurados/i/i');
    await expect(infoMessage).toBeVisible({ timeout: 10000 });
    
    // Try to send a message
    const textarea = page.locator('[data-testid={${TEST_IDS.chat.input}}]');
    await textarea.fill('Test message');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show error about no providers
    const errorMessage = page.locator('text=//No tienes proveedores de IA configurados.*Configuración//i');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});