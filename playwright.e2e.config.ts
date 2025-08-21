import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.test.ts',
  
  // Parallel execution configuration
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  
  // Worker configuration
  // Use TEST_WORKERS env var to control parallelism
  // Default: 1 for sequential, set to 6 for parallel
  workers: process.env.TEST_WORKERS ? parseInt(process.env.TEST_WORKERS) : 
           process.env.CI ? 1 : 
           process.env.PARALLEL_TESTS ? 6 : 1,
  
  // Reporting
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  
  // Timeouts
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  
  // Global test configuration
  use: {
    baseURL: process.env.TEST_URL || 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10000,
    navigationTimeout: 15000,
    
    // Add custom test metadata for isolation
    contextOptions: {
      // Each test gets fresh context
      storageState: undefined,
      // Prevent cross-test pollution
      acceptDownloads: false,
      // Unique browser context per test
      bypassCSP: false,
    },
  },

  projects: [
    {
      name: 'chromium-isolated',
      use: { 
        ...devices['Desktop Chrome'],
        // Force new context for each test
        contextOptions: {
          storageState: undefined,
        },
      },
      // Run specific isolated tests
      testMatch: '**/*.isolated.test.ts',
    },
    {
      name: 'chromium-sequential',
      use: { 
        ...devices['Desktop Chrome'],
      },
      // Run regular tests sequentially for debugging
      testMatch: '**/*.test.ts',
      testIgnore: '**/*.isolated.test.ts',
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    port: 4321,
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
  },
  
  // Global setup/teardown
  globalSetup: './tests/utils/global-setup.ts',
  globalTeardown: './tests/utils/global-teardown.ts',
});