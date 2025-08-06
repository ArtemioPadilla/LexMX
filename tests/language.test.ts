import { test, expect } from '@playwright/test';

test.describe('Language Selector Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should display language selector button', async ({ page }) => {
    await page.goto('/');
    const langSelector = page.locator('.language-selector button').first();
    await expect(langSelector).toBeVisible();
    await expect(langSelector).toHaveAttribute('aria-label', 'Cambiar idioma');
  });

  test('should open language dropdown on click', async ({ page }) => {
    await page.goto('/');
    const langSelector = page.locator('.language-selector button').first();
    
    // Click to open dropdown
    await langSelector.click();
    
    // Check dropdown is visible
    const dropdown = page.locator('.language-selector').locator('div').filter({ hasText: 'Español' });
    await expect(dropdown).toBeVisible();
    
    // Check both language options are present
    await expect(page.locator('button:has-text("Español")')).toBeVisible();
    await expect(page.locator('button:has-text("English")')).toBeVisible();
  });

  test('should switch to English', async ({ page }) => {
    await page.goto('/');
    
    // Open language selector
    await page.locator('.language-selector button').first().click();
    
    // Click English
    await page.locator('button:has-text("English")').click();
    
    // Check localStorage
    const lang = await page.evaluate(() => localStorage.getItem('language'));
    expect(JSON.parse(lang!)).toBe('en');
    
    // Check HTML lang attribute
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');
  });

  test('should switch to Spanish', async ({ page }) => {
    await page.goto('/');
    
    // First set to English
    await page.locator('.language-selector button').first().click();
    await page.locator('button:has-text("English")').click();
    
    // Then switch back to Spanish
    await page.locator('.language-selector button').first().click();
    await page.locator('button:has-text("Español")').click();
    
    // Check localStorage
    const lang = await page.evaluate(() => localStorage.getItem('language'));
    expect(JSON.parse(lang!)).toBe('es');
    
    // Check HTML lang attribute
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('es');
  });

  test('should apply translations when switching language', async ({ page }) => {
    await page.goto('/');
    
    // Get initial text (Spanish)
    const navChat = page.locator('[data-i18n="nav.chat"]').first();
    await expect(navChat).toContainText('Chat Legal');
    
    // Switch to English
    await page.locator('.language-selector button').first().click();
    await page.locator('button:has-text("English")').click();
    
    // Wait for translations to apply
    await page.waitForTimeout(500);
    
    // Check text changed to English
    await expect(navChat).toContainText('Legal Chat');
  });

  test('should persist language on page reload', async ({ page }) => {
    await page.goto('/');
    
    // Set English
    await page.locator('.language-selector button').first().click();
    await page.locator('button:has-text("English")').click();
    
    // Reload page
    await page.reload();
    
    // Check language persists
    const lang = await page.evaluate(() => localStorage.getItem('language'));
    expect(JSON.parse(lang!)).toBe('en');
    
    const htmlLang = await page.locator('html').getAttribute('lang');
    expect(htmlLang).toBe('en');
  });

  test('should maintain language across navigation', async ({ page }) => {
    await page.goto('/');
    
    // Set English
    await page.locator('.language-selector button').first().click();
    await page.locator('button:has-text("English")').click();
    
    // Navigate to other pages
    for (const path of ['/chat', '/setup']) {
      await page.goto(path);
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBe('en');
    }
  });

  test('CRITICAL: navbar should not disappear after language toggle', async ({ page }) => {
    await page.goto('/');
    
    // Verify navbar components are visible initially
    const langSelector = page.locator('.language-selector').first();
    const themeToggle = page.locator('.theme-toggle').first();
    await expect(langSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    // Toggle language multiple times
    for (let i = 0; i < 5; i++) {
      // Open language selector
      await page.locator('.language-selector button').first().click();
      
      // Switch language
      if (i % 2 === 0) {
        await page.locator('button:has-text("English")').click();
      } else {
        await page.locator('button:has-text("Español")').click();
      }
      
      // Wait a moment
      await page.waitForTimeout(500);
      
      // Verify navbar components are still visible
      await expect(langSelector).toBeVisible();
      await expect(themeToggle).toBeVisible();
    }
  });

  test('should update button flag based on language', async ({ page }) => {
    await page.goto('/');
    const langButton = page.locator('.language-selector button').first();
    
    // Check Spanish flag
    await expect(langButton).toContainText('🇲🇽');
    
    // Switch to English
    await langButton.click();
    await page.locator('button:has-text("English")').click();
    await expect(langButton).toContainText('🇺🇸');
    
    // Switch back to Spanish
    await langButton.click();
    await page.locator('button:has-text("Español")').click();
    await expect(langButton).toContainText('🇲🇽');
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    await page.goto('/');
    
    // Open dropdown
    await page.locator('.language-selector button').first().click();
    const dropdown = page.locator('.language-selector').locator('div').filter({ hasText: 'Español' });
    await expect(dropdown).toBeVisible();
    
    // Click outside
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    
    // Dropdown should be hidden
    await expect(dropdown).not.toBeVisible();
  });
});