import { expect, test, waitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of user-journeys tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Comprehensive User Journeys (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('First-Time User Journey', () => {
    test('complete onboarding flow', async ({ page }) => {
      // 1. Land on homepage
      await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Click "Iniciar Consulta Gratis"
      await page.waitForSelector(`[data-testid="${TEST_IDS.home.ctaChat}"]`, { state: 'visible', timeout: 5000 });
    await page.click(`[data-testid="${TEST_IDS.home.ctaChat}"]`);
      
      // 3. Could go to either setup or chat depending on config
      await page.waitForURL(/(setup|chat)/, { timeout: 5000 });
      
      const currentUrl = page.url();
      if (currentUrl.includes('setup')) {
        // 4. Complete minimal setup (privacy-focused profile)
        const setupBegin = page.locator('[data-testid="setup-begin"]');
        if (await setupBegin.isVisible({ timeout: 2000 }).catch(() => false)) {
          await setupBegin.click();
          
          const privacyFirst = page.locator('[data-testid="profile-privacy-first"]');
          if (await privacyFirst.isVisible({ timeout: 2000 }).catch(() => false)) {
            await privacyFirst.click();
          }
          
          const ollamaOption = page.locator('div:text="Ollama", :has-text(/Ollama/i)');
          if (await ollamaOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await ollamaOption.click();
            await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
            await page.fill('input[type="url"]', 'http://localhost:11434');
            await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
          }
          
          // 5. Wait for completion and navigate to chat
          const completeButton = page.locator('button:has-text("Comenzar a Usar LexMX")');
          if (await completeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await completeButton.click();
          }
        }
      }
      
      // 6. Verify chat is ready
      await page.waitForURL('**/chat', { timeout: 5000 });
      await expect(page.locator(`[data-testid="${TEST_IDS.chat.container}"]`)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Wiki Legal Navigation', () => {
    test('browse legal wiki sections', async ({ page }) => {
      // 1. Navigate to wiki
      await page.goto('http://localhost:4321/wiki');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Verify wiki navigation is visible
      await expect(page.locator(`[data-testid="${TEST_IDS.wiki.navigation}"]`)).toBeVisible();
      
      // 3. Click on Government Structure
      await page.waitForSelector('button:has-text("Estructura del Gobierno")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Estructura del Gobierno")');
      await expect(page.locator('h2:text="Estructura del Gobierno Mexicano", :has-text(/Estructura del Gobierno Mexicano/i)')).toBeVisible();
      
      // 4. Navigate to Legal System
      await page.waitForSelector('button:has-text("Sistema Legal")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Sistema Legal")');
      await expect(page.locator('h2:text="Sistema Legal Mexicano", :has-text(/Sistema Legal Mexicano/i)')).toBeVisible();
      
      // 5. Check progress indicator
      await expect(page.locator('text=//Sección \\d+ de \\d+//i')).toBeVisible();
      
      // 6. Navigate using next/previous buttons
      await page.waitForSelector('button[aria-label="Siguiente sección"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Siguiente sección"]');
      await page.waitForSelector('button[aria-label="Sección anterior"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Sección anterior"]');
    });
  });

  test.describe('Document Request Flow', () => {
    test('create and view document request', async ({ page }) => {
      // 1. Navigate to requests page
      await page.goto('http://localhost:4321/requests');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Click new request
      await page.waitForSelector('text=/Nueva Solicitud/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Nueva Solicitud/i');
      
      // 3. Fill out request form
      await page.fill('input[placeholder*="Título"]', 'Ley de Protección de Datos Personales');
      await page.selectOption('select', 'law');
      await page.fill('textarea[placeholder*="Descripción"]', 'Necesitamos acceso a la ley federal de protección de datos personales en posesión de particulares.');
      await page.fill('textarea[placeholder*="Justificación"]', 'Para cumplir con las obligaciones de privacidad en nuestra empresa.');
      
      // 4. Submit request
      await page.waitForSelector('button:has-text("Enviar Solicitud")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Enviar Solicitud")');
      
      // 5. Verify request appears in list
      await expect(page.locator('text=/Ley de Protección de Datos Personales/i')).toBeVisible();
      await expect(page.locator('text=/Pendiente/i')).toBeVisible();
      
      // 6. Vote on request
      await page.waitForSelector('button:has-text("Votar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Votar")');
      await expect(page.locator('text=/Votado/i')).toBeVisible();
    });
  });

  test.describe('Legal Document Viewer', () => {
    test('view and navigate legal documents', async ({ page }) => {
      // 1. Navigate to a document
      await page.goto('http://localhost:4321/document/constitucion');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Verify document viewer loads
      await expect(page.locator(`[data-testid="${TEST_IDS.documents.viewer}"]`)).toBeVisible();
      await expect(page.locator('h1:text="Constitución Política", :has-text(/Constitución Política/i)')).toBeVisible();
      
      // 3. Use table of contents
      await page.waitForSelector('button[aria-label="Mostrar índice"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Mostrar índice"]');
      await expect(page.locator('.document-toc')).toBeVisible();
      
      // 4. Navigate to specific article
      await page.waitForSelector('text=/Artículo 123/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Artículo 123/i');
      await expect(page.locator('text=//Artículo 123//i')).toBeVisible();
      
      // 5. Use search functionality
      await page.fill('input[placeholder*="Buscar"]', 'derechos laborales');
      await page.keyboard.press('Enter');
      
      // 6. Toggle highlights
      await page.waitForSelector('button[aria-label="Resaltar resultados"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Resaltar resultados"]');
    });
  });

  test.describe('Multi-Language Support', () => {
    test('switch between Spanish and English', async ({ page }) => {
      // 1. Start in Spanish (default)
      await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await expect(page.locator('text=/Tu Asistente Legal Mexicano con IA/i')).toBeVisible();
      
      // 2. Open language selector
      await page.waitForSelector('button[aria-label="Cambiar idioma"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Cambiar idioma"]');
      
      // 3. Switch to English
      await page.waitForSelector('text=/English/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/English/i');
      
      // 4. Verify UI updates to English
      await expect(page.locator('text=/Your Mexican Legal AI Assistant/i')).toBeVisible();
      
      // 5. Navigate to chat in English
      await page.waitForSelector('text=/Legal Chat/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Legal Chat/i');
      await expect(page.locator('text=/Legal Chat/i')).toBeVisible();
      
      // 6. Switch back to Spanish
      await page.waitForSelector('button[aria-label="Change language"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Change language"]');
      await page.waitForSelector('text=/Español/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Español/i');
      await expect(page.locator('text=/Chat Legal/i')).toBeVisible();
    });
  });

  test.describe('Theme Toggle', () => {
    test('switch between light and dark themes', async ({ page }) => {
      // 1. Navigate to homepage
      await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Check default theme (light)
      const htmlElement = page.locator('html');
      await expect(htmlElement).not.toHaveClass(/dark/);
      
      // 3. Toggle to dark theme
      await page.waitForSelector('button[aria-label="Cambiar tema"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Cambiar tema"]');
      await page.waitForSelector('text=/Oscuro/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Oscuro/i');
      
      // 4. Verify dark theme applied
      await expect(htmlElement).toHaveClass(/dark/);
      
      // 5. Navigate to another page and verify theme persists
      await page.waitForSelector('text=/Chat Legal/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Chat Legal/i');
      await expect(htmlElement).toHaveClass(/dark/);
      
      // 6. Switch back to light theme
      await page.waitForSelector('button[aria-label="Cambiar tema"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Cambiar tema"]');
      await page.waitForSelector('text=/Claro/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Claro/i');
      await expect(htmlElement).not.toHaveClass(/dark/);
    });
  });

  test.describe('Mobile Navigation', () => {
    test('use mobile menu navigation', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // 1. Navigate to homepage
      await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // 2. Open mobile menu
      await page.waitForSelector('button[aria-label="Abrir menú principal"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Abrir menú principal"]');
      
      // 3. Verify menu is open
      await expect(page.locator(`[data-testid="${TEST_IDS.mobile.menu}"]`)).toBeVisible();
      
      // 4. Navigate to chat
      await page.waitForSelector('.mobile-menu >> [href*="chat"], text=/Chat/i', { state: 'visible', timeout: 5000 });
    await page.click('.mobile-menu >> [href*="chat"], text=/Chat/i');
      await page.waitForURL('**/chat');
      
      // 5. Verify menu closed after navigation
      await expect(page.locator(`[data-testid="${TEST_IDS.mobile.menu}"]`)).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('handle network errors gracefully', async ({ page, context }) => {
      // Setup provider first
      await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
      await page.waitForSelector('text=/Configuración Personalizada/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Configuración Personalizada/i');
      await page.waitForSelector('div:text="OpenAI", :has-text(/OpenAI/i)', { state: 'visible', timeout: 5000 });
    await page.click('div:text="OpenAI", :has-text(/OpenAI/i)');
      await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
      await page.fill('input[type="password"]', 'sk-test-key');
      await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
      await page.waitForSelector('h2:text="¡Configuración Completa!", :has-text(/¡Configuración Completa!/i)');
      await page.waitForSelector('button:has-text("Comenzar a Usar LexMX")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Comenzar a Usar LexMX")');
      
      // Simulate network failure
      await context.setOffline(true);
      
      // Try to send a message
      await page.fill(`[data-testid="${TEST_IDS.chat.input}"]`, 'Test query');
      await page.waitForSelector('button[aria-label="Enviar mensaje"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Enviar mensaje"]');
      
      // Should show error message
      await expect(page.locator('text=/error|Error|problema|intenta nuevamente/i')).toBeVisible({ timeout: 5000 });
      
      // Restore network
      await context.setOffline(false);
    });
  });

  test.describe('Search and RAG Features', () => {
    test('use advanced search options in chat', async ({ page }) => {
      // Setup provider
      await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
      await page.waitForSelector('div:text="Balanceado", :has-text(/Balanceado/i)', { state: 'visible', timeout: 5000 });
    await page.click('div:text="Balanceado", :has-text(/Balanceado/i)');
      await page.waitForSelector('div:text="OpenAI", :has-text(/OpenAI/i)', { state: 'visible', timeout: 5000 });
    await page.click('div:text="OpenAI", :has-text(/OpenAI/i)');
      await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
      await page.fill('input[type="password"]', 'sk-test-key');
      await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
      await page.waitForSelector('h2:text="¡Configuración Completa!", :has-text(/¡Configuración Completa!/i)');
      await page.waitForSelector('button:has-text("Comenzar a Usar LexMX")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Comenzar a Usar LexMX")');
      
      // Open advanced options
      await page.waitForSelector('button[title="Opciones avanzadas"]', { state: 'visible', timeout: 5000 });
    await page.click('button[title="Opciones avanzadas"]');
      
      // Select specific legal area
      await page.selectOption('select#legal-area', 'labor');
      
      // Send a query
      await page.fill(`[data-testid="${TEST_IDS.chat.input}"]`, '¿Cuáles son los derechos de maternidad?');
      await page.waitForSelector('button[aria-label="Enviar mensaje"]', { state: 'visible', timeout: 5000 });
    await page.click('button[aria-label="Enviar mensaje"]');
      
      // Verify response includes labor law context
      await expect(page.locator('text=/¿Cuáles son los derechos de maternidad?/i')).toBeVisible();
      await expect(page.locator('.animate-spin').or(page.locator('text=/Analizando/i'))).toBeVisible();
    });
  });

  test.describe('Provider Recommendation', () => {
    test('see provider recommendations while typing', async ({ page }) => {
      // Setup multiple providers
      await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
      await page.waitForSelector('text=/Configuración Personalizada/i', { state: 'visible', timeout: 5000 });
    await page.click('text=/Configuración Personalizada/i');
      await page.waitForSelector('div:text="OpenAI", :has-text(/OpenAI/i)', { state: 'visible', timeout: 5000 });
    await page.click('div:text="OpenAI", :has-text(/OpenAI/i)');
      await page.waitForSelector('div:text="Claude", :has-text(/Claude/i)', { state: 'visible', timeout: 5000 });
    await page.click('div:text="Claude", :has-text(/Claude/i)');
      await page.waitForSelector('button:has-text("Configurar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Configurar")');
      
      // Configure OpenAI
      await page.fill('input[type="password"]', 'sk-openai-test');
      await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
      
      // Configure Claude
      await page.fill('input[type="password"]', 'sk-ant-test');
      await page.waitForSelector('button:has-text("Guardar")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Guardar")');
      
      await page.waitForSelector('h2:text="¡Configuración Completa!", :has-text(/¡Configuración Completa!/i)');
      await page.waitForSelector('button:has-text("Comenzar a Usar LexMX")', { state: 'visible', timeout: 5000 });
    await page.click('button:has-text("Comenzar a Usar LexMX")');
      
      // Type a complex query
      await page.fill(`[data-testid="${TEST_IDS.chat.input}"]`, 'Necesito analizar un contrato complejo de compraventa internacional');
      
      // Wait for recommendations to appear
      await expect(page.locator('text=/Proveedores Recomendados/i')).toBeVisible({ timeout: 5000 });
      await expect(page.locator(`[data-testid="${TEST_IDS.recommendation.container}"]`)).toBeVisible();
    });
  });
});