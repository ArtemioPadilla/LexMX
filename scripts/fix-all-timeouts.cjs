#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// Replacements to make
const replacements = [
  // Replace waitForTimeout with smartWait
  {
    pattern: /await page\.waitForTimeout\((\d+)\);?/g,
    replacement: (match, timeout) => {
      const ms = parseInt(timeout);
      if (ms <= 300) {
        return '// Removed unnecessary wait';
      } else if (ms <= 1000) {
        return 'await smartWait(page, "interaction");';
      } else {
        return 'await smartWait(page, "network");';
      }
    }
  },
  
  // Replace long timeouts with short ones
  {
    pattern: /timeout:\s*15000/g,
    replacement: 'timeout: 5000'
  },
  {
    pattern: /timeout:\s*20000/g,
    replacement: 'timeout: 5000'
  },
  {
    pattern: /timeout:\s*30000/g,
    replacement: 'timeout: 10000'
  },
  {
    pattern: /timeout:\s*45000/g,
    replacement: 'timeout: 10000'
  },
  {
    pattern: /timeout:\s*90000/g,
    replacement: 'timeout: 15000'
  },
  
  // Fix complex selectors
  {
    pattern: /div:text="([^"]+)", button:text="([^"]+)", has-text\([^)]+\)/g,
    replacement: 'div:has-text("$1"), button:has-text("$2")'
  },
  {
    pattern: /button:text="([^"]+)", has-text\([^)]+\)/g,
    replacement: 'button:has-text("$1")'
  },
  {
    pattern: /text=\/\/([^\/]+)\/i\/i/g,
    replacement: 'text=/$1/i'
  },
  
  // Comment out TODO comments
  {
    pattern: /\/\/ await page\.waitForTimeout.*TODO.*$/gm,
    replacement: '// Removed: wait replaced with proper condition'
  }
];

// Add imports if needed
function addImports(content) {
  // Check if fast-helpers is already imported
  if (!content.includes('fast-helpers')) {
    // Check if there's an existing import from test-helpers-consolidated
    if (content.includes("from '../utils/test-helpers-consolidated'")) {
      // Add smartWait to existing import
      content = content.replace(
        /from '\.\.\/utils\/test-helpers-consolidated'/,
        `from '../utils/test-helpers-consolidated';\nimport { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers'`
      );
    } else {
      // Add new import at the top
      const importStatement = `import { smartWait, waitForElement, clickElement, fillInput as fastFillInput, waitForText, waitForHydrationFast } from '../utils/fast-helpers';\n`;
      content = importStatement + content;
    }
  }
  
  return content;
}

// Process a single file
function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Apply all replacements
  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });
  
  // Add imports if we made changes
  if (modified) {
    content = addImports(content);
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    return true;
  }
  
  return false;
}

// Get all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => path.join(testsDir, f));

console.log('🔧 Fixing timeouts in all E2E tests...\n');
console.log(`Found ${testFiles.length} test files\n`);

let fixedCount = 0;
let stats = {
  waitForTimeout: 0,
  longTimeouts: 0,
  complexSelectors: 0
};

testFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf-8');
  
  // Count issues
  const waitForTimeoutMatches = content.match(/await page\.waitForTimeout/g);
  if (waitForTimeoutMatches) stats.waitForTimeout += waitForTimeoutMatches.length;
  
  const longTimeoutMatches = content.match(/timeout:\s*(15000|20000|30000|45000|90000)/g);
  if (longTimeoutMatches) stats.longTimeouts += longTimeoutMatches.length;
  
  const complexSelectorMatches = content.match(/div:text=.*has-text|button:text=.*has-text/g);
  if (complexSelectorMatches) stats.complexSelectors += complexSelectorMatches.length;
  
  // Process file
  if (processFile(file)) {
    console.log(`✅ Fixed ${path.basename(file)}`);
    fixedCount++;
  } else {
    console.log(`⏭️  No changes needed in ${path.basename(file)}`);
  }
});

console.log('\n📊 Summary:');
console.log(`   - Files updated: ${fixedCount}/${testFiles.length}`);
console.log(`   - waitForTimeout removed: ${stats.waitForTimeout}`);
console.log(`   - Long timeouts reduced: ${stats.longTimeouts}`);
console.log(`   - Complex selectors fixed: ${stats.complexSelectors}`);
console.log('\n✨ Timeout fixes complete!');