import { test, expect } from '@playwright/test';

test.describe('Provider Setup to Chat Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('http://localhost:4321/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('complete provider setup flow and use chat', async ({ page }) => {
    // 1. Navigate to setup page
    await page.goto('http://localhost:4321/setup');
    
    // 2. Wait for setup wizard to load
    await page.waitForSelector('.provider-setup', { state: 'visible' });
    
    // 3. Start configuration
    await page.click('button:has-text("Comenzar Configuración")');
    
    // 4. Select balanced profile
    await page.click('div:has-text("Balanceado"):has-text("Mezcla de rendimiento y costo")');
    
    // 5. Should advance to provider selection
    await expect(page.locator('h2:has-text("Selecciona Proveedores de IA")')).toBeVisible();
    
    // 6. Select OpenAI provider
    await page.click('div:has-text("OpenAI"):has-text("GPT-4")');
    
    // 7. Click configure button
    await page.click('button:has-text("Configurar (1)")');
    
    // 8. Configure OpenAI with test API key
    await expect(page.locator('h2:has-text("Configurar OpenAI")')).toBeVisible();
    await page.fill('input[type="password"]', 'sk-test-1234567890abcdef');
    await page.click('button:has-text("Guardar")');
    
    // 9. Wait for test phase
    await expect(page.locator('h2:has-text("Probando Conexiones")')).toBeVisible({ timeout: 10000 });
    
    // 10. Wait for completion
    await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
    
    // 11. Click "Comenzar a Usar LexMX" button
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // 12. Should navigate to chat page
    await page.waitForURL('**/chat', { timeout: 10000 });
    
    // 13. Wait for chat interface to load
    await page.waitForSelector('.chat-interface', { state: 'visible' });
    
    // 14. Verify no error message about missing providers
    const errorMessage = page.locator('text=/No tienes proveedores de IA configurados/');
    await expect(errorMessage).not.toBeVisible();
    
    // 15. Try sending a message
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    await textarea.fill('¿Qué es el artículo 123 constitucional?');
    
    const sendButton = page.locator('button[aria-label="Enviar mensaje"]');
    await sendButton.click();
    
    // 16. Verify message was sent (should see user message)
    await expect(page.locator('text="¿Qué es el artículo 123 constitucional?"')).toBeVisible();
    
    // 17. Verify processing started (loading indicator or processing message)
    const processingIndicator = page.locator('.animate-spin').or(page.locator('text="Analizando tu consulta legal"'));
    await expect(processingIndicator).toBeVisible();
  });

  test('persists provider configuration after page refresh', async ({ page }) => {
    // 1. Complete setup first
    await page.goto('http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("Claude"):has-text("Razonamiento avanzado")');
    await page.click('button:has-text("Configurar (1)")');
    await page.fill('input[type="password"]', 'sk-ant-test-key');
    await page.click('button:has-text("Guardar")');
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")', { timeout: 10000 });
    
    // 2. Navigate to chat
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 3. Refresh the page
    await page.reload();
    
    // 4. Wait for chat to reinitialize
    await page.waitForSelector('.chat-interface', { state: 'visible' });
    
    // 5. Verify provider is still configured
    const errorMessage = page.locator('text=/No tienes proveedores de IA configurados/');
    await expect(errorMessage).not.toBeVisible();
    
    // 6. Try sending a message to confirm functionality
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    await textarea.fill('Test message after refresh');
    await page.click('button[aria-label="Enviar mensaje"]');
    await expect(page.locator('text="Test message after refresh"')).toBeVisible();
  });

  test('redirects to setup if no providers configured', async ({ page }) => {
    // 1. Clear any existing configurations
    await page.goto('http://localhost:4321/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // 2. Navigate directly to chat without setup
    await page.goto('http://localhost:4321/chat');
    
    // 3. Should show warning message about no providers
    await page.waitForSelector('.chat-interface', { state: 'visible' });
    const warningMessage = page.locator('text=/No tienes proveedores configurados/');
    await expect(warningMessage).toBeVisible({ timeout: 10000 });
    
    // 4. Try to send a message
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    await textarea.fill('Test query without providers');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // 5. Should show error message
    const errorMessage = page.locator('text=/No tienes proveedores de IA configurados/');
    await expect(errorMessage).toBeVisible();
  });

  test('supports multiple provider configuration', async ({ page }) => {
    // 1. Navigate to setup
    await page.goto('http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    
    // 2. Select custom configuration
    await page.click('text="Configuración Personalizada"');
    
    // 3. Select multiple providers
    await page.click('div:has-text("OpenAI"):has-text("GPT-4")');
    await page.click('div:has-text("Claude"):has-text("Razonamiento avanzado")');
    
    // 4. Click configure
    await page.click('button:has-text("Configurar (2)")');
    
    // 5. Configure OpenAI
    await expect(page.locator('h2:has-text("Configurar OpenAI")')).toBeVisible();
    await page.fill('input[type="password"]', 'sk-openai-test-key');
    await page.click('button:has-text("Guardar")');
    
    // 6. Configure Claude
    await expect(page.locator('h2:has-text("Configurar Claude")')).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="password"]', 'sk-ant-claude-test-key');
    await page.click('button:has-text("Guardar")');
    
    // 7. Wait for completion
    await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=/Configuraste 2 proveedor/')).toBeVisible();
    
    // 8. Navigate to chat
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 9. Verify chat works with multiple providers
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    await textarea.fill('Query with multiple providers');
    await page.click('button[aria-label="Enviar mensaje"]');
    await expect(page.locator('text="Query with multiple providers"')).toBeVisible();
  });

  test('handles provider configuration errors gracefully', async ({ page }) => {
    // 1. Navigate to setup
    await page.goto('http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("OpenAI")');
    await page.click('button:has-text("Configurar (1)")');
    
    // 2. Try to save without API key
    await page.click('button:has-text("Guardar")');
    
    // 3. Should remain on configuration page (not advance)
    await expect(page.locator('h2:has-text("Configurar OpenAI")')).toBeVisible();
    
    // 4. Enter invalid API key format
    await page.fill('input[type="password"]', 'invalid-key');
    await page.click('button:has-text("Guardar")');
    
    // 5. May show error or proceed to test - handle both cases
    const errorText = page.locator('text=/formato|inválido|error/i');
    const testingText = page.locator('h2:has-text("Probando Conexiones")');
    
    // Wait for either error or test phase
    await expect(errorText.or(testingText)).toBeVisible({ timeout: 10000 });
  });
});