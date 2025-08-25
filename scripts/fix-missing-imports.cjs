#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// Functions that should be imported from test-helpers-consolidated
const helperFunctions = [
  'navigateAndWaitForHydration',
  'waitForHydration',
  'setupWebLLMProvider',
  'clearAllStorage',
  'createTestCase',
  'expect',
  'test',
  'isHydrated',
  'setupOllamaProvider',
  'setupOpenAIProvider',
  'setupClaudeProvider',
  'setupGeminiProvider',
  'navigateToChat',
  'sendMessage',
  'waitForResponse'
];

function fixImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Find all functions used in the file
  const usedFunctions = new Set();
  helperFunctions.forEach(func => {
    // Check if function is used (not in import statement)
    const regex = new RegExp(`(?<!import.*{[^}]*)(\\b${func}\\b)(?![^{]*})`, 'g');
    if (regex.test(content)) {
      usedFunctions.add(func);
    }
  });
  
  if (usedFunctions.size === 0) {
    return false;
  }
  
  // Find existing import statement
  const importMatch = content.match(/import\s*{\s*([^}]+)\s*}\s*from\s*['"]\.\.\/utils\/test-helpers-consolidated['"]/);
  
  if (importMatch) {
    // Parse existing imports
    const existingImports = importMatch[1].split(',').map(s => s.trim());
    
    // Add missing imports
    const allImports = new Set([...existingImports, ...usedFunctions]);
    
    // Build new import statement
    const newImportStatement = `import { ${Array.from(allImports).join(', ')} } from '../utils/test-helpers-consolidated'`;
    
    // Replace the import statement
    content = content.replace(importMatch[0], newImportStatement);
    
    fs.writeFileSync(filePath, content);
    
    const added = Array.from(usedFunctions).filter(f => !existingImports.includes(f));
    if (added.length > 0) {
      console.log(`✅ Fixed imports in ${path.basename(filePath)}: Added ${added.join(', ')}`);
      return true;
    }
  }
  
  return false;
}

// Process all test files
const testFiles = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

console.log('🔍 Checking imports in test files...\n');

let fixedCount = 0;
testFiles.forEach(file => {
  const filePath = path.join(testsDir, file);
  if (fixImports(filePath)) {
    fixedCount++;
  }
});

console.log(`\n✨ Fixed imports in ${fixedCount} files`);