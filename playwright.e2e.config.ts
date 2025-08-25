import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.test.ts',
  
  // Optimized configuration for speed with mocks
  fullyParallel: !process.env.USE_REAL_PROVIDERS, // Parallel when mocked
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.USE_REAL_PROVIDERS ? 1 : 4, // More workers when mocked
  
  // Reporting
  reporter: process.env.CI ? [['html'], ['github']] : 'html',
  
  // Optimized timeouts - shorter with mocks
  timeout: process.env.USE_REAL_PROVIDERS ? 30000 : 10000,
  expect: {
    timeout: process.env.USE_REAL_PROVIDERS ? 10000 : 5000,
  },
  
  // Global test configuration
  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.USE_REAL_PROVIDERS ? 'retain-on-failure' : 'off', // No video for fast mocked tests
    actionTimeout: process.env.USE_REAL_PROVIDERS ? 10000 : 5000,
    navigationTimeout: process.env.USE_REAL_PROVIDERS ? 15000 : 5000,
    
    // Browser context options
    contextOptions: {
      // Each test gets fresh context
      storageState: undefined,
      // Prevent cross-test pollution
      acceptDownloads: false,
      // Unique browser context per test
      bypassCSP: false,
    },
  },

  // Single project for simplicity
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Force new context for each test
        contextOptions: {
          storageState: undefined,
        },
      },
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