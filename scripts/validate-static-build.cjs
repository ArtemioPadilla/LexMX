#!/usr/bin/env node

/**
 * Validates that the static build is ready for GitHub Pages deployment
 */

const fs = require('fs');
const path = require('path');

const DIST_DIR = path.join(__dirname, '../dist');
const REQUIRED_FILES = [
  'index.html',
  'chat/index.html',
  'setup/index.html',
  'legal-corpus/metadata.json',
  'embeddings/index.json',
  '_astro/',
  'icons/',
  'sitemap-index.xml'
];

const REQUIRED_FEATURES = [
  { name: 'Home page', file: 'index.html', contains: 'LexMX' },
  { name: 'Chat interface', file: 'chat/index.html', contains: 'chat' },
  { name: 'Setup page', file: 'setup/index.html', contains: 'setup' },
  { name: 'Legal corpus', file: 'legal-corpus/metadata.json', contains: '"version"' },
  { name: 'Embeddings', file: 'embeddings/index.json', contains: 'embeddings' },
  { name: 'API Adapter', file: '_astro/', type: 'directory' },
  { name: '.nojekyll', file: '.nojekyll', type: 'file' }
];

let errors = [];
let warnings = [];
let success = [];

console.log('🔍 Validating static build for GitHub Pages deployment...\n');

// Check if dist directory exists
if (!fs.existsSync(DIST_DIR)) {
  console.error('❌ ERROR: dist/ directory not found. Run "npm run build" first.');
  process.exit(1);
}

// Check required files
console.log('📁 Checking required files...');
for (const file of REQUIRED_FILES) {
  const filePath = path.join(DIST_DIR, file);
  if (fs.existsSync(filePath)) {
    success.push(`✅ ${file}`);
  } else {
    errors.push(`❌ Missing: ${file}`);
  }
}

// Check features
console.log('\n🎯 Checking features...');
for (const feature of REQUIRED_FEATURES) {
  const filePath = path.join(DIST_DIR, feature.file);
  
  if (feature.type === 'directory') {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      success.push(`✅ ${feature.name}`);
    } else {
      errors.push(`❌ ${feature.name}: directory not found`);
    }
  } else if (feature.type === 'file') {
    if (fs.existsSync(filePath)) {
      success.push(`✅ ${feature.name}`);
    } else {
      warnings.push(`⚠️ ${feature.name}: file not found (optional but recommended)`);
    }
  } else if (feature.contains) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes(feature.contains)) {
        success.push(`✅ ${feature.name}`);
      } else {
        warnings.push(`⚠️ ${feature.name}: expected content not found`);
      }
    } else {
      errors.push(`❌ ${feature.name}: file not found`);
    }
  }
}

// Check for server-side API routes (should not exist in static build)
console.log('\n🚫 Checking for server-side code...');
const apiDir = path.join(DIST_DIR, 'api');
if (fs.existsSync(apiDir)) {
  const apiFiles = fs.readdirSync(apiDir, { recursive: true })
    .filter(file => file.endsWith('.js') || file.endsWith('.ts'));
  
  if (apiFiles.length > 0) {
    warnings.push(`⚠️ Found ${apiFiles.length} API files in dist/api/ - these won't work on GitHub Pages`);
  }
}

// Check build size
console.log('\n📊 Build statistics:');
const getDirSize = (dir) => {
  let totalSize = 0;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    if (file.isDirectory()) {
      totalSize += getDirSize(filePath);
    } else {
      totalSize += fs.statSync(filePath).size;
    }
  }
  
  return totalSize;
};

const totalSize = getDirSize(DIST_DIR);
const sizeMB = (totalSize / 1024 / 1024).toFixed(2);

console.log(`  Total size: ${sizeMB} MB`);

if (totalSize > 100 * 1024 * 1024) {
  warnings.push(`⚠️ Build size (${sizeMB} MB) exceeds GitHub Pages recommendation of 100 MB`);
} else {
  success.push(`✅ Build size (${sizeMB} MB) is within GitHub Pages limits`);
}

// Check for GitHub Pages specific files
console.log('\n🌐 GitHub Pages configuration:');
const nojekyllPath = path.join(DIST_DIR, '.nojekyll');
if (fs.existsSync(nojekyllPath)) {
  success.push('✅ .nojekyll file present (prevents Jekyll processing)');
} else {
  warnings.push('⚠️ .nojekyll file missing (may cause issues with _astro directory)');
}

// Report results
console.log('\n' + '='.repeat(60));
console.log('📋 VALIDATION SUMMARY');
console.log('='.repeat(60));

if (success.length > 0) {
  console.log(`\n✅ Passed: ${success.length} checks`);
  if (process.env.VERBOSE) {
    success.forEach(s => console.log('  ' + s));
  }
}

if (warnings.length > 0) {
  console.log(`\n⚠️ Warnings: ${warnings.length}`);
  warnings.forEach(w => console.log('  ' + w));
}

if (errors.length > 0) {
  console.log(`\n❌ Errors: ${errors.length}`);
  errors.forEach(e => console.log('  ' + e));
}

// Final verdict
console.log('\n' + '='.repeat(60));
if (errors.length === 0) {
  console.log('🎉 SUCCESS: Build is ready for GitHub Pages deployment!');
  console.log('\nNext steps:');
  console.log('1. Commit and push to main branch');
  console.log('2. GitHub Actions will automatically deploy to GitHub Pages');
  console.log('3. Visit https://artemiopadilla.github.io/LexMX to see your site');
  process.exit(0);
} else {
  console.log('❌ FAILED: Build has errors that must be fixed before deployment');
  console.log('\nRun "npm run build" to rebuild after fixing the issues.');
  process.exit(1);
}