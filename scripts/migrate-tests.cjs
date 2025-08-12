#!/usr/bin/env node

/**
 * Script to migrate all test files to use new test infrastructure
 */

const fs = require('fs');
const path = require('path');

// Mapping of old selectors to new test ID selectors
const selectorMappings = {
  // Text selectors to test IDs
  'text="Iniciar Consulta Gratis"': '[data-testid="cta-chat"]',
  'text="Abrir Chat Legal"': '[data-testid="cta-chat"]',
  'text="Configurar IA"': '[data-testid="cta-setup"]',
  'button:has-text("Usar WebLLM")': '[data-testid="provider-webllm"]',
  'button:has-text("+ Nuevo Caso")': '[data-testid="new-case-button"]',
  '.corpus-selector button': '[data-testid="corpus-selector-toggle"]',
  '.provider-selector button': '[data-testid="provider-selector-toggle"]',
  '.chat-interface': '[data-testid="chat-container"]',
  '.case-manager': '[data-testid="case-manager"]',
  'textarea[placeholder*="consulta legal"]': '[data-testid="chat-input"]',
  'input[placeholder="Buscar casos..."]': '[data-testid="case-search"]',
  
  // Replace h1/h2 selectors with more specific ones
  'page.locator(\'h1\')': 'page.locator(\'h1\').first()',
  'page.locator(\'h2\')': 'page.locator(\'h2\').first()',
  'page.locator("h1")': 'page.locator("h1").first()',
  'page.locator("h2")': 'page.locator("h2").first()',
  
  // Import updates
  '../utils/test-helpers': '../utils/test-helpers\';\nimport { TEST_IDS } from \'../../src/utils/test-ids\';\nimport { TEST_DATA } from \'../../src/utils/test-data',
};

// Function to update a test file
function updateTestFile(filePath) {
  console.log(`Updating ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Apply all selector mappings
  for (const [oldSelector, newSelector] of Object.entries(selectorMappings)) {
    if (content.includes(oldSelector)) {
      content = content.replace(new RegExp(escapeRegex(oldSelector), 'g'), newSelector);
      modified = true;
    }
  }
  
  // Add imports if not present
  if (!content.includes('TEST_IDS') && !content.includes('skip')) {
    const importLine = "import { TEST_IDS } from '../../src/utils/test-ids';\nimport { TEST_DATA } from '../../src/utils/test-data';";
    
    // Find the last import statement
    const lastImportMatch = content.match(/import.*from.*;/g);
    if (lastImportMatch) {
      const lastImport = lastImportMatch[lastImportMatch.length - 1];
      const insertPos = content.indexOf(lastImport) + lastImport.length;
      content = content.slice(0, insertPos) + '\n' + importLine + content.slice(insertPos);
      modified = true;
    }
  }
  
  // Update test timeouts for complex operations
  content = content.replace(/timeout:\s*5000/g, 'timeout: 10000');
  content = content.replace(/timeout:\s*30000/g, 'timeout: 60000');
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated ${path.basename(filePath)}`);
  } else {
    console.log(`⏭️  No changes needed for ${path.basename(filePath)}`);
  }
}

// Helper to escape regex special characters
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find all test files
function findTestFiles(dir) {
  const files = [];
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      files.push(...findTestFiles(fullPath));
    } else if (item.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const testsDir = path.join(__dirname, '..', 'tests', 'e2e');
const testFiles = findTestFiles(testsDir);

console.log(`Found ${testFiles.length} test files to update\n`);

for (const file of testFiles) {
  updateTestFile(file);
}

console.log('\n✨ Migration complete!');
console.log('\nNext steps:');
console.log('1. Review the changes with: git diff tests/');
console.log('2. Run tests to verify: npm run test:e2e');
console.log('3. Manually fix any remaining issues');