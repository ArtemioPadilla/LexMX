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
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Core application chunks
            'legal-corpus': ['./src/data/legal-corpus/index.ts'],
            'rag-engine': ['./src/lib/rag/engine.ts'],
            'llm-providers': [
              './src/lib/llm/providers/openai.ts',
              './src/lib/llm/providers/claude.ts',
              './src/lib/llm/providers/gemini.ts',
              './src/lib/llm/providers/ollama.ts'
            ],
            'vector-search': [
              './src/lib/rag/vectorizer.ts',
              './src/lib/rag/retriever.ts'
            ],
            'security': ['./src/lib/security/encryption.ts']
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      target: 'esnext'
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'nanostores', '@nanostores/persistent']
    }
  },

  // Optimizations for legal documents
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true
    }
  }
  
  // Note: assets and viewTransitions are now built-in features in Astro 4.x
  // No experimental flags needed
});