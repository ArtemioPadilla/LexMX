import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  navigateAndWaitForHydration,
  clearAllStorage,
  assertNoConsoleErrors 
} from '../../utils/test-helpers';

test.describe('WebLLM Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    
    // Mock WebGPU availability and WebLLM
    await page.addInitScript(() => {
      // Mock WebGPU
      if (!navigator.gpu) {
        (navigator as any).gpu = {
          requestAdapter: async () => ({
            requestDevice: async () => ({})
          })
        };
      }
      
      // Mock @mlc-ai/web-llm module
      (window as any).__webllm_mock = true;
    });
    
    // Intercept WebLLM module requests and provide mock
    await page.route('**/@mlc-ai/web-llm**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript',
        body: `
          export const CreateMLCEngine = async (modelId, config) => {
            // Simulate initialization
            if (config?.initProgressCallback) {
              setTimeout(() => config.initProgressCallback({ progress: 0.5, text: 'Loading model...' }), 100);
              setTimeout(() => config.initProgressCallback({ progress: 1.0, text: 'Model ready!' }), 200);
            }
            
            return {
              chat: {
                completions: {
                  create: async (params) => {
                    if (params.stream) {
                      return (async function* () {
                        const response = "Para presentar un amparo directo, se requiere: 1) Sentencia definitiva, 2) Agotamiento de recursos ordinarios, 3) Plazo de 15 días hábiles.";
                        const chunks = response.split(' ');
                        for (const chunk of chunks) {
                          yield {
                            choices: [{
                              delta: { content: chunk + ' ' }
                            }]
                          };
                        }
                      })();
                    }
                    return {
                      choices: [{
                        message: {
                          content: "Para presentar un amparo directo, se requiere: 1) Sentencia definitiva, 2) Agotamiento de recursos ordinarios, 3) Plazo de 15 días hábiles."
                        },
                        finish_reason: 'stop'
                      }]
                    };
                  }
                }
              }
            };
          };
          
          export const MLCEngine = {};
        `
      });
    });
  });

  test('complete WebLLM provider setup journey', async ({ page }) => {
    // 1. Navigate to setup
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    
    // 2. Start configuration
    await page.click('button:has-text("Comenzar Configuración")');
    
    // 3. Select Privacy First profile (includes WebLLM)
    await expect(page.locator('h2:has-text("Elige tu Perfil")')).toBeVisible();
    
    const privacyProfile = page.locator('.profile-card:has-text("Privacy First"), [role="button"]:has-text("Privacy First")').first();
    await privacyProfile.click();
    
    // 4. Verify WebLLM appears in provider selection
    await expect(page.locator('h2:has-text("Selecciona Proveedores")')).toBeVisible();
    
    const webllmCard = page.locator('.provider-card:has-text("WebLLM"), [role="button"]:has-text("WebLLM")').first();
    await expect(webllmCard).toBeVisible();
    
    // Verify WebLLM shows as free
    await expect(webllmCard.locator('text="Gratis"')).toBeVisible();
    
    // Verify privacy capabilities
    await expect(webllmCard.locator('text=/privacy|offline/')).toBeVisible();
    
    // 5. Select WebLLM
    await webllmCard.click();
    await expect(page.locator('button:has-text("Configurar (1)")')).toBeVisible();
    await page.click('button:has-text("Configurar (1)")');
    
    // 6. Verify WebLLM configuration UI
    await expect(page.locator('h2:has-text("Configurar WebLLM")')).toBeVisible();
    
    // Should show browser-based AI info
    await expect(page.locator('text=/Modelo de IA en tu navegador/')).toBeVisible();
    await expect(page.locator('text=/100% privado/')).toBeVisible();
    await expect(page.locator('text=/Sin costos/')).toBeVisible();
    await expect(page.locator('text=/Funciona offline/')).toBeVisible();
    
    // 7. Verify model selection dropdown
    const modelSelect = page.locator('select:has(option:has-text("Llama"))');
    await expect(modelSelect).toBeVisible();
    
    // Check available models
    const modelOptions = await modelSelect.locator('option').allTextContents();
    expect(modelOptions).toContain('Llama 3.2 3B (Recomendado - 1.7GB)');
    expect(modelOptions).toContain('Phi 3.5 Mini (Más rápido - 1.2GB)');
    
    // Select a model
    await modelSelect.selectOption({ label: 'Phi 3.5 Mini (Más rápido - 1.2GB)' });
    
    // 8. Verify requirements warning
    await expect(page.locator('text=/Chrome o Edge actualizado/')).toBeVisible();
    await expect(page.locator('text=/4GB de RAM/')).toBeVisible();
    
    // 9. Save configuration (no API key needed)
    await page.click('button:has-text("Guardar")');
    
    // 10. Complete setup
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // Should navigate to chat
    await page.waitForURL('**/chat');
    
    assertNoConsoleErrors(page);
  });

  test('WebLLM model download progress', async ({ page }) => {
    // Setup WebLLM provider first
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("WebLLM")');
    await page.click('button:has-text("Configurar (1)")');
    await page.click('button:has-text("Guardar")');
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // Mock WebLLM initialization with progress
    await page.addInitScript(() => {
      (window as any).__mockWebLLMProgress = true;
    });
    
    // Navigate to chat
    await page.waitForURL('**/chat');
    
    // Send first message to trigger model download
    await page.fill('textarea[placeholder*="consulta legal"]', '¿Qué es el amparo?');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show download progress
    await expect(page.locator('text="Descargando modelo IA"')).toBeVisible({ timeout: 10000 });
    
    // Verify progress bar
    await expect(page.locator('.bg-legal-500').first()).toBeVisible();
    
    // Verify progress updates
    await expect(page.locator('text=/[0-9]+%/')).toBeVisible();
    
    // Progress message should update
    await expect(page.locator('text=/Downloading|Loading|Initializing/')).toBeVisible();
    
    // Info about first-time download
    await expect(page.locator('text=/Primera vez.*almacenará localmente/')).toBeVisible();
  });

  test('chat functionality with WebLLM', async ({ page }) => {
    // Quick setup with WebLLM
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Send a legal query
    await page.fill('textarea[placeholder*="consulta legal"]', 
      '¿Cuáles son los requisitos para presentar un amparo directo?'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show loading state
    await expect(page.locator('text="Analizando tu consulta legal..."')).toBeVisible();
    
    // Should get response (mocked)
    await expect(page.locator('text=/amparo directo|requisitos|Sentencia definitiva/')).toBeVisible({ timeout: 30000 });
    
    // Verify no cost tracking for WebLLM
    const costIndicator = page.locator('text=/\$|cost|costo/');
    await expect(costIndicator).not.toBeVisible();
    
    // Test streaming response
    await page.fill('textarea[placeholder*="consulta legal"]', 'Explica el proceso legislativo');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should see streaming indicator or response
    await expect(page.locator('.animate-pulse, .streaming-indicator, text=/proceso legislativo/')).toBeVisible({ timeout: 5000 });
  });

  test('WebGPU compatibility check', async ({ page }) => {
    // Remove WebGPU support
    await page.addInitScript(() => {
      delete (navigator as any).gpu;
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("WebLLM")');
    await page.click('button:has-text("Configurar (1)")');
    await page.click('button:has-text("Guardar")');
    
    // Navigate to chat and try to use
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // Try to send message
    await page.fill('textarea[placeholder*="consulta legal"]', 'Test query');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should show WebGPU error
    await expect(page.locator('text=/WebGPU.*not supported|navegador compatible|Chrome o Edge/')).toBeVisible({ timeout: 10000 });
  });

  test('offline functionality with WebLLM', async ({ page, context }) => {
    // Setup WebLLM first
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
        priority: 1
      }]));
      
      // Mock that model is already downloaded
      localStorage.setItem('webllm_model_downloaded', 'true');
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Go offline
    await context.setOffline(true);
    
    // Should still be able to send queries
    await page.fill('textarea[placeholder*="consulta legal"]', 
      '¿Qué dice el artículo 14 constitucional?'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should process locally without network errors
    await expect(page.locator('text=/error.*conexión|network error/i')).not.toBeVisible({ timeout: 5000 });
    
    // Should get response or show working state
    await expect(page.locator('text=/artículo 14|retroactividad|Analizando/')).toBeVisible({ timeout: 30000 });
    
    // Verify offline indicator (if implemented)
    const offlineIndicator = page.locator('[aria-label*="offline"], .offline-indicator');
    if (await offlineIndicator.count() > 0) {
      await expect(offlineIndicator).toBeVisible();
    }
  });

  test('model switching in WebLLM', async ({ page }) => {
    // Setup with one model
    await page.evaluate(() => {
      localStorage.setItem('lexmx_providers', JSON.stringify([{
        id: 'webllm',
        name: 'WebLLM (Browser)',
        type: 'local',
        enabled: true,
        model: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
        priority: 1
      }]));
    });
    
    await navigateAndWaitForHydration(page, 'http://localhost:4321/chat');
    
    // Send a query with first model
    await page.fill('textarea[placeholder*="consulta legal"]', 'Primera consulta');
    await page.click('button[aria-label="Enviar mensaje"]');
    await page.waitForSelector('text="Primera consulta"');
    
    // Go back to settings to change model
    await page.click('link:has-text("Configuración")');
    await page.waitForURL('**/setup');
    
    // Edit WebLLM configuration
    await page.click('button:has-text("Editar Proveedores")');
    await page.click('button[aria-label="Editar WebLLM"]');
    
    // Change to a different model
    const modelSelect = page.locator('select:has(option:has-text("Llama"))');
    await modelSelect.selectOption({ label: 'Llama 3.2 3B (Recomendado - 1.7GB)' });
    
    await page.click('button:has-text("Guardar")');
    
    // Return to chat
    await page.click('link:has-text("Chat")');
    await page.waitForURL('**/chat');
    
    // Send query with new model
    await page.fill('textarea[placeholder*="consulta legal"]', 'Segunda consulta con nuevo modelo');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should trigger download for new model
    await expect(page.locator('text=/Descargando.*Llama 3.2|Loading.*model/')).toBeVisible({ timeout: 10000 });
  });

  test('privacy-first profile includes WebLLM by default', async ({ page }) => {
    await navigateAndWaitForHydration(page, 'http://localhost:4321/setup');
    await page.click('button:has-text("Comenzar Configuración")');
    
    // Select Privacy First profile
    const privacyProfile = page.locator('.profile-card:has-text("Privacy First"), [role="button"]:has-text("Privacy First")').first();
    await privacyProfile.click();
    
    // Continue to provider selection
    await page.click('button:has-text("Siguiente")');
    
    // WebLLM should be pre-selected
    const webllmCard = page.locator('div:has-text("WebLLM")');
    await expect(webllmCard).toHaveClass(/selected|active|border-legal/);
    
    // Ollama might also be selected
    const ollamaCard = page.locator('div:has-text("Ollama")');
    const ollamaSelected = await ollamaCard.evaluate(el => 
      el.classList.contains('selected') || 
      el.classList.contains('active') ||
      el.classList.contains('border-legal-500')
    );
    
    // Verify no cloud providers are selected
    const cloudProviders = ['OpenAI', 'Claude', 'Gemini'];
    for (const provider of cloudProviders) {
      const card = page.locator(`div:has-text("${provider}")`);
      if (await card.count() > 0) {
        await expect(card).not.toHaveClass(/selected|active|border-legal/);
      }
    }
    
    assertNoConsoleErrors(page);
  });
});