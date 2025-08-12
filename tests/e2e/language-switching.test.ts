import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  clearAllStorage,
  setupWebLLMProvider
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

test.describe('Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('language selector is visible and functional', async ({ page }) => {
    await page.goto('/');
    
    // Check language selector is visible
    const langSelector = page.locator('.language-selector button').first();
    await expect(langSelector).toBeVisible();
    
    // Click to open dropdown
    await langSelector.click();
    
    // Check dropdown options are visible
    await expect(page.locator('.language-selector button:has-text("Español")')).toBeVisible();
    await expect(page.locator('.language-selector button:has-text("English")')).toBeVisible();
    
    // Select English
    await page.click('.language-selector button:has-text("English")');
    
    // Verify language changed (check flag icon changed)
    await expect(langSelector).toContainText('EN');
    
    // Verify it persists after reload
    await page.reload();
    await expect(page.locator('.language-selector button').first()).toContainText('EN');
  });

  test('homepage content changes with language', async ({ page }) => {
    await page.goto('/');
    
    // Verify Spanish content is displayed by default
    await expect(page.locator('h1').first().first()).toContainText('Tu Asistente Legal');
    await expect(page.locator('[data-testid="cta-chat"]')).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Wait for content to update
    await page.waitForTimeout(500);
    
    // Verify English content is displayed
    await expect(page.locator('h1').first().first()).toContainText('Your Mexican Legal AI Assistant');
    await expect(page.locator('text="Start Free Consultation"')).toBeVisible();
  });

  test('chat interface translates correctly', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    await page.reload();
    
    // Verify Spanish content
    await expect(page.locator('h1').first().first()).toContainText('Chat Legal');
    const welcomeMessage = page.locator('[data-testid="chat-container"]').locator('text=/Bienvenido a LexMX/i');
    await expect(welcomeMessage).toBeVisible();
    
    // Check placeholder text
    const input = page.locator('[data-testid="chat-input"]');
    await expect(input).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Verify English content
    await expect(page.locator('h1').first().first()).toContainText('Legal Chat');
    const welcomeMessageEn = page.locator('[data-testid="chat-container"]').locator('text=/Welcome to LexMX/i');
    await expect(welcomeMessageEn).toBeVisible();
    
    // Check placeholder text changed
    const inputEn = page.locator('textarea[placeholder*="legal question"]');
    await expect(inputEn).toBeVisible();
  });

  test('navigation menu translates correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check Spanish navigation
    await expect(page.locator('nav a:has-text("Chat Legal")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Mis Casos")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Wiki Legal")')).toBeVisible();
    await expect(page.locator('nav a:has-text("Códigos")')).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Check English navigation
    await expect(page.locator('nav a[data-i18n="nav.chat"]')).toContainText('Legal Chat');
    await expect(page.locator('nav a[data-i18n="nav.cases"]')).toContainText('My Cases');
    await expect(page.locator('nav a[data-i18n="nav.wiki"]')).toContainText('Legal Wiki');
    await expect(page.locator('nav a[data-i18n="nav.codes"]')).toContainText('Legal Codes');
  });

  test('language preference persists across pages', async ({ page }) => {
    // Start on home page and switch to English
    await page.goto('/');
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Navigate to chat
    await page.goto('/chat');
    await expect(page.locator('.language-selector button').first()).toContainText('EN');
    await expect(page.locator('h1').first().first()).toContainText('Legal Chat');
    
    // Navigate to casos
    await page.goto('/casos');
    await expect(page.locator('.language-selector button').first()).toContainText('EN');
    
    // Navigate to setup
    await page.goto('/setup');
    await expect(page.locator('.language-selector button').first()).toContainText('EN');
    
    // Go back to home
    await page.goto('/');
    await expect(page.locator('.language-selector button').first()).toContainText('EN');
    await expect(page.locator('h1').first().first()).toContainText('Your Mexican Legal AI Assistant');
  });

  test('setup wizard translates correctly', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/setup');
    
    // Verify Spanish content
    await expect(page.locator('h2').first().first()).toContainText('Configura tu Asistente Legal IA');
    await expect(page.locator('[data-testid="provider-webllm"]')).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Verify English content
    await expect(page.locator('h2').first().first()).toContainText('Configure your Legal AI Assistant');
    await expect(page.locator('button:has-text("Use WebLLM")')).toBeVisible();
  });

  test('example questions translate in chat', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    await page.reload();
    
    // Check Spanish example questions
    const spanishExample = page.locator('text="¿Qué dice el artículo 123 constitucional"');
    await expect(spanishExample).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Check English example questions
    const englishExample = page.locator('text="What does constitutional article 123"');
    await expect(englishExample).toBeVisible();
  });

  test('error messages translate correctly', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // Clear providers to trigger error message
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    
    // Check Spanish error message
    const spanishError = page.locator('text=/No tienes proveedores/i');
    await expect(spanishError).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Wait for update
    await page.waitForTimeout(500);
    
    // Check English error message
    const englishError = page.locator('text=/No AI providers configured/i');
    await expect(englishError).toBeVisible();
  });

  test('language selector works in dark mode', async ({ page }) => {
    await page.goto('/');
    
    // Enable dark mode first
    const themeToggle = page.locator('.theme-toggle button').first();
    await themeToggle.click();
    await page.click('.theme-toggle button:has-text("Oscuro")');
    
    // Verify dark mode is active
    await expect(page.locator('html')).toHaveClass(/dark/);
    
    // Test language selector in dark mode
    const langSelector = page.locator('.language-selector button').first();
    await expect(langSelector).toBeVisible();
    
    // Open dropdown
    await langSelector.click();
    
    // Check dropdown has dark styling
    const dropdown = page.locator('.language-selector div.absolute');
    await expect(dropdown).toBeVisible();
    await expect(dropdown).toHaveCSS('background-color', 'rgb(31, 41, 55)'); // gray-800
    
    // Select English
    await page.click('.language-selector button:has-text("English")');
    
    // Verify language changed
    await expect(langSelector).toContainText('EN');
  });

  test('language and theme preferences persist together', async ({ page }) => {
    await page.goto('/');
    
    // Set dark mode and English
    const themeToggle = page.locator('.theme-toggle button').first();
    await themeToggle.click();
    await page.click('.theme-toggle button:has-text("Oscuro")');
    
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    await page.click('.language-selector button:has-text("English")');
    
    // Reload page
    await page.reload();
    
    // Verify both preferences persisted
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('.language-selector button').first()).toContainText('EN');
    await expect(page.locator('h1').first().first()).toContainText('Your Mexican Legal AI Assistant');
  });

  test('language selector closes when clicking outside', async ({ page }) => {
    await page.goto('/');
    
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.click();
    
    // Dropdown should be visible
    const dropdown = page.locator('.language-selector div.absolute');
    await expect(dropdown).toBeVisible();
    
    // Click outside
    await page.click('body', { position: { x: 10, y: 10 } });
    
    // Dropdown should be hidden
    await expect(dropdown).not.toBeVisible();
  });

  test('language selector keyboard navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Focus on language selector
    const langSelector = page.locator('.language-selector button').first();
    await langSelector.focus();
    
    // Open with Enter key
    await page.keyboard.press('Enter');
    
    // Dropdown should be visible
    const dropdown = page.locator('.language-selector div.absolute');
    await expect(dropdown).toBeVisible();
    
    // Close with Escape key
    await page.keyboard.press('Escape');
    
    // Dropdown should be hidden
    await expect(dropdown).not.toBeVisible();
  });
});