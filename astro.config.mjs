import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';

// Subpath the site is served under. GitHub *project* pages live at
// `<domain>/<repo>/`. The Pages build sets ASTRO_BASE=/LexMX; local dev and
// root deploys leave it unset → '/'. Production builds without the variable
// keep the historical default so `npm run build` still targets Pages.
const BASE =
  process.env.ASTRO_BASE || (process.env.NODE_ENV === 'production' ? '/LexMX' : '/');

export default defineConfig({
  site: 'https://artemiopadilla.github.io',
  base: BASE,
  output: 'static',

  integrations: [
    react(),
    sitemap(),
    compress({
      CSS: true,
      HTML: true,
      Image: true,
      JavaScript: true,
      SVG: true,
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    server: {
      port: 4321,
      host: true,
      headers: {
        // Allow service workers
        'Service-Worker-Allowed': '/',
      },
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    build: {
      // Heavy client-only libraries (transformers.js, web-llm, pdf.js) are
      // code-split by their dynamic imports; no manual chunking.
      chunkSizeWarningLimit: 1000,
    },
  },

  // Optimizations for legal documents
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
