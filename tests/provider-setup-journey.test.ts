import { test, expect, Page } from '@playwright/test';

// Helper to wait for React hydration
async function waitForHydration(page: Page, selector: string, timeout = 10000) {
  await page.waitForSelector(selector, { timeout });
  // Wait a bit more for React to fully hydrate
  await page.waitForTimeout(500);
}

// Helper to mock storage APIs
async function mockStorageAPIs(page: Page) {
  await page.addInitScript(() => {
    // Mock crypto.subtle if not available
    if (!window.crypto || !window.crypto.subtle) {
      window.crypto = window.crypto || {};
      window.crypto.subtle = {
        encrypt: async () => new ArrayBuffer(32),
        decrypt: async () => new ArrayBuffer(32),
        generateKey: async () => ({ type: 'secret' }),
        deriveKey: async () => ({ type: 'secret' }),
        importKey: async () => ({ type: 'secret' }),
        digest: async () => new ArrayBuffer(32),
      } as any;
    }
    
    // Ensure localStorage is available
    if (!window.localStorage) {
      const storage = new Map();
      window.localStorage = {
        getItem: (key: string) => storage.get(key) || null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
        clear: () => storage.clear(),
        key: (index: number) => Array.from(storage.keys())[index] || null,
        get length() { return storage.size; }
      } as any;
    }
  });
}

