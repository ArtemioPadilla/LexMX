#!/usr/bin/env node

/**
 * Fix duplicate imports from the same source in test files
 * Consolidates multiple import statements into a single one
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

function fixDuplicateImports(filePath) {
  const fileName = path.basename(filePath);
  
  if (!fileName.endsWith('.test.ts')) {
    return;
  }
  
  console.log(`📝 Checking ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  // Track imports by source
  const importsBySource = new Map();
  const importLineIndices = [];
  
  // Find all import statements
  lines.forEach((line, index) => {
    const importMatch = line.match(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/);
    if (importMatch) {
      const [, imports, source] = importMatch;
      const cleanImports = imports.split(',').map(i => i.trim()).filter(i => i);
      
      if (!importsBySource.has(source)) {
        importsBySource.set(source, new Set());
      }
      
      cleanImports.forEach(imp => importsBySource.get(source).add(imp));
      importLineIndices.push({ index, source, original: line });
    }
  });
  
  // Check for duplicates from test-helpers-consolidated
  const testHelpersSource = '../utils/test-helpers-consolidated';
  const testHelpersImports = importsBySource.get(testHelpersSource);
  
  if (testHelpersImports && testHelpersImports.size > 0) {
    // Count how many import lines we have for this source
    const testHelperImportLines = importLineIndices.filter(i => i.source === testHelpersSource);
    
    if (testHelperImportLines.length > 1) {
      console.log(`  ⚠️  Found ${testHelperImportLines.length} duplicate imports from test-helpers-consolidated`);
      
      // Consolidate all imports
      const allImports = Array.from(testHelpersImports).sort();
      
      // Create new consolidated import statement
      let newImport;
      if (allImports.length <= 3) {
        newImport = `import { ${allImports.join(', ')} } from '${testHelpersSource}';`;
      } else {
        newImport = `import { \n  ${allImports.join(',\n  ')}\n} from '${testHelpersSource}';`;
      }
      
      // Remove all old import lines (in reverse order to maintain indices)
      testHelperImportLines.reverse().forEach((importLine, idx) => {
        if (idx === testHelperImportLines.length - 1) {
          // Replace the first one with the consolidated import
          lines[importLine.index] = newImport;
        } else {
          // Remove the duplicate lines
          lines.splice(importLine.index, 1);
        }
      });
      
      // Write back the fixed content
      const fixedContent = lines.join('\n');
      fs.writeFileSync(filePath, fixedContent);
      console.log(`  ✅ Fixed duplicate imports in ${fileName}`);
      return true;
    }
  }
  
  console.log(`  ✅ No duplicate imports found in ${fileName}`);
  return false;
}

// Process all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => path.join(testsDir, f));

console.log('🔧 Checking for duplicate imports in test files...\n');

let fixedCount = 0;
testFiles.forEach(file => {
  if (fixDuplicateImports(file)) {
    fixedCount++;
  }
});

console.log(`\n✨ Done! Fixed ${fixedCount} files with duplicate imports.`);