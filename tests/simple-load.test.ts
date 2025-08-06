import { test, expect } from '@playwright/test';

test('simple page load', async ({ page }) => {
  // Just try to load the page
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  
  // Check title exists
  await expect(page).toHaveTitle(/LexMX/);
  
  // Check basic content is visible
  await expect(page.locator('text=Tu Asistente Legal Inteligente')).toBeVisible();
});