test.describe('Provider Setup Journey', () => {
  test.beforeEach(async ({ page }) => {
    // Mock storage APIs for all tests
    await mockStorageAPIs(page);
    
    // Navigate to setup page
    await page.goto('/setup');
    await waitForHydration(page, '.provider-setup', 5000);
  });

  test('should display provider setup wizard', async ({ page }) => {
    // Check wizard is visible
    await expect(page.locator('.provider-setup')).toBeVisible();
    
    // Check welcome step is shown initially
    await expect(page.locator('text=Configura tu Asistente Legal IA')).toBeVisible();
    await expect(page.locator('text=LexMX te permite usar múltiples proveedores')).toBeVisible();
  });

  test('should navigate through setup wizard steps', async ({ page }) => {
    // Start from welcome
    await expect(page.locator('text=Configura tu Asistente Legal IA')).toBeVisible();
    
    // Click next to go to profile selection
    await page.click('button:has-text("Comenzar Configuración")');
    await expect(page.locator('text=Elige tu Perfil de Uso')).toBeVisible();
    
    // Select a profile (click on the profile card)
    await page.click('text=Privacy First');
    
    // Should be on provider selection
    await expect(page.locator('text=Selecciona Proveedores de IA')).toBeVisible();
  });

  test('should allow selecting and configuring providers', async ({ page }) => {
    // Navigate to provider selection
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Premium Legal'); // This profile includes OpenAI
    
    // OpenAI should already be selected
    await page.click('button:has-text("Configurar (")');
    
    // Should show Claude configuration form (first in Premium Legal profile)
    await expect(page.locator('text=Configurar Claude')).toBeVisible();
    await expect(page.locator('input[name="apiKey"]')).toBeVisible();
    
    // Enter API key
    await page.fill('input[name="apiKey"]', 'sk-test-1234567890');
    
    // Select model
    await page.selectOption('select[name="model"]', 'gpt-4');
    
    // Save configuration
    await page.click('button:has-text("Guardar")');
    
    // Should move to test step automatically
    await expect(page.locator('text=Probando Conexiones...')).toBeVisible();
  });

  test('should handle storage errors gracefully', async ({ page }) => {
    // Override storage to throw errors
    await page.addInitScript(() => {
      const originalSetItem = window.localStorage.setItem;
      window.localStorage.setItem = function(key: string, value: string) {
        if (key.includes('provider_')) {
          throw new Error('QuotaExceededError');
        }
        return originalSetItem.call(this, key, value);
      };
    });
    
    // Try to configure a provider
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Privacy First');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    // Enter configuration
    await page.fill('input[name="apiKey"]', 'sk-test-1234567890');
    await page.click('button:has-text("Guardar")');
    
    // Should show storage error
    await expect(page.locator('text=/Storage quota exceeded|Failed to store/')).toBeVisible();
  });

  test('should test provider connection', async ({ page }) => {
    // Configure OpenAI
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Privacy First');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    await page.fill('input[name="apiKey"]', 'sk-test-valid-key');
    await page.click('button:has-text("Guardar")');
    
    // Should move to test step and show testing indicator
    await expect(page.locator('text=Probando Conexiones...')).toBeVisible();
    
    // Should eventually show success state
    await expect(page.locator('text=Conexiones Exitosas')).toBeVisible({ timeout: 10000 });
  });

  test('should handle invalid API keys', async ({ page }) => {
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Privacy First');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    // Enter invalid API key format
    await page.fill('input[name="apiKey"]', 'invalid-key');
    
    // Should show validation error
    await expect(page.locator('text=Formato de clave API inválido')).toBeVisible();
  });

  test('should complete full setup flow', async ({ page }) => {
    // Step 1: Welcome
    await page.click('button:has-text("Comenzar Configuración")');
    
    // Step 2: Profile
    await page.click('text=Balanced Professional');
    await page.click('button:has-text("Siguiente")');
    
    // Step 3: Provider selection
    await page.click('text=Claude');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    // Step 4: Configure Claude
    await page.fill('input[name="apiKey"]', 'sk-ant-test-key');
    await page.click('button:has-text("Guardar")');
    
    // Step 5: Configure OpenAI (should auto-advance to this)
    await page.fill('input[name="apiKey"]', 'sk-test-openai-key');
    await page.click('button:has-text("Guardar")');
    
    // Step 6: Complete
    await expect(page.locator('text=¡Configuración Completa!')).toBeVisible();
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // Should redirect to chat
    await expect(page).toHaveURL('/chat');
  });

  test('should persist provider configurations', async ({ page }) => {
    // Configure a provider
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Privacy First');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    await page.fill('input[name="apiKey"]', 'sk-test-persistent');
    await page.selectOption('select[name="model"]', 'gpt-3.5-turbo');
    await page.click('button:has-text("Guardar")');
    
    // Reload page
    await page.reload();
    await waitForHydration(page, '.provider-setup', 5000);
    
    // Check if configuration persisted
    await page.click('button:has-text("Ver Proveedores Configurados")');
    await expect(page.locator('text=OpenAI')).toBeVisible();
    await expect(page.locator('text=gpt-3.5-turbo')).toBeVisible();
  });

  test('should handle provider switching', async ({ page }) => {
    // Configure multiple providers
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Premium Legal');
    await page.click('button:has-text("Siguiente")');
    
    // Select multiple providers
    await page.click('text=OpenAI');
    await page.click('text=Claude');
    await page.click('text=Gemini');
    await page.click('button:has-text("Configurar (")');
    
    // Configure each
    for (const provider of ['openai', 'claude', 'gemini']) {
      await page.fill('input[name="apiKey"]', `test-key-${provider}`);
      if (provider !== 'gemini') {
        await page.click('button:has-text("Guardar y Siguiente")');
      } else {
        await page.click('button:has-text("Guardar")');
      }
    }
    
    // Go to chat
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await waitForHydration(page, '.chat-interface', 5000);
    
    // Check provider selector is available
    await expect(page.locator('select[name="provider"]')).toBeVisible();
    
    // Check all providers are available
    const options = await page.locator('select[name="provider"] option').allTextContents();
    expect(options).toContain('OpenAI');
    expect(options).toContain('Claude');
    expect(options).toContain('Gemini');
  });

  test('should validate required fields', async ({ page }) => {
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Privacy First');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    // Try to save without API key
    await page.click('button:has-text("Guardar")');
    
    // Should show validation error
    await expect(page.locator('text=La clave API es requerida')).toBeVisible();
    
    // Fill API key but clear model selection
    await page.fill('input[name="apiKey"]', 'sk-test-key');
    await page.selectOption('select[name="model"]', '');
    await page.click('button:has-text("Guardar")');
    
    // Should show model validation error
    await expect(page.locator('text=Por favor selecciona un modelo')).toBeVisible();
  });
});

