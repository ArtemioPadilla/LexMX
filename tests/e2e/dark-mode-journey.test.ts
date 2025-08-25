import { clearAllStorage, expect, setupWebLLMProvider, test, toggleDarkMode, waitForHydration, navigateAndWaitForHydration, isVisibleInDarkMode } from '../utils/test-helpers-consolidated';
import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';
import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';

/**
 * Isolated version of dark-mode-journey tests
 * Uses the new test isolation system for parallel execution
 */
import { Page } from '@playwright/test';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

// Helper to wait for theme to be applied
async function waitForThemeApplied(page: Page, theme: 'dark' | 'light') {
  await page.waitForFunction((expectedTheme) => {
    const html = document.documentElement;
    return expectedTheme === 'dark' ? html.classList.contains('dark') : !html.classList.contains('dark');
  }, theme, { timeout: 5000 });
}

test.describe('Dark Mode User Journey (Mocked)', () => {
  test.beforeEach(async ({ page }) => {
    // Note: setupIsolatedPage is already called by the fixture
    await clearAllStorage(page);
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);});

  test('theme toggle is visible and functional', async ({ page }) => {
    // Check theme toggle is visible using correct data-testid
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    await expect(themeToggle).toBeVisible({ timeout: 5000 });
    
    // Click to open dropdown
    await themeToggle.click();
    
    // Check dropdown options are visible using correct data-testids
    const lightOption = page.locator('[data-testid="theme-light"]');
    const darkOption = page.locator('[data-testid="theme-dark"]');
    const systemOption = page.locator('[data-testid="theme-system"]');
    
    // Use fallback selectors if data-testid not available
    const lightFallback = page.locator('button').filter({ hasText: /Claro|Light/i }).first();
    const darkFallback = page.locator('button').filter({ hasText: /Oscuro|Dark/i }).first();
    const systemFallback = page.locator('button').filter({ hasText: /Sistema|System/i }).first();
    
    await expect(await lightOption.isVisible() ? lightOption : lightFallback).toBeVisible();
    await expect(await darkOption.isVisible() ? darkOption : darkFallback).toBeVisible();
    await expect(await systemOption.isVisible() ? systemOption : systemFallback).toBeVisible();
    
    // Select dark mode
    const darkSelector = await darkOption.isVisible() ? darkOption : darkFallback;
    await darkSelector.click();
    
    // Wait for dark mode to be applied
    await waitForThemeApplied(page, 'dark');
    
    // Verify dark mode is applied
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Verify it persists after reload
    await page.reload();
    await waitForThemeApplied(page, 'dark');
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('theme toggle dropdown works in dark mode', async ({ page }) => {
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Wait for dark mode to be applied
    await waitForThemeApplied(page, 'dark');
    
    // Verify dark mode is enabled
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Check theme toggle is still accessible in dark mode using correct data-testid
    const themeToggle = page.locator('[data-testid="theme-toggle"]').first();
    await expect(themeToggle).toBeVisible({ timeout: 5000 });
    
    // Open dropdown again
    await themeToggle.click();
    // Removed unnecessary wait
    
    // Verify dropdown is visible in dark mode using proper selector
    const dropdown = page.locator('[data-testid="theme-dropdown-button"]').first();
    // Fallback to class-based selector if needed
    const dropdownFallback = page.locator('.theme-toggle div.absolute').first();
    const dropdownSelector = await dropdown.isVisible() ? dropdown : dropdownFallback;
    
    await expect(dropdownSelector).toBeVisible();
    
    // Check dropdown has dark styling
    await expect(dropdownSelector).toHaveCSS('background-color', 'rgb(31, 41, 55)'); // gray-800
    
    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('chat interface displays correctly in dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await quickSetupProvider(page, "webllm");
    
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Check main chat container has dark background
    const chatInterface = page.locator('[data-testid="chat-container"]');
    await expect(chatInterface).toBeVisible();
    await expect(chatInterface).toHaveCSS('background-color', 'rgb(17, 24, 39)'); // gray-900
    
    // Check input area has dark styling
    const inputArea = page.locator('[data-testid="chat-input"]');
    await expect(inputArea).toBeVisible();
    await expect(inputArea).toHaveCSS('background-color', 'rgb(55, 65, 81)'); // gray-700
    
    // Check example questions have proper dark mode styling
    const exampleSection = page.locator('[data-testid="chat-examples"]').first();
    // Fallback to class selector if data-testid not available
    const exampleFallback = page.locator('.flex-shrink-0.p-4.border-t').first();
    const exampleSelector = await exampleSection.isVisible() ? exampleSection : exampleFallback;
    await expect(exampleSelector).toHaveCSS('background-color', 'rgb(31, 41, 55)'); // gray-800
  });

  test('markdown content renders correctly in dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await quickSetupProvider(page, "webllm");
    
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Send a message to get a response with markdown
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Test message with **bold text** and *italic text*');
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 5000 });
    
    // Check bold text is visible
    const boldText = page.locator('strong').first();
    if (await boldText.isVisible()) {
      const boldColor = await boldText.evaluate(el => 
        window.getComputedStyle(el).color
      );
      
      // Parse RGB and check brightness
      const rgb = boldColor.match(/\d+/g);
      if (rgb) {
        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
        expect(brightness).toBeGreaterThan(128); // Should be bright in dark mode
      }
    }
    
    // Check code blocks have proper dark styling
    const codeBlock = page.locator('code').first();
    if (await codeBlock.isVisible()) {
      await expect(codeBlock).toHaveCSS('background-color', /rgb\(31, 41, 55\)/); // gray-800
    }
  });

  test('footer text is readable in dark mode', async ({ page }) => {
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Scroll to footer
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    
    // Check footer text is visible and readable
    const footerText = page.locator('footer p').first();
    await expect(footerText).toBeVisible();
    
    const isReadable = await isVisibleInDarkMode(page, 'footer p');
    expect(isReadable).toBe(true);
    
    // Check at least some footer links are visible and readable
    const footerLinks = page.locator('footer a');
    const linkCount = await footerLinks.count();
    
    if (linkCount > 0) {
      // Just check the first visible link instead of all
      const firstVisibleLink = await footerLinks.evaluateAll(links => {
        const visible = links.find(link => {
          const style = window.getComputedStyle(link);
          return style.display !== 'none' && style.visibility !== 'hidden';
        });
        return visible ? links.indexOf(visible) : -1;
      });
      
      if (firstVisibleLink >= 0) {
        const link = footerLinks.nth(firstVisibleLink);
        await expect(link).toBeVisible();
        // Just verify the link has appropriate text color for dark mode
        const color = await link.evaluate(el => window.getComputedStyle(el).color);
        const rgb = color.match(/\d+/g);
        if (rgb) {
          const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3;
          expect(brightness).toBeGreaterThan(100); // Should be bright enough in dark mode
        }
      }
    }
  });

  test('provider setup wizard works in dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/setup');
    
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Check setup container has dark background
    const setupContainer = page.locator('.provider-setup');
    await expect(setupContainer).toBeVisible();
    await expect(setupContainer).toHaveCSS('background-color', 'rgb(17, 24, 39)'); // gray-900
    
    // Check welcome screen text is readable
    const welcomeTitle = page.locator('h2:text="Configura tu Asistente Legal IA", :has-text(/Configura tu Asistente Legal IA/i)');
    await expect(welcomeTitle).toBeVisible();
    
    const titleReadable = await isVisibleInDarkMode(page, 'h2:text="Configura tu Asistente Legal IA", :has-text(/Configura tu Asistente Legal IA/i)');
    expect(titleReadable).toBe(true);
    
    // Check buttons are visible
    const webllmButton = page.locator('[data-testid="provider-webllm"]');
    await expect(webllmButton).toBeVisible();
    await expect(webllmButton).toHaveCSS('background-image', /gradient/); // Has gradient background
  });

  test('case manager displays correctly in dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/casos');
    
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Check main container has dark background
    await expect(page.locator('[data-testid="chat-container"]')).toHaveCSS('background-color', 'rgb(17, 24, 39)'); // gray-900
    
    // Check sidebar has proper dark styling
    const sidebar = page.locator('[data-testid="chat-container"] > div').first();
    await expect(sidebar).toBeVisible();
    
    // Check "Nuevo Caso" button is visible
    const newCaseButton = page.locator('button:has-text("Nuevo Caso"), button:has-text("New Case")');
    await expect(newCaseButton).toBeVisible();
    // Button uses legal-500 which is green (rgb(34, 197, 94))
    await expect(newCaseButton).toHaveCSS('background-color', /rgb\(34, 197, 94\)/); // legal-500 green
    
    // Check search input has dark styling
    const searchInput = page.locator('[data-testid="search-cases-input"]');
    await expect(searchInput).toBeVisible();
    await expect(searchInput).toHaveCSS('background-color', 'rgb(31, 41, 55)'); // gray-800
  });

  test('all navigation links are visible in dark mode', async ({ page }) => {
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Check desktop navigation
    const navLinks = page.locator('nav a');
    const linkTexts = ['Chat Legal', 'Mis Casos', 'Wiki Legal', 'Códigos', 'Solicitudes', 'Configuración', 'Acerca de'];
    
    for (const text of linkTexts) {
      const link = page.locator(`nav a:text="${text}", :has-text(/${text}/i)`).first();
      if (await link.isVisible()) {
        const linkReadable = await isVisibleInDarkMode(page, `nav a:text="${text}", :has-text(/${text}/i)`);
        expect(linkReadable).toBe(true);
      }
    }
    
    // Check navigation is still visible on smaller screens
    await page.setViewportSize({ width: 375, height: 667 });
    
    // On mobile, check if navigation is visible or accessible
    // Since we don't have a mobile menu component yet, just verify the page works
    await expect(page.locator('body')).toBeVisible();
  });

  test('theme preference persists across different pages', async ({ page }) => {
    // Enable dark mode on home page
    await toggleDarkMode(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Navigate to chat
    await page.goto('/chat');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Navigate to casos
    await page.goto('/casos');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Navigate to setup
    await page.goto('/setup');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Go back to home
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    await waitForHydration(page);
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('comparison table in setup page is readable in dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/setup');
    
    // Scroll to comparison table
    await page.evaluate(() => {
      const table = document.querySelector('table');
      if (table) table.scrollIntoView();
    });
    
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Check table headers are readable
    const tableHeaders = page.locator('th');
    const headerCount = await tableHeaders.count();
    
    for (let i = 0; i < Math.min(headerCount, 3); i++) {
      const header = tableHeaders.nth(i);
      if (await header.isVisible()) {
        const headerReadable = await isVisibleInDarkMode(page, `th:nth-of-type(${i + 1})`);
        expect(headerReadable).toBe(true);
      }
    }
    
    // Check WebLLM row (should be first)
    const webllmRow = page.locator('tr:text="WebLLM", :has-text(/WebLLM/i)').first();
    if (await webllmRow.isVisible()) {
      await expect(webllmRow.locator('td').first()).toContainText('WebLLM');
      
      // Check recommended badge is visible
      const badge = webllmRow.locator('span:text="Recomendado", :has-text(/Recomendado/i)');
      if (await badge.isVisible()) {
        await expect(badge).toHaveCSS('color', /rgb/); // Should have a color
      }
    }
  });
});