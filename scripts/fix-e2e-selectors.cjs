#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing E2E test selectors and text patterns...\n');

// Find all test files
const testFiles = glob.sync('tests/e2e/**/*.test.ts');

let totalFixed = 0;
let fileCount = 0;

// Replacement patterns for incorrect selectors
const replacements = [
  // Fix invalid has-text() syntax to :has-text()
  {
    pattern: /\bhas-text\(/g,
    replacement: ':has-text(',
    description: 'Fix invalid has-text() syntax'
  },
  // Fix double selector syntax
  {
    pattern: /:text="([^"]+)", has-text\(/g,
    replacement: ':has-text("$1"), :has-text(',
    description: 'Fix double selector syntax'
  },
  // Fix WebLLM text patterns
  {
    pattern: /text=["']WebLLM \(Browser\)["']/g,
    replacement: 'text="WebLLM - IA en tu Navegador"',
    description: 'Fix WebLLM text to match i18n'
  },
  {
    pattern: /text=\/WebLLM \(Browser\)/g,
    replacement: 'text=/WebLLM - IA en tu Navegador|WebLLM - AI in Your Browser',
    description: 'Fix WebLLM regex patterns'
  },
  // Fix invalid compound selectors
  {
    pattern: /div:text="([^"]+)", has-text\(/g,
    replacement: 'div:has-text("$1"):has-text(',
    description: 'Fix compound div selectors'
  },
  {
    pattern: /h2:text="([^"]+)", has-text\(/g,
    replacement: 'h2:has-text("$1"):has-text(',
    description: 'Fix compound h2 selectors'
  },
  // Fix multiple selector syntax
  {
    pattern: /, h2:text=/g,
    replacement: ', h2:has-text=',
    description: 'Fix h2:text to h2:has-text'
  },
  // Fix case empty state messages (already done in case-management but checking others)
  {
    pattern: /No tienes casos\|No cases yet\|Aún no has creado/g,
    replacement: 'No hay casos creados|No cases created',
    description: 'Fix case empty state text'
  },
  {
    pattern: /Crea tu primer caso\|Create your first case/g,
    replacement: 'o crea uno nuevo|or create a new one',
    description: 'Fix case creation text'
  },
  // Fix streaming message patterns
  {
    pattern: /\[class\*="isStreaming"\]:text="([^"]+)"/g,
    replacement: '[class*="isStreaming"]:has-text("$1")',
    description: 'Fix streaming class selectors'
  },
  // Fix test data-testid patterns that might be wrong
  {
    pattern: /data-testid="upload-area"/g,
    replacement: 'data-testid="upload-area"',
    description: 'Keep upload-area testid'
  },
  {
    pattern: /data-testid="upload-text"/g,
    replacement: 'data-testid="upload-text"',
    description: 'Keep upload-text testid'
  },
  {
    pattern: /data-testid="file-input"/g,
    replacement: 'data-testid="file-input"',
    description: 'Keep file-input testid'
  }
];

// Additional specific fixes for known problematic selectors
const specificFixes = [
  // Fix the waitForSelector patterns
  {
    pattern: /await page\.waitForSelector\('text=\/([^\/]+)\/i', \{ state: 'visible', timeout: 5000 \}\)/g,
    replacement: "await page.waitForSelector('text=/$1/i', { state: 'visible', timeout: 5000 })",
    description: 'Fix waitForSelector regex patterns'
  },
  // Fix div:has-text patterns
  {
    pattern: /div:text="([^"]+)", has-text\(\/([^\/]+)\/i\):text="([^"]+)", has-text\(\/([^\/]+)\/i\)/g,
    replacement: 'div:has-text("$1"):has-text(/$2/i)',
    description: 'Simplify complex div selectors'
  },
  // Fix h2 patterns
  {
    pattern: /h2:text="([^"]+)", has-text\(\/([^\/]+)\/i\)/g,
    replacement: 'h2:has-text("$1")',
    description: 'Simplify h2 selectors'
  },
  // Fix OR patterns in selectors
  {
    pattern: /h2:text="([^"]+)", has-text\(\/([^\/]+)\/i\), h2:text="([^"]+)", has-text\(\/([^\/]+)\/i\)/g,
    replacement: 'h2:has-text(/$2|$4/i)',
    description: 'Simplify OR patterns in h2'
  }
];

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let fixes = 0;

  // Apply general replacements
  replacements.forEach(({ pattern, replacement, description }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      fixes += matches.length;
      console.log(`  ✓ ${description}: ${matches.length} occurrences`);
    }
  });

  // Apply specific fixes
  specificFixes.forEach(({ pattern, replacement, description }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      fixes += matches.length;
      console.log(`  ✓ ${description}: ${matches.length} occurrences`);
    }
  });

  // Only write if changes were made
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log(`✅ Fixed ${path.basename(file)}: ${fixes} changes`);
    fileCount++;
    totalFixed += fixes;
  }
});

console.log(`\n📊 Summary:`);
console.log(`  - Files updated: ${fileCount}`);
console.log(`  - Total fixes applied: ${totalFixed}`);
console.log(`\n✨ E2E test selectors have been fixed!`);
console.log('\n💡 Next steps:');
console.log('  1. Run: npm run test:e2e to verify the fixes');
console.log('  2. Check for any remaining timeout errors');
console.log('  3. Update any test-specific expectations if needed');