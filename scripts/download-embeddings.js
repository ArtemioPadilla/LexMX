#!/usr/bin/env node

/**
 * Download or use pre-generated embeddings for the legal corpus
 * This is a fallback script for when API keys are not available
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMBEDDINGS_DIR = path.join(__dirname, '..', 'public', 'embeddings');

// Ensure embeddings directory exists
if (!fs.existsSync(EMBEDDINGS_DIR)) {
  fs.mkdirSync(EMBEDDINGS_DIR, { recursive: true });
}

console.log('📥 Checking for embeddings...');

// Check if embeddings already exist
const indexPath = path.join(EMBEDDINGS_DIR, 'index.json');
const metadataPath = path.join(EMBEDDINGS_DIR, 'embeddings-metadata.json');
const embeddingsPath = path.join(EMBEDDINGS_DIR, 'embeddings-000.json');

if (fs.existsSync(indexPath) && fs.existsSync(metadataPath) && fs.existsSync(embeddingsPath)) {
  console.log('✅ Embeddings already exist in public/embeddings/');
  console.log('📊 Using existing embeddings');
  
  // Read and display statistics
  try {
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
    console.log(`📈 Total chunks: ${metadata.corpus?.processedChunks || 'unknown'}`);
    console.log(`📏 Dimensions: ${metadata.provider?.dimensions || 'unknown'}`);
  } catch {
    console.log('⚠️ Could not read metadata, but embeddings are present');
  }
  
  process.exit(0);
}

console.log('⚠️ No embeddings found. Creating mock embeddings for development...');

// Create mock embeddings for development/testing
const mockIndex = {
  version: "1.0.0",
  totalEmbeddings: 100,
  dimensions: 384,
  provider: "mock",
  files: ["embeddings-000.json"]
};

const mockMetadata = {
  version: "1.0.0",
  created: new Date().toISOString(),
  provider: {
    name: "mock",
    model: "mock-embeddings",
    dimensions: 384
  },
  corpus: {
    source: "public/legal-corpus",
    processedChunks: 100,
    totalDocuments: 3
  }
};

const mockEmbeddings = {
  embeddings: Array(100).fill(null).map((_, i) => ({
    id: `chunk_${i}`,
    embedding: Array(384).fill(0).map(() => Math.random() * 2 - 1),
    metadata: {
      text: `Mock legal text chunk ${i}`,
      source: "mock-document",
      chunkIndex: i
    }
  }))
};

// Write mock files
fs.writeFileSync(indexPath, JSON.stringify(mockIndex, null, 2));
fs.writeFileSync(metadataPath, JSON.stringify(mockMetadata, null, 2));
fs.writeFileSync(embeddingsPath, JSON.stringify(mockEmbeddings, null, 2));

console.log('✅ Mock embeddings created successfully');
console.log('📁 Location: public/embeddings/');
console.log('⚠️ Note: These are mock embeddings for development.');
console.log('    For production, run: npm run build:embeddings');