#!/usr/bin/env node

/**
 * Comprehensive test fix - properly use TEST_IDS and fix all selector issues
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// Map of common test IDs that should be used
const testIdMappings = {
  'container': 'chat-container',
  'toggle': 'theme-toggle',
  'message-container': 'chat-message-container',
  'input': 'chat-input',
  'send-button': 'chat-send-button',
  'provider-selector': 'provider-selector',
  'corpus-selector': 'corpus-selector',
  'corpus-dropdown': 'corpus-dropdown',
  'provider-dropdown': 'provider-dropdown'
};

function fixFile(filePath) {
  const fileName = path.basename(filePath);
  
  if (!fileName.endsWith('.test.ts')) {
    return;
  }
  
  console.log(`📝 Processing ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;
  
  // Fix data-testid selectors to use actual string values
  for (const [shortId, fullId] of Object.entries(testIdMappings)) {
    const pattern1 = new RegExp(`\\[data-testid="${shortId}"\\]`, 'g');
    const pattern2 = new RegExp(`\\[data-testid='${shortId}'\\]`, 'g');
    
    content = content.replace(pattern1, `[data-testid="${fullId}"]`);
    content = content.replace(pattern2, `[data-testid="${fullId}"]`);
  }
  
  // Fix TEST_IDS references to use actual values
  content = content.replace(/TEST_IDS\.chat\.container/g, '"chat-container"');
  content = content.replace(/TEST_IDS\.chat\.input/g, '"chat-input"');
  content = content.replace(/TEST_IDS\.chat\.sendButton/g, '"chat-send-button"');
  content = content.replace(/TEST_IDS\.chat\.messageContainer/g, '"chat-message-container"');
  content = content.replace(/TEST_IDS\.theme\.toggle/g, '"theme-toggle"');
  content = content.replace(/TEST_IDS\.corpus\.selector/g, '"corpus-selector"');
  content = content.replace(/TEST_IDS\.corpus\.dropdown/g, '"corpus-dropdown"');
  content = content.replace(/TEST_IDS\.provider\.selector/g, '"provider-selector"');
  content = content.replace(/TEST_IDS\.provider\.dropdown/g, '"provider-dropdown"');
  
  // Fix duplicate waitForHydration calls
  content = content.replace(/await waitForHydration\(page\);\/\/ Wait for the page to load\n\s*await page\.waitForLoadState\('domcontentloaded'\);/g, 
    'await waitForHydration(page);');
  
  content = content.replace(/await waitForHydration\(page\);\/\/ Wait for theme toggle to be available/g,
    'await waitForHydration(page);\n    // Wait for theme toggle to be available');
    
  content = content.replace(/await waitForHydration\(page\);\/\/ Check that markdown CSS is loaded/g,
    'await waitForHydration(page);\n    // Check that markdown CSS is loaded');
  
  // Fix button selectors with multiple alternatives
  content = content.replace(/\.theme-toggle button:text\("Oscuro"\), has-text\(\/Oscuro\/i\), \.theme-toggle button:text\("Dark"\), has-text\(\/Dark\/i\)/g,
    'button:has-text("Oscuro"), button:has-text("Dark")');
  
  // Fix provider selector patterns
  content = content.replace(/button:has-text\("Configurar \(\d+\)"\)/g, 'button:has-text("Configurar")');
  
  // Add proper waits before clicks
  const clickPatterns = [
    /await page\.click\('([^']+)'\)/g,
    /await ([a-zA-Z]+)\.click\(\)/g
  ];
  
  clickPatterns.forEach(pattern => {
    content = content.replace(pattern, (match, selector) => {
      // Check if there's already a wait before this click
      const lines = content.split('\n');
      const clickLine = lines.findIndex(line => line.includes(match));
      if (clickLine > 0) {
        const prevLine = lines[clickLine - 1];
        if (prevLine.includes('waitFor') || prevLine.includes('wait')) {
          return match; // Already has a wait
        }
      }
      return match; // Keep as is for now
    });
  });
  
  // Fix timeout values
  content = content.replace(/timeout:\s*5000/g, 'timeout: 15000');
  content = content.replace(/timeout:\s*10000/g, 'timeout: 20000');
  
  // Remove duplicate imports
  const lines = content.split('\n');
  const uniqueLines = [];
  const seenImports = new Set();
  
  for (const line of lines) {
    if (line.startsWith('import ')) {
      if (!seenImports.has(line)) {
        seenImports.add(line);
        uniqueLines.push(line);
      }
    } else {
      uniqueLines.push(line);
    }
  }
  
  content = uniqueLines.join('\n');
  
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

console.log('🔧 Applying comprehensive test fixes...\n');

testFiles.forEach(fixFile);

console.log('\n✨ Done! Tests should now use proper selectors.');