import { defineConfig } from 'vite';
import { getViteConfig } from 'astro/config';
import path from 'path';

export default defineConfig(
  getViteConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test/setupTests.ts'],
      // Test isolation configuration
      isolate: true, // Isolate test files from each other
      pool: 'threads', // Use worker threads for better isolation
      poolOptions: {
        threads: {
          singleThread: false, // Allow parallel execution
          isolate: true, // Full isolation between test files
          minThreads: 1,
          maxThreads: 4
        }
      },
      // Sequence configuration for predictable execution
      sequence: {
        shuffle: false, // Don't randomize test order
        concurrent: false // Run tests in sequence within files
      },
      // Test timeout configuration
      testTimeout: 10000, // 10 seconds
      hookTimeout: 10000, // 10 seconds for hooks
      // Exclude E2E test files (in tests directory)
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**', // Exclude E2E tests directory
        '.git/**',
      ],
      // Include only unit test files in src
      include: [
        'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      ],
      // Configure aliases for module resolution
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/islands': path.resolve(__dirname, './src/islands'),
        '@/lib': path.resolve(__dirname, './src/lib'),
        '@/data': path.resolve(__dirname, './src/data'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/utils': path.resolve(__dirname, './src/utils'),
        '@/i18n': path.resolve(__dirname, './src/i18n'),
        '@/test': path.resolve(__dirname, './src/test'),
      },
      // Configure module optimization
      deps: {
        optimizer: {
          web: {
            include: [
              '@testing-library/react',
              '@testing-library/jest-dom',
              '@testing-library/user-event',
            ]
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@/components': path.resolve(__dirname, './src/components'),
        '@/islands': path.resolve(__dirname, './src/islands'),
        '@/lib': path.resolve(__dirname, './src/lib'),
        '@/data': path.resolve(__dirname, './src/data'),
        '@/types': path.resolve(__dirname, './src/types'),
        '@/utils': path.resolve(__dirname, './src/utils'),
        '@/i18n': path.resolve(__dirname, './src/i18n'),
        '@/test': path.resolve(__dirname, './src/test'),
      }
    }
  })
);