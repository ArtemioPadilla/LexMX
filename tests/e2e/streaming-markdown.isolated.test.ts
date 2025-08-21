/**
 * Isolated version of streaming-markdown tests
 * Uses the new test isolation system for parallel execution
 */
import { isolatedTest as test, expect } from '../utils/isolated-fixtures';
import { setupPage, navigateToPage, waitForPageReady, setupAllMockProviders, setupProviderScenario, waitForHydration } from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Chat Streaming and Markdown - Isolated', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    // Navigate to the home page
    await page.goto('/');
    await waitForHydration(page);// Click on "Empezar" button to go to chat
    await page.click('text=/Empezar/i');
    
    // Wait for chat interface to load
    await page.waitForSelector('[data-testid={${TEST_IDS.chat.container}}]');
  });

  test('should render markdown content correctly', async ({ page }) => {
    // Mock the provider configuration first
    await page.goto('/setup');
    await waitForHydration(page);// Configure WebLLM provider (it's free and works in browser)
    await page.click('text=/WebLLM (Browser)/i');
    await page.click('button:has-text("Guardar configuración")');
    
    // Go back to chat
    await page.goto('/');
    await waitForHydration(page);await page.click('text=/Empezar/i');
    
    // Type a message that will trigger markdown response
    const testMessage = '¿Qué es el amparo? Dame una respuesta con formato markdown que incluya listas y código.';
    await page.fill('textarea[placeholder*="Escribe tu consulta legal"]', testMessage);
    
    // Submit the message
    await page.press('textarea', 'Enter');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 60000 });
    
    // Check that markdown elements are rendered
    const markdownContent = await page.locator('.markdown-content').first();
    
    // Check for headers
    const headers = await markdownContent.locator('h1, h2, h3').count();
    expect(headers).toBeGreaterThan(0);
    
    // Check for lists
    const lists = await markdownContent.locator('ul, ol').count();
    expect(lists).toBeGreaterThan(0);
    
    // Check for code blocks
    const codeBlocks = await markdownContent.locator('code').count();
    expect(codeBlocks).toBeGreaterThan(0);
    
    // Check for proper styling
    const h2Element = await markdownContent.locator('h2').first();
    if (await h2Element.count() > 0) {
      const fontWeight = await h2Element.evaluate(el => 
        window.getComputedStyle(el).fontWeight
      );
      expect(parseInt(fontWeight)).toBeGreaterThan(400); // Should be bold
    }
  });

  test('should show streaming animation while loading', async ({ page }) => {
    // Configure a provider first
    await page.goto('/setup');
    await waitForHydration(page);await page.click('text=/WebLLM (Browser)/i');
    await page.click('button:has-text("Guardar configuración")');
    
    // Go to chat
    await page.goto('/');
    await waitForHydration(page);await page.click('text=/Empezar/i');
    
    // Type and submit a message
    await page.fill('textarea[placeholder*="Escribe tu consulta legal"]', '¿Qué es el artículo 123?');
    await page.press('textarea', 'Enter');
    
    // Check for streaming indicator
    await page.waitForSelector('.animate-pulse', { timeout: 10000 });
    
    // Verify the streaming dots animation
    const streamingDots = await page.locator('.animate-pulse').count();
    expect(streamingDots).toBeGreaterThan(0);
    
    // Wait for response to complete
    await page.waitForSelector('.markdown-content', { timeout: 60000 });
    
    // Streaming indicator should be gone
    await expect(page.locator('.animate-pulse')).toHaveCount(0);
  });

  test('should progressively show content during streaming', async ({ page }) => {
    // Configure provider
    await page.goto('/setup');
    await waitForHydration(page);await page.click('text=/WebLLM (Browser)/i');
    await page.click('button:has-text("Guardar configuración")');
    
    // Go to chat
    await page.goto('/');
    await waitForHydration(page);await page.click('text=/Empezar/i');
    
    // Submit a query
    await page.fill('textarea[placeholder*="Escribe tu consulta legal"]', 'Explica el proceso de divorcio');
    await page.press('textarea', 'Enter');
    
    // Wait for initial content
    await page.waitForSelector('[class*="isStreaming"]:has-text("Analizando")', { timeout: 10000 });
    
    // Get the message element that's being streamed
    const messageElement = await page.locator('[class*="isStreaming"]').last();
    
    // Track content length over time to verify streaming
    let previousLength = 0;
    let increasingCount = 0;
    
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(1000);
      
      const currentContent = await messageElement.textContent();
      const currentLength = currentContent?.length || 0;
      
      if (currentLength > previousLength) {
        increasingCount++;
      }
      
      previousLength = currentLength;
      
      // If streaming stopped, break
      const isStillStreaming = await messageElement.evaluate(el => 
        el.classList.contains('isStreaming')
      );
      if (!isStillStreaming) break;
    }
    
    // Content should have increased at least once during streaming
    expect(increasingCount).toBeGreaterThan(0);
  });

  test('should support dark mode for markdown content', async ({ page }) => {
    // Configure provider
    await page.goto('/setup');
    await waitForHydration(page);await page.click('text=/WebLLM (Browser)/i');
    await page.click('button:has-text("Guardar configuración")');
    
    // Go to chat
    await page.goto('/');
    await waitForHydration(page);await page.click('text=/Empezar/i');
    
    // Toggle dark mode
    await page.click('[aria-label*="tema"]');
    await page.click('text=/Oscuro/i');
    
    // Submit a message
    await page.fill('textarea[placeholder*="Escribe tu consulta legal"]', '¿Qué es la jurisprudencia?');
    await page.press('textarea', 'Enter');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 60000 });
    
    // Check dark mode styles
    const htmlElement = await page.locator('html');
    const hasDarkClass = await htmlElement.evaluate(el => el.classList.contains('dark'));
    expect(hasDarkClass).toBe(true);
    
    // Check markdown content has appropriate dark mode colors
    const markdownElement = await page.locator('.markdown-content').first();
    const color = await markdownElement.evaluate(el => 
      window.getComputedStyle(el).color
    );
    
    // In dark mode, text should be light colored
    // Parse rgb values to check if it's a light color
    const rgbMatch = color.match(/\d+/g);
    if (rgbMatch) {
      const [r, g, b] = rgbMatch.map(Number);
      const brightness = (r + g + b) / 3;
      expect(brightness).toBeGreaterThan(128); // Should be bright in dark mode
    }
  });

  test('should handle markdown special characters correctly', async ({ page }) => {
    // Configure provider
    await page.goto('/setup');
    await waitForHydration(page);await page.click('text=/WebLLM (Browser)/i');
    await page.click('button:has-text("Guardar configuración")');
    
    // Go to chat
    await page.goto('/');
    await waitForHydration(page);await page.click('text=/Empezar/i');
    
    // Submit a message that should return markdown with special chars
    await page.fill('textarea[placeholder*="Escribe tu consulta legal"]', 
      'Dame ejemplos de artículos con caracteres especiales como < > & " \' y código'
    );
    await page.press('textarea', 'Enter');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 60000 });
    
    // Check that special characters are properly escaped/rendered
    const content = await page.locator('.markdown-content').first().innerHTML();
    
    // Should not contain unescaped HTML
    expect(content).not.toContain('<script');
    expect(content).not.toContain('javascript:');
    
    // But should render markdown elements
    expect(content).toMatch(/<(p|h\d|ul|ol|li|code|blockquote)/);
  });
});

