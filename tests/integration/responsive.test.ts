import { test, expect } from '@playwright/test';

test.describe('Responsive Design', () => {
  test('should display mobile menu on small screens', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Desktop navigation should be hidden
    const desktopNav = page.locator('nav.hidden.lg\\:flex');
    await expect(desktopNav).not.toBeVisible();
    
    // Mobile menu button should be visible
    const mobileMenuButton = page.locator('button[aria-label="Abrir menú principal"]');
    await expect(mobileMenuButton).toBeVisible();
  });

  test('should display desktop navigation on large screens', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    // Desktop navigation should be visible
    const desktopNav = page.locator('nav').filter({ hasText: 'Chat Legal' });
    await expect(desktopNav).toBeVisible();
    
    // Mobile menu button should be hidden
    const mobileMenuButton = page.locator('.lg\\:hidden button');
    await expect(mobileMenuButton).not.toBeVisible();
  });

  test('should adapt layout for tablet screens', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    
    // Check that content is properly sized
    const mainContent = page.locator('main');
    await expect(mainContent).toBeVisible();
    
    // Check padding and margins are appropriate
    const container = page.locator('.max-w-7xl');
    await expect(container).toBeVisible();
  });

  test('should have responsive text sizes', async ({ page }) => {
    // Mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    const mobileHeading = page.locator('h1').first();
    const mobileFontSize = await mobileHeading.evaluate(el => 
      window.getComputedStyle(el).fontSize
    );
    
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    
    const desktopHeading = page.locator('h1').first();
    const desktopFontSize = await desktopHeading.evaluate(el => 
      window.getComputedStyle(el).fontSize
    );
    
    // Desktop font should be larger
    expect(parseFloat(desktopFontSize)).toBeGreaterThan(parseFloat(mobileFontSize));
  });

  test('should have responsive grid layouts', async ({ page }) => {
    await page.goto('/');
    
    // Find grid containers
    const gridContainers = page.locator('.grid');
    const count = await gridContainers.count();
    
    if (count > 0) {
      // Test mobile grid (single column)
      await page.setViewportSize({ width: 375, height: 667 });
      const mobileGrid = gridContainers.first();
      const mobileColumns = await mobileGrid.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      );
      
      // Test desktop grid (multiple columns)
      await page.setViewportSize({ width: 1920, height: 1080 });
      const desktopGrid = gridContainers.first();
      const desktopColumns = await desktopGrid.evaluate(el => 
        window.getComputedStyle(el).gridTemplateColumns
      );
      
      // Desktop should have more columns
      expect(desktopColumns).not.toBe(mobileColumns);
    }
  });

  test('should handle touch interactions on mobile', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 667 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    
    await page.goto('/');
    
    // Test tap on language selector
    await page.tap('.language-selector button');
    const langDropdown = page.locator('.language-selector').locator('div').filter({ hasText: 'Español' });
    await expect(langDropdown).toBeVisible();
    
    // Test tap on theme toggle
    await page.tap('.theme-toggle button');
    const themeDropdown = page.locator('.theme-toggle').locator('div').filter({ hasText: 'Claro' });
    await expect(themeDropdown).toBeVisible();
    
    await context.close();
  });

  test('should have proper spacing on different screen sizes', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1920, height: 1080, name: 'desktop' },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');
      
      // Check main container padding
      const container = page.locator('.max-w-7xl').first();
      const padding = await container.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          left: styles.paddingLeft,
          right: styles.paddingRight,
        };
      });
      
      // Padding should exist
      expect(parseFloat(padding.left)).toBeGreaterThan(0);
      expect(parseFloat(padding.right)).toBeGreaterThan(0);
    }
  });

  test('should hide/show elements based on screen size', async ({ page }) => {
    await page.goto('/');
    
    // Desktop view
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Elements with 'hidden sm:inline' should be visible
    const desktopOnlyElements = page.locator('.hidden.sm\\:inline');
    const desktopCount = await desktopOnlyElements.count();
    for (let i = 0; i < desktopCount; i++) {
      await expect(desktopOnlyElements.nth(i)).toBeVisible();
    }
    
    // Mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Same elements should be hidden on mobile
    for (let i = 0; i < desktopCount; i++) {
      await expect(desktopOnlyElements.nth(i)).not.toBeVisible();
    }
  });
});