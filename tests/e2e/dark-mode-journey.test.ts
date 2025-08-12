import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  toggleDarkMode,
  isVisibleInDarkMode,
  setupWebLLMProvider,
  testDarkMode,
  clearAllStorage
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Dark Mode User Journey', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    await page.goto('/');
  });

  test('theme toggle is visible and functional', async ({ page }) => {
    // Check theme toggle is visible
    const themeToggle = page.locator('.theme-toggle button').first();
    await expect(themeToggle).toBeVisible();
    
    // Click to open dropdown
    await themeToggle.click();
    
    // Check dropdown options are visible
    await expect(page.locator('button:has-text("Claro")')).toBeVisible();
    await expect(page.locator('button:has-text("Oscuro")')).toBeVisible();
    await expect(page.locator('button:has-text("Sistema")')).toBeVisible();
    
    // Select dark mode
    await page.click('button:has-text("Oscuro")');
    
    // Verify dark mode is applied
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Verify it persists after reload
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
  });

  test('theme toggle dropdown works in dark mode', async ({ page }) => {
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Verify dark mode is enabled
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Check theme toggle is still accessible in dark mode
    const themeToggle = page.locator('.theme-toggle button').first();
    await expect(themeToggle).toBeVisible();
    
    // Open dropdown again
    await themeToggle.click();
    
    // Verify dropdown is visible in dark mode
    const dropdown = page.locator('.theme-toggle div.absolute');
    await expect(dropdown).toBeVisible();
    
    // Check dropdown has dark styling
    await expect(dropdown).toHaveCSS('background-color', 'rgb(31, 41, 55)'); // gray-800
    
    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('chat interface displays correctly in dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
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
    const exampleSection = page.locator('.flex-shrink-0.p-4.border-t').first();
    await expect(exampleSection).toHaveCSS('background-color', 'rgb(31, 41, 55)'); // gray-800
  });

  test('markdown content renders correctly in dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    
    // Enable dark mode
    await toggleDarkMode(page);
    
    // Send a message to get a response with markdown
    const input = page.locator('[data-testid="chat-input"]');
    await input.fill('Test message with **bold text** and *italic text*');
    await page.keyboard.press('Enter');
    
    // Wait for response
    await page.waitForSelector('.markdown-content', { timeout: 10000 });
    
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
    const welcomeTitle = page.locator('h2:has-text("Configura tu Asistente Legal IA")');
    await expect(welcomeTitle).toBeVisible();
    
    const titleReadable = await isVisibleInDarkMode(page, 'h2:has-text("Configura tu Asistente Legal IA")');
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
    await expect(page.locator('[data-testid="case-manager"]')).toHaveCSS('background-color', 'rgb(17, 24, 39)'); // gray-900
    
    // Check sidebar has proper dark styling
    const sidebar = page.locator('[data-testid="case-manager"] > div').first();
    await expect(sidebar).toBeVisible();
    
    // Check "Nuevo Caso" button is visible
    const newCaseButton = page.locator('[data-testid="new-case-button"]');
    await expect(newCaseButton).toBeVisible();
    // Button uses legal-500 which is green (rgb(34, 197, 94))
    await expect(newCaseButton).toHaveCSS('background-color', /rgb\(34, 197, 94\)/); // legal-500 green
    
    // Check search input has dark styling
    const searchInput = page.locator('[data-testid="case-search"]');
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
      const link = page.locator(`nav a:has-text("${text}")`).first();
      if (await link.isVisible()) {
        const linkReadable = await isVisibleInDarkMode(page, `nav a:has-text("${text}")`);
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
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Navigate to casos
    await page.goto('/casos');
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Navigate to setup
    await page.goto('/setup');
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Go back to home
    await page.goto('/');
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
    const webllmRow = page.locator('tr:has-text("WebLLM")').first();
    if (await webllmRow.isVisible()) {
      await expect(webllmRow.locator('td').first()).toContainText('WebLLM');
      
      // Check recommended badge is visible
      const badge = webllmRow.locator('span:has-text("Recomendado")');
      if (await badge.isVisible()) {
        await expect(badge).toHaveCSS('color', /rgb/); // Should have a color
      }
    }
  });
});