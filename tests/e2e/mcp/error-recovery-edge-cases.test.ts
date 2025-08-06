import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  clearAllStorage,
  setupMockProviders
} from '../../utils/test-helpers';

test.describe('Error Recovery and Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('network failure recovery during chat session', async ({ page, context }) => {
    // Setup provider
    await setupMockProviders(page);
    await page.goto('http://localhost:4321/chat');
    await page.waitForSelector('.chat-interface');
    
    // 1. Send initial successful query
    await page.fill('textarea[placeholder*="consulta legal"]', 'Primera consulta exitosa');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Wait for response
    await page.waitForSelector('text="Primera consulta exitosa"', { timeout: 5000 });
    
    // 2. Simulate network failure
    await context.setOffline(true);
    
    // Try to send query while offline
    await page.fill('textarea[placeholder*="consulta legal"]', 'Consulta durante falla de red');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show error message
    await expect(page.locator('text=/error|Error|conexión|intenta/i')).toBeVisible({ timeout: 10000 });
    
    // 3. Restore network
    await context.setOffline(false);
    
    // 4. Retry query
    await page.fill('textarea[placeholder*="consulta legal"]', 'Consulta después de reconexión');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should work again
    await page.waitForSelector('text="Consulta después de reconexión"', { timeout: 5000 });
    
    // 5. Verify chat history is intact
    await expect(page.locator('text="Primera consulta exitosa"')).toBeVisible();
    await expect(page.locator('text="Consulta durante falla de red"')).toBeVisible();
    await expect(page.locator('text="Consulta después de reconexión"')).toBeVisible();
  });

  test('storage quota exceeded handling', async ({ page }) => {
    await page.goto('http://localhost:4321');
    
    // 1. Fill storage near capacity
    await page.evaluate(() => {
      const largeData = 'x'.repeat(1024 * 1024); // 1MB string
      const storage = localStorage;
      
      // Try to fill storage
      try {
        for (let i = 0; i < 10; i++) {
          storage.setItem(`lexmx_test_data_${i}`, largeData);
        }
      } catch (e) {
        // Expected to fail at some point
      }
    });
    
    // 2. Try to configure provider with full storage
    await page.goto('http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("OpenAI")');
    await page.click('button:has-text("Configurar (1)")');
    
    await page.fill('input[type="password"]', 'sk-test-key-when-storage-full');
    await page.click('button:has-text("Guardar")');
    
    // Should handle gracefully (either show error or use sessionStorage)
    const errorVisible = await page.locator('text=/storage|almacenamiento|espacio/i').isVisible({ timeout: 5000 });
    const successVisible = await page.locator('h2:has-text("¡Configuración Completa!")').isVisible({ timeout: 5000 });
    
    expect(errorVisible || successVisible).toBeTruthy();
    
    // 3. Clean up test data
    await page.evaluate(() => {
      const storage = localStorage;
      for (let i = 0; i < 10; i++) {
        storage.removeItem(`lexmx_test_data_${i}`);
      }
    });
  });

  test('malformed API key and provider switching', async ({ page }) => {
    await page.goto('http://localhost:4321/setup');
    
    // 1. Configure multiple providers with various key formats
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    
    // Select multiple providers
    await page.click('div:has-text("OpenAI")');
    await page.click('div:has-text("Claude")');
    await page.click('div:has-text("Ollama")');
    await page.click('button:has-text("Configurar (3)")');
    
    // 2. Configure with invalid OpenAI key
    await page.fill('input[type="password"]', 'not-a-valid-openai-key');
    await page.click('button:has-text("Guardar")');
    
    // 3. Configure valid Claude key
    await page.waitForSelector('h2:has-text("Configurar Claude")');
    await page.fill('input[type="password"]', 'sk-ant-valid-test-key');
    await page.click('button:has-text("Guardar")');
    
    // 4. Configure Ollama endpoint
    await page.waitForSelector('h2:has-text("Configurar Ollama")');
    await page.fill('input[type="url"]', 'http://localhost:11434');
    await page.click('button:has-text("Guardar")');
    
    // 5. Complete setup
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // 6. Test provider fallback in chat
    await page.waitForURL('**/chat');
    await page.fill('textarea[placeholder*="consulta legal"]', 'Test con múltiples proveedores');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should attempt with available providers
    await page.waitForSelector('text="Test con múltiples proveedores"', { timeout: 5000 });
  });

  test('session recovery after browser crash', async ({ page, context }) => {
    // 1. Setup initial session
    await setupMockProviders(page);
    await page.goto('http://localhost:4321/chat');
    
    // Send some messages
    const messages = [
      '¿Qué es un contrato?',
      '¿Cuáles son los elementos del contrato?',
      '¿Qué pasa si se incumple un contrato?'
    ];
    
    for (const msg of messages) {
      await page.fill('textarea[placeholder*="consulta legal"]', msg);
      await page.click('button[aria-label="Enviar mensaje"]');
      await page.waitForSelector(`text="${msg}"`, { timeout: 5000 });
      await page.waitForTimeout(500);
    }
    
    // 2. Get session data before "crash"
    const sessionData = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      };
    });
    
    // 3. Simulate browser crash by opening new page
    const newPage = await context.newPage();
    await setupPage(newPage);
    
    // 4. Restore session data
    await newPage.evaluate((data) => {
      // Restore localStorage
      Object.entries(data.localStorage).forEach(([key, value]) => {
        if (key.startsWith('lexmx_')) {
          localStorage.setItem(key, value);
        }
      });
      
      // Note: sessionStorage is lost in real crash
    }, sessionData);
    
    // 5. Navigate back to chat
    await newPage.goto('http://localhost:4321/chat');
    await newPage.waitForSelector('.chat-interface');
    
    // 6. Verify provider configuration persisted
    await newPage.fill('textarea[placeholder*="consulta legal"]', 'Consulta después de recuperación');
    await newPage.click('button[aria-label="Enviar mensaje"]');
    
    // Should work without reconfiguration
    await newPage.waitForSelector('text="Consulta después de recuperación"', { timeout: 10000 });
    
    await newPage.close();
  });

  test('handling corrupt or missing legal corpus data', async ({ page }) => {
    await setupMockProviders(page);
    
    // 1. Corrupt embeddings data
    await page.evaluate(() => {
      localStorage.setItem('lexmx_embeddings', 'corrupted-data-{}[]');
    });
    
    // 2. Navigate to chat
    await page.goto('http://localhost:4321/chat');
    await page.waitForSelector('.chat-interface');
    
    // 3. Send query that would use RAG
    await page.fill('textarea[placeholder*="consulta legal"]', '¿Qué dice el artículo 27 constitucional?');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should handle gracefully
    await page.waitForSelector('text=/artículo 27|error|problema/i', { timeout: 20000 });
    
    // 4. Clear corrupt data
    await page.evaluate(() => {
      localStorage.removeItem('lexmx_embeddings');
    });
  });

  test('rapid user interactions and race conditions', async ({ page }) => {
    await setupMockProviders(page);
    await page.goto('http://localhost:4321/chat');
    
    // 1. Send multiple queries rapidly
    const queries = [
      'Primera consulta',
      'Segunda consulta',
      'Tercera consulta',
      'Cuarta consulta'
    ];
    
    // Send all queries without waiting
    for (const query of queries) {
      await page.fill('textarea[placeholder*="consulta legal"]', query);
      await page.click('button[aria-label="Enviar mensaje"]');
    }
    
    // 2. All queries should appear
    for (const query of queries) {
      await expect(page.locator(`text="${query}"`)).toBeVisible({ timeout: 10000 });
    }
    
    // 3. Clear chat while processing
    await page.fill('textarea[placeholder*="consulta legal"]', 'Última consulta antes de limpiar');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Immediately clear
    await page.click('button[title="Limpiar chat"]');
    
    // Should clear successfully
    await expect(page.locator('text="Primera consulta"')).not.toBeVisible({ timeout: 5000 });
    
    // 4. Test language switching during active session
    await page.fill('textarea[placeholder*="consulta legal"]', 'Consulta en español');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Switch language while processing
    await page.click('button[aria-label*="idioma"]');
    await page.click('text="English"');
    
    // UI should update but query should complete
    await page.waitForTimeout(1000);
    
    // Switch back
    await page.click('button[aria-label*="language"]');
    await page.click('text="Español"');
  });

  test('browser compatibility and feature detection', async ({ page }) => {
    await page.goto('http://localhost:4321');
    
    // 1. Disable JavaScript features to test fallbacks
    await page.evaluate(() => {
      // Temporarily disable crypto
      (window as any).crypto.subtle = undefined;
    });
    
    // 2. Try to setup provider without crypto
    await page.goto('http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("OpenAI")');
    await page.click('button:has-text("Configurar (1)")');
    
    await page.fill('input[type="password"]', 'sk-test-no-crypto');
    await page.click('button:has-text("Guardar")');
    
    // Should work with fallback
    await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
    
    // 3. Re-enable crypto
    await page.evaluate(() => {
      location.reload();
    });
  });

  test('deep navigation state recovery', async ({ page }) => {
    await page.goto('http://localhost:4321/wiki');
    
    // 1. Navigate deep into wiki
    await page.click('button:has-text("Sistema Legal")');
    await page.locator('h2:has-text("Proceso Legislativo")').scrollIntoViewIfNeeded();
    
    // Progress through legislative process
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("Siguiente")');
      await page.waitForTimeout(300);
    }
    
    // 2. Navigate to glossary with filter
    await page.locator('h2:has-text("Glosario Legal")').scrollIntoViewIfNeeded();
    await page.click('button:has-text("Penal")');
    await page.fill('input[placeholder*="Buscar términos"]', 'delito');
    
    // 3. Open chat in new tab simulation
    const chatUrl = new URL('/chat', page.url()).href;
    const newPage = await page.context().newPage();
    await newPage.goto(chatUrl);
    
    // 4. Go back to wiki
    await page.bringToFront();
    
    // State should be preserved
    await expect(page.locator('button:has-text("Penal")[aria-pressed="true"]')).toBeVisible();
    await expect(page.locator('input[placeholder*="Buscar términos"]')).toHaveValue('delito');
    
    await newPage.close();
  });

  test('invalid document requests and validation', async ({ page }) => {
    await page.goto('http://localhost:4321/requests');
    await page.click('button:has-text("Nueva Solicitud")');
    
    // 1. Try to submit empty form
    await page.click('button:has-text("Enviar Solicitud")');
    
    // Should show validation errors
    const titleInput = page.locator('input[placeholder*="Título"]');
    await expect(titleInput).toHaveAttribute('required', '');
    
    // 2. Fill with invalid data
    await page.fill('input[placeholder*="Título"]', 'a'); // Too short
    await page.fill('textarea[placeholder*="Descripción"]', 'b'); // Too short
    await page.click('button:has-text("Enviar Solicitud")');
    
    // Should show length validation
    const validationVisible = await page.locator('text=/mínimo|caracteres|requerido/i').isVisible({ timeout: 3000 });
    
    // 3. Fill with valid data
    await page.fill('input[placeholder*="Título"]', 'Solicitud de Jurisprudencia Válida');
    await page.selectOption('select[name="type"]', { index: 1 });
    await page.fill('textarea[placeholder*="Descripción"]', 'Descripción detallada de la solicitud de documento legal');
    await page.fill('textarea[placeholder*="Justificación"]', 'Justificación para la solicitud del documento');
    
    await page.click('button:has-text("Enviar Solicitud")');
    
    // Should succeed
    await expect(page.locator('text="Solicitud de Jurisprudencia Válida"')).toBeVisible({ timeout: 5000 });
  });
});