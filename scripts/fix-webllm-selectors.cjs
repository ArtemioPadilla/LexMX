#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

console.log('🔧 Fixing WebLLM-specific test selectors...\n');

// Find all test files
const testFiles = glob.sync('tests/e2e/**/*.test.ts');

let totalFixed = 0;
let fileCount = 0;

// WebLLM-specific replacements
const webllmReplacements = [
  // Fix WebLLM text patterns to match i18n
  {
    pattern: /div::has-text\("WebLLM"\)/g,
    replacement: 'div:has-text("WebLLM")',
    description: 'Fix WebLLM div selector syntax'
  },
  {
    pattern: /button::has-text\("Configurar"\)/g,
    replacement: 'button:has-text("Configurar")',
    description: 'Fix button selector syntax'
  },
  {
    pattern: /button::has-text\("Guardar"\)/g,
    replacement: 'button:has-text("Guardar")',
    description: 'Fix save button selector syntax'
  },
  {
    pattern: /button::has-text\("Oscuro"\), button::has-text\("Dark"\)/g,
    replacement: 'button:has-text("Oscuro"), button:has-text("Dark")',
    description: 'Fix dark mode button selector'
  },
  // Fix any remaining double colon syntax
  {
    pattern: /::has-text/g,
    replacement: ':has-text',
    description: 'Fix double colon syntax'
  }
];

testFiles.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  let fixes = 0;

  // Apply WebLLM-specific replacements
  webllmReplacements.forEach(({ pattern, replacement, description }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      fixes += matches.length;
      console.log(`  ✓ ${description}: ${matches.length} occurrences in ${path.basename(file)}`);
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
console.log(`  - Total WebLLM fixes applied: ${totalFixed}`);
console.log(`\n✨ WebLLM test selectors have been fixed!`);
