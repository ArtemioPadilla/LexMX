import { test, expect, Page } from '@playwright/test';

test.describe('Integration Tests - Full User Flows', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    
    // Clear all storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('should complete full setup and chat flow', async () => {
    // Start at home page
    await page.goto('http://localhost:4323');
    
    // Click get started
    await page.click('a[href="/setup"]');
    
    // Complete setup wizard
    await expect(page).toHaveURL(/\/setup/);
    await page.click('button:has-text("Comenzar")');
    
    // Select profile
    await page.click('div:has-text("Balanced")');
    await page.click('button:has-text("Siguiente")');
    
    // Configure OpenAI
    await page.click('text=OpenAI');
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('sk-test-integration-key');
    await page.click('button:has-text("Siguiente")');
    
    // Complete setup
    await page.click('button:has-text("Finalizar")');
    
    // Should redirect to chat
    await expect(page).toHaveURL(/\/chat/);
    
    // Send a legal query
    const textarea = page.locator('textarea[placeholder*="pregunta legal"]');
    await textarea.fill('¿Qué es el amparo directo?');
    await page.click('button[aria-label*="Enviar"]');
    
    // Should show message and response
    await expect(page.locator('text=¿Qué es el amparo directo?')).toBeVisible();
    await expect(page.locator('.typing-indicator')).toBeVisible();
  });

  test('should navigate from wiki to chat with context', async () => {
    // Setup provider first
    await page.evaluate(() => {
      const mockConfig = {
        providers: [{
          id: 'openai',
          name: 'OpenAI',
          apiKey: 'encrypted-mock-key',
          models: ['gpt-4'],
          enabled: true
        }],
        activeProvider: 'openai',
        activeModel: 'gpt-4'
      };
      localStorage.setItem('lexmx_providers', JSON.stringify(mockConfig));
    });
    
    // Start at wiki
    await page.goto('/wiki');
    
    // Navigate to amparo section
    await page.locator('.wiki-nav-card:has-text("Sistema Legal")').click();
    await page.waitForTimeout(500);
    
    // Click on CTA
    await page.click('a:has-text("Consultar Asistente Legal")');
    
    // Should be in chat
    await expect(page).toHaveURL(/\/chat/);
    
    // Chat should have context hint
    const contextHint = page.locator('.context-hint, .suggested-topics');
    if (await contextHint.isVisible()) {
      await expect(contextHint).toContainText(/sistema legal|wiki/i);
    }
  });

  test('should search documents and view with RAG integration', async () => {
    // Go to legal corpus
    await page.goto('/legal');
    
    // Search for a document
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await searchInput.fill('código civil');
    await searchInput.press('Enter');
    
    // Click on first result
    const firstResult = page.locator('.document-card').first();
    await firstResult.click();
    
    // Should be in document viewer
    await expect(page).toHaveURL(/\/document\//);
    
    // Switch to chunks view
    await page.click('button:has-text("Chunks RAG")');
    
    // Should show RAG chunks
    await expect(page.locator('.chunk-item').first()).toBeVisible();
    
    // Check chunk has embeddings info
    const chunkMeta = page.locator('.chunk-meta').first();
    if (await chunkMeta.isVisible()) {
      await expect(chunkMeta).toContainText(/tokens|vector/i);
    }
  });

  test('should submit document request and track status', async () => {
    // Setup user
    await page.evaluate(() => {
      const mockUser = {
        id: 'test-user-456',
        name: 'Integration Test User',
        email: 'integration@test.com'
      };
      localStorage.setItem('lexmx_user', JSON.stringify(mockUser));
    });
    
    // Go to requests
    await page.goto('/requests');
    
    // Create new request
    await page.click('a[href="/requests/new"]');
    
    // Fill form
    await page.fill('input[name="title"]', 'Ley de Inteligencia Artificial');
    await page.selectOption('select[name="type"]', 'ley-federal');
    await page.fill('textarea[name="description"]', 'Necesito la nueva ley de IA para un proyecto.');
    await page.fill('textarea[name="justification"]', 'Es crucial para regular el uso de IA en México.');
    await page.check('input[name="terms"]');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Should show success
    await expect(page.locator('text=/enviada|éxito/i')).toBeVisible();
    
    // Go back to listing
    await page.goto('/requests');
    
    // Should see new request
    await expect(page.locator('text=Ley de Inteligencia Artificial')).toBeVisible();
  });

  test('should use chat with document context', async () => {
    // Setup provider
    await page.evaluate(() => {
      const mockConfig = {
        providers: [{
          id: 'claude',
          name: 'Claude',
          apiKey: 'encrypted-claude-key',
          models: ['claude-3.5-sonnet'],
          enabled: true
        }],
        activeProvider: 'claude',
        activeModel: 'claude-3.5-sonnet'
      };
      localStorage.setItem('lexmx_providers', JSON.stringify(mockConfig));
    });
    
    // Open a document
    await page.goto('/document/codigo-civil-federal');
    
    // Find "Ask AI" button
    const askAIButton = page.locator('button:has-text("Preguntar a IA"), button[aria-label*="asistente"]');
    
    if (await askAIButton.isVisible()) {
      await askAIButton.click();
      
      // Should open chat with document context
      await expect(page).toHaveURL(/\/chat\?context=codigo-civil-federal/);
      
      // Chat should show document context
      await expect(page.locator('text=/contexto.*código civil/i')).toBeVisible();
    }
  });

  test('should handle multi-language flow', async () => {
    // Start in Spanish
    await page.goto('http://localhost:4323');
    
    // Change to English
    const langSelector = page.locator('.language-selector');
    await langSelector.click();
    await page.click('button:has-text("English")');
    
    // Check UI updated
    await expect(page.locator('text=Mexican Legal Assistant')).toBeVisible();
    
    // Navigate to wiki
    await page.click('a[href="/wiki"]');
    
    // Content should be in English
    await expect(page.locator('text=Mexican Law Wiki')).toBeVisible();
    
    // Go to chat
    await page.click('a[href="/chat"]');
    
    // Interface should be in English
    await expect(page.locator('placeholder*="legal question"')).toBeVisible();
  });

  test('should maintain session across navigation', async () => {
    // Setup initial state
    await page.evaluate(() => {
      // Set provider
      const mockConfig = {
        providers: [{
          id: 'openai',
          name: 'OpenAI',
          apiKey: 'encrypted-session-key',
          models: ['gpt-4'],
          enabled: true
        }],
        activeProvider: 'openai',
        activeModel: 'gpt-4'
      };
      localStorage.setItem('lexmx_providers', JSON.stringify(mockConfig));
      
      // Set theme
      localStorage.setItem('theme', 'dark');
      
      // Set language
      localStorage.setItem('language', 'en');
    });
    
    // Navigate through app
    await page.goto('http://localhost:4323');
    
    // Check dark theme
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Go to chat
    await page.click('a[href="/chat"]');
    
    // Send a message
    const textarea = page.locator('textarea');
    await textarea.fill('Test message');
    await page.keyboard.press('Control+Enter');
    
    // Navigate to wiki
    await page.click('a[href="/wiki"]');
    
    // Go back to chat
    await page.click('a[href="/chat"]');
    
    // Message should still be there
    await expect(page.locator('text=Test message')).toBeVisible();
    
    // Theme should persist
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('should handle error scenarios gracefully', async () => {
    // Try to access chat without setup
    await page.goto('/chat');
    
    // Should show setup prompt
    await expect(page.locator('text=/configurar.*proveedor/i')).toBeVisible();
    
    // Try to access non-existent document
    await page.goto('/document/inexistente');
    
    // Should show error or redirect
    const errorShown = await page.locator('text=/no encontrado|404/i').isVisible();
    const redirected = page.url().includes('/legal');
    expect(errorShown || redirected).toBeTruthy();
    
    // Try invalid API key
    await page.goto('/setup');
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Balanced")');
    await page.click('button:has-text("Siguiente")');
    await page.click('text=OpenAI');
    
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('invalid-key-format');
    await page.click('button:has-text("Validar")');
    
    // Should show validation error
    await expect(page.locator('text=/formato.*inválido/i')).toBeVisible();
  });

  test('should handle offline functionality', async () => {
    // Setup provider and visit chat
    await page.evaluate(() => {
      const mockConfig = {
        providers: [{
          id: 'openai',
          name: 'OpenAI',
          apiKey: 'encrypted-offline-key',
          models: ['gpt-4'],
          enabled: true
        }],
        activeProvider: 'openai',
        activeModel: 'gpt-4'
      };
      localStorage.setItem('lexmx_providers', JSON.stringify(mockConfig));
    });
    
    await page.goto('/chat');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Try to send message
    const textarea = page.locator('textarea[placeholder*="pregunta legal"]');
    await textarea.fill('Test offline query');
    await page.click('button[aria-label*="Enviar"]');
    
    // Should show offline indicator
    await expect(page.locator('text=/sin conexión|offline/i')).toBeVisible();
    
    // Wiki should still work (static content)
    await page.goto('/wiki');
    await expect(page.locator('h1')).toBeVisible();
    
    // Go back online
    await page.context().setOffline(false);
    
    // Chat should recover
    await page.goto('/chat');
    await expect(page.locator('.chat-interface')).toBeVisible();
  });

  test('should track usage across features', async () => {
    // Setup provider with usage tracking
    await page.evaluate(() => {
      const mockConfig = {
        providers: [{
          id: 'openai',
          name: 'OpenAI',
          apiKey: 'encrypted-usage-key',
          models: ['gpt-3.5-turbo'],
          enabled: true
        }],
        activeProvider: 'openai',
        activeModel: 'gpt-3.5-turbo',
        usage: {
          totalTokens: 0,
          totalCost: 0
        }
      };
      localStorage.setItem('lexmx_providers', JSON.stringify(mockConfig));
    });
    
    // Use chat
    await page.goto('/chat');
    const textarea = page.locator('textarea[placeholder*="pregunta legal"]');
    await textarea.fill('Primera consulta legal');
    await page.click('button[aria-label*="Enviar"]');
    
    await page.waitForTimeout(1000);
    
    // Check usage updated
    const usage = await page.evaluate(() => {
      const config = JSON.parse(localStorage.getItem('lexmx_providers') || '{}');
      return config.usage;
    });
    
    // Usage should be tracked
    if (usage) {
      expect(usage.totalTokens).toBeGreaterThan(0);
    }
    
    // Navigate to document and use AI features
    await page.goto('/document/codigo-civil-federal');
    
    const analyzeButton = page.locator('button:has-text("Analizar"), button[aria-label*="análisis"]');
    if (await analyzeButton.isVisible()) {
      await analyzeButton.click();
      await page.waitForTimeout(1000);
      
      // Usage should increase
      const newUsage = await page.evaluate(() => {
        const config = JSON.parse(localStorage.getItem('lexmx_providers') || '{}');
        return config.usage;
      });
      
      if (newUsage && usage) {
        expect(newUsage.totalTokens).toBeGreaterThan(usage.totalTokens);
      }
    }
  });
});