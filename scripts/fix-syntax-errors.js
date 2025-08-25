#!/usr/bin/env node

/**
 * Fix syntax errors introduced in test files
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
  const originalContent = content;
  
  // Fix broken string concatenations in data-testid selectors
  content = content.replace(/\[data-testid="\$\{"provider-selector"Toggle\}"\]/g, '[data-testid="provider-selector"]');
  content = content.replace(/\[data-testid="\$\{"corpus-selector"Toggle\}"\]/g, '[data-testid="corpus-selector"]');
  content = content.replace(/\[data-testid="\$\{TEST_IDS\.corpus\.container\}"\]/g, '[data-testid="corpus-container"]');
  content = content.replace(/\[data-testid="\$\{TEST_IDS\.chat\.input\}"\]/g, '[data-testid="chat-input"]');
  
  // Fix missing import in integrated-chat-journey.test.ts
  if (fileName === 'integrated-chat-journey.test.ts') {
    // Check if enhanced-test-helpers doesn't exist and replace with test-helpers
    if (content.includes("from '../utils/enhanced-test-helpers'")) {
      content = content.replace("from '../utils/enhanced-test-helpers'", "from '../utils/test-helpers'");
      modified = true;
    }
  }
  
  // Fix any remaining TEST_IDS template literals in selectors
  content = content.replace(/\$\{TEST_IDS\.([\w.]+)\}/g, (match, path) => {
    const parts = path.split('.');
    const mapping = {
      'chat.container': 'chat-container',
      'chat.input': 'chat-input',
      'chat.sendButton': 'chat-send-button',
      'chat.messageContainer': 'chat-message-container',
      'theme.toggle': 'theme-toggle',
      'corpus.selector': 'corpus-selector',
      'corpus.container': 'corpus-container',
      'corpus.dropdown': 'corpus-dropdown',
      'provider.selector': 'provider-selector',
      'provider.dropdown': 'provider-dropdown'
    };
    modified = true;
    return mapping[path] || parts[parts.length - 1];
  });
  
  // Check if content was modified
  modified = content !== originalContent;
  
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

console.log('🔧 Fixing syntax errors in test files...\n');

testFiles.forEach(fixFile);

console.log('\n✨ Done! Syntax errors should be fixed.');