import { test, expect } from '@playwright/test';

test.describe('Basic Markdown Rendering', () => {
  test('should render markdown in chat messages', async ({ page }) => {
    // Go directly to chat page
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check if we have the "Empezar" button
    const startButton = page.locator('text=Empezar');
    const isStartButtonVisible = await startButton.isVisible().catch(() => false);
    
    if (isStartButtonVisible) {
      await startButton.click();
      await page.waitForSelector('.chat-interface', { timeout: 5000 });
    }
    
    // Check that MessageContent component is being used
    const chatInterface = await page.locator('.chat-interface').isVisible();
    expect(chatInterface).toBe(true);
    
    // Look for any existing messages with markdown content
    const markdownElements = await page.locator('.markdown-content').count();
    console.log(`Found ${markdownElements} markdown content elements`);
    
    // The welcome message should have markdown content
    expect(markdownElements).toBeGreaterThan(0);
  });

  test('should apply markdown styles', async ({ page }) => {
    await page.goto('/');
    
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
    await page.goto('/');
    
    // Wait for theme toggle to be available
    await page.waitForSelector('[aria-label*="tema"]', { timeout: 5000 });
    
    // Click theme toggle
    await page.click('[aria-label*="tema"]');
    
    // Select dark mode
    const darkOption = page.locator('text=Oscuro');
    if (await darkOption.isVisible()) {
      await darkOption.click();
      
      // Check that dark class is applied
      const htmlElement = page.locator('html');
      await expect(htmlElement).toHaveClass(/dark/);
    }
  });
});