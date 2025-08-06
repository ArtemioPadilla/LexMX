import { test, expect } from '@playwright/test';

test('debug provider setup', async ({ page }) => {
  // Enable console logging
  page.on('console', msg => console.log(`Browser console: ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.log(`Browser error: ${err.message}`));

  // Clear storage
  await page.goto('http://localhost:4321');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // 1. Navigate to setup
  console.log('Navigating to setup page...');
  await page.goto('http://localhost:4321/setup');
  
  // 2. Check if setup page loads
  console.log('Waiting for setup page...');
  await page.waitForSelector('.provider-setup', { timeout: 10000 });
  console.log('Setup page loaded');
  
  // 3. Take screenshot
  await page.screenshot({ path: 'setup-page.png' });
  
  // 4. Check what's visible
  const welcomeText = await page.locator('h2:has-text("Configura tu Asistente Legal IA")').isVisible();
  console.log('Welcome text visible:', welcomeText);
  
  // 5. Click start button if visible
  const startButton = page.locator('button:has-text("Comenzar Configuración")');
  if (await startButton.isVisible()) {
    console.log('Clicking start button...');
    await startButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'after-start-click.png' });
  }
  
  // 6. Check current state
  const profileTitle = await page.locator('h2:has-text("Elige tu Perfil")').isVisible();
  console.log('Profile selection visible:', profileTitle);
  
  // 7. Try custom configuration
  const customButton = page.locator('text="Configuración Personalizada"');
  if (await customButton.isVisible()) {
    console.log('Clicking custom configuration...');
    await customButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'after-custom-click.png' });
  }
  
  // 8. Check providers page
  const providersTitle = await page.locator('h2:has-text("Selecciona Proveedores")').isVisible();
  console.log('Providers selection visible:', providersTitle);
  
  // 9. Complete a simple setup to test navigation
  console.log('Setting up Ollama provider...');
  await page.goto('http://localhost:4321/setup');
  await page.click('button:has-text("Comenzar Configuración")');
  await page.click('text="Configuración Personalizada"');
  
  // Select Ollama
  const ollamaCard = page.locator('div').filter({ hasText: /^Ollama.*Modelos locales/ });
  await ollamaCard.click();
  
  // Click configure
  await page.click('button:has-text("Configurar (1)")');
  
  // Fill endpoint
  await page.fill('input[type="url"]', 'http://localhost:11434');
  await page.click('button:has-text("Guardar")');
  
  // Wait for completion
  await page.waitForSelector('h2:has-text("¡Configuración Completa!")', { timeout: 10000 });
  console.log('Configuration completed');
  
  // Click start using button
  console.log('Clicking "Comenzar a Usar LexMX"...');
  await page.click('button:has-text("Comenzar a Usar LexMX")');
  
  // Check if navigation happened
  await page.waitForTimeout(2000);
  const currentUrl = page.url();
  console.log('Current URL after clicking:', currentUrl);
  
  // Check if chat page loaded
  const chatInterface = await page.locator('.chat-interface').isVisible();
  console.log('Chat interface visible:', chatInterface);
});