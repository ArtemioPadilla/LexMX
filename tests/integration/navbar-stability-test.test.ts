import { test, expect } from '@playwright/test';

test.describe('Navbar Stability Test', () => {
  test('navbar components remain stable when switching tabs', async ({ page, context }) => {
    // Navigate to the home page
    await page.goto('http://localhost:4323');
    
    // Wait for initial hydration
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Check that navbar components are visible
    const languageSelector = page.locator('.language-selector').first();
    const themeToggle = page.locator('.theme-toggle').first();
    
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    // Take initial screenshot
    await page.screenshot({ path: 'test-results/navbar-initial.png' });
    
    // Create a new tab
    const newPage = await context.newPage();
    await newPage.goto('/chat');
    
    // Switch back to original tab
    await page.bringToFront();
    await page.waitForTimeout(1000);
    
    // Check components are still visible
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    // Test rapid tab switching
    for (let i = 0; i < 5; i++) {
      await newPage.bringToFront();
      await page.waitForTimeout(100);
      await page.bringToFront();
      await page.waitForTimeout(100);
    }
    
    // Final visibility check
    await expect(languageSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    
    // Take final screenshot
    await page.screenshot({ path: 'test-results/navbar-after-switching.png' });
    
    // Test interaction after tab switching
    await languageSelector.click();
    const languageDropdown = page.locator('.language-selector').locator('div[class*="absolute"]');
    await expect(languageDropdown).toBeVisible();
    
    await themeToggle.click();
    const themeDropdown = page.locator('.theme-toggle').locator('div[class*="absolute"]');
    await expect(themeDropdown).toBeVisible();
    
    console.log('✅ Navbar components remained stable throughout tab switching');
  });
  
  test('check for hydration errors in console', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      errors.push(error.message);
    });
    
    await page.goto('http://localhost:4323');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    // Filter out non-critical errors
    const criticalErrors = errors.filter(error => 
      error.includes('hydration') || 
      error.includes('React') || 
      error.includes('useState') ||
      error.includes('useEffect')
    );
    
    if (criticalErrors.length > 0) {
      console.log('⚠️ Found hydration-related errors:', criticalErrors);
    } else {
      console.log('✅ No hydration errors detected');
    }
    
    expect(criticalErrors).toHaveLength(0);
  });
});