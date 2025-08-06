import { test, expect } from '@playwright/test';

test('verify hydration and service worker fixes', async ({ page }) => {
  // Capture console logs and errors
  const consoleLogs: string[] = [];
  const consoleErrors: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });
  
  page.on('pageerror', err => {
    consoleErrors.push(`Page error: ${err.message}`);
  });

  // Navigate to chat page
  await page.goto('http://localhost:4321/chat');
  
  // Wait for hydration
  await page.waitForSelector('.chat-interface', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(2000); // Give time for all hydration to complete
  
  // Check that no critical errors occurred
  const criticalErrors = consoleErrors.filter(err => 
    err.includes('Cannot access') || 
    err.includes('before initialization') ||
    err.includes('ReferenceError')
  );
  
  if (criticalErrors.length > 0) {
    console.log('Critical errors found:', criticalErrors);
  }
  
  expect(criticalErrors).toHaveLength(0);
  
  // Verify chat interface is functional
  const textarea = page.locator('textarea[placeholder*="consulta legal"]');
  await expect(textarea).toBeVisible();
  await expect(textarea).toBeEnabled();
  
  // Check that service worker registered (no cache errors)
  const swErrors = consoleErrors.filter(err => 
    err.includes('Failed to execute') || 
    err.includes('addAll') ||
    err.includes('Cache')
  );
  
  expect(swErrors).toHaveLength(0);
});

test('verify provider setup to chat flow works', async ({ page }) => {
  // Clear storage
  await page.goto('http://localhost:4321');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Complete minimal setup
  await page.goto('http://localhost:4321/setup');
  await page.click('button:has-text("Comenzar Configuración")');
  await page.click('text="Configuración Personalizada"');
  
  // Select Ollama (simplest setup)
  await page.locator('div').filter({ hasText: /^Ollama.*Modelos locales/ }).first().click();
  await page.click('button:has-text("Configurar (1)")');
  await page.fill('input[type="url"]', 'http://localhost:11434');
  await page.click('button:has-text("Guardar")');
  
  // Wait for completion
  await expect(page.locator('h2:has-text("¡Configuración Completa!")')).toBeVisible({ timeout: 10000 });
  
  // Click button and verify navigation
  await page.click('button:has-text("Comenzar a Usar LexMX")');
  await expect(page).toHaveURL(/.*\/chat/, { timeout: 5000 });
  
  // Verify chat loads without errors
  await expect(page.locator('.chat-interface')).toBeVisible();
});