test.describe('WebLLM Progress Indicator - Isolated', () => {
  test('should show progress when downloading WebLLM model', async ({ page }) => {
    // Clear any existing storage
    await page.goto('/');
    await waitForHydration(page);await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Go to setup
    await page.goto('/setup');
    await waitForHydration(page);// Click on WebLLM provider
    await page.click('text=/WebLLM (Browser)/i');
    
    // Select a model
    await page.selectOption('select[name="model"]', 'Llama-3.2-3B-Instruct-q4f16_1-MLC');
    
    // Enable and save
    await page.click('input[type="checkbox"][name="enabled"]');
    await page.click('button:has-text("Guardar configuración")');
    
    // Go to chat
    await page.goto('/');
    await waitForHydration(page);await page.click('text=/Empezar/i');
    
    // Submit a message to trigger model download
    await page.fill('textarea[placeholder*="Escribe tu consulta legal"]', 'Hola');
    await page.press('textarea', 'Enter');
    
    // Look for WebLLM progress indicator
    const progressIndicator = page.locator('text=/Descargando modelo IA/i');
    
    // If model needs to download, progress should appear
    const progressVisible = await progressIndicator.isVisible().catch(() => false);
    
    if (progressVisible) {
      // Check progress bar exists
      await expect(page.locator('[role="progressbar"]')).toBeVisible();
      
      // Check percentage is shown
      await expect(page.locator('text=/%/i')).toBeVisible();
      
      // Wait for progress to complete (with generous timeout)
      await expect(progressIndicator).toBeHidden({ timeout: 600000 });
    }
    
    // Eventually should show response
    await expect(page.locator('.markdown-content')).toBeVisible({ timeout: 600000 });
  });
});