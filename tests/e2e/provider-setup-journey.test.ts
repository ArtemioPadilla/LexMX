import { expect, test, waitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of provider-setup-journey tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Provider Setup to Chat Journey (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    // Clear storage before each test
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      // Set proper lexmx language format for consistency
      localStorage.setItem('lexmx_language', JSON.stringify('es'));
    });
  });

  test('complete provider setup flow and use chat', async ({ page }) => {
    // 1. Navigate to setup page
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Wait for setup wizard to load
    await page.waitForSelector('[data-testid="provider-setup"]', { state: 'visible' });
    
    // 3. Start configuration
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    
    // 4. Select balanced profile using proper data-testid
    await page.waitForSelector('[data-testid="profile-balanced"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="profile-balanced"]');
    
    // 5. Should advance to provider selection (check for provider container)
    await expect(page.locator('[data-testid="provider-setup"]')).toBeVisible();
    
    // 6. Select OpenAI provider using proper data-testid
    await page.waitForSelector('[data-testid="provider-openai"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-openai"]');
    
    // 7. Click configure button - fixed syntax error
    await page.waitForSelector('button:has-text("Configurar"), button:has-text("Configure")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar"), button:has-text("Configure")');
    
    // 8. Configure OpenAI with test API key using proper data-testid
    await expect(page.locator('[data-testid="provider-setup"]')).toBeVisible();
    await page.fill('[data-testid="provider-api-key"]', 'sk-test-1234567890abcdef');
    await page.waitForSelector('[data-testid="provider-save"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-save"]');
    
    // 9. Wait for test phase (check for provider container or success message)
    await expect(page.locator('[data-testid="provider-setup"]')).toBeVisible({ timeout: 5000 });
    
    // 10. Wait for completion
    await expect(page.locator('[data-testid="provider-success"]')).toBeVisible({ timeout: 5000 });
    
    // 11. Click start button (use CTA or navigation)
    await page.waitForSelector('[data-testid="cta-chat"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="cta-chat"]');
    
    // 12. Should navigate to chat page
    await page.waitForURL('**/chat', { timeout: 5000 });
    
    // 13. Wait for chat interface to load
    await page.waitForSelector('[data-testid="chat-container"]', { state: 'visible' });
    
    // 14. Verify no error message about missing providers
    const errorMessage = page.locator('text=/No tienes proveedores de IA configurados/i');
    await expect(errorMessage).not.toBeVisible();
    
    // 15. Try sending a message using proper data-testids
    const textarea = page.locator('[data-testid="chat-input"]');
    await textarea.fill('¿Qué es el artículo 123 constitucional?');
    
    const sendButton = page.locator('[data-testid="chat-send"]');
    await sendButton.click();
    
    // 16. Verify message was sent (should see user message)
    await expect(page.locator('text=/¿Qué es el artículo 123 constitucional?/i')).toBeVisible();
    
    // 17. Verify processing started (loading indicator or processing message)
    const processingIndicator = page.locator('.animate-spin').or(page.locator('text=/Analizando tu consulta legal/i'));
    await expect(processingIndicator).toBeVisible();
  });

  test('persists provider configuration after page refresh', async ({ page }) => {
    // 1. Complete setup first
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    await page.waitForSelector('[data-testid="setup-custom"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-custom"]');
    await page.waitForSelector('[data-testid="provider-claude"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-claude"]');
    await page.waitForSelector('button:has-text("Configurar"), button:has-text("Configure")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar"), button:has-text("Configure")');
    await page.fill('[data-testid="provider-api-key"]', 'sk-ant-test-key');
    await page.waitForSelector('[data-testid="provider-save"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-save"]');
    await page.waitForSelector('[data-testid="provider-success"]', { timeout: 5000 });
    
    // 2. Navigate to chat
    await page.waitForSelector('[data-testid="cta-chat"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="cta-chat"]');
    await page.waitForURL('**/chat');
    
    // 3. Refresh the page
    await page.reload();
    
    // 4. Wait for chat to reinitialize
    await page.waitForSelector('[data-testid="chat-container"]', { state: 'visible' });
    
    // 5. Verify provider is still configured
    const errorMessage = page.locator('text=/No tienes proveedores de IA configurados/i');
    await expect(errorMessage).not.toBeVisible();
    
    // 6. Try sending a message to confirm functionality
    const textarea = page.locator('[data-testid="chat-input"]');
    await textarea.fill('Test message after refresh');
    await page.waitForSelector('[data-testid="chat-send"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="chat-send"]');
    await expect(page.locator('text=/Test message after refresh/i')).toBeVisible();
  });

  test('redirects to setup if no providers configured', async ({ page }) => {
    // 1. Clear any existing configurations
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // 2. Navigate directly to chat without setup
    await page.goto('http://localhost:4321/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 3. Should show warning message about no providers
    await page.waitForSelector('[data-testid="chat-container"]', { state: 'visible' });
    const warningMessage = page.locator('text=/No tienes proveedores configurados/i');
    await expect(warningMessage).toBeVisible({ timeout: 5000 });
    
    // 4. Try to send a message
    const textarea = page.locator('[data-testid="chat-input"]');
    await textarea.fill('Test query without providers');
    await page.waitForSelector('[data-testid="chat-send"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="chat-send"]');
    
    // 5. Should show error message
    const errorMessage = page.locator('text=/No tienes proveedores de IA configurados/i');
    await expect(errorMessage).toBeVisible();
  });

  test('supports multiple provider configuration', async ({ page }) => {
    // 1. Navigate to setup
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    
    // 2. Select custom configuration
    await page.waitForSelector('[data-testid="setup-custom"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-custom"]');
    
    // 3. Select multiple providers
    await page.waitForSelector('[data-testid="provider-openai"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-openai"]');
    await page.waitForSelector('[data-testid="provider-claude"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-claude"]');
    
    // 4. Click configure
    await page.waitForSelector('button:has-text("Configurar"), button:has-text("Configure")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar"), button:has-text("Configure")');
    
    // 5. Configure OpenAI
    await expect(page.locator('[data-testid="provider-setup"]')).toBeVisible();
    await page.fill('[data-testid="provider-api-key"]', 'sk-openai-test-key');
    await page.waitForSelector('[data-testid="provider-save"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-save"]');
    
    // 6. Configure Claude
    await expect(page.locator('[data-testid="provider-setup"]')).toBeVisible({ timeout: 5000 });
    await page.fill('[data-testid="provider-api-key"]', 'sk-ant-claude-test-key');
    await page.waitForSelector('[data-testid="provider-save"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-save"]');
    
    // 7. Wait for completion
    await expect(page.locator('[data-testid="provider-success"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=/Configuraste 2 proveedor/i')).toBeVisible();
    
    // 8. Navigate to chat
    await page.waitForSelector('[data-testid="cta-chat"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="cta-chat"]');
    await page.waitForURL('**/chat');
    
    // 9. Verify chat works with multiple providers
    const textarea = page.locator('[data-testid="chat-input"]');
    await textarea.fill('Query with multiple providers');
    await page.waitForSelector('[data-testid="chat-send"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="chat-send"]');
    await expect(page.locator('text=/Query with multiple providers/i')).toBeVisible();
  });

  test('handles provider configuration errors gracefully', async ({ page }) => {
    // 1. Navigate to setup
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    await page.waitForSelector('[data-testid="setup-custom"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-custom"]');
    await page.waitForSelector('[data-testid="provider-openai"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-openai"]');
    await page.waitForSelector('button:has-text("Configurar")/i)', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")/i)');
    
    // 2. Try to save without API key
    await page.waitForSelector('button:has-text("Guardar"), button:has-text("Save")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar"), button:has-text("Save")');
    
    // 3. Should remain on configuration page (not advance)
    await expect(page.locator('h2:text="Configurar OpenAI", :has-text(/Configurar OpenAI/i)')).toBeVisible();
    
    // 4. Enter invalid API key format
    await page.fill('input[type="password"]', 'invalid-key');
    await page.waitForSelector('button:has-text("Guardar"), button:has-text("Save")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar"), button:has-text("Save")');
    
    // 5. May show error or proceed to test - handle both cases
    const errorText = page.locator('text=/formato|inválido|error/i');
    const testingText = page.locator('h2:text="Probando Conexiones", :has-text(/Probando Conexiones/i)');
    
    // Wait for either error or test phase
    await expect(errorText.or(testingText)).toBeVisible({ timeout: 5000 });
  });
});