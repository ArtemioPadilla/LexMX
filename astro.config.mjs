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
      hmr: false, // Temporarily disable HMR to stop constant refreshes
      headers: {
        // Allow service workers
        'Service-Worker-Allowed': '/'
        // CORS headers temporarily disabled to fix WebSocket issues
        // Will need a different approach for WebLLM support
      }
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@mlc-ai/web-llm']
    },
    ssr: {
      noExternal: ['@astrojs/react']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Core vendor dependencies
            'vendor-react': ['react', 'react-dom'],
            'vendor-transformers': ['@xenova/transformers'],
            'vendor-webllm': ['@mlc-ai/web-llm'],
            
            // PDF processing
            'pdf-processing': ['pdf-parse', 'pdfjs-dist'],
            
            // Storage and IndexedDB
            'storage': ['idb'],
            
            // Language processing
            'i18n': ['i18next', 'react-i18next'],
            
            // Chart and visualization libraries
            'charts': ['chart.js', 'react-chartjs-2'],
            
            // Large feature components
            'case-management': [
              'src/islands/CaseManager.tsx',
              'src/islands/CaseChat.tsx',
              'src/islands/CaseTimeline.tsx'
            ],
            'document-processing': [
              'src/islands/DocumentIngestionPipeline.tsx',
              'src/islands/DocumentViewerWrapper.tsx'
            ],
            'admin-tools': [
              'src/islands/QualityMetrics.tsx',
              'src/islands/CorpusManager.tsx'
            ],
            'llm-providers': [
              'src/lib/llm/provider-manager.ts',
              'src/lib/llm/providers/'
            ]
          }
        }
      },
      chunkSizeWarningLimit: 1000 // Increase limit to 1MB to reduce warnings
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