const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files that use setupMockProviders
const testFiles = glob.sync('tests/**/*.test.ts', {
  cwd: path.join(__dirname, '..'),
  absolute: true
});

console.log(`Checking ${testFiles.length} test files for setupMockProviders usage...\n`);

function fixMockProviderImport(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file imports setupMockProviders from test-helpers
  const importRegex = /import \{([^}]*)\} from ['"](.*)test-helpers['"]/g;
  let match;
  
  while ((match = importRegex.exec(content)) !== null) {
    const imports = match[1];
    const importPath = match[2];
    
    if (imports.includes('setupMockProviders')) {
      // Replace setupMockProviders with setupAllMockProviders in the import
      const newImports = imports.replace(/setupMockProviders/g, 'setupAllMockProviders');
      const newImportStatement = `import {${newImports}} from '${importPath}test-helpers'`;
      const oldImportStatement = match[0];
      
      content = content.replace(oldImportStatement, newImportStatement);
      
      // Also replace usage in the file
      content = content.replace(/await setupMockProviders\(/g, 'await setupAllMockProviders(');
      content = content.replace(/setupMockProviders\(/g, 'setupAllMockProviders(');
      
      modified = true;
    }
  }
  
  // Special handling for files that use setupMockProviders with custom providers
  if (content.includes('await setupAllMockProviders(page,')) {
    // These calls with custom providers need to use setupLegacyMockProviders instead
    content = content.replace(/await setupAllMockProviders\(page,/g, 'await setupLegacyMockProviders(page,');
    
    // Make sure setupLegacyMockProviders is imported
    const importRegex2 = /import \{([^}]*)\} from ['"](.*)test-helpers['"]/;
    const match2 = importRegex2.exec(content);
    if (match2 && !match2[1].includes('setupLegacyMockProviders')) {
      const imports = match2[1];
      const newImports = imports.replace('setupAllMockProviders', 'setupAllMockProviders, setupLegacyMockProviders');
      const newImportStatement = `import {${newImports}} from '${match2[2]}test-helpers'`;
      content = content.replace(match2[0], newImportStatement);
    }
    
    modified = true;
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed: ${path.basename(filePath)}`);
    return true;
  }
  
  return false;
}

let fixedCount = 0;
let errorCount = 0;

testFiles.forEach(file => {
  try {
    if (fixMockProviderImport(file)) {
      fixedCount++;
    }
  } catch (error) {
    console.error(`❌ Error fixing ${path.basename(file)}:`, error.message);
    errorCount++;
  }
});

console.log(`\n✨ Fix complete!`);
console.log(`   Fixed: ${fixedCount} files`);
if (errorCount > 0) {
  console.log(`   Errors: ${errorCount} files`);
}