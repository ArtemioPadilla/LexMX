const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('tests/e2e/**/*.test.ts', {
  cwd: path.join(__dirname, '..'),
  absolute: true
});

console.log(`Found ${testFiles.length} test files to update\n`);

function updateTestFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Check if file already imports from test-helpers
  const hasTestHelpers = content.includes("from '../utils/test-helpers'") || 
                         content.includes('from "../../utils/test-helpers"') ||
                         content.includes("from '../../utils/test-helpers'");
  
  // Check if file already imports hydration helpers
  const hasHydrationHelpers = content.includes("from '../utils/hydration-helpers'") ||
                              content.includes('from "../../utils/hydration-helpers"') ||
                              content.includes("from '../../utils/hydration-helpers'");
  
  // Check if file imports webllm-mock
  const hasWebLLMMock = content.includes('webllm-mock');
  
  if (!hasTestHelpers) {
    // Add test-helpers import after playwright import
    const playwrightImportRegex = /(import .* from ['"]@playwright\/test['"];?)/;
    if (playwrightImportRegex.test(content)) {
      const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'tests', 'utils'));
      const importPath = relativePath.replace(/\\/g, '/');
      
      content = content.replace(playwrightImportRegex, 
        `$1\nimport { setupPage, navigateToPage, waitForPageReady, setupAllMockProviders, setupProviderScenario } from '${importPath}/test-helpers';`);
      modified = true;
    }
  }
  
  if (!hasHydrationHelpers) {
    // Add hydration-helpers import if needed
    if (content.includes('waitForHydration') || content.includes('waitForComponentHydration')) {
      const testHelpersImportRegex = /(import .* from ['"].*test-helpers['"];?)/;
      if (testHelpersImportRegex.test(content)) {
        const relativePath = path.relative(path.dirname(filePath), path.join(__dirname, '..', 'tests', 'utils'));
        const importPath = relativePath.replace(/\\/g, '/');
        
        content = content.replace(testHelpersImportRegex, 
          `$1\nimport { waitForHydration, waitForComponentHydration } from '${importPath}/hydration-helpers';`);
        modified = true;
      }
    }
  }
  
  // Replace manual page setup with setupPage helper
  const manualSetupRegex = /await page\.goto\(['"].*['"](?:\)|,)/g;
  if (manualSetupRegex.test(content) && !content.includes('setupPage(')) {
    // Add setupPage call in beforeEach or at the beginning of tests
    const beforeEachRegex = /test\.beforeEach\(async \(\{ page \}\) => \{/;
    if (beforeEachRegex.test(content)) {
      content = content.replace(beforeEachRegex, 
        `test.beforeEach(async ({ page }) => {\n  await setupPage(page);`);
      modified = true;
    }
  }
  
  // Replace WebLLM mock imports if they exist
  if (hasWebLLMMock) {
    content = content.replace(/import.*from ['"].*webllm-mock['"];?\n?/g, '');
    // Ensure setupAllMockProviders is imported
    if (!content.includes('setupAllMockProviders')) {
      const testHelpersImportRegex = /(import \{[^}]*)\} from ['"].*test-helpers['"];?/;
      if (testHelpersImportRegex.test(content)) {
        content = content.replace(testHelpersImportRegex, 
          `$1, setupAllMockProviders } from '../../utils/test-helpers';`);
      }
    }
    modified = true;
  }
  
  // Replace manual WebLLM setup with helper
  const webllmSetupRegex = /await page\.evaluate\(\(\) => \{\s*\(window as any\)\.webllm/;
  if (webllmSetupRegex.test(content)) {
    content = content.replace(webllmSetupRegex, 
      'await setupAllMockProviders(page);\n  // WebLLM mock setup handled by helper');
    modified = true;
  }
  
  // Update wait for selectors to use data-testid where possible
  const selectorRegex = /page\.(locator|waitForSelector|click|fill)\(['"]([^'"]*)['"]\)/g;
  content = content.replace(selectorRegex, (match, method, selector) => {
    // Convert common selectors to data-testid
    if (selector.includes('button') && selector.includes('Español')) {
      return `page.${method}('[data-testid="language-option-es"]')`;
    }
    if (selector.includes('button') && selector.includes('English')) {
      return `page.${method}('[data-testid="language-option-en"]')`;
    }
    if (selector.includes('theme') && selector.includes('button')) {
      return `page.${method}('[data-testid="theme-toggle"]')`;
    }
    return match;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Updated: ${path.basename(filePath)}`);
    return true;
  } else {
    console.log(`✓ Already up to date: ${path.basename(filePath)}`);
    return false;
  }
}

let updatedCount = 0;
let errorCount = 0;

testFiles.forEach(file => {
  try {
    if (updateTestFile(file)) {
      updatedCount++;
    }
  } catch (error) {
    console.error(`❌ Error updating ${path.basename(file)}:`, error.message);
    errorCount++;
  }
});

console.log(`\n✨ Update complete!`);
console.log(`   Updated: ${updatedCount} files`);
console.log(`   Already up to date: ${testFiles.length - updatedCount - errorCount} files`);
if (errorCount > 0) {
  console.log(`   Errors: ${errorCount} files`);
}