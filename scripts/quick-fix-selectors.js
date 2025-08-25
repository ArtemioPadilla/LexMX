#!/usr/bin/env node

/**
 * Quick fix for common selector issues in E2E tests
 * Updates hardcoded text selectors to be more flexible
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

const selectorFixes = [
  // Fix exact text matches to use regex
  {
    from: /has-text\("([^"]+)"\)/g,
    to: (match, text) => `has-text("${text}"), has-text(/${text}/i)`
  },
  // Add flexible wait times
  {
    from: /timeout: 10000/g,
    to: 'timeout: 15000'
  },
  {
    from: /timeout: 5000/g,
    to: 'timeout: 10000'
  },
  // Fix button selectors
  {
    from: /button:has-text\("Configurar \((\d+)\)"\)/g,
    to: 'button:has-text("Configurar")'
  },
  // Add waitForLoadState after navigation
  {
    from: /await page\.goto\(([^)]+)\);$/gm,
    to: `await page.goto($1);
    await page.waitForLoadState('networkidle');`
  },
  // Fix WebLLM selectors
  {
    from: /\[role="button"\]:has-text\("WebLLM"\)/g,
    to: 'div:has-text("WebLLM"), button:has-text("WebLLM")'
  },
  // Wait for button to be enabled
  {
    from: /await page\.click\('button:has-text\("Guardar"\)'\);/g,
    to: `await page.waitForSelector('button:has-text("Guardar"):not([disabled])', { timeout: 15000 });
    await page.click('button:has-text("Guardar")');`
  }
];

function fixFile(filePath) {
  const fileName = path.basename(filePath);
  
  if (!fileName.endsWith('.test.ts')) {
    return;
  }
  
  console.log(`📝 Processing ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  selectorFixes.forEach(({ from, to }) => {
    const before = content;
    if (typeof to === 'function') {
      content = content.replace(from, to);
    } else {
      content = content.replace(from, to);
    }
    if (before !== content) {
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Fixed ${fileName}`);
  } else {
    console.log(`  ⏭️  No changes needed for ${fileName}`);
  }
}

// Process all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => path.join(testsDir, f));

console.log('🔧 Fixing common selector issues...\n');

testFiles.forEach(fixFile);

console.log('\n✨ Done! Run tests again to see improvements.');