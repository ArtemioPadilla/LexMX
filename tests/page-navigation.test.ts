import { test, expect } from '@playwright/test';

test.describe('Page Navigation - Navbar Stability', () => {
  test('navbar components remain visible when navigating between pages', async ({ page }) => {
    // Start at home page
    await page.goto('http://localhost:4323');
    await page.waitForLoadState('networkidle');
    
    // Wait for components to be visible
    const languageSelector = page.locator('.language-selector').first();
    const themeToggle = page.locator('.theme-toggle').first();
    
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    console.log('✅ Initial page: Components visible');
    
    // Navigate to Chat page
    await page.click('a[href="/chat"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Check components are still visible
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    console.log('✅ Chat page: Components visible');
    
    // Navigate to Legal/Códigos page
    await page.click('a[href="/legal"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    console.log('✅ Legal page: Components visible');
    
    // Navigate to Setup/Configuración page
    await page.click('a[href="/setup"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    console.log('✅ Setup page: Components visible');
    
    // Navigate to About page
    await page.click('a[href="/about"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    console.log('✅ About page: Components visible');
    
    // Navigate back to home
    await page.click('a[href="/"]');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    console.log('✅ Back to home: Components visible');
    
    // Test rapid navigation
    console.log('\n🏃 Testing rapid navigation...');
    
    const pages = ['/chat', '/legal', '/setup', '/about', '/'];
    
    for (const pagePath of pages) {
      await page.click(`a[href="${pagePath}"]`);
      await page.waitForLoadState('domcontentloaded');
      
      // Even during rapid navigation, components should be visible
      await expect(languageSelector).toBeVisible();
      await expect(themeToggle).toBeVisible();
    }
    
    console.log('✅ Rapid navigation: Components remained visible');
    
    // Test that components are interactive after navigation
    await page.click('.language-selector button');
    const langDropdown = page.locator('.language-selector div[class*="absolute"]');
    await expect(langDropdown).toBeVisible();
    
    await page.click('.theme-toggle button');
    const themeDropdown = page.locator('.theme-toggle div[class*="absolute"]');
    await expect(themeDropdown).toBeVisible();
    
    console.log('✅ Components remain interactive after navigation');
  });
  
  test('components maintain state across page navigation', async ({ page }) => {
    await page.goto('http://localhost:4323');
    await page.waitForLoadState('networkidle');
    
    // Change theme to dark
    await page.click('.theme-toggle button');
    await page.click('button:has-text("Oscuro")');
    
    // Change language to English
    await page.click('.language-selector button');
    await page.click('button:has-text("English")');
    
    // Navigate to another page
    await page.click('a[href="/chat"]');
    await page.waitForLoadState('networkidle');
    
    // Check that dark mode is still active
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveClass(/dark/);
    
    // Check that language is still English
    await expect(htmlElement).toHaveAttribute('lang', 'en');
    
    console.log('✅ Theme and language settings persist across navigation');
  });
});