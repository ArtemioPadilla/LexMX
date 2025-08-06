import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';
import compress from 'astro-compress';

export default defineConfig({
  site: 'https://artemiopadilla.github.io',
  base: import.meta.env.PROD ? '/LexMX' : '/',
  output: 'static',
  
  integrations: [
    react(),
    tailwind(),
    sitemap(),
    compress({
      CSS: true,
      HTML: true,
      Image: true,
      JavaScript: true,
      SVG: true
    })
  ],

  vite: {
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    server: {
      port: 4321,
      host: true,
      headers: {
        // Allow service workers
        'Service-Worker-Allowed': '/',
        // Required for WebLLM but only in development
        ...(process.env.NODE_ENV === 'development' ? {
          'Cross-Origin-Embedder-Policy': 'credentialless',
          'Cross-Origin-Opener-Policy': 'same-origin'
        } : {})
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@mlc-ai/web-llm']
    },
    ssr: {
      noExternal: ['@astrojs/react']
    }
  },

  // Optimizations for legal documents
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true
    }
  }
});