#!/usr/bin/env node

/**
 * Update all test files to use consolidated test helpers
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

function updateTestFile(filePath) {
  const fileName = path.basename(filePath);
  
  if (!fileName.endsWith('.test.ts')) {
    return;
  }
  
  console.log(`📝 Updating ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const originalContent = content;
  
  // Replace old imports with new consolidated import
  const oldImportPatterns = [
    /import \{ isolatedTest as test[^}]*\} from ['"]\.\.\/utils\/isolated-fixtures['"];?\n?/g,
    /import \{ test[^}]*\} from ['"]@playwright\/test['"];?\n?/g,
    /import \{ expect[^}]*\} from ['"]@playwright\/test['"];?\n?/g,
    /import \{[^}]*\} from ['"]\.\.\/utils\/enhanced-test-helpers['"];?\n?/g,
    /import \{[^}]*\} from ['"]\.\.\/utils\/hydration-helpers['"];?\n?/g,
    /import \{[^}]*waitForHydration[^}]*\} from ['"]\.\.\/utils\/test-helpers['"];?\n?/g,
    /import \{[^}]*setupPage[^}]*\} from ['"]\.\.\/utils\/test-helpers['"];?\n?/g,
  ];
  
  // Remove all old imports
  oldImportPatterns.forEach(pattern => {
    if (pattern.test(content)) {
      content = content.replace(pattern, '');
      modified = true;
    }
  });
  
  // Collect all the functions being used
  const functionsUsed = new Set();
  
  // Common functions to check for
  const commonFunctions = [
    'test', 'expect', 'waitForHydration', 'setupPage', 'navigateToPage',
    'setupWebLLMProvider', 'setupMockProviders', 'clearAllStorage',
    'clickElement', 'fillInput', 'getByTestId', 'assertVisible',
    'toggleDarkMode', 'selectCorpusDocuments', 'createTestCase',
    'waitForComponentHydration', 'getTextContent', 'assertTextContent'
  ];
  
  // Check which functions are actually used in the file
  commonFunctions.forEach(func => {
    const patterns = [
      new RegExp(`\\b${func}\\s*\\(`),
      new RegExp(`\\b${func}\\.`),
      new RegExp(`await\\s+${func}\\s*\\(`)
    ];
    
    if (patterns.some(p => p.test(content))) {
      functionsUsed.add(func);
    }
  });
  
  // Always include test and expect
  functionsUsed.add('test');
  functionsUsed.add('expect');
  
  // Build the import statement
  const importList = Array.from(functionsUsed).sort().join(', ');
  const newImport = `import { ${importList} } from '../utils/test-helpers-consolidated';\n`;
  
  // Find where to insert the new import (after any remaining imports)
  const lines = content.split('\n');
  let insertIndex = 0;
  
  // Find the last import statement
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('import ')) {
      insertIndex = i + 1;
    } else if (lines[i].trim() && !lines[i].startsWith('//') && !lines[i].startsWith('/*')) {
      // Stop at first non-import, non-comment line
      break;
    }
  }
  
  // Insert the new import
  if (!content.includes("from '../utils/test-helpers-consolidated'")) {
    lines.splice(insertIndex, 0, newImport);
    content = lines.join('\n');
    modified = true;
  }
  
  // Clean up multiple blank lines
  content = content.replace(/\n\n\n+/g, '\n\n');
  
  // Fix test.describe calls (remove "- Isolated" suffix)
  content = content.replace(/test\.describe\(['"]([^'"]+) - Isolated['"]/g, "test.describe('$1'");
  
  // Update any references to old helper paths
  content = content.replace(/\.\.\/utils\/test-helpers/g, '../utils/test-helpers-consolidated');
  
  if (modified && content !== originalContent) {
    fs.writeFileSync(filePath, content);
    console.log(`  ✅ Updated ${fileName}`);
  } else {
    console.log(`  ⏭️  No changes needed for ${fileName}`);
  }
}

// Process all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => path.join(testsDir, f));

console.log('🔧 Updating test imports to use consolidated helpers...\n');

testFiles.forEach(updateTestFile);

console.log('\n✨ Done! All tests now use consolidated helpers.');