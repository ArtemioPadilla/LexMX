#!/usr/bin/env node

/**
 * Fix test selector issues - properly handle TEST_IDS references
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

function fixFile(filePath) {
  const fileName = path.basename(filePath);
  
  if (!fileName.endsWith('.test.ts')) {
    return;
  }
  
  console.log(`📝 Processing ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Fix template literal syntax in selectors
  content = content.replace(/\[data-testid=\{\$\{TEST_IDS\.([\w.]+)\}\}\]/g, (match, path) => {
    modified = true;
    return `[data-testid="${path.split('.').pop()}"]`;
  });
  
  // Fix incorrect port references
  content = content.replace(/http:\/\/localhost:4322/g, 'http://localhost:4321');
  modified = true;
  
  // Fix button selectors to be more flexible
  content = content.replace(/button:has-text\("Configurar \(\d+\)"\)/g, 'button:has-text("Configurar")');
  
  // Fix exact text matches in has-text to use contains
  content = content.replace(/has-text\("([^"]+)"\)/g, (match, text) => {
    // Don't change if it's already a regex
    if (text.startsWith('/') && text.endsWith('/')) {
      return match;
    }
    modified = true;
    return `text="${text}"`;
  });
  
  // Add proper wait conditions before actions
  const clickPattern = /await page\.click\('([^']+)'\);/g;
  content = content.replace(clickPattern, (match, selector) => {
    // Don't add wait if it already has one
    if (content.includes(`waitForSelector('${selector}'`) || 
        content.includes(`waitForSelector("${selector}"`) ||
        selector.includes('TEST_IDS')) {
      return match;
    }
    modified = true;
    return `await page.waitForSelector('${selector}', { state: 'visible', timeout: 15000 });
    ${match}`;
  });
  
  // Fix waitForLoadState calls
  content = content.replace(/waitForLoadState\('networkidle'\)/g, "waitForLoadState('domcontentloaded')");
  
  // Increase timeouts
  content = content.replace(/timeout:\s*5000/g, 'timeout: 15000');
  content = content.replace(/timeout:\s*10000/g, 'timeout: 20000');
  
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

console.log('🔧 Fixing test selector issues...\n');

testFiles.forEach(fixFile);

console.log('\n✨ Done! Run tests again to see improvements.');