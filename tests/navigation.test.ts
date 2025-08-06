import { test, expect } from '@playwright/test';

test.describe('Navigation and Routing', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/LexMX/);
    
    // Check main heading is visible
    const heading = page.locator('h1').filter({ hasText: /Tu Asistente Legal Mexicano|Your Mexican Legal Assistant/ });
    await expect(heading).toBeVisible();
  });

  test('should navigate to all main pages', async ({ page }) => {
    await page.goto('/');
    
    // Test Chat Legal navigation
    await page.click('a[href="/chat"]');
    await expect(page).toHaveURL('/chat');
    await expect(page.locator('h1').first()).toContainText(/Chat Legal|Legal Chat/);
    
    // Test Legal/Códigos navigation
    await page.click('a[href="/legal"]');
    await expect(page).toHaveURL('/legal');
    
    // Test Configuración navigation
    await page.click('a[href="/setup"]');
    await expect(page).toHaveURL('/setup');
    await expect(page.locator('h1')).toContainText(/Configuración|Setup/);
    
    // Test About navigation
    await page.click('a[href="/about"]');
    await expect(page).toHaveURL('/about');
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    await page.goto('/');
    await page.click('a[href="/chat"]');
    await page.click('a[href="/setup"]');
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/chat');
    
    // Go back again
    await page.goBack();
    await expect(page).toHaveURL('/');
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/chat');
  });

  test('should not have /es/ or /en/ routes (404 test)', async ({ page }) => {
    // These routes should not exist in the application
    const response1 = await page.goto('/es/', { waitUntil: 'networkidle' });
    expect(response1?.status()).toBe(404);
    
    const response2 = await page.goto('/en/', { waitUntil: 'networkidle' });
    expect(response2?.status()).toBe(404);
  });

  test('should maintain header/footer across navigation', async ({ page }) => {
    await page.goto('/');
    
    // Check header is present - use first() to get the main header
    const header = page.locator('header').first();
    await expect(header).toBeVisible();
    
    // Check logo is present
    const logo = header.locator('a[href="/"]').first();
    await expect(logo).toContainText('LexMX');
    
    // Navigate to different pages and verify header persists
    for (const path of ['/chat', '/setup']) {
      await page.goto(path);
      await expect(header).toBeVisible();
      await expect(logo).toContainText('LexMX');
    }
  });

  test('should have working footer links', async ({ page }) => {
    await page.goto('/');
    
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    
    // Check external links have correct attributes
    const githubLink = footer.locator('a[href*="github.com"]');
    await expect(githubLink).toHaveAttribute('target', '_blank');
    await expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});