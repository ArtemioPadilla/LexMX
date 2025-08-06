import { test, expect } from '@playwright/test';

test('find exact syntax error location', async ({ page }) => {
  let errorFound = false;
  
  page.on('pageerror', error => {
    console.log('\n=== PAGE ERROR ===');
    console.log('Message:', error.message);
    console.log('Stack:', error.stack);
    errorFound = true;
  });
  
  // Intercept script evaluations
  await page.addInitScript(() => {
    const originalEval = window.eval;
    window.eval = function(...args) {
      try {
        return originalEval.apply(this, args);
      } catch (e) {
        console.error('Eval error:', e.message);
        console.error('Code:', args[0]?.substring(0, 200));
        throw e;
      }
    };
  });
  
  // Go to page
  const response = await page.goto('/', { 
    waitUntil: 'domcontentloaded'
  });
  
  // Get the HTML
  const html = await response.text();
  
  // Find all script tags
  const scriptMatches = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  
  console.log(`\nFound ${scriptMatches.length} script tags`);
  
  // Check each script for syntax issues
  scriptMatches.forEach((script, index) => {
    // Extract content
    const content = script.replace(/<\/?script[^>]*>/g, '');
    
    // Look for problematic patterns
    if (content.includes('":') && !content.includes('function')) {
      console.log(`\nScript ${index} might have JSON issues:`);
      // Find lines with colons
      const lines = content.split('\n');
      lines.forEach((line, lineIndex) => {
        if (line.includes('":') && lineIndex < 10) {
          console.log(`  Line ${lineIndex}: ${line.trim().substring(0, 100)}`);
        }
      });
    }
  });
  
  await page.waitForTimeout(1000);
  
  if (errorFound) {
    console.log('\nSyntax errors were found!');
  } else {
    console.log('\nNo syntax errors detected');
  }
});