import { test, expect, Page } from '@playwright/test';

test.describe('LLM Setup Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to page first
    await page.goto('/setup');
    
    // Clear any existing setup data
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Reload to ensure clean state
    await page.reload();
  });

  test('should show setup wizard steps', async ({ page }) => {
    // Check page title
    await expect(page).toHaveTitle(/Configuración - LexMX/);
    
    // Check wizard header
    await expect(page.locator('h1:has-text("Configuración de Proveedores")')).toBeVisible();
    
    // Check step indicators
    await expect(page.locator('.step-indicator')).toHaveCount(4);
    
    // Should start at welcome step
    await expect(page.locator('text=Bienvenido a LexMX')).toBeVisible();
    await expect(page.locator('text=Comenzar')).toBeVisible();
  });

  test('should navigate through setup wizard', async ({ page }) => {
    // Click start
    await page.click('button:has-text("Comenzar")');
    
    // Should show profile selection
    await expect(page.locator('text=Selecciona tu Perfil')).toBeVisible();
    await expect(page.locator('text=Privacy First')).toBeVisible();
    await expect(page.locator('text=Balanced')).toBeVisible();
    await expect(page.locator('text=Performance')).toBeVisible();
    
    // Select Balanced profile
    await page.click('div:has-text("Balanced")');
    await expect(page.locator('div:has-text("Balanced")')).toHaveClass(/border-blue-500/);
    
    // Click next
    await page.click('button:has-text("Siguiente")');
    
    // Should show provider selection
    await expect(page.locator('text=Elige tus Proveedores')).toBeVisible();
  });

  test('should configure OpenAI provider', async ({ page }) => {
    // Navigate to provider selection
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Balanced")');
    await page.click('button:has-text("Siguiente")');
    
    // Select OpenAI
    await page.click('text=OpenAI');
    
    // Enter API key
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('sk-test-key-1234567890');
    
    // Test key validation
    await page.click('button:has-text("Validar")');
    
    // Should show validation result (mock)
    await page.waitForTimeout(500);
    
    // Click next
    await page.click('button:has-text("Siguiente")');
    
    // Should show summary
    await expect(page.locator('text=¡Configuración Completa!')).toBeVisible();
  });

  test('should configure multiple providers', async ({ page }) => {
    // Navigate to provider selection
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Performance")');
    await page.click('button:has-text("Siguiente")');
    
    // Select multiple providers
    await page.click('text=OpenAI');
    await page.click('text=Claude');
    await page.click('text=Gemini');
    
    // Configure OpenAI
    const openAIKey = page.locator('div:has-text("OpenAI") input[type="password"]');
    await openAIKey.fill('sk-openai-test-key');
    
    // Configure Claude
    const claudeKey = page.locator('div:has-text("Claude") input[type="password"]');
    await claudeKey.fill('sk-ant-test-key');
    
    // Configure Gemini
    const geminiKey = page.locator('div:has-text("Gemini") input[type="password"]');
    await geminiKey.fill('AIza-test-key');
    
    // Click next
    await page.click('button:has-text("Siguiente")');
    
    // Should show summary with all providers
    await expect(page.locator('text=OpenAI')).toBeVisible();
    await expect(page.locator('text=Claude')).toBeVisible();
    await expect(page.locator('text=Gemini')).toBeVisible();
  });

  test('should handle local model configuration', async ({ page }) => {
    // Navigate to provider selection
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Privacy First")');
    await page.click('button:has-text("Siguiente")');
    
    // Select Ollama
    await page.click('text=Ollama');
    
    // Configure endpoint
    const endpointInput = page.locator('input[placeholder*="localhost:11434"]');
    await endpointInput.fill('http://localhost:11434');
    
    // Select model
    const modelSelect = page.locator('select');
    if (await modelSelect.isVisible()) {
      await modelSelect.selectOption({ index: 1 });
    }
    
    // Click next
    await page.click('button:has-text("Siguiente")');
    
    // Should show summary
    await expect(page.locator('text=Ollama')).toBeVisible();
  });

  test('should validate API keys', async ({ page }) => {
    // Navigate to provider selection
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Balanced")');
    await page.click('button:has-text("Siguiente")');
    
    // Select OpenAI
    await page.click('text=OpenAI');
    
    // Try empty API key
    await page.click('button:has-text("Validar")');
    
    // Should show error
    await expect(page.locator('text=API key es requerido')).toBeVisible();
    
    // Try invalid format
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('invalid-key');
    await page.click('button:has-text("Validar")');
    
    // Should show format error
    await expect(page.locator('text=/formato|inválido/i')).toBeVisible();
  });

  test('should show cost warnings', async ({ page }) => {
    // Navigate to provider selection
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Performance")');
    await page.click('button:has-text("Siguiente")');
    
    // Select expensive providers
    await page.click('text=OpenAI');
    
    // Should show cost information
    await expect(page.locator('text=/costo|precio|cost/i')).toBeVisible();
  });

  test('should persist configuration', async ({ page }) => {
    // Complete setup
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Balanced")');
    await page.click('button:has-text("Siguiente")');
    await page.click('text=OpenAI');
    
    const apiKeyInput = page.locator('input[type="password"]').first();
    await apiKeyInput.fill('sk-test-key-persistent');
    
    await page.click('button:has-text("Siguiente")');
    await page.click('button:has-text("Finalizar")');
    
    // Should redirect to chat
    await expect(page).toHaveURL(/\/chat/);
    
    // Go back to setup
    await page.goto('/setup');
    
    // Should show existing configuration
    await expect(page.locator('text=Configuración existente detectada')).toBeVisible();
  });

  test('should handle back navigation', async ({ page }) => {
    // Navigate to provider selection
    await page.click('button:has-text("Comenzar")');
    await page.click('div:has-text("Balanced")');
    await page.click('button:has-text("Siguiente")');
    
    // Should be on provider selection
    await expect(page.locator('text=Elige tus Proveedores')).toBeVisible();
    
    // Click back
    await page.click('button:has-text("Atrás")');
    
    // Should be back on profile selection
    await expect(page.locator('text=Selecciona tu Perfil')).toBeVisible();
    
    // Click back again
    await page.click('button:has-text("Atrás")');
    
    // Should be on welcome
    await expect(page.locator('text=Bienvenido a LexMX')).toBeVisible();
  });

  test('should show security information', async ({ page }) => {
    // Navigate to setup
    await page.click('button:has-text("Comenzar")');
    
    // Check for security information
    await expect(page.locator('text=/segur|encript|privac/i')).toBeVisible();
    
    // Navigate to provider config
    await page.click('div:has-text("Privacy First")');
    await page.click('button:has-text("Siguiente")');
    
    // Should show encryption notice
    await expect(page.locator('text=/AES|256|encriptado/i')).toBeVisible();
  });

  test('should handle mobile view', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check that wizard is still usable
    await expect(page.locator('text=Bienvenido a LexMX')).toBeVisible();
    
    // Navigate through wizard
    await page.click('button:has-text("Comenzar")');
    
    // Profile cards should stack vertically
    const profileCards = page.locator('.provider-profile-card');
    const firstCard = profileCards.first();
    const lastCard = profileCards.last();
    
    const firstBox = await firstCard.boundingBox();
    const lastBox = await lastCard.boundingBox();
    
    // Check vertical stacking
    if (firstBox && lastBox) {
      expect(lastBox.y).toBeGreaterThan(firstBox.y + firstBox.height);
    }
  });
});