import { test, expect, Page } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  clearAllStorage,
  setupWebLLMProvider
} from '../utils/test-helpers';
import { TEST_IDS } from '../../src/utils/test-ids';
import { TEST_DATA } from '../../src/utils/test-data';

// Helper to wait for language change
async function waitForLanguageChange(page: Page, targetLang: 'es' | 'en') {
  await page.waitForFunction(
    (lang) => document.documentElement.getAttribute('data-language') === lang || 
             document.documentElement.getAttribute('lang') === lang,
    targetLang,
    { timeout: 5000 }
  );
  // Additional wait for i18n updates
  await page.waitForTimeout(300);
}

test.describe('Language Switching', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
  });

  test('language selector is visible and functional', async ({ page }) => {
    await page.goto('/');
    
    // Check language selector is visible using data-testid
    const langSelector = page.locator(`[data-testid="${TEST_IDS.language.dropdownButton}"]`).first();
    // Fallback to class selector
    const langFallback = page.locator('.language-selector button').first();
    const selector = await langSelector.isVisible() ? langSelector : langFallback;
    
    await expect(selector).toBeVisible({ timeout: 10000 });
    
    // Click to open dropdown
    await selector.click();
    await page.waitForTimeout(300);
    
    // Check dropdown options are visible using data-testid
    const spanishOption = page.locator(`[data-testid="${TEST_IDS.language.spanishOption}"]`);
    const englishOption = page.locator(`[data-testid="${TEST_IDS.language.englishOption}"]`);
    
    // Fallback selectors
    const spanishFallback = page.locator('button').filter({ hasText: /Español|Spanish/i }).first();
    const englishFallback = page.locator('button').filter({ hasText: /English|Inglés/i }).first();
    
    await expect(await spanishOption.isVisible() ? spanishOption : spanishFallback).toBeVisible();
    await expect(await englishOption.isVisible() ? englishOption : englishFallback).toBeVisible();
    
    // Select English
    const enSelector = await englishOption.isVisible() ? englishOption : englishFallback;
    await enSelector.click();
    
    // Wait for language change
    await waitForLanguageChange(page, 'en');
    
    // Verify language changed
    await expect(selector).toContainText(/EN|English/i);
    
    // Verify it persists after reload
    await page.reload();
    await waitForLanguageChange(page, 'en');
    const selectorAfterReload = await langSelector.isVisible() ? langSelector : langFallback;
    await expect(selectorAfterReload).toContainText(/EN|English/i);
  });

  test('homepage content changes with language', async ({ page }) => {
    await page.goto('/');
    
    // Verify Spanish content is displayed by default using data-i18n
    const heroTitle = page.locator('[data-i18n="home.hero.title"]').first();
    const heroFallback = page.locator('h1').filter({ hasText: /Asistente Legal|Legal Assistant/i }).first();
    await expect(await heroTitle.isVisible() ? heroTitle : heroFallback).toBeVisible();
    
    const ctaButton = page.locator(`[data-testid="${TEST_IDS.home.ctaChat}"]`);
    await expect(ctaButton).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator(`[data-testid="${TEST_IDS.language.dropdownButton}"]`).first();
    const langFallback = page.locator('.language-selector button').first();
    const langBtn = await langSelector.isVisible() ? langSelector : langFallback;
    
    await langBtn.click();
    await page.waitForTimeout(300);
    
    const englishOpt = page.locator(`[data-testid="${TEST_IDS.language.englishOption}"]`);
    const englishFallback = page.locator('button').filter({ hasText: /English/i }).first();
    await (await englishOpt.isVisible() ? englishOpt : englishFallback).click();
    
    // Wait for language change
    await waitForLanguageChange(page, 'en');
    
    // Verify English content is displayed
    await expect(await heroTitle.isVisible() ? heroTitle : heroFallback).toBeVisible();
    await expect(ctaButton).toBeVisible();
  });

  test('chat interface translates correctly', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    await setupWebLLMProvider(page);
    await page.reload();
    
    // Verify Spanish content
    const pageTitle = page.locator('[data-i18n="chat.title"]').first();
    const pageTitleFallback = page.locator('h1').filter({ hasText: /Chat Legal|Legal Chat/i }).first();
    await expect(await pageTitle.isVisible() ? pageTitle : pageTitleFallback).toBeVisible();
    
    const welcomeMessage = page.locator(`[data-testid="${TEST_IDS.chat.welcomeMessage}"]`);
    const welcomeFallback = page.locator('[data-testid="chat-container"]').locator('text=/Bienvenido|Welcome/i');
    await expect(await welcomeMessage.isVisible() ? welcomeMessage : welcomeFallback).toBeVisible();
    
    // Check input is visible
    const input = page.locator(`[data-testid="${TEST_IDS.chat.input}"]`);
    await expect(input).toBeVisible();
    
    // Switch to English
    const langSelector = page.locator(`[data-testid="${TEST_IDS.language.dropdownButton}"]`).first();
    const langFallback = page.locator('.language-selector button').first();
    const langBtn = await langSelector.isVisible() ? langSelector : langFallback;
    
    await langBtn.click();
    await page.waitForTimeout(300);
    
    const englishOpt = page.locator(`[data-testid="${TEST_IDS.language.englishOption}"]`);
    const englishFallback = page.locator('button').filter({ hasText: /English/i }).first();
    await (await englishOpt.isVisible() ? englishOpt : englishFallback).click();
    
    // Wait for language change
    await waitForLanguageChange(page, 'en');
    
    // Verify English content
    await expect(await pageTitle.isVisible() ? pageTitle : pageTitleFallback).toBeVisible();
    await expect(await welcomeMessage.isVisible() ? welcomeMessage : welcomeFallback).toBeVisible();
    
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