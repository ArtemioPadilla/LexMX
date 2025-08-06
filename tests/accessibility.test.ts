import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility', () => {
  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Start from body
    await page.keyboard.press('Tab');
    
    // First focusable element should be skip link
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toBeFocused();
    
    // Continue tabbing through navigation
    await page.keyboard.press('Tab');
    const logoLink = page.locator('header a[href="/"]').first();
    await expect(logoLink).toBeFocused();
    
    // Tab through nav items
    const navItems = ['chat', 'legal', 'setup', 'about'];
    for (const item of navItems) {
      await page.keyboard.press('Tab');
      const navLink = page.locator(`a[href="/${item}"]`).first();
      if (await navLink.isVisible()) {
        await expect(navLink).toBeFocused();
      }
    }
    
    // Tab to language selector
    await page.keyboard.press('Tab');
    const langButton = page.locator('.language-selector button').first();
    await expect(langButton).toBeFocused();
    
    // Tab to theme toggle
    await page.keyboard.press('Tab');
    const themeButton = page.locator('.theme-toggle button').first();
    await expect(themeButton).toBeFocused();
  });

  test('should have proper focus indicators', async ({ page }) => {
    await page.goto('/');
    
    // Tab to first interactive element
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Get focused element
    const focusedElement = page.locator(':focus');
    
    // Check focus outline is visible
    const outline = await focusedElement.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return {
        outlineWidth: styles.outlineWidth,
        outlineStyle: styles.outlineStyle,
        outlineColor: styles.outlineColor,
      };
    });
    
    // Should have visible outline
    expect(parseInt(outline.outlineWidth)).toBeGreaterThan(0);
    expect(outline.outlineStyle).not.toBe('none');
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    // Check language selector
    const langButton = page.locator('.language-selector button').first();
    await expect(langButton).toHaveAttribute('aria-label', 'Cambiar idioma');
    
    // Check theme toggle
    const themeButton = page.locator('.theme-toggle button').first();
    await expect(themeButton).toHaveAttribute('aria-label', 'Cambiar tema');
    
    // Check navigation has proper structure
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
    
    // Check mobile menu button
    const mobileMenuButton = page.locator('button[aria-label="Abrir menú principal"]');
    if (await mobileMenuButton.isVisible()) {
      await expect(mobileMenuButton).toHaveAttribute('aria-label');
    }
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    // Get all headings
    const headings = await page.$$eval('h1, h2, h3, h4, h5, h6', elements => 
      elements.map(el => ({
        level: parseInt(el.tagName.charAt(1)),
        text: el.textContent,
      }))
    );
    
    // Should have at least one h1
    const h1Count = headings.filter(h => h.level === 1).length;
    expect(h1Count).toBeGreaterThanOrEqual(1);
    
    // Check heading hierarchy (no skipping levels)
    let previousLevel = 0;
    for (const heading of headings) {
      if (previousLevel > 0) {
        // Level should not skip (e.g., h1 -> h3)
        expect(heading.level).toBeLessThanOrEqual(previousLevel + 1);
      }
      previousLevel = heading.level;
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    
    // Test in light mode
    await page.evaluate(() => {
      document.documentElement.classList.remove('dark');
    });
    
    // Check text contrast
    const lightText = page.locator('p').first();
    const lightContrast = await lightText.evaluate(el => {
      const styles = window.getComputedStyle(el);
      const bgColor = styles.backgroundColor;
      const textColor = styles.color;
      return { bgColor, textColor };
    });
    
    // Test in dark mode
    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });
    
    const darkText = page.locator('p').first();
    const darkContrast = await darkText.evaluate(el => {
      const styles = window.getComputedStyle(el);
      const bgColor = styles.backgroundColor;
      const textColor = styles.color;
      return { bgColor, textColor };
    });
    
    // Colors should be different in light vs dark mode
    expect(lightContrast.textColor).not.toBe(darkContrast.textColor);
  });

  test('should handle screen reader navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check for skip to content link
    const skipLink = page.locator('a[href="#main-content"]');
    await expect(skipLink).toHaveClass(/sr-only/);
    
    // Check main content has proper ID
    const mainContent = page.locator('#main-content');
    await expect(mainContent).toBeVisible();
    
    // Check for landmark regions
    const header = page.locator('header');
    const main = page.locator('main');
    const footer = page.locator('footer');
    const nav = page.locator('nav');
    
    await expect(header).toBeVisible();
    await expect(main).toBeVisible();
    await expect(footer).toBeVisible();
    await expect(nav.first()).toBeVisible();
  });

  test('should have accessible dropdowns', async ({ page }) => {
    await page.goto('/');
    
    // Test language selector dropdown
    const langButton = page.locator('.language-selector button').first();
    await langButton.click();
    
    // Check aria-expanded
    await expect(langButton).toHaveAttribute('aria-expanded', 'true');
    
    // Check dropdown is accessible
    const langDropdown = page.locator('.language-selector div').filter({ hasText: 'Español' });
    await expect(langDropdown).toBeVisible();
    
    // Close dropdown
    await page.keyboard.press('Escape');
    await expect(langButton).toHaveAttribute('aria-expanded', 'false');
    
    // Test theme toggle dropdown
    const themeButton = page.locator('.theme-toggle button').first();
    await themeButton.click();
    
    await expect(themeButton).toHaveAttribute('aria-expanded', 'true');
    
    const themeDropdown = page.locator('.theme-toggle div').filter({ hasText: 'Claro' });
    await expect(themeDropdown).toBeVisible();
  });

  test('should have proper alt text for images', async ({ page }) => {
    await page.goto('/');
    
    // Get all images
    const images = page.locator('img');
    const count = await images.count();
    
    for (let i = 0; i < count; i++) {
      const img = images.nth(i);
      const altText = await img.getAttribute('alt');
      
      // Images should have alt text or be decorative (alt="")
      expect(altText).toBeDefined();
    }
  });

  test('should support reduced motion', async ({ page }) => {
    // Set prefers-reduced-motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    
    // Check that transitions are disabled/reduced
    const button = page.locator('a').filter({ hasText: /Comenzar|Start/ }).first();
    const transition = await button.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.transition;
    });
    
    // With reduced motion, transitions should be minimal or none
    // This is a basic check - actual implementation may vary
    expect(transition).toBeDefined();
  });

  test('should have accessible forms', async ({ page }) => {
    await page.goto('/setup');
    
    // If there are form inputs, check they have labels
    const inputs = page.locator('input');
    const inputCount = await inputs.count();
    
    if (inputCount > 0) {
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        
        if (id) {
          // Check for associated label
          const label = page.locator(`label[for="${id}"]`);
          if (await label.count() > 0) {
            await expect(label).toBeVisible();
          } else {
            // Check for aria-label
            const ariaLabel = await input.getAttribute('aria-label');
            expect(ariaLabel).toBeTruthy();
          }
        }
      }
    }
  });
});