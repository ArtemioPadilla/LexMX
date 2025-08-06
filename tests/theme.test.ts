import { test, expect } from '@playwright/test';

test.describe('Theme Toggle Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('should display theme toggle button', async ({ page }) => {
    await page.goto('/');
    const themeToggle = page.locator('.theme-toggle button').first();
    await expect(themeToggle).toBeVisible();
    await expect(themeToggle).toHaveAttribute('aria-label', 'Cambiar tema');
  });

  test('should open theme dropdown on click', async ({ page }) => {
    await page.goto('/');
    const themeToggle = page.locator('.theme-toggle button').first();
    
    // Click to open dropdown
    await themeToggle.click();
    
    // Check dropdown is visible
    const dropdown = page.locator('.theme-toggle').locator('div').filter({ hasText: 'Claro' });
    await expect(dropdown).toBeVisible();
    
    // Check all theme options are present
    await expect(page.locator('button:has-text("Claro")')).toBeVisible();
    await expect(page.locator('button:has-text("Oscuro")')).toBeVisible();
    await expect(page.locator('button:has-text("Sistema")')).toBeVisible();
  });

  test('should switch to dark theme', async ({ page }) => {
    await page.goto('/');
    
    // Open theme toggle
    await page.locator('.theme-toggle button').first().click();
    
    // Click dark theme
    await page.locator('button:has-text("Oscuro")').click();
    
    // Check that dark class is applied to html
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
    
    // Check localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(JSON.parse(theme!)).toBe('dark');
  });

  test('should switch to light theme', async ({ page }) => {
    await page.goto('/');
    
    // First set to dark
    await page.locator('.theme-toggle button').first().click();
    await page.locator('button:has-text("Oscuro")').click();
    
    // Then switch to light
    await page.locator('.theme-toggle button').first().click();
    await page.locator('button:has-text("Claro")').click();
    
    // Check that dark class is removed from html
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).not.toContain('dark');
    
    // Check localStorage
    const theme = await page.evaluate(() => localStorage.getItem('theme'));
    expect(JSON.parse(theme!)).toBe('light');
  });

  test('should persist theme on page reload', async ({ page }) => {
    await page.goto('/');
    
    // Set dark theme
    await page.locator('.theme-toggle button').first().click();
    await page.locator('button:has-text("Oscuro")').click();
    
    // Reload page
    await page.reload();
    
    // Check theme persists
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).toContain('dark');
  });

  test('should apply theme across all pages', async ({ page }) => {
    await page.goto('/');
    
    // Set dark theme
    await page.locator('.theme-toggle button').first().click();
    await page.locator('button:has-text("Oscuro")').click();
    
    // Navigate to other pages and check theme
    for (const path of ['/chat', '/setup']) {
      await page.goto(path);
      const htmlClass = await page.locator('html').getAttribute('class');
      expect(htmlClass).toContain('dark');
    }
  });

  test('should close dropdown when clicking outside', async ({ page }) => {
    await page.goto('/');
    
    // Open dropdown
    await page.locator('.theme-toggle button').first().click();
    const dropdown = page.locator('.theme-toggle').locator('div').filter({ hasText: 'Claro' });
    await expect(dropdown).toBeVisible();
    
    // Click outside
    await page.locator('body').click({ position: { x: 10, y: 10 } });
    
    // Dropdown should be hidden
    await expect(dropdown).not.toBeVisible();
  });

  test('should update button icon based on theme', async ({ page }) => {
    await page.goto('/');
    const themeButton = page.locator('.theme-toggle button').first();
    
    // Set light theme and check icon
    await themeButton.click();
    await page.locator('button:has-text("Claro")').click();
    await expect(themeButton).toContainText('☀️');
    
    // Set dark theme and check icon
    await themeButton.click();
    await page.locator('button:has-text("Oscuro")').click();
    await expect(themeButton).toContainText('🌙');
    
    // Set system theme and check icon
    await themeButton.click();
    await page.locator('button:has-text("Sistema")').click();
    await expect(themeButton).toContainText('💻');
  });
});