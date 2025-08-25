#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const testsDir = path.join(__dirname, '..', 'tests', 'e2e');

// Files to fix
const filesToFix = [
  'webllm-flow.test.ts',
  'webllm-fix-verification.test.ts'
];

function fixTestStructure(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Fix the duplicate test.describe issue
  // The script accidentally created nested describes
  content = content.replace(
    /test\.describe\('WebLLM Integration Flow \(Mocked\)', \(\) => \{\s*\/\/ Uses mock[\s\S]*?test\.describe\.skip\('WebLLM[^']*', \(\) => \{/,
    `test.describe('WebLLM Integration Flow (Mocked)', () => {
  // Uses mock WebLLM by default for fast testing
  // Set USE_REAL_WEBLLM=true to test with real model download`
  );
  
  // Fix for webllm-fix-verification
  content = content.replace(
    /test\.describe\('WebLLM Integration Flow \(Mocked\)', \(\) => \{\s*\/\/ Uses mock[\s\S]*?test\.describe\.skip\('WebLLM Fix Verification', \(\) => \{/,
    `test.describe('WebLLM Fix Verification (Mocked)', () => {
  // Uses mock WebLLM by default for fast testing
  // Set USE_REAL_WEBLLM=true to test with real model download`
  );
  
  // Remove any "No newline at end of file" comments
  content = content.replace(/\n\s*\d+→ No newline at end of file/g, '');
  
  // Ensure file ends with newline
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  
  fs.writeFileSync(filePath, content);
}

console.log('🔧 Fixing WebLLM test structure...\n');

filesToFix.forEach(file => {
  const filePath = path.join(testsDir, file);
  if (fs.existsSync(filePath)) {
    fixTestStructure(filePath);
    console.log(`✅ Fixed ${file}`);
  } else {
    console.log(`⚠️  ${file} not found`);
  }
});

console.log('\n✨ Test structure fixed!');