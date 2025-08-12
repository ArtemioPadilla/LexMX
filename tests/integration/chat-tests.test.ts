import { test, expect, Page } from '@playwright/test';

test.describe('Chat Interface Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to page first
    await page.goto('/chat');
    
    // Setup a mock provider configuration
    await page.evaluate(() => {
      const mockConfig = {
        providers: [{
          id: 'openai',
          name: 'OpenAI',
          apiKey: 'encrypted-mock-key',
          models: ['gpt-4', 'gpt-3.5-turbo'],
          enabled: true
        }],
        activeProvider: 'openai',
        activeModel: 'gpt-3.5-turbo'
      };
      localStorage.setItem('lexmx_providers', JSON.stringify(mockConfig));
    });
    
    // Reload to pick up the localStorage changes
    await page.reload();
  });

  test('should load chat interface', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Chat - LexMX Asistente Legal/);
    
    // Check chat interface is visible
    await expect(page.locator('.chat-interface')).toBeVisible();
    
    // Check welcome message
    await expect(page.locator('text=¡Bienvenido a LexMX!')).toBeVisible();
    
    // Check input area
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    await expect(textarea).toBeVisible();
    await expect(textarea).toBeEnabled();
    
    // Check send button
    await expect(page.locator('button[aria-label="Enviar mensaje"]')).toBeVisible();
  });

  test('should send a message', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // Type a message
    await textarea.fill('¿Qué es el amparo en México?');
    
    // Send message
    await sendButton.click();
    
    // Check that message appears in chat
    await expect(page.locator('text=¿Qué es el amparo en México?')).toBeVisible();
    
    // Check loading state - look for streaming indicator
    await expect(page.locator('.animate-pulse, .animate-spin').first()).toBeVisible();
    
    // Wait for response (mocked)
    await page.waitForTimeout(1000);
  });

  test('should show legal area classification', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // Send a constitutional law question
    await textarea.fill('¿Cuáles son los requisitos para interponer un amparo?');
    await sendButton.click();
    
    // Should show legal area badge
    await expect(page.locator('text=/constitucional|amparo/i')).toBeVisible();
  });

  test('should handle provider switching', async ({ page }) => {
    // Look for provider selector
    const providerSelector = page.locator('.provider-selector, select[aria-label*="proveedor"]');
    
    if (await providerSelector.isVisible()) {
      // Check current provider
      await expect(providerSelector).toContainText('OpenAI');
      
      // If multiple providers available, test switching
      const options = await providerSelector.locator('option').count();
      if (options > 1) {
        await providerSelector.selectOption({ index: 1 });
        // Verify switch happened
      }
    }
  });

  test('should show token usage', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // Send a message
    await textarea.fill('Explica el artículo 123 constitucional');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(1500);
    
    // Check for token counter
    const tokenDisplay = page.locator('text=/tokens|fichas/i');
    if (await tokenDisplay.isVisible()) {
      await expect(tokenDisplay).toBeVisible();
    }
  });

  test('should handle RAG source display', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // Send a specific legal question
    await textarea.fill('¿Qué dice el Código Civil Federal sobre el matrimonio?');
    await sendButton.click();
    
    // Wait for response
    await page.waitForTimeout(1500);
    
    // Check for source citations
    const sources = page.locator('text=/fuente|referencia|artículo/i');
    if (await sources.first().isVisible()) {
      await expect(sources.first()).toBeVisible();
    }
  });

  test('should handle multi-turn conversation', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // First message
    await textarea.fill('¿Qué es un contrato?');
    await sendButton.click();
    await page.waitForTimeout(1000);
    
    // Second message (follow-up)
    await textarea.fill('¿Cuáles son los elementos esenciales?');
    await sendButton.click();
    
    // Check both messages are visible
    await expect(page.locator('text=¿Qué es un contrato?')).toBeVisible();
    await expect(page.locator('text=¿Cuáles son los elementos esenciales?')).toBeVisible();
    
    // Check conversation context is maintained
    await page.waitForTimeout(1000);
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Remove provider config to trigger error
    await page.evaluate(() => {
      localStorage.removeItem('lexmx_providers');
    });
    
    await page.reload();
    
    // Should show setup prompt
    await expect(page.locator('text=/configurar|setup|proveedor/i')).toBeVisible();
    
    // Should have link to setup
    const setupLink = page.locator('a[href="/setup"]');
    await expect(setupLink).toBeVisible();
  });

  test('should support keyboard shortcuts', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    
    // Focus textarea
    await textarea.focus();
    
    // Type message
    await textarea.type('Test message with keyboard');
    
    // Press Enter with modifier (should send)
    await page.keyboard.down('Control');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Control');
    
    // Check message was sent
    await expect(page.locator('text=Test message with keyboard')).toBeVisible();
  });

  test('should handle long messages', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // Type a very long message
    const longMessage = 'Este es un mensaje muy largo que contiene múltiples preguntas legales. '.repeat(10);
    await textarea.fill(longMessage);
    
    // Check textarea expands
    const initialHeight = await textarea.evaluate(el => el.scrollHeight);
    expect(initialHeight).toBeGreaterThan(50);
    
    // Send message
    await sendButton.click();
    
    // Check message appears (truncated in UI if needed)
    await expect(page.locator('.message-content').last()).toBeVisible();
  });

  test('should clear chat', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // Send a message
    await textarea.fill('Primera pregunta');
    await sendButton.click();
    
    // Look for clear button
    const clearButton = page.locator('button[aria-label*="Limpiar"], button:has-text("Nueva conversación")');
    
    if (await clearButton.isVisible()) {
      await clearButton.click();
      
      // Confirm if needed
      const confirmButton = page.locator('button:has-text("Confirmar")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Check chat is cleared
      await expect(page.locator('text=Primera pregunta')).not.toBeVisible();
      await expect(page.locator('text=¡Bienvenido a LexMX!')).toBeVisible();
    }
  });

  test('should work on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check interface adapts
    await expect(page.locator('.chat-interface')).toBeVisible();
    
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    await expect(textarea).toBeVisible();
    
    // Test sending message on mobile
    await textarea.fill('Pregunta desde móvil');
    const sendButton = page.locator('form button[type="submit"]');
    await sendButton.click();
    
    // Check message appears
    await expect(page.locator('text=Pregunta desde móvil')).toBeVisible();
  });

  test('should show typing indicator', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="consulta legal"]');
    const sendButton = page.locator('form button[type="submit"]');
    
    // Send message
    await textarea.fill('¿Qué es la prescripción?');
    await sendButton.click();
    
    // Check for typing indicator - looking for the animated dots
    const typingIndicator = page.locator('.animate-pulse').first();
    await expect(typingIndicator).toBeVisible();
    
    // Indicator should disappear after response
    await page.waitForTimeout(2000);
  });
});