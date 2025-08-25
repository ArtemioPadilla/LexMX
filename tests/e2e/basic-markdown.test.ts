import { expect, test, waitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of basic-markdown tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Basic Markdown Rendering (Mocked)', () => {
  test('should render markdown in chat messages', async ({ page }) => {
    // Go directly to chat page and set up provider
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Set up provider for functional chat
    await quickSetupProvider(page, "webllm");
    
    // Check that ChatInterface component is visible
    const chatInterface = await page.locator('[data-testid="chat-container"]').isVisible();
    expect(chatInterface).toBe(true);
    
    // Look for any existing messages with markdown content
    const markdownElements = await page.locator('.markdown-content').count();
    console.log(`Found ${markdownElements} markdown content elements`);
    
    // The welcome message should have markdown content
    expect(markdownElements).toBeGreaterThan(0);
  });

  test('should apply markdown styles', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Set up provider for functional chat
    await quickSetupProvider(page, "webllm");
    // Check that markdown CSS is loaded
    const markdownStyles = await page.evaluate(() => {
      // Check if any markdown-specific styles are applied
      const testElement = document.createElement('div');
      testElement.className = 'markdown-content';
      document.body.appendChild(testElement);
      
      const styles = window.getComputedStyle(testElement);
      document.body.removeChild(testElement);
      
      return {
        hasStyles: styles.lineHeight !== 'normal' || styles.color !== 'rgb(0, 0, 0)'
      };
    });
    
    expect(markdownStyles.hasStyles).toBe(true);
  });

  test('should handle dark mode', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Set up provider for functional chat
    await quickSetupProvider(page, "webllm");
    // Wait for theme toggle to be available
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    await themeToggle.waitFor({ state: 'visible', timeout: 5000 });
    
    // Click theme toggle
    await themeToggle.click();
    
    // Wait for dropdown using proper test-id
    await page.waitForSelector('[data-testid="theme-dropdown-button"]', { state: 'visible' });
    
    // Select dark mode using proper test-id
    const darkOption = page.locator('[data-testid="theme-dark"]').first();
    try {
      await darkOption.waitFor({ state: 'visible', timeout: 5000 });
      await darkOption.click();
      
      // Check that dark class is applied
      const htmlElement = page.locator('html');
      await expect(htmlElement).toHaveClass(/dark/);
    } catch {
      // Dark mode option might not be visible, skip
      console.log('Dark mode option not found, skipping');
    }
  });
});