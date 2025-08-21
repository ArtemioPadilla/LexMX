#!/usr/bin/env node

/**
 * Script to fix issues in isolated test files
 * - Remove duplicate TEST_IDS imports
 * - Ensure waitForHydration is properly exported/imported
 * - Fix any syntax errors from migration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

function fixTestFile(filePath) {
  const fileName = path.basename(filePath);
  console.log(`🔧 Fixing ${fileName}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // 1. Remove duplicate TEST_IDS imports
  const testIdsRegex = /(import { TEST_IDS } from '\.\.\/\.\.\/src\/utils\/test-ids';\n)+/g;
  if (content.match(testIdsRegex)) {
    content = content.replace(testIdsRegex, "import { TEST_IDS } from '../../src/utils/test-ids';\n");
    modified = true;
    console.log('  ✅ Fixed duplicate TEST_IDS imports');
  }
  
  // 2. Remove duplicate waitForHydration in imports
  const lines = content.split('\n');
  const fixedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for import lines from test-helpers
    if (line.includes("from '../utils/test-helpers'") && line.includes('import {')) {
      // Extract all imports
      let importLine = line;
      // Continue collecting if multiline
      while (!importLine.includes("from '../utils/test-helpers'") && i < lines.length - 1) {
        i++;
        importLine += ' ' + lines[i];
      }
      
      // Parse imports
      const importMatch = importLine.match(/import\s*{\s*([^}]+)\s*}\s*from/);
      if (importMatch) {
        const imports = importMatch[1].split(',').map(s => s.trim());
        // Remove duplicates
        const uniqueImports = [...new Set(imports)];
        
        // Check if waitForHydration is present
        if (!uniqueImports.includes('waitForHydration')) {
          uniqueImports.push('waitForHydration');
        }
        
        // Rebuild import line
        const newImportLine = `import { ${uniqueImports.join(', ')} } from '../utils/test-helpers';`;
        fixedLines.push(newImportLine);
        modified = true;
        console.log('  ✅ Fixed test-helpers imports');
      } else {
        fixedLines.push(line);
      }
    } else {
      fixedLines.push(line);
    }
  }
  
  if (modified) {
    content = fixedLines.join('\n');
  }
  
  // 3. Fix duplicate waitForHydration declarations in destructured imports
  content = content.replace(
    /import\s*{\s*([^}]*?)\s*waitForHydration\s*,\s*([^}]*?)\s*waitForHydration\s*([^}]*?)\s*}/g,
    'import { $1 waitForHydration, $2 $3 }'
  );
  
  // 4. Remove setupPage comments that are not needed
  content = content.replace(
    /\/\/ Note: setupIsolatedPage is already called by the fixture\s*\n\s*\/\/ Note: setupIsolatedPage is already called by the fixture/g,
    '// Note: setupIsolatedPage is already called by the fixture'
  );
  
  // 5. Fix data-testid replacements that might have broken syntax
  // Fix ${${TEST_IDS...}} to ${TEST_IDS...}
  content = content.replace(/\${\${(TEST_IDS[^}]+)}}/g, '${$1}');
  
  // Write fixed content
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ Fixed ${fileName}`);
}

// Get all isolated test files
const isolatedTestFiles = fs.readdirSync(testsDir)
  .filter(file => file.endsWith('.isolated.test.ts'))
  .map(file => path.join(testsDir, file));

console.log('🚀 Fixing isolated test files...\n');

isolatedTestFiles.forEach(file => {
  try {
    fixTestFile(file);
  } catch (error) {
    console.error(`❌ Error fixing ${path.basename(file)}:`, error.message);
  }
});

console.log('\n✨ Fixes complete!');
console.log(`📊 ${isolatedTestFiles.length} files processed`);