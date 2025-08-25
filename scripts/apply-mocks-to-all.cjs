#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// Add mock setup to all test files
function addMockSetup(content, fileName) {
  let modified = false;
  
  // Add import for mock-all-providers
  if (!content.includes('mock-all-providers')) {
    const importLine = "import { setupCompleteMockEnvironment, quickSetupProvider } from '../utils/mock-all-providers';";
    
    // Add after other imports
    if (content.includes("from '../utils/test-helpers-consolidated'")) {
      content = content.replace(
        /from '\.\.\/utils\/test-helpers-consolidated';/,
        `from '../utils/test-helpers-consolidated';\n${importLine}`
      );
      modified = true;
    } else {
      // Add at the beginning
      content = importLine + '\n' + content;
      modified = true;
    }
  }
  
  // Replace setupWebLLMProvider with mock version
  if (content.includes('setupWebLLMProvider(page)')) {
    content = content.replace(
      /await setupWebLLMProvider\(page\)/g,
      'await quickSetupProvider(page, "webllm")'
    );
    modified = true;
  }
  
  // Add mock setup to beforeEach if not present
  if (!content.includes('setupCompleteMockEnvironment') && !content.includes('quickSetupProvider')) {
    // Find beforeEach blocks
    content = content.replace(
      /test\.beforeEach\(async \(\{ page \}\) => \{/g,
      `test.beforeEach(async ({ page }) => {
    // Setup complete mock environment for fast tests
    await setupCompleteMockEnvironment(page);`
    );
    modified = true;
  }
  
  // Replace complex provider setup with quick mock
  content = content.replace(
    /await page\.evaluate\(\(\) => \{\s*localStorage\.setItem\('lexmx_providers'[\s\S]*?\}\);/g,
    'await quickSetupProvider(page, "webllm");'
  );
  
  // Update test descriptions to indicate mocked
  if (!content.includes('(Mocked)') && !fileName.includes('real')) {
    content = content.replace(
      /test\.describe\('([^']+)'/,
      "test.describe('$1 (Mocked)'"
    );
    modified = true;
  }
  
  return { content, modified };
}

// Process all test files
const testFiles = fs.readdirSync(testsDir)
  .filter(f => f.endsWith('.test.ts'))
  .map(f => ({ name: f, path: path.join(testsDir, f) }));

console.log('🎭 Applying mock setup to all E2E tests...\n');

let updatedCount = 0;

testFiles.forEach(({ name, path: filePath }) => {
  const originalContent = fs.readFileSync(filePath, 'utf-8');
  const { content, modified } = addMockSetup(originalContent, name);
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Added mocks to ${name}`);
    updatedCount++;
  } else {
    console.log(`⏭️  ${name} already has mocks`);
  }
});

console.log(`\n✨ Updated ${updatedCount}/${testFiles.length} test files with mock setup`);
console.log('\n📝 Tests will now run with full mocking by default.');
console.log('   To run with real providers: USE_REAL_PROVIDERS=true npm run test:e2e');