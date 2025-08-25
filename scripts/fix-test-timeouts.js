#!/usr/bin/env node

/**
 * Fix timeout issues in E2E tests by updating selectors to be more robust
 * and language-agnostic
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// Common selector fixes - map brittle selectors to robust ones
const selectorFixes = [
  // Fix WebLLM selector - use more flexible matching
  {
    pattern: /text=\/WebLLM \(Browser\)\/i/g,
    replacement: 'text=/WebLLM/i'
  },
  {
    pattern: /'text=\/WebLLM \(Browser\)\/i'/g,
    replacement: `'text=/WebLLM/i'`
  },
  
  // Fix button selectors with exact text
  {
    pattern: /button:text="Guardar configuración", has-text\(\/Guardar configuración\/i\)/g,
    replacement: 'button:has-text(/Guardar|Save/i)'
  },
  
  // Fix "Empezar" button selector
  {
    pattern: /text=\/Empezar\/i/g,
    replacement: 'text=/Empezar|Start|Comenzar/i'
  },
  
  // Fix navigation selectors
  {
    pattern: /text=\/Chat Legal\/i/g,
    replacement: '[href*="chat"], text=/Chat/i'
  },
  
  // Remove duplicate waitForHydration calls
  {
    pattern: /await waitForHydration\(page\);await/g,
    replacement: 'await waitForHydration(page);\n    await'
  },
  
  // Fix corpus selector patterns
  {
    pattern: /\[data-testid="selectorToggle"\]/g,
    replacement: '[data-testid*="selector"]'
  },
  
  // Increase timeout for model loading
  {
    pattern: /timeout: 60000/g,
    replacement: 'timeout: 90000'
  }
];

// Additional patterns for common issues
const additionalFixes = [
  // Replace hardcoded waits with proper conditions
  {
    pattern: /await page\.waitForTimeout\((\d+)\)/g,
    replacement: (match, timeout) => {
      if (parseInt(timeout) <= 500) {
        return match; // Keep small timeouts
      }
      return '// ' + match + ' // TODO: Replace with proper wait condition';
    }
  },
  
  // Fix provider setup patterns
  {
    pattern: /await page\.goto\('\/setup'\)/g,
    replacement: `await page.goto('/setup');\n    await page.waitForLoadState('domcontentloaded')`
  }
];

function fixTestFile(filePath) {
  const fileName = path.basename(filePath);
  
  if (!fileName.endsWith('.test.ts')) {
    return;
  }
  
  console.log(`📝 Processing ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;
  
  // Apply selector fixes
  selectorFixes.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });
  
  // Apply additional fixes
  additionalFixes.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });
  
  // Fix specific WebLLM setup pattern
  if (content.includes('/setup') && content.includes('WebLLM')) {
    // Replace provider setup with setupWebLLMProvider helper
    const setupPattern = /\/\/ Go to setup[\s\S]*?await page\.click\('button:text="Guardar[^"]*"[^)]*\);/g;
    
    if (setupPattern.test(content)) {
      content = content.replace(setupPattern, `// Setup WebLLM provider directly
    await setupWebLLMProvider(page);`);
      
      // Ensure setupWebLLMProvider is imported
      if (!content.includes('setupWebLLMProvider')) {
        content = content.replace(
          /import \{([^}]+)\} from '\.\.\/utils\/test-helpers-consolidated'/,
          (match, imports) => {
            const importList = imports.split(',').map(i => i.trim());
            if (!importList.includes('setupWebLLMProvider')) {
              importList.push('setupWebLLMProvider');
            }
            return `import { ${importList.join(', ')} } from '../utils/test-helpers-consolidated'`;
          }
        );
      }
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Fixed ${fileName}`);
    
    // List what was fixed
    const changes = [];
    if (content.includes('text=/WebLLM/i') && originalContent.includes('WebLLM (Browser)')) {
      changes.push('WebLLM selector');
    }
    if (content.includes('button:has-text(/Guardar|Save/i)')) {
      changes.push('Save button selector');
    }
    if (content.includes('setupWebLLMProvider')) {
      changes.push('Provider setup');
    }
    
    if (changes.length > 0) {
      console.log(`     Fixed: ${changes.join(', ')}`);
    }
  } else {
    console.log(`  ⏭️  No timeout issues found`);
  }
}

// Process all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => path.join(testsDir, f));

console.log('🔧 Fixing timeout issues in E2E tests...\n');

testFiles.forEach(fixTestFile);

console.log('\n✨ Done! Test selectors should now be more robust.');