import { test, expect } from '@playwright/test';

// Helper to track console errors
async function setupErrorTracking(page) {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.toString());
  });
  
  return { errors, warnings };
}

test.describe('React Hook Violation Detection', () => {
  test('should not have React hook errors on homepage', async ({ page }) => {
    const { errors } = await setupErrorTracking(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Check for specific React hook errors
    const hookErrors = errors.filter(err => 
      err.includes('Invalid hook call') || 
      err.includes('Hooks can only be called inside')
    );
    
    expect(hookErrors).toHaveLength(0);
  });
  
  test('should not have React hook errors on test page', async ({ page }) => {
    const { errors } = await setupErrorTracking(page);
    
    await page.goto('/test');
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Wait for components to hydrate
    await page.waitForSelector('.theme-toggle', { state: 'visible' });
    await page.waitForSelector('.language-selector', { state: 'visible' });
    
    const hookErrors = errors.filter(err => 
      err.includes('Invalid hook call') || 
      err.includes('Hooks can only be called inside')
    );
    
    expect(hookErrors).toHaveLength(0);
  });
  
  test('should not have duplicate React instance warnings', async ({ page }) => {
    const { warnings } = await setupErrorTracking(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    const duplicateReactWarnings = warnings.filter(warn => 
      warn.includes('multiple versions of React')
    );
    
    expect(duplicateReactWarnings).toHaveLength(0);
  });
});

test.describe('Hydration Consistency', () => {
  test('should not have hydration mismatches', async ({ page }) => {
    const { errors, warnings } = await setupErrorTracking(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Check for hydration errors
    const hydrationErrors = [...errors, ...warnings].filter(msg => 
      msg.includes('Hydration failed') ||
      msg.includes('did not match') ||
      msg.includes('hydration mismatch')
    );
    
    expect(hydrationErrors).toHaveLength(0);
  });
  
  test('should render consistent dates', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Check if date is rendered consistently
    const dateElement = await page.locator('text=/Última actualización.*enero.*2024/');
    await expect(dateElement).toBeVisible();
  });
});

test.describe('Component Stability', () => {
  test('theme toggle should work without errors', async ({ page }) => {
    const { errors } = await setupErrorTracking(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Find and click theme toggle
    const themeToggle = page.locator('.theme-toggle button').first();
    await expect(themeToggle).toBeVisible();
    await themeToggle.click();
    
    // Check dropdown appears
    const themeDropdown = page.locator('.theme-toggle [role="menu"], .theme-toggle div').nth(1);
    await expect(themeDropdown).toBeVisible();
    
    // Select dark theme
    await page.locator('text=Oscuro').click();
    
    // Verify no errors occurred
    const componentErrors = errors.filter(err => 
      err.includes('ThemeToggle') || 
      err.includes('theme')
    );
    
    expect(componentErrors).toHaveLength(0);
  });
  
  test('language selector should work without errors', async ({ page }) => {
    const { errors } = await setupErrorTracking(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Find and click language selector
    const langSelector = page.locator('.language-selector button').first();
    await expect(langSelector).toBeVisible();
    await langSelector.click();
    
    // Check dropdown appears
    const langDropdown = page.locator('.language-selector [role="menu"], .language-selector div').nth(1);
    await expect(langDropdown).toBeVisible();
    
    // Select English
    await page.locator('text=English').click();
    
    // Verify no errors occurred
    const componentErrors = errors.filter(err => 
      err.includes('LanguageSelector') || 
      err.includes('language')
    );
    
    expect(componentErrors).toHaveLength(0);
  });
});

test.describe('Navigation Stability', () => {
  test('components should persist when navigating', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Verify components are visible
    await expect(page.locator('.theme-toggle')).toBeVisible();
    await expect(page.locator('.language-selector')).toBeVisible();
    
    // Navigate to another page
    await page.click('a[href="/chat"]');
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Verify components are still visible
    await expect(page.locator('.theme-toggle')).toBeVisible();
    await expect(page.locator('.language-selector')).toBeVisible();
    
    // Navigate back
    await page.click('a[href="/"]');
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Verify components are still visible
    await expect(page.locator('.theme-toggle')).toBeVisible();
    await expect(page.locator('.language-selector')).toBeVisible();
  });
});

test.describe('Console Error Monitoring', () => {
  test('should have no JavaScript errors on all pages', async ({ page }) => {
    const pages = ['/', '/chat', '/wiki', '/setup', '/requests', '/privacy'];
    
    for (const pagePath of pages) {
      const { errors } = await setupErrorTracking(page);
      
      await page.goto(`http://localhost:4323${pagePath}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000); // Give time for hydration
      
      // Filter out known non-critical errors
      const criticalErrors = errors.filter(err => 
        !err.includes('favicon.ico') &&
        !err.includes('Failed to load resource') &&
        !err.includes('manifest.json')
      );
      
      expect(criticalErrors, `Page ${pagePath} has JavaScript errors`).toHaveLength(0);
    }
  });
  
  test('should have no syntax errors', async ({ page }) => {
    const { errors } = await setupErrorTracking(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    const syntaxErrors = errors.filter(err => 
      err.includes('SyntaxError') ||
      err.includes('Unexpected token')
    );
    
    expect(syntaxErrors).toHaveLength(0);
  });
});

test.describe('WebSocket Connection', () => {
  test('should not have WebSocket errors in development', async ({ page }) => {
    const { errors } = await setupErrorTracking(page);
    
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000); // Give time for hydration
    
    // Wait a bit for WebSocket to attempt connection
    await page.waitForTimeout(2000);
    
    const wsErrors = errors.filter(err => 
      err.includes('WebSocket') &&
      err.includes('undefined')
    );
    
    expect(wsErrors).toHaveLength(0);
  });
});