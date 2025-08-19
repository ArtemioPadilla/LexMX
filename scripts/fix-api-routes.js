#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_DIR = path.join(__dirname, '../src/pages/api');

// Template for simplified API routes that work during build
const API_TEMPLATE = `import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  // Return mock response during build
  return new Response(JSON.stringify({
    message: 'API routes are handled client-side in production',
    timestamp: Date.now()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'API routes are handled client-side in production',
    timestamp: Date.now()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const DELETE: APIRoute = async () => {
  return new Response(JSON.stringify({
    message: 'API routes are handled client-side in production',
    timestamp: Date.now()
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    }
  });
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};
`;

// List of API files to update
const API_FILES = [
  'corpus/delete.ts',
  'corpus/export.ts',
  'corpus/get.ts',
  'corpus/list.ts',
  'corpus/stats.ts',
  'embeddings/clear.ts',
  'embeddings/export.ts',
  'embeddings/generate.ts',
  'embeddings/stats.ts',
  'quality/metrics.ts',
  'quality/results.ts',
  'quality/test.ts'
];

console.log('🔧 Fixing API routes for static deployment...\n');

let updated = 0;
let errors = 0;

for (const file of API_FILES) {
  const filePath = path.join(API_DIR, file);
  
  try {
    // Skip test files
    if (file.includes('__tests__')) continue;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.log(`⚠️  Skipping ${file} (not found)`);
      continue;
    }
    
    // Write the simplified template
    fs.writeFileSync(filePath, API_TEMPLATE);
    console.log(`✅ Updated ${file}`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${file}:`, error.message);
    errors++;
  }
}

console.log(`\n✨ Summary: ${updated} files updated, ${errors} errors`);

if (errors === 0) {
  console.log('✅ All API routes fixed for static deployment!');
  console.log('\nNote: API functionality is handled client-side via api-adapter.ts');
} else {
  console.log('⚠️  Some files had errors. Please check manually.');
  process.exit(1);
}