import { test, expect } from '@playwright/test';
import { 
  setupPage, 
  clearAllStorage,
  assertNoConsoleErrors,
  testMobileView,
  switchLanguage
} from '../../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('First-Time User Onboarding Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('complete first-time user journey with discovery flow', async ({ page }) => {
    // 1. First visit - homepage discovery
    await page.goto('http://localhost:4321');
    await page.waitForLoadState('networkidle');
    
    // Verify compelling value proposition is visible
    await expect(page.locator('h1:has-text("Tu Asistente Legal Mexicano")')).toBeVisible();
    await expect(page.locator('text=/legislación mexicana|IA avanzada/')).toBeVisible();
    
    // Check privacy emphasis for first-time users
    await expect(page.locator('text=/100%.*Privado|Sin servidores/')).toBeVisible();
    
    // 2. Explore features before committing
    // Scroll to see feature cards
    await page.locator('h2:has-text("Características Principales")').scrollIntoViewIfNeeded();
    
    // Verify key features are explained
    const features = [
      'Múltiples Proveedores de IA',
      'Corpus Legal Completo',
      'Máxima Privacidad',
      'Búsqueda Híbrida RAG'
    ];
    
    for (const feature of features) {
      await expect(page.locator(`h3:has-text("${feature}")`)).toBeVisible();
    }
    
    // 3. Try to use chat without setup (common first-time behavior)
    await page.click('link:has-text("Iniciar Chat Legal")');
    await page.waitForURL('**/chat');
    
    // Should see welcome message and provider warning
    await expect(page.locator('text="¡Bienvenido a LexMX!"')).toBeVisible();
    await expect(page.locator('text=/No tienes proveedores configurados/')).toBeVisible();
    
    // Try to send a message anyway
    await page.fill('[data-testid="chat-input"]', '¿Qué es el amparo?');
    await page.keyboard.press('Enter');
    
    // Should get clear error directing to setup
    await expect(page.locator('text=/No tienes proveedores.*Configuración/')).toBeVisible();
    
    // 4. Navigate to setup from error message
    await page.click('link:has-text("Configuración")');
    await page.waitForURL('**/setup');
    
    // 5. First-time setup experience
    // Verify welcoming setup screen
    await expect(page.locator('h2:has-text("Configura tu Asistente Legal IA")')).toBeVisible();
    await expect(page.locator('text=/segura.*encriptada/')).toBeVisible();
    
    // Start configuration
    await page.click('[data-testid="setup-begin"]');
    
    // 6. Profile selection for beginners
    await expect(page.locator('h2:has-text("Elige tu Perfil")')).toBeVisible();
    
    // Hover over profiles to see descriptions
    const balancedProfile = page.locator('div:has-text("Balanceado"):has-text("Mezcla de rendimiento")');
    await balancedProfile.hover();
    
    // Select balanced profile (good for beginners)
    await balancedProfile.click();
    
    // 7. Provider selection education
    await expect(page.locator('h2:has-text("Selecciona Proveedores")')).toBeVisible();
    
    // Should see recommended providers highlighted
    const openAICard = page.locator('div:has-text("OpenAI"):has-text("GPT-4")');
    await expect(openAICard).toBeVisible();
    
    // Check cost indicators
    await expect(page.locator('text=/Gratis|low|medium|high/')).toBeVisible();
    
    // Select OpenAI for first-time user
    await openAICard.click();
    await expect(page.locator('button:has-text("Configurar (1)")')).toBeVisible();
    await page.click('button:has-text("Configurar (1)")');
    
    // 8. API key configuration with help
    await expect(page.locator('h2:has-text("Configurar OpenAI")')).toBeVisible();
    
    // Check for help text about API keys
    await expect(page.locator('text=/clave.*encriptada|API/')).toBeVisible();
    
    // Fill dummy API key
    await page.fill('input[type="password"]', 'sk-beginner-test-key-123456');
    await page.click('button:has-text("Guardar")');
    
    // 9. Setup completion celebration
    await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
    
    // Should show next steps
    await expect(page.locator('text=/primera consulta|Siguientes pasos/')).toBeVisible();
    
    // Navigate to chat
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    await page.waitForURL('**/chat');
    
    // 10. First successful query
    await page.waitForSelector('[data-testid="chat-container"]');
    
    // Type a beginner-friendly query
    const beginnerQuery = '¿Qué es el amparo y para qué sirve?';
    await page.fill('[data-testid="chat-input"]', beginnerQuery);
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Should see processing indicator
    await expect(page.locator('text=/Analizando|procesando/')).toBeVisible();
    
    // Wait for response
    await page.waitForSelector(`text="${beginnerQuery}"`, { timeout: 10000 });
    
    // 11. Explore response features
    // Should educate about sources and confidence
    await page.waitForSelector('text=/Fuentes:|Sources:/', { timeout: 20000 }).catch(() => {
      // Sources might not always show
    });
    
    // 12. Discovery of other features
    // Click advanced options
    await page.click('button[title="Opciones avanzadas"]');
    await expect(page.locator('select#legal-area')).toBeVisible();
    
    // Close advanced options
    await page.click('button[title="Opciones avanzadas"]');
    
    // 13. Explore Wiki from chat
    await page.click('link:has-text("Wiki Legal")');
    await page.waitForURL('**/wiki');
    
    // First-time wiki experience
    await expect(page.locator('.wiki-navigation')).toBeVisible();
    await expect(page.locator('text=/Navegación.*Secciones/')).toBeVisible();
    
    // Click on a section
    await page.click('button:has-text("Estructura del Gobierno")');
    await expect(page.locator('h2:has-text("Estructura del Gobierno")')).toBeVisible();
    
    // 14. Return to chat with new knowledge
    await page.click('link:has-text("Chat Legal")');
    
    // Ask a follow-up question
    await page.fill('[data-testid="chat-input"]', 
      '¿Cuál es la diferencia entre amparo directo e indirecto?'
    );
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Verify contextual response
    await page.waitForSelector('text=/directo.*indirecto/i', { timeout: 20000 });
    
    assertNoConsoleErrors(page);
  });

  test('mobile first-time user experience', async ({ page }) => {
    await testMobileView(page, async () => {
      // 1. Mobile landing
      await page.goto('http://localhost:4321');
      
      // Check mobile menu
      await page.click('button[aria-label*="menú"]');
      await expect(page.locator('.mobile-menu')).toBeVisible();
      
      // Navigate to chat
      await page.click('.mobile-menu >> text="Chat Legal"');
      await page.waitForURL('**/chat');
      
      // 2. Mobile setup prompt
      await expect(page.locator('text=/No tienes proveedores/')).toBeVisible();
      
      // Navigate to setup
      await page.click('link:has-text("Configuración")');
      
      // 3. Mobile-optimized setup
      await page.click('[data-testid="setup-begin"]');
      await page.click('div:has-text("Privacidad Primero")'); // Good for mobile users
      await page.click('div:has-text("Ollama")'); // Local option
      await page.click('button:has-text("Configurar (1)")');
      
      // Configure Ollama
      await page.fill('input[type="url"]', 'http://localhost:11434');
      await page.click('button:has-text("Guardar")');
      
      // Complete setup
      await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
      await page.click('button:has-text("Comenzar a Usar LexMX")');
      
      // 4. Mobile chat experience
      await page.waitForURL('**/chat');
      await page.fill('[data-testid="chat-input"]', 'consulta rápida móvil');
      await page.click('button[aria-label="Enviar mensaje"]');
      
      // Verify mobile-friendly response
      await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    });
  });

  test('privacy-conscious user onboarding', async ({ page }) => {
    // 1. Privacy-focused landing
    await page.goto('http://localhost:4321');
    
    // Look for privacy features
    await expect(page.locator('text=/100%.*Privado/')).toBeVisible();
    await expect(page.locator('text=/Sin servidores|sin tracking/')).toBeVisible();
    await expect(page.locator('text=/Encriptación|AES-256/')).toBeVisible();
    
    // 2. Check privacy policy
    await page.click('link:has-text("Privacidad")');
    await page.waitForURL('**/privacy');
    
    // Verify privacy commitments
    await expect(page.locator('h1:has-text("Privacidad")')).toBeVisible();
    await expect(page.locator('text=/datos.*localmente|navegador/')).toBeVisible();
    
    // 3. Setup with privacy profile
    await page.goto('http://localhost:4321/setup');
    await page.click('[data-testid="setup-begin"]');
    
    // Select privacy-first profile
    await page.click('div:has-text("Privacidad Primero"):has-text("modelos locales")');
    
    // Should recommend local providers including WebLLM
    await expect(page.locator('text=/WebLLM|Ollama|local/')).toBeVisible();
    
    // WebLLM should be highlighted for browser-based privacy
    const webllmCard = page.locator('div:has-text("WebLLM"):has-text("navegador")');
    await expect(webllmCard).toBeVisible();
    await expect(webllmCard.locator('text=/100%.*privado|Sin.*costos/')).toBeVisible();
    
    // Select WebLLM for ultimate privacy (no external connections)
    await webllmCard.click();
    await page.click('button:has-text("Configurar (1)")');
    
    // Configure WebLLM (no endpoint needed)
    await expect(page.locator('text=/Modelo.*navegador/')).toBeVisible();
    await page.selectOption('select', { index: 0 }); // Select default model
    await page.click('button:has-text("Guardar")');
    
    // Complete privacy-focused setup
    await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
    await page.click('button:has-text("Comenzar a Usar LexMX")');
    
    // 4. Verify local-only operation
    await page.waitForURL('**/chat');
    
    // Check that no external requests are made
    const externalRequests: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (!url.includes('localhost') && !url.includes('127.0.0.1')) {
        externalRequests.push(url);
      }
    });
    
    // Send a query
    await page.fill('[data-testid="chat-input"]', 'consulta privada local');
    await page.click('button[aria-label="Enviar mensaje"]');
    
    // Wait a bit for any requests
    await page.waitForTimeout(2000);
    
    // No external requests should have been made
    expect(externalRequests.filter(url => 
      !url.includes('fonts.googleapis.com') && // Allow fonts
      !url.includes('unpkg.com') // Allow CDN assets
    )).toHaveLength(0);
  });

  test('non-Spanish speaker onboarding', async ({ page }) => {
    // 1. Land on Spanish site
    await page.goto('http://localhost:4321');
    
    // 2. Find and use language switcher
    await page.click('button[aria-label*="idioma"]');
    await page.click('text="English"');
    
    // Wait for language change
    await page.waitForTimeout(500);
    
    // 3. Verify English UI
    await expect(page.locator('text=/Legal.*Assistant|Mexican.*Law/')).toBeVisible();
    
    // 4. English setup flow
    await page.click('link:has-text("Setup")');
    await page.waitForURL('**/setup');
    
    // Verify English setup
    await expect(page.locator('text=/Configure|Welcome/')).toBeVisible();
    
    // Complete setup in English
    await page.click('button:has-text("Start")');
    await page.click('div:has-text("Balanced")');
    await page.click('div:has-text("OpenAI")');
    await page.click('button:has-text("Configure")');
    
    await page.fill('input[type="password"]', 'sk-english-user-test');
    await page.click('button:has-text("Save")');
    
    await page.waitForSelector('text=/Complete|Success/');
    await page.click('button:has-text("Start Using")');
    
    // 5. English chat experience
    await page.waitForURL('**/chat');
    
    // Send query in English
    await page.fill('textarea', 'What is amparo in Mexican law?');
    await page.keyboard.press('Enter');
    
    // Should get response (possibly in Spanish due to legal context)
    await page.waitForSelector('text=/amparo/i', { timeout: 20000 });
  });

  test('error recovery during onboarding', async ({ page }) => {
    // 1. Setup with invalid configuration
    await page.goto('http://localhost:4321/setup');
    await page.click('[data-testid="setup-begin"]');
    await page.click('text="Configuración Personalizada"');
    await page.click('div:has-text("OpenAI")');
    await page.click('button:has-text("Configurar (1)")');
    
    // 2. Enter invalid API key
    await page.fill('input[type="password"]', 'invalid-key');
    await page.click('button:has-text("Guardar")');
    
    // 3. Handle configuration error
    // Might show error or continue to test phase
    await page.waitForSelector('text=/error|Error|inválido|Probando/', { timeout: 10000 });
    
    // 4. If we reach completion despite error
    const completionVisible = await page.locator('h2:has-text("¡Configuración Completa!")').isVisible();
    if (completionVisible) {
      await page.click('button:has-text("Comenzar a Usar LexMX")');
      await page.waitForURL('**/chat');
      
      // 5. Try to use chat with invalid provider
      await page.fill('[data-testid="chat-input"]', 'test query');
      await page.click('button[aria-label="Enviar mensaje"]');
      
      // Should show provider error
      await expect(page.locator('text=/error|Error|configuración|intenta/')).toBeVisible({ timeout: 10000 });
      
      // 6. Return to setup to fix
      await page.click('link:has-text("Configuración")');
      
      // Should be able to reconfigure
      await expect(page.locator('.provider-setup')).toBeVisible();
    }
  });
});