#!/usr/bin/env node

/**
 * Build validation script for LexMX
 * Validates that the production build contains all necessary components
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating LexMX Production Build...\n');

const distDir = path.join(__dirname, 'dist');
const publicDir = path.join(__dirname, 'public');

// Check if dist directory exists
if (!fs.existsSync(distDir)) {
  console.error('❌ Build directory not found. Run "npm run build" first.');
  process.exit(1);
}

// Validation results
const results = {
  passed: [],
  failed: []
};

// Test 1: Check legal corpus
console.log('📚 Checking Legal Corpus...');
const corpusFiles = [
  'legal-corpus/constitucion-politica-mexico.json',
  'legal-corpus/codigo-civil-federal.json',
  'legal-corpus/ley-federal-trabajo.json',
  'legal-corpus/metadata.json',
  'legal-corpus/index.json'
];

corpusFiles.forEach(file => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    results.passed.push(`✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  } else {
    results.failed.push(`❌ Missing: ${file}`);
  }
});

// Test 2: Check embeddings
console.log('\n🧮 Checking Embeddings...');
const embeddingsFiles = [
  'embeddings/embeddings-000.json',
  'embeddings/embeddings-metadata.json',
  'embeddings/index.json'
];

embeddingsFiles.forEach(file => {
  const filePath = path.join(distDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    results.passed.push(`✅ ${file} (${(stats.size / 1024).toFixed(2)} KB)`);
  } else {
    results.failed.push(`❌ Missing: ${file}`);
  }
});

// Test 3: Check main pages
console.log('\n📄 Checking Pages...');
const pages = [
  'index.html',
  'chat/index.html',
  'admin/corpus/index.html',
  'admin/embeddings/index.html',
  'admin/quality/index.html',
  'requests/index.html',
  'setup/index.html',
  'about/index.html'
];

pages.forEach(page => {
  const filePath = path.join(distDir, page);
  if (fs.existsSync(filePath)) {
    results.passed.push(`✅ /${page}`);
  } else {
    results.failed.push(`❌ Missing page: /${page}`);
  }
});

// Test 4: Check JavaScript bundles
console.log('\n📦 Checking JavaScript Bundles...');
const jsDir = path.join(distDir, '_astro');
if (fs.existsSync(jsDir)) {
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  if (jsFiles.length > 0) {
    results.passed.push(`✅ Found ${jsFiles.length} JavaScript bundles`);
    // Check sizes
    let totalSize = 0;
    jsFiles.forEach(file => {
      const stats = fs.statSync(path.join(jsDir, file));
      totalSize += stats.size;
    });
    results.passed.push(`✅ Total JS size: ${(totalSize / 1024).toFixed(2)} KB`);
  } else {
    results.failed.push('❌ No JavaScript bundles found');
  }
} else {
  results.failed.push('❌ JavaScript bundle directory not found');
}

// Test 5: Check CSS files
console.log('\n🎨 Checking CSS...');
const cssFiles = fs.existsSync(jsDir) ? fs.readdirSync(jsDir).filter(f => f.endsWith('.css')) : [];
if (cssFiles.length > 0) {
  results.passed.push(`✅ Found ${cssFiles.length} CSS files`);
} else {
  results.failed.push('❌ No CSS files found');
}

// Test 6: Validate corpus data structure
console.log('\n🔍 Validating Data Structure...');
try {
  const metadataPath = path.join(distDir, 'legal-corpus/metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  
  if (metadata.totalDocuments === 3) {
    results.passed.push(`✅ Corpus contains ${metadata.totalDocuments} documents`);
  } else {
    results.failed.push(`⚠️ Expected 3 documents, found ${metadata.totalDocuments}`);
  }
  
  const embeddingsMetaPath = path.join(distDir, 'embeddings/embeddings-metadata.json');
  const embeddingsMeta = JSON.parse(fs.readFileSync(embeddingsMetaPath, 'utf-8'));
  
  if (embeddingsMeta.corpus.totalChunks === 14) {
    results.passed.push(`✅ Embeddings contain ${embeddingsMeta.corpus.totalChunks} chunks`);
  } else {
    results.failed.push(`⚠️ Expected 14 chunks, found ${embeddingsMeta.corpus.totalChunks}`);
  }
  
  if (embeddingsMeta.provider.dimensions === 384) {
    results.passed.push(`✅ Embeddings have ${embeddingsMeta.provider.dimensions} dimensions`);
  }
} catch (error) {
  results.failed.push(`❌ Error validating data: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(60));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(60));

console.log('\n✅ Passed Tests:', results.passed.length);
results.passed.forEach(msg => console.log('  ', msg));

if (results.failed.length > 0) {
  console.log('\n❌ Failed Tests:', results.failed.length);
  results.failed.forEach(msg => console.log('  ', msg));
}

const totalTests = results.passed.length + results.failed.length;
const passRate = ((results.passed.length / totalTests) * 100).toFixed(1);

console.log('\n' + '='.repeat(60));
console.log(`📈 Pass Rate: ${passRate}% (${results.passed.length}/${totalTests})`);
console.log('='.repeat(60));

if (results.failed.length === 0) {
  console.log('\n🎉 BUILD VALIDATION SUCCESSFUL!');
  console.log('\nThe LexMX application is ready for deployment:');
  console.log('  1. Legal corpus loaded with 3 Mexican legal documents');
  console.log('  2. Embeddings generated with 14 chunks');
  console.log('  3. All pages and assets built successfully');
  console.log('  4. Application ready for GitHub Pages deployment');
  console.log('\nNext steps:');
  console.log('  - Run "npm run preview" to test the production build locally');
  console.log('  - Push to GitHub to deploy via GitHub Actions');
} else {
  console.log('\n⚠️ BUILD VALIDATION COMPLETED WITH WARNINGS');
  console.log('\nSome components may be missing. Review the failed tests above.');
  process.exit(1);
}