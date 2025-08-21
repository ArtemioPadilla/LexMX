import { test, expect } from '@playwright/test';
import {
  setupPage,
  navigateAndWaitForHydration,
  setupAllMockProviders,
  waitForComponent,
  assertNoConsoleErrors,
  fillFormField,
  testMobileView,
  testDarkMode
} from '../utils/test-helpers';
import { waitForHydrationWrapper, waitForInteractive } from '../utils/hydration-helpers';

test.describe('Example Tests with Helpers', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await setupAllMockProviders(page);
  });

  test('should load chat interface with proper hydration', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/chat');
    
    // Wait for chat interface to be hydrated
    await waitForComponent(page, '.chat-interface');
    
    // Check that input is interactive
    await waitForInteractive(page, 'textarea[placeholder*="consulta legal"]');
    
    // Fill in a message
    await fillFormField(
      page,
      'textarea[placeholder*="consulta legal"]',
      '¿Qué es el amparo en México?'
    );
    
    // Check send button is enabled
    const sendButton = page.locator('button[aria-label="Enviar mensaje"]');
    await expect(sendButton).toBeEnabled();
    
    // No console errors should occur
    assertNoConsoleErrors(page);
  });

  test('should handle provider setup with hydration', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/setup');
    
    // Wait for provider setup component
    await waitForComponent(page, '.provider-setup-wizard');
    
    // Start setup flow
    const startButton = page.locator('button:has-text("Comenzar")');
    await waitForInteractive(page, 'button:has-text("Comenzar")');
    await startButton.click();
    
    // Select profile
    await waitForComponent(page, '.provider-profile-card');
    await page.locator('div:has-text("Balanced")').click();
    
    // Continue to next step
    await page.locator('button:has-text("Siguiente")').click();
    
    assertNoConsoleErrors(page);
  });

  test('should work on mobile view', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/');
    
    await testMobileView(page, async () => {
      // Check mobile menu button is visible
      const mobileMenuButton = page.locator('button[aria-label="Abrir menú principal"]');
      await expect(mobileMenuButton).toBeVisible();
      
      // Check that navigation is hidden on mobile
      const desktopNav = page.locator('nav.hidden.lg\\:flex');
      await expect(desktopNav).not.toBeVisible();
    });
  });

  test('should support dark mode', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/');
    
    await testDarkMode(page, async () => {
      // Check that dark mode class is applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
      
      // Check that dark mode styles are applied
      const body = page.locator('body');
      await expect(body).toHaveClass(/dark:bg-gray-900/);
    });
  });

  test('should handle hydration wrappers', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/');
    
    // Wait for specific hydration wrappers
    await waitForHydrationWrapper(page, 'theme-toggle');
    await waitForHydrationWrapper(page, 'language-selector');
    
    // Check that wrapped components are interactive
    const themeToggle = page.locator('.theme-toggle button');
    await expect(themeToggle).toBeVisible();
    await expect(themeToggle).toBeEnabled();
    
    const langSelector = page.locator('.language-selector button');
    await expect(langSelector).toBeVisible();
    await expect(langSelector).toBeEnabled();
    
    assertNoConsoleErrors(page);
  });

  test('should handle navigation with hydration', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/');
    
    // Click on chat link
    await page.locator('a[href="/chat"]').click();
    
    // Wait for navigation and hydration
    await page.waitForURL('**/chat');
    await waitForComponent(page, '.chat-interface');
    
    // Navigate to setup
    await page.locator('a[href="/setup"]').click();
    await page.waitForURL('**/setup');
    await waitForComponent(page, '.provider-setup-wizard');
    
    assertNoConsoleErrors(page);
  });

  test('should handle form validation with hydrated components', async ({ page }) => {
    await navigateAndWaitForHydration(page, '/requests/new');
    
    // Wait for form to be hydrated
    await waitForComponent(page, 'form');
    
    // Try to submit empty form
    const submitButton = page.locator('button[type="submit"]');
    await waitForInteractive(page, 'button[type="submit"]');
    await submitButton.click();
    
    // Check validation messages appear
    await expect(page.locator('text=/requerido|obligatorio/i')).toBeVisible();
    
    // Fill required fields
    await fillFormField(
      page,
      'input[name="title"]',
      'Test Document Request'
    );
    
    await fillFormField(
      page,
      'textarea[name="description"]',
      'Test description for document request'
    );
    
    assertNoConsoleErrors(page);
  });
});