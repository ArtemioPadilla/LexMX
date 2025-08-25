#!/usr/bin/env node

/**
 * LexMX Deployment Validation Script
 * 
 * Validates that the built static site is ready for GitHub Pages deployment.
 * Checks for common issues like missing files, incorrect paths, and broken URLs.
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distPath = join(projectRoot, 'dist');

// ANSI color codes for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

// Validation results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function log(level, message, details = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const levelColors = {
    PASS: colors.green,
    FAIL: colors.red,
    WARN: colors.yellow,
    INFO: colors.cyan
  };
  
  const color = levelColors[level] || colors.white;
  console.log(`${color}[${timestamp}] ${level}${colors.reset} ${message}`);
  
  if (details) {
    console.log(`${colors.white}    ${details}${colors.reset}`);
  }
  
  // Record result
  if (level === 'PASS') results.passed++;
  if (level === 'FAIL') results.failed++;
  if (level === 'WARN') results.warnings++;
  
  results.tests.push({ level, message, details, timestamp });
}

function fileExists(filePath, description) {
  const fullPath = join(distPath, filePath);
  if (existsSync(fullPath)) {
    const stats = statSync(fullPath);
    const size = (stats.size / 1024).toFixed(2);
    log('PASS', `${description} exists`, `${filePath} (${size} KB)`);
    return true;
  } else {
    log('FAIL', `${description} missing`, `Expected: ${filePath}`);
    return false;
  }
}

function validateJSON(filePath, description) {
  const fullPath = join(distPath, filePath);
  if (!existsSync(fullPath)) {
    log('FAIL', `${description} missing`, filePath);
    return null;
  }
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    const data = JSON.parse(content);
    log('PASS', `${description} is valid JSON`, `${Object.keys(data).length} keys`);
    return data;
  } catch (error) {
    log('FAIL', `${description} contains invalid JSON`, error.message);
    return null;
  }
}

function validateHTML(filePath, description, requiredElements = []) {
  const fullPath = join(distPath, filePath);
  if (!existsSync(fullPath)) {
    log('FAIL', `${description} missing`, filePath);
    return false;
  }
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    
    // Check for basic HTML structure
    if (!content.includes('<!DOCTYPE html>')) {
      log('WARN', `${description} missing DOCTYPE`, filePath);
    }
    
    // Check for required elements
    let allFound = true;
    for (const element of requiredElements) {
      if (!content.includes(element)) {
        log('FAIL', `${description} missing required element`, `${filePath}: ${element}`);
        allFound = false;
      }
    }
    
    if (allFound) {
      log('PASS', `${description} is valid HTML`, `${(content.length / 1024).toFixed(2)} KB`);
    }
    
    return allFound;
  } catch (error) {
    log('FAIL', `${description} could not be read`, error.message);
    return false;
  }
}

function validateBaseURLs(filePath, description) {
  const fullPath = join(distPath, filePath);
  if (!existsSync(fullPath)) {
    log('WARN', `Skipping base URL validation for missing file`, filePath);
    return true;
  }
  
  try {
    const content = readFileSync(fullPath, 'utf-8');
    
    // Look for hardcoded URLs that should use base path
    const hardcodedPatterns = [
      /href="\/(?!\/|https?:)/g,  // href="/path" (not // or http://)
      /src="\/(?!\/|https?:)/g,   // src="/path"
      /fetch\(['"]\/(?!\/|https?:)/g  // fetch("/path")
    ];
    
    let issuesFound = 0;
    for (const pattern of hardcodedPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        issuesFound += matches.length;
        log('WARN', `${description} contains hardcoded URLs`, `${matches.length} instances found`);
      }
    }
    
    if (issuesFound === 0) {
      log('PASS', `${description} has no hardcoded URL issues`);
    }
    
    return issuesFound === 0;
  } catch (error) {
    log('FAIL', `Could not validate URLs in ${description}`, error.message);
    return false;
  }
}

function validateServiceWorker() {
  const swPath = join(distPath, 'sw.js');
  
  if (!existsSync(swPath)) {
    log('FAIL', 'Service worker missing', 'sw.js not found in dist/');
    return false;
  }
  
  try {
    const content = readFileSync(swPath, 'utf-8');
    
    // Check for basic service worker structure
    if (!content.includes('self.addEventListener')) {
      log('WARN', 'Service worker may be invalid', 'No event listeners found');
      return false;
    }
    
    log('PASS', 'Service worker exists and appears valid', `${(content.length / 1024).toFixed(2)} KB`);
    return true;
  } catch (error) {
    log('FAIL', 'Service worker could not be read', error.message);
    return false;
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}🚀 LexMX Deployment Validation${colors.reset}\n`);
  
  // Check if dist directory exists
  if (!existsSync(distPath)) {
    log('FAIL', 'Distribution directory not found', 'Run "npm run build" first');
    process.exit(1);
  }
  
  log('INFO', 'Starting deployment validation...', `Target: ${distPath}`);
  
  // 1. Validate core HTML pages
  log('INFO', '1. Validating core pages...');
  validateHTML('index.html', 'Home page', ['<title>', '<main>']);
  validateHTML('chat/index.html', 'Chat page', ['<title>', 'chat']);
  validateHTML('admin/documents/index.html', 'Documents admin page', ['admin', 'documents']);
  validateHTML('admin/embeddings/index.html', 'Embeddings admin page', ['admin', 'embeddings']);
  
  // 2. Validate static assets
  log('INFO', '2. Validating static assets...');
  fileExists('favicon.svg', 'Favicon');
  fileExists('manifest.json', 'PWA manifest');
  fileExists('sw.js', 'Service worker');
  
  // 3. Validate legal corpus
  log('INFO', '3. Validating legal corpus...');
  const corpusMetadata = validateJSON('legal-corpus/metadata.json', 'Corpus metadata');
  if (corpusMetadata) {
    if (corpusMetadata.totalDocuments > 0) {
      log('PASS', `Corpus contains ${corpusMetadata.totalDocuments} documents`);
    } else {
      log('WARN', 'Corpus appears empty', 'This is ok for demo purposes');
    }
  }
  
  // 4. Validate embeddings
  log('INFO', '4. Validating embeddings...');
  const embeddingsMetadata = validateJSON('embeddings/embeddings-metadata.json', 'Embeddings metadata');
  if (embeddingsMetadata) {
    if (embeddingsMetadata.corpus?.processedChunks > 0) {
      log('PASS', `Embeddings contain ${embeddingsMetadata.corpus.processedChunks} processed chunks`);
    } else {
      log('WARN', 'No embeddings found', 'Generate embeddings for full functionality');
    }
  }
  
  // 5. Validate service worker
  log('INFO', '5. Validating service worker...');
  validateServiceWorker();
  
  // 6. Validate PWA manifest
  log('INFO', '6. Validating PWA manifest...');
  const manifest = validateJSON('manifest.json', 'PWA manifest');
  if (manifest) {
    if (manifest.start_url && !manifest.start_url.startsWith('/')) {
      log('PASS', 'PWA manifest has relative start_url for GitHub Pages');
    } else if (manifest.start_url === './') {
      log('PASS', 'PWA manifest has correct relative start_url');
    } else {
      log('WARN', 'PWA manifest may have incorrect start_url for GitHub Pages', `Current: ${manifest.start_url}`);
    }
  }
  
  // 7. Check for hardcoded URLs
  log('INFO', '7. Validating URL construction...');
  validateBaseURLs('index.html', 'Home page');
  validateBaseURLs('admin/documents/index.html', 'Documents admin page');
  validateBaseURLs('admin/embeddings/index.html', 'Embeddings admin page');
  
  // 8. Validate JavaScript bundles
  log('INFO', '8. Validating JavaScript assets...');
  const jsFiles = ['_astro/hoisted.js', '_astro/entry.js'].map(file => {
    const exists = existsSync(join(distPath, file));
    if (exists) {
      const stats = statSync(join(distPath, file));
      const size = (stats.size / 1024).toFixed(2);
      log('PASS', `JavaScript bundle exists`, `${file} (${size} KB)`);
    } else {
      // JS files might have different names, so just warn
      log('WARN', `JavaScript bundle not found`, `Expected: ${file}`);
    }
    return exists;
  });
  
  // Print summary
  console.log(`\n${colors.bright}${colors.white}📊 Validation Summary${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Warnings: ${results.warnings}${colors.reset}`);
  
  // Exit with appropriate code
  if (results.failed > 0) {
    console.log(`\n${colors.red}${colors.bright}❌ Deployment validation failed${colors.reset}`);
    console.log(`${colors.white}Fix the above issues before deploying to GitHub Pages.${colors.reset}`);
    process.exit(1);
  } else if (results.warnings > 0) {
    console.log(`\n${colors.yellow}${colors.bright}⚠️  Deployment validation passed with warnings${colors.reset}`);
    console.log(`${colors.white}Consider addressing the warnings for optimal deployment.${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`\n${colors.green}${colors.bright}✅ Deployment validation passed!${colors.reset}`);
    console.log(`${colors.white}Your site is ready for GitHub Pages deployment.${colors.reset}`);
    process.exit(0);
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log('FAIL', 'Validation script crashed', error.message);
  process.exit(1);
});

// Run the validation
main().catch((error) => {
  log('FAIL', 'Validation failed with error', error.message);
  process.exit(1);
});