test.describe('Storage System Tests', () => {
  test.beforeEach(async ({ page }) => {
    await mockStorageAPIs(page);
  });

  test('should handle browser storage availability', async ({ page }) => {
    // Test when storage is disabled
    await page.addInitScript(() => {
      // Simulate storage being disabled
      delete (window as any).localStorage;
      delete (window as any).sessionStorage;
    });
    
    await page.goto('/setup');
    
    // Should show storage warning
    await expect(page.locator('text=/Storage not available|Browser storage is disabled/')).toBeVisible();
  });

  test('should handle crypto API availability', async ({ page }) => {
    // Test when crypto is not available
    await page.addInitScript(() => {
      delete (window as any).crypto;
    });
    
    await page.goto('/setup');
    await waitForHydration(page, '.provider-setup', 5000);
    
    // Should still work but show warning about encryption
    await expect(page.locator('text=/Encryption not available|reduced security/')).toBeVisible();
  });

  test('should clean up expired data', async ({ page }) => {
    // Add some expired data
    await page.addInitScript(() => {
      const expiredData = {
        encrypted: false,
        data: { test: 'expired' },
        timestamp: Date.now() - (25 * 60 * 60 * 1000) // 25 hours old
      };
      localStorage.setItem('lexmx_test_expired', JSON.stringify(expiredData));
      
      const validData = {
        encrypted: false,
        data: { test: 'valid' },
        timestamp: Date.now() - (1 * 60 * 60 * 1000) // 1 hour old
      };
      localStorage.setItem('lexmx_test_valid', JSON.stringify(validData));
    });
    
    await page.goto('/setup');
    await page.waitForTimeout(1000); // Wait for cleanup
    
    // Check that expired data was removed
    const hasExpired = await page.evaluate(() => {
      return localStorage.getItem('lexmx_test_expired') !== null;
    });
    expect(hasExpired).toBe(false);
    
    // Check that valid data remains
    const hasValid = await page.evaluate(() => {
      return localStorage.getItem('lexmx_test_valid') !== null;
    });
    expect(hasValid).toBe(true);
  });

  test('should handle storage quota errors', async ({ page }) => {
    // Fill up storage to simulate quota exceeded
    await page.addInitScript(() => {
      try {
        // Try to fill localStorage with large data
        const largeData = 'x'.repeat(1024 * 1024); // 1MB string
        for (let i = 0; i < 10; i++) {
          localStorage.setItem(`lexmx_filler_${i}`, largeData);
        }
      } catch (e) {
        // Storage might already be full
      }
    });
    
    await page.goto('/setup');
    await waitForHydration(page, '.provider-setup', 5000);
    
    // Try to save provider config
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Privacy First');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    await page.fill('input[name="apiKey"]', 'sk-test-quota-test');
    await page.click('button:has-text("Guardar")');
    
    // Should show quota error
    await expect(page.locator('text=/quota exceeded|storage full/i')).toBeVisible();
  });

  test('should export and import configurations', async ({ page }) => {
    // First configure a provider
    await page.goto('/setup');
    await waitForHydration(page, '.provider-setup', 5000);
    
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text=Privacy First');
    await page.click('text=OpenAI');
    await page.click('button:has-text("Configurar (")');
    
    await page.fill('input[name="apiKey"]', 'sk-test-export');
    await page.selectOption('select[name="model"]', 'gpt-4');
    await page.click('button:has-text("Guardar")');
    
    // Export configuration
    await page.click('button:has-text("Exportar Configuración")');
    
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('lexmx-config');
    
    // Clear storage
    await page.evaluate(() => localStorage.clear());
    
    // Import configuration
    await page.reload();
    await waitForHydration(page, '.provider-setup', 5000);
    
    await page.click('button:has-text("Importar Configuración")');
    // Upload the downloaded file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(await download.path());
    
    // Check configuration was imported
    await page.click('button:has-text("Ver Proveedores Configurados")');
    await expect(page.locator('text=OpenAI')).toBeVisible();
    await expect(page.locator('text=gpt-4')).toBeVisible();
  });
});