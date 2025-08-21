import { FullConfig } from '@playwright/test';

/**
 * Global teardown function that runs once after all tests
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('\n🏁 E2E test suite completed');
  
  // Clean up any test artifacts
  if (process.env.CLEAN_AFTER_TEST) {
    console.log('🧹 Cleaning up test artifacts...');
    // Add cleanup logic here if needed
  }
  
  // Report summary
  console.log('📈 Test execution summary:');
  console.log(`   - Total projects: ${config.projects.length}`);
  console.log(`   - Workers used: ${config.workers || 1}`);
  
  // Clear test environment variables
  delete process.env.TEST_MODE;
  
  console.log('✅ Global teardown complete');
}

export default globalTeardown;