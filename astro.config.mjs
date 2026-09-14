import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';
import AstroPWA from '@vite-pwa/astro';

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
    // PWA (Fase 5): Workbox worker built from src/sw.ts. `manifest.id` is
    // fixed so browsers keep treating the site as the same installed app
    // after the switch from public/sw.js + public/manifest.json.
    AstroPWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        id: `${BASE}`,
        name: 'LexMX - Asistente Legal Mexicano',
        short_name: 'LexMX',
        description:
          'Asistente legal mexicano con IA - consultas legales precisas basadas en legislación mexicana. Funciona sin conexión.',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#22c55e',
        lang: 'es',
        icons: [
          { src: `${BASE}favicon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${BASE}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${BASE}icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        // Corpus and embeddings are runtime-cached by the worker, not precached.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        globIgnores: ['**/legal-corpus/**', '**/embeddings/**', '**/node_modules/**'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      experimental: { directoryAndTrailingSlashHandler: true },
    }),
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
