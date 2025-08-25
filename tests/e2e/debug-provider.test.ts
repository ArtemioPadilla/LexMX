import { expect, test, waitForHydration } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of debug-provider tests
 * Uses the new test isolation system for parallel execution
 */
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Debug Provider Setup (Mocked)', () => {
  test('debug provider setup and chat functionality', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`Browser console: ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`Browser error: ${err.message}`));

    // Clear storage and set up provider using proven pattern
    console.log('Setting up provider using quickSetupProvider...');
    await page.goto('http://localhost:4321/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await quickSetupProvider(page, "webllm");

    // 1. Test chat interface is working
    console.log('Testing chat interface...');
    
    // Check if chat interface is visible
    const chatInterface = await page.locator('[data-testid="chat-container"]').isVisible();
    console.log('Chat interface visible:', chatInterface);
    
    // Test if chat input is functional (not disabled)
    const chatInput = page.locator('[data-testid="chat-input"]');
    const isDisabled = await chatInput.isDisabled();
    console.log('Chat input disabled:', isDisabled);
    
    // Take screenshot of current state
    await page.screenshot({ path: 'debug-chat-state.png' });
    
    // 2. Test navigation to setup page
    console.log('Testing navigation to setup page...');
    await page.goto('http://localhost:4321/setup');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Check if setup page loads using proper data-testid
    console.log('Waiting for setup page...');
    await page.waitForSelector('[data-testid="provider-setup"]', { timeout: 5000 });
    console.log('Setup page loaded');
    
    // Take screenshot
    await page.screenshot({ path: 'debug-setup-page.png' });
    
    // 3. Test setup wizard components
    const welcomeText = await page.locator('h2:has-text("Configura tu Asistente Legal IA")').isVisible();
    console.log('Welcome text visible:', welcomeText);
    
    // Check start button
    const startButton = page.locator('[data-testid="setup-begin"]');
    const startButtonVisible = await startButton.isVisible();
    console.log('Start button visible:', startButtonVisible);
    
    if (startButtonVisible) {
      console.log('Clicking start button...');
      await startButton.click();
      await page.screenshot({ path: 'debug-after-start-click.png' });
    }
    
    // 4. Test WebLLM setup button (our configured provider)
    const webllmButton = page.locator('[data-testid="setup-webllm"]');
    const webllmVisible = await webllmButton.isVisible();
    console.log('WebLLM button visible:', webllmVisible);
    
    // 5. Go back to chat and verify everything still works
    console.log('Returning to chat to verify functionality...');
    await page.goto('http://localhost:4321/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    
    // Final state check
    const finalChatInterface = await page.locator('[data-testid="chat-container"]').isVisible();
    const finalInputDisabled = await page.locator('[data-testid="chat-input"]').isDisabled();
    
    console.log('Final chat interface visible:', finalChatInterface);
    console.log('Final chat input disabled:', finalInputDisabled);
    
    // Take final screenshot
    await page.screenshot({ path: 'debug-final-state.png' });
    
    // Assertions to verify everything works
    expect(chatInterface).toBe(true);
    expect(isDisabled).toBe(false);
    expect(finalChatInterface).toBe(true);
    expect(finalInputDisabled).toBe(false);
  });

  test('debug theme functionality', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log(`Browser console (theme): ${msg.type()}: ${msg.text()}`));
    page.on('pageerror', err => console.log(`Browser error (theme): ${err.message}`));

    // Set up and navigate to homepage
    await page.goto('http://localhost:4321/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);

    // Check theme toggle functionality
    console.log('Testing theme toggle...');
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    const themeVisible = await themeToggle.isVisible();
    console.log('Theme toggle visible:', themeVisible);

    if (themeVisible) {
      await themeToggle.click();
      const darkOption = page.locator('[data-testid="theme-dark"]');
      const darkVisible = await darkOption.isVisible();
      console.log('Dark theme option visible:', darkVisible);
      
      if (darkVisible) {
        await darkOption.click();
        await page.screenshot({ path: 'debug-dark-theme.png' });
      }
    }
    
    // Verify dark mode is applied
    const isDark = await page.locator('html').evaluate(el => el.classList.contains('dark'));
    console.log('Dark mode applied:', isDark);
    
    expect(themeVisible).toBe(true);
  });
});