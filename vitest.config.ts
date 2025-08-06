import { defineConfig } from 'vite';
import { getViteConfig } from 'astro/config';

export default defineConfig(
  getViteConfig({
    test: {
      globals: true,
      environment: 'jsdom',
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
    },
  })
);