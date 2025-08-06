import { test, expect } from '@playwright/test';

test('debug syntax error', async ({ page }) => {
  const errors: { message: string; stack?: string }[] = [];
  
  page.on('pageerror', error => {
    errors.push({
      message: error.message,
      stack: error.stack
    });
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Console error:', msg.text());
      // Try to get more details
      msg.args().forEach(async (arg, i) => {
        try {
          const value = await arg.jsonValue();
          console.log(`  Arg ${i}:`, value);
        } catch (e) {
          console.log(`  Arg ${i}: [unable to serialize]`);
        }
      });
    }
  });
  
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  console.log('Total errors found:', errors.length);
  errors.forEach((err, i) => {
    console.log(`\nError ${i + 1}:`);
    console.log('Message:', err.message);
    if (err.stack) {
      console.log('Stack:', err.stack);
    }
  });
  
  // Also check for any script tags with errors
  const scripts = await page.$$eval('script', elements => {
    return elements.map(el => ({
      src: el.src || '[inline]',
      content: el.src ? null : el.textContent?.substring(0, 200)
    }));
  });
  
  console.log('\nScript tags found:', scripts.length);
  scripts.forEach((script, i) => {
    if (script.content && script.content.includes(':')) {
      console.log(`\nScript ${i}: ${script.src}`);
      console.log('Content preview:', script.content);
    }
  });
});