#!/usr/bin/env node

/**
 * Script to migrate E2E tests to use the isolation system
 * This will create .isolated.test.ts versions of existing tests
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// List of test files to migrate (excluding already migrated ones)
const filesToMigrate = [
  'language-switching.test.ts',
  'user-journeys.test.ts',
  'provider-selector-journey.test.ts',
  'dark-mode-journey.test.ts',
  'integrated-chat-journey.test.ts',
  'streaming-markdown.test.ts',
  'provider-setup-journey.test.ts',
  'webllm-flow.test.ts',
  'basic-markdown.test.ts',
  'debug-provider.test.ts',
  'provider-setup-fix.test.ts',
  'verify-fixes.test.ts',
  'webllm-fix-verification.test.ts'
];

// Common replacements for migration
const replacements = [
  // Import changes
  {
    from: /import { test, expect[^}]*} from '@playwright\/test';?/g,
    to: "import { isolatedTest as test, expect } from '../utils/isolated-fixtures';"
  },
  // Replace hardcoded data-testids with TEST_IDS
  {
    from: /data-testid="([^"]+)"/g,
    to: (match, testId) => {
      // Map common test IDs to TEST_IDS structure
      const mappings = {
        'theme-toggle': 'TEST_IDS.theme.toggle',
        'theme-dropdown-button': 'TEST_IDS.theme.dropdownButton',
        'theme-light': 'TEST_IDS.theme.lightOption',
        'theme-dark': 'TEST_IDS.theme.darkOption',
        'theme-system': 'TEST_IDS.theme.systemOption',
        'language-dropdown-button': 'TEST_IDS.language.dropdownButton',
        'language-es': 'TEST_IDS.language.spanishOption',
        'language-en': 'TEST_IDS.language.englishOption',
        'provider-selector-toggle': 'TEST_IDS.provider.selectorToggle',
        'corpus-selector-toggle': 'TEST_IDS.corpus.selectorToggle',
        'chat-container': 'TEST_IDS.chat.container',
        'chat-input': 'TEST_IDS.chat.input',
        'chat-send': 'TEST_IDS.chat.sendButton',
        'chat-messages': 'TEST_IDS.chat.messageList',
        'case-manager': 'TEST_IDS.cases.container',
        'new-case-button': 'TEST_IDS.cases.newCaseButton',
        'search-cases-input': 'TEST_IDS.cases.searchInput',
        'cases-list': 'TEST_IDS.cases.caseList',
        'filter-status-select': 'TEST_IDS.cases.filterStatus',
        'upload-area': 'TEST_IDS.upload.area',
        'upload-text': 'TEST_IDS.upload.text',
        'file-input': 'TEST_IDS.upload.input'
      };
      
      if (mappings[testId]) {
        return `data-testid={\${${mappings[testId]}}}`;
      }
      return match; // Keep original if no mapping found
    }
  },
  // Add TEST_IDS import if not present
  {
    from: /(import.*from.*'\.\.\/utils\/test-helpers';?)/g,
    to: `$1\nimport { TEST_IDS } from '../../src/utils/test-ids';`
  },
  // Ensure waitForHydration is imported
  {
    from: /import\s*{\s*([^}]+)\s*}\s*from\s*'\.\.\/utils\/test-helpers'/g,
    to: (match, imports) => {
      const importList = imports.split(',').map(s => s.trim());
      if (!importList.includes('waitForHydration')) {
        importList.push('waitForHydration');
      }
      return `import { ${importList.join(', ')} } from '../utils/test-helpers'`;
    }
  },
  // Replace setupPage with proper isolation setup (if not already using it)
  {
    from: /await setupPage\(page\);?/g,
    to: '// Note: setupIsolatedPage is already called by the fixture'
  },
  // Add waitForHydration after navigation if missing
  {
    from: /await page\.goto\(([^)]+)\);?\s*(?!await waitForHydration)/g,
    to: `await page.goto($1);\n    await waitForHydration(page);`
  },
  // Replace text selectors with regex for i18n
  {
    from: /text="([^"]+)"/g,
    to: 'text=/$1/i'
  },
  {
    from: /'text=([^']+)'/g,
    to: "'text=/$1/i'"
  },
  // Add " - Isolated" to test suite names
  {
    from: /test\.describe\('([^']+)'/g,
    to: "test.describe('$1 - Isolated'"
  }
];

function migrateFile(fileName) {
  const inputPath = path.join(testsDir, fileName);
  const outputPath = inputPath.replace('.test.ts', '.isolated.test.ts');
  
  // Skip if already migrated
  if (fs.existsSync(outputPath)) {
    console.log(`⏭️  Skipping ${fileName} (already migrated)`);
    return;
  }
  
  // Skip if source doesn't exist
  if (!fs.existsSync(inputPath)) {
    console.log(`❌ File not found: ${fileName}`);
    return;
  }
  
  console.log(`📝 Migrating ${fileName}...`);
  
  let content = fs.readFileSync(inputPath, 'utf8');
  
  // Add header comment
  content = `/**
 * Isolated version of ${fileName.replace('.test.ts', '')} tests
 * Uses the new test isolation system for parallel execution
 */
${content}`;
  
  // Apply replacements
  replacements.forEach(({ from, to }) => {
    content = content.replace(from, to);
  });
  
  // Ensure TEST_IDS import is present (if not already added)
  if (!content.includes("import { TEST_IDS }")) {
    const firstImportMatch = content.match(/^import .* from/m);
    if (firstImportMatch) {
      const insertPos = content.indexOf(firstImportMatch[0]) + firstImportMatch[0].length;
      content = content.slice(0, insertPos) + 
                `\nimport { TEST_IDS } from '../../src/utils/test-ids';` + 
                content.slice(insertPos);
    }
  }
  
  // Write migrated file
  fs.writeFileSync(outputPath, content);
  console.log(`✅ Created ${path.basename(outputPath)}`);
}

// Main execution
console.log('🚀 Starting test migration to isolation system...\n');

filesToMigrate.forEach(file => {
  try {
    migrateFile(file);
  } catch (error) {
    console.error(`❌ Error migrating ${file}:`, error.message);
  }
});

console.log('\n✨ Migration complete!');
console.log(`📊 ${filesToMigrate.length} files processed`);
console.log('\n💡 Next steps:');
console.log('1. Review the generated .isolated.test.ts files');
console.log('2. Run: npm run test:e2e -- *.isolated.test.ts');
console.log('3. Fix any remaining issues manually');