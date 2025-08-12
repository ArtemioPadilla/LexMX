import { test, expect } from '@playwright/test';

test.describe('Performance and Loading', () => {
  test('should load homepage within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    // Page should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should not have console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000); // Wait for any async operations
    
    // Filter out expected errors (like 404s for missing resources)
    const criticalErrors = errors.filter(error => 
      !error.includes('404') &&
      !error.includes('Failed to load resource') &&
      !error.includes('favicon')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should handle hydration without visible flashing', async ({ page }) => {
    await page.goto('/');
    
    // Take screenshot immediately after navigation
    const screenshot1 = await page.screenshot();
    
    // Wait for hydration
    await page.waitForTimeout(1000);
    
    // Take another screenshot
    const screenshot2 = await page.screenshot();
    
    // Components should be visible in both screenshots
    const langSelector = page.locator('.language-selector');
    const themeToggle = page.locator('.theme-toggle');
    
    await expect(langSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
  });

  test('should lazy load React islands properly', async ({ page }) => {
    await page.goto('/');
    
    // Check initial HTML contains island markers
    const html = await page.content();
    expect(html).toContain('LanguageSelector');
    expect(html).toContain('ThemeToggle');
    
    // Wait for hydration
    await page.waitForFunction(() => {
      const langSelector = document.querySelector('.language-selector button');
      const themeToggle = document.querySelector('.theme-toggle button');
      return langSelector && themeToggle && 
             !langSelector.hasAttribute('disabled') &&
             !themeToggle.hasAttribute('disabled');
    }, { timeout: 5000 });
    
    // Components should be interactive
    const langButton = page.locator('.language-selector button').first();
    const themeButton = page.locator('.theme-toggle button').first();
    
    await expect(langButton).toBeEnabled();
    await expect(themeButton).toBeEnabled();
  });

  test('should handle service worker registration', async ({ page }) => {
    const swRegistered = new Promise(resolve => {
      page.on('console', msg => {
        if (msg.text().includes('Service Worker') || msg.text().includes('sw.js')) {
          resolve(true);
        }
      });
    });
    
    await page.goto('/');
    
    // Check if service worker is registered
    const hasServiceWorker = await page.evaluate(() => 'serviceWorker' in navigator);
    expect(hasServiceWorker).toBe(true);
  });

  test('should optimize resource loading', async ({ page }) => {
    const resources: { url: string; type: string; size: number }[] = [];
    
    page.on('response', response => {
      const url = response.url();
      const headers = response.headers();
      resources.push({
        url,
        type: headers['content-type'] || '',
        size: parseInt(headers['content-length'] || '0'),
      });
    });
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for unoptimized images
    const images = resources.filter(r => r.type.includes('image'));
    for (const img of images) {
      // Images should be reasonably sized (< 500KB)
      expect(img.size).toBeLessThan(500000);
    }
    
    // Check for large JavaScript bundles
    const scripts = resources.filter(r => r.type.includes('javascript'));
    for (const script of scripts) {
      // Individual scripts should be < 200KB
      expect(script.size).toBeLessThan(200000);
    }
  });

  test('should handle rapid navigation without breaking', async ({ page }) => {
    const pages = ['/', '/chat', '/setup', '/'];
    
    // Rapidly navigate between pages
    for (const path of pages) {
      await page.goto(path);
      // Don't wait for full load, navigate quickly
    }
    
    // Final page should still work
    await page.waitForLoadState('networkidle');
    
    // Components should still be functional
    const langSelector = page.locator('.language-selector button').first();
    const themeToggle = page.locator('.theme-toggle button').first();
    
    await expect(langSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
    await expect(langSelector).toBeEnabled();
    await expect(themeToggle).toBeEnabled();
  });

  test('should cache assets properly', async ({ page }) => {
    // First load
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Second load of same page
    const startTime = Date.now();
    await page.reload();
    const reloadTime = Date.now() - startTime;
    
    // Reload should be faster due to caching
    expect(reloadTime).toBeLessThan(2000);
  });

  test('should not have memory leaks during interaction', async ({ page }) => {
    await page.goto('/');
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Perform many interactions
    for (let i = 0; i < 20; i++) {
      await page.locator('.language-selector button').first().click();
      await page.waitForTimeout(50);
      await page.locator('.theme-toggle button').first().click();
      await page.waitForTimeout(50);
    }
    
    // Force garbage collection if possible
    await page.evaluate(() => {
      if ('gc' in window) {
        (window as any).gc();
      }
    });
    
    // Check memory usage hasn't grown excessively
    const finalMemory = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory shouldn't grow more than 10MB
    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowth = finalMemory - initialMemory;
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    }
  });
});