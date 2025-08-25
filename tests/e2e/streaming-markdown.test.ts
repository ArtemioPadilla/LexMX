import { expect, test, waitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of streaming-markdown tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Chat Streaming and Markdown (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    // Use our fixed provider setup and navigate to chat properly
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Set up WebLLM provider using our fixed method
    await quickSetupProvider(page, "webllm");
    
    // Wait for chat interface to load
    await page.waitForSelector('[data-testid="chat-container"]');
  });

  test('should render markdown content correctly', async ({ page }) => {
    // Provider is already configured in beforeEach
    
    // Type a message that will trigger markdown response
    const testMessage = '¿Qué es el amparo? Dame una respuesta con formato markdown que incluya listas y código.';
    await page.fill('[data-testid="chat-input"]', testMessage);
    
    // Submit the message using proper test-id
    await page.click('[data-testid="chat-send"]');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 15000 });
    
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
    // Provider is already configured in beforeEach
    
    // Type and submit a message using proper test-ids
    await page.fill('[data-testid="chat-input"]', '¿Qué es el artículo 123?');
    await page.click('[data-testid="chat-send"]');
    
    // Check for streaming indicator
    await page.waitForSelector('.animate-pulse', { timeout: 5000 });
    
    // Verify the streaming dots animation
    const streamingDots = await page.locator('.animate-pulse').count();
    expect(streamingDots).toBeGreaterThan(0);
    
    // Wait for response to complete
    await page.waitForSelector('.markdown-content', { timeout: 15000 });
    
    // Streaming indicator should be gone
    await expect(page.locator('.animate-pulse')).toHaveCount(0);
  });

  test('should progressively show content during streaming', async ({ page }) => {
    // Provider is already configured in beforeEach
    
    // Submit a query using proper test-ids
    await page.fill('[data-testid="chat-input"]', 'Explica el proceso de divorcio');
    await page.click('[data-testid="chat-send"]');
    
    // Wait for initial content
    await page.waitForSelector('[class*="isStreaming"]:has-text("Analizando"), :has-text(/Analizando/i)', { timeout: 5000 });
    
    // Get the message element that's being streamed
    const messageElement = await page.locator('[class*="isStreaming"]').last();
    
    // Track content length over time to verify streaming
    let previousLength = 0;
    let increasingCount = 0;
    
    for (let i = 0; i < 5; i++) {
      // await smartWait(page, "interaction"); // TODO: Replace with proper wait condition;
      
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
    // Provider is already configured in beforeEach
    
    // Toggle dark mode using proper test-ids
    await page.waitForSelector('[data-testid="theme-toggle"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="theme-toggle"]');
    await page.waitForSelector('[data-testid="theme-dark"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="theme-dark"]');
    
    // Submit a message using proper test-ids
    await page.fill('[data-testid="chat-input"]', '¿Qué es la jurisprudencia?');
    await page.click('[data-testid="chat-send"]');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 15000 });
    
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
    // Provider is already configured in beforeEach
    
    // Submit a message that should return markdown with special chars
    await page.fill('[data-testid="chat-input"]', 
      'Dame ejemplos de artículos con caracteres especiales como < > & " \' y código'
    );
    await page.click('[data-testid="chat-send"]');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 15000 });
    
    // Check that special characters are properly escaped/rendered
    const content = await page.locator('.markdown-content').first().innerHTML();
    
    // Should not contain unescaped HTML
    expect(content).not.toContain('<script');
    expect(content).not.toContain('javascript:');
    
    // But should render markdown elements
    expect(content).toMatch(/<(p|h\d|ul|ol|li|code|blockquote)/);
  });
});

test.describe('WebLLM Progress Indicator', () => {
  test('should show progress when downloading WebLLM model', async ({ page }) => {
    // Clear any existing storage and set up fresh
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Go to setup and configure WebLLM with specific model
    await page.goto('/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Start setup and select WebLLM provider
    await page.waitForSelector('[data-testid="setup-begin"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-begin"]');
    await page.waitForSelector('[data-testid="setup-webllm"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="setup-webllm"]');
    
    // Select a model using proper selector
    await page.selectOption('[data-testid="webllm-model-selector"]', 'Llama-3.2-3B-Instruct-q4f16_1-MLC');
    
    // Save configuration
    await page.waitForSelector('[data-testid="provider-save"]', { state: 'visible', timeout: 5000 });
    await page.click('[data-testid="provider-save"]');
    
    // Navigate to chat
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Submit a message to trigger model download
    await page.fill('[data-testid="chat-input"]', 'Hola');
    await page.click('[data-testid="chat-send"]');
    
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
      await expect(progressIndicator).toBeHidden({ timeout: 150000 });
    }
    
    // Eventually should show response
    await expect(page.locator('.markdown-content')).toBeVisible({ timeout: 150000 });
  });
});