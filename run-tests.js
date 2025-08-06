#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Test groups
const testGroups = {
  'wiki': 'tests/wiki-tests.spec.ts',
  'chat': 'tests/chat-tests.spec.ts',
  'setup': 'tests/setup-flow-tests.spec.ts',
  'docs': 'tests/document-tests.spec.ts',
  'requests': 'tests/request-system-tests.spec.ts',
  'integration': 'tests/integration-tests.spec.ts'
};

// Parse arguments
const args = process.argv.slice(2);
const testGroup = args[0] || 'all';
const project = args[1] || 'chromium';

console.log(`🧪 Running ${testGroup} tests with ${project}...`);

try {
  // Kill any existing dev server
  try {
    execSync('pkill -f "npm run dev"', { stdio: 'ignore' });
  } catch (e) {
    // Ignore if no process found
  }

  // Start dev server
  console.log('Starting dev server...');
  const devProcess = require('child_process').spawn('npm', ['run', 'dev'], {
    detached: true,
    stdio: 'ignore'
  });
  devProcess.unref();

  // Wait for server to start
  console.log('Waiting for server to be ready...');
  execSync('sleep 5');

  // Run tests
  let testFiles = '';
  if (testGroup === 'all') {
    testFiles = Object.values(testGroups).join(' ');
  } else if (testGroups[testGroup]) {
    testFiles = testGroups[testGroup];
  } else {
    console.error(`Unknown test group: ${testGroup}`);
    console.log('Available groups:', Object.keys(testGroups).join(', '));
    process.exit(1);
  }

  const command = `npx playwright test ${testFiles} --reporter=list --project=${project}`;
  console.log(`Running: ${command}`);
  
  execSync(command, { stdio: 'inherit' });

} catch (error) {
  console.error('Test failed:', error.message);
  process.exit(1);
} finally {
  // Clean up
  console.log('\nCleaning up...');
  try {
    execSync('pkill -f "npm run dev"', { stdio: 'ignore' });
  } catch (e) {
    // Ignore
  }
}