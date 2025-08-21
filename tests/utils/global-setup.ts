import { FullConfig } from '@playwright/test';

/**
 * Global setup function that runs once before all tests
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('🚀 Starting E2E test suite with isolation...');
  
  // Set environment variables for test execution
  process.env.TEST_MODE = 'e2e';
  process.env.NODE_ENV = 'test';
  
  // Log configuration
  const workers = config.workers || 1;
  const parallel = workers > 1;
  
  console.log(`📊 Test Configuration:`);
  console.log(`   - Workers: ${workers}`);
  console.log(`   - Parallel: ${parallel ? 'Yes' : 'No'}`);
  console.log(`   - Projects: ${config.projects.map(p => p.name).join(', ')}`);
  console.log(`   - Base URL: ${config.projects[0]?.use?.baseURL || 'http://localhost:4321'}`);
  
  // Clear any existing test artifacts
  if (process.env.CLEAN_BEFORE_TEST) {
    console.log('🧹 Cleaning test artifacts...');
    // Add cleanup logic here if needed
  }
  
  // Prepare test data directory
  // This could be used to set up mock data, etc.
  
  console.log('✅ Global setup complete\n');
}

export default globalSetup;