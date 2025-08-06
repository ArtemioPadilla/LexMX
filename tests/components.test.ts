import { test, expect } from '@playwright/test';

test.describe('Interactive Components', () => {
  test('should have working buttons with hover states', async ({ page }) => {
    await page.goto('/');
    
    // Find the main CTA button
    const ctaButton = page.locator('a').filter({ hasText: /Comenzar Consulta|Start Consultation/ });
    
    // Check initial state
    await expect(ctaButton).toBeVisible();
    
    // Check hover state changes background
    const initialBg = await ctaButton.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    await ctaButton.hover();
    await page.waitForTimeout(100); // Wait for transition
    
    const hoverBg = await ctaButton.evaluate(el => 
      window.getComputedStyle(el).backgroundColor
    );
    
    // Background should change on hover
    expect(hoverBg).not.toBe(initialBg);
  });

  test('should load chat interface components', async ({ page }) => {
    await page.goto('/chat');
    
    // Check for chat container
    const chatContainer = page.locator('main');
    await expect(chatContainer).toBeVisible();
    
    // Check for chat header
    const chatHeader = page.locator('h1');
    await expect(chatHeader).toContainText(/Chat Legal|Legal Chat/);
    
    // Check for input area (if ChatInterface is loaded)
    const chatArea = page.locator('[data-island="ChatInterface"]');
    if (await chatArea.count() > 0) {
      await expect(chatArea).toBeVisible();
    }
  });

  test('should load provider setup form', async ({ page }) => {
    await page.goto('/setup');
    
    // Check for setup container
    const setupContainer = page.locator('main');
    await expect(setupContainer).toBeVisible();
    
    // Check for setup header
    const setupHeader = page.locator('h1');
    await expect(setupHeader).toContainText(/Configuración|Setup/);
    
    // Check for ProviderSetup island
    const providerSetup = page.locator('[data-island="ProviderSetup"]');
    if (await providerSetup.count() > 0) {
      await expect(providerSetup).toBeVisible();
    }
  });

  test('should have working footer links', async ({ page }) => {
    await page.goto('/');
    
    const footer = page.locator('footer');
    
    // Test internal links
    const internalLinks = [
      { href: '/chat', text: 'Chat Legal' },
      { href: '/legal', text: 'Códigos Legales' },
      { href: '/setup', text: 'Configuración' },
      { href: '/privacy', text: 'Privacidad' },
    ];
    
    for (const link of internalLinks) {
      const element = footer.locator(`a[href="${link.href}"]`);
      if (await element.count() > 0) {
        await expect(element).toBeVisible();
        await expect(element).toContainText(link.text);
      }
    }
    
    // Test external links have proper attributes
    const externalLinks = footer.locator('a[target="_blank"]');
    const count = await externalLinks.count();
    
    for (let i = 0; i < count; i++) {
      const link = externalLinks.nth(i);
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  test('should handle React island hydration', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React components to hydrate
    await page.waitForTimeout(1000);
    
    // Language selector should be interactive
    const langSelector = page.locator('.language-selector button').first();
    await expect(langSelector).toBeEnabled();
    
    // Theme toggle should be interactive
    const themeToggle = page.locator('.theme-toggle button').first();
    await expect(themeToggle).toBeEnabled();
    
    // Components should not disappear after hydration
    await page.waitForTimeout(2000);
    await expect(langSelector).toBeVisible();
    await expect(themeToggle).toBeVisible();
  });

  test('should have proper loading states', async ({ page }) => {
    // Navigate to setup page which has more complex components
    await page.goto('/setup');
    
    // Check that page loads without errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait for potential hydration
    await page.waitForTimeout(2000);
    
    // Check for critical errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.includes('Failed to load resource') && // Ignore missing resources
      !error.includes('404') // Ignore 404s
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('should maintain component state during interaction', async ({ page }) => {
    await page.goto('/');
    
    // Open language dropdown
    await page.locator('.language-selector button').first().click();
    const langDropdown = page.locator('.language-selector').locator('div').filter({ hasText: 'Español' });
    await expect(langDropdown).toBeVisible();
    
    // Open theme dropdown while language is open
    await page.locator('.theme-toggle button').first().click();
    const themeDropdown = page.locator('.theme-toggle').locator('div').filter({ hasText: 'Claro' });
    await expect(themeDropdown).toBeVisible();
    
    // Language dropdown should close
    await expect(langDropdown).not.toBeVisible();
    
    // Theme dropdown should remain open
    await expect(themeDropdown).toBeVisible();
  });

  test('should handle rapid interactions without breaking', async ({ page }) => {
    await page.goto('/');
    
    // Rapidly toggle language selector
    const langButton = page.locator('.language-selector button').first();
    for (let i = 0; i < 10; i++) {
      await langButton.click();
      await page.waitForTimeout(50);
    }
    
    // Component should still be functional
    await expect(langButton).toBeVisible();
    await expect(langButton).toBeEnabled();
    
    // Rapidly toggle theme selector
    const themeButton = page.locator('.theme-toggle button').first();
    for (let i = 0; i < 10; i++) {
      await themeButton.click();
      await page.waitForTimeout(50);
    }
    
    // Component should still be functional
    await expect(themeButton).toBeVisible();
    await expect(themeButton).toBeEnabled();
  });
});