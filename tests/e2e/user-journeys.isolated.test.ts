/**
 * Isolated version of user-journeys tests
 * Uses the new test isolation system for parallel execution
 */
import { isolatedTest as test, expect } from '../utils/isolated-fixtures';
import { setupPage, navigateToPage, waitForPageReady, setupAllMockProviders, setupProviderScenario, waitForHydration } from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Comprehensive User Journeys - Isolated', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    await page.goto('http://localhost:4321/');
    await waitForHydration(page);await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.describe('First-Time User Journey - Isolated', () => {
    test('complete onboarding flow', async ({ page }) => {
      // 1. Land on homepage
      await page.goto('http://localhost:4321/');
    await waitForHydration(page);// 2. Click "Iniciar Consulta Gratis"
      await page.click('[data-testid="cta-chat"]');
      
      // 3. Could go to either setup or chat depending on config
      await page.waitForURL(/(setup|chat)/, { timeout: 15000 });
      
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
          
          const ollamaOption = page.locator('div:has-text("Ollama")');
          if (await ollamaOption.isVisible({ timeout: 2000 }).catch(() => false)) {
            await ollamaOption.click();
            await page.click('button:has-text("Configurar")');
            await page.fill('input[type="url"]', 'http://localhost:11434');
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
      await page.waitForURL('**/chat', { timeout: 15000 });
      await expect(page.locator('[data-testid={${TEST_IDS.chat.container}}]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Wiki Legal Navigation - Isolated', () => {
    test('browse legal wiki sections', async ({ page }) => {
      // 1. Navigate to wiki
      await page.goto('http://localhost:4321/wiki');
    await waitForHydration(page);// 2. Verify wiki navigation is visible
      await expect(page.locator('.wiki-navigation')).toBeVisible();
      
      // 3. Click on Government Structure
      await page.click('button:has-text("Estructura del Gobierno")');
      await expect(page.locator('h2:has-text("Estructura del Gobierno Mexicano")')).toBeVisible();
      
      // 4. Navigate to Legal System
      await page.click('button:has-text("Sistema Legal")');
      await expect(page.locator('h2:has-text("Sistema Legal Mexicano")')).toBeVisible();
      
      // 5. Check progress indicator
      await expect(page.locator('text=//Sección \\d+ de \\d+//i')).toBeVisible();
      
      // 6. Navigate using next/previous buttons
      await page.click('button[aria-label="Siguiente sección"]');
      await page.click('button[aria-label="Sección anterior"]');
    });
  });

  test.describe('Document Request Flow - Isolated', () => {
    test('create and view document request', async ({ page }) => {
      // 1. Navigate to requests page
      await page.goto('http://localhost:4321/requests');
    await waitForHydration(page);// 2. Click new request
      await page.click('text=//Nueva Solicitud/i/i');
      
      // 3. Fill out request form
      await page.fill('input[placeholder*="Título"]', 'Ley de Protección de Datos Personales');
      await page.selectOption('select', 'law');
      await page.fill('textarea[placeholder*="Descripción"]', 'Necesitamos acceso a la ley federal de protección de datos personales en posesión de particulares.');
      await page.fill('textarea[placeholder*="Justificación"]', 'Para cumplir con las obligaciones de privacidad en nuestra empresa.');
      
      // 4. Submit request
      await page.click('button:has-text("Enviar Solicitud")');
      
      // 5. Verify request appears in list
      await expect(page.locator('text=//Ley de Protección de Datos Personales/i/i')).toBeVisible();
      await expect(page.locator('text=//Pendiente/i/i')).toBeVisible();
      
      // 6. Vote on request
      await page.click('button:has-text("Votar")');
      await expect(page.locator('text=//Votado/i/i')).toBeVisible();
    });
  });

  test.describe('Legal Document Viewer - Isolated', () => {
    test('view and navigate legal documents', async ({ page }) => {
      // 1. Navigate to a document
      await page.goto('http://localhost:4321/document/constitucion');
    await waitForHydration(page);// 2. Verify document viewer loads
      await expect(page.locator('.document-viewer')).toBeVisible();
      await expect(page.locator('h1:has-text("Constitución Política")')).toBeVisible();
      
      // 3. Use table of contents
      await page.click('button[aria-label="Mostrar índice"]');
      await expect(page.locator('.document-toc')).toBeVisible();
      
      // 4. Navigate to specific article
      await page.click('text=//Artículo 123/i/i');
      await expect(page.locator('text=//Artículo 123//i')).toBeVisible();
      
      // 5. Use search functionality
      await page.fill('input[placeholder*="Buscar"]', 'derechos laborales');
      await page.keyboard.press('Enter');
      
      // 6. Toggle highlights
      await page.click('button[aria-label="Resaltar resultados"]');
    });
  });

  test.describe('Multi-Language Support - Isolated', () => {
    test('switch between Spanish and English', async ({ page }) => {
      // 1. Start in Spanish (default)
      await page.goto('http://localhost:4321/');
    await waitForHydration(page);await expect(page.locator('text=//Tu Asistente Legal Mexicano con IA/i/i')).toBeVisible();
      
      // 2. Open language selector
      await page.click('button[aria-label="Cambiar idioma"]');
      
      // 3. Switch to English
      await page.click('text=//English/i/i');
      
      // 4. Verify UI updates to English
      await expect(page.locator('text=//Your Mexican Legal AI Assistant/i/i')).toBeVisible();
      
      // 5. Navigate to chat in English
      await page.click('text=//Legal Chat/i/i');
      await expect(page.locator('text=//Legal Chat/i/i')).toBeVisible();
      
      // 6. Switch back to Spanish
      await page.click('button[aria-label="Change language"]');
      await page.click('text=//Español/i/i');
      await expect(page.locator('text=//Chat Legal/i/i')).toBeVisible();
    });
  });

  test.describe('Theme Toggle - Isolated', () => {
    test('switch between light and dark themes', async ({ page }) => {
      // 1. Navigate to homepage
      await page.goto('http://localhost:4321/');
    await waitForHydration(page);// 2. Check default theme (light)
      const htmlElement = page.locator('html');
      await expect(htmlElement).not.toHaveClass(/dark/);
      
      // 3. Toggle to dark theme
      await page.click('button[aria-label="Cambiar tema"]');
      await page.click('text=//Oscuro/i/i');
      
      // 4. Verify dark theme applied
      await expect(htmlElement).toHaveClass(/dark/);
      
      // 5. Navigate to another page and verify theme persists
      await page.click('text=//Chat Legal/i/i');
      await expect(htmlElement).toHaveClass(/dark/);
      
      // 6. Switch back to light theme
      await page.click('button[aria-label="Cambiar tema"]');
      await page.click('text=//Claro/i/i');
      await expect(htmlElement).not.toHaveClass(/dark/);
    });
  });

  test.describe('Mobile Navigation - Isolated', () => {
    test('use mobile menu navigation', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      
      // 1. Navigate to homepage
      await page.goto('http://localhost:4321/');
    await waitForHydration(page);// 2. Open mobile menu
      await page.click('button[aria-label="Abrir menú principal"]');
      
      // 3. Verify menu is open
      await expect(page.locator('.mobile-menu')).toBeVisible();
      
      // 4. Navigate to chat
      await page.click('.mobile-menu >> text=/Chat Legal/i');
      await page.waitForURL('**/chat');
      
      // 5. Verify menu closed after navigation
      await expect(page.locator('.mobile-menu')).not.toBeVisible();
    });
  });

  test.describe('Error Handling - Isolated', () => {
    test('handle network errors gracefully', async ({ page, context }) => {
      // Setup provider first
      await page.goto('http://localhost:4321/setup');
    await waitForHydration(page);await page.click('[data-testid="setup-begin"]');
      await page.click('text=//Configuración Personalizada/i/i');
      await page.click('div:has-text("OpenAI")');
      await page.click('button:has-text("Configurar (1)")');
      await page.fill('input[type="password"]', 'sk-test-key');
      await page.click('button:has-text("Guardar")');
      await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
      await page.click('button:has-text("Comenzar a Usar LexMX")');
      
      // Simulate network failure
      await context.setOffline(true);
      
      // Try to send a message
      await page.fill('[data-testid={${TEST_IDS.chat.input}}]', 'Test query');
      await page.click('button[aria-label="Enviar mensaje"]');
      
      // Should show error message
      await expect(page.locator('text=//error|Error|problema|intenta nuevamente/i/i')).toBeVisible({ timeout: 10000 });
      
      // Restore network
      await context.setOffline(false);
    });
  });

  test.describe('Search and RAG Features - Isolated', () => {
    test('use advanced search options in chat', async ({ page }) => {
      // Setup provider
      await page.goto('http://localhost:4321/setup');
    await waitForHydration(page);await page.click('[data-testid="setup-begin"]');
      await page.click('div:has-text("Balanceado")');
      await page.click('div:has-text("OpenAI")');
      await page.click('button:has-text("Configurar (1)")');
      await page.fill('input[type="password"]', 'sk-test-key');
      await page.click('button:has-text("Guardar")');
      await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
      await page.click('button:has-text("Comenzar a Usar LexMX")');
      
      // Open advanced options
      await page.click('button[title="Opciones avanzadas"]');
      
      // Select specific legal area
      await page.selectOption('select#legal-area', 'labor');
      
      // Send a query
      await page.fill('[data-testid={${TEST_IDS.chat.input}}]', '¿Cuáles son los derechos de maternidad?');
      await page.click('button[aria-label="Enviar mensaje"]');
      
      // Verify response includes labor law context
      await expect(page.locator('text=//¿Cuáles son los derechos de maternidad?/i/i')).toBeVisible();
      await expect(page.locator('.animate-spin').or(page.locator('text=//Analizando/i/i'))).toBeVisible();
    });
  });

  test.describe('Provider Recommendation - Isolated', () => {
    test('see provider recommendations while typing', async ({ page }) => {
      // Setup multiple providers
      await page.goto('http://localhost:4321/setup');
    await waitForHydration(page);await page.click('[data-testid="setup-begin"]');
      await page.click('text=//Configuración Personalizada/i/i');
      await page.click('div:has-text("OpenAI")');
      await page.click('div:has-text("Claude")');
      await page.click('button:has-text("Configurar (2)")');
      
      // Configure OpenAI
      await page.fill('input[type="password"]', 'sk-openai-test');
      await page.click('button:has-text("Guardar")');
      
      // Configure Claude
      await page.fill('input[type="password"]', 'sk-ant-test');
      await page.click('button:has-text("Guardar")');
      
      await page.waitForSelector('h2:has-text("¡Configuración Completa!")');
      await page.click('button:has-text("Comenzar a Usar LexMX")');
      
      // Type a complex query
      await page.fill('[data-testid={${TEST_IDS.chat.input}}]', 'Necesito analizar un contrato complejo de compraventa internacional');
      
      // Wait for recommendations to appear
      await expect(page.locator('text=//Proveedores Recomendados/i/i')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.provider-recommendation')).toBeVisible();
    });
  });
});