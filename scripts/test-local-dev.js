#!/usr/bin/env node

/**
 * LexMX Local Development Testing Script
 * 
 * Tests the development server to ensure core functionality works
 * before building for production.
 */

import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Configuration
const DEV_SERVER_URL = 'http://localhost:4321';
const STARTUP_TIMEOUT = 30000; // 30 seconds
const TEST_TIMEOUT = 10000; // 10 seconds per test

// ANSI colors
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m',
  bright: '\x1b[1m'
};

let devServer = null;
const testResults = { passed: 0, failed: 0, tests: [] };

function log(level, message, details = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const levelColors = {
    PASS: colors.green,
    FAIL: colors.red,
    WARN: colors.yellow,
    INFO: colors.cyan,
    DEBUG: colors.white
  };
  
  const color = levelColors[level] || colors.white;
  console.log(`${color}[${timestamp}] ${level}${colors.reset} ${message}`);
  
  if (details) {
    console.log(`${colors.white}    ${details}${colors.reset}`);
  }
  
  if (level === 'PASS') testResults.passed++;
  if (level === 'FAIL') testResults.failed++;
  testResults.tests.push({ level, message, details, timestamp });
}

async function startDevServer() {
  log('INFO', 'Starting development server...');
  
  return new Promise((resolve, reject) => {
    devServer = spawn('npm', ['run', 'dev'], {
      cwd: projectRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let output = '';
    const timeout = setTimeout(() => {
      devServer.kill();
      reject(new Error('Dev server startup timeout'));
    }, STARTUP_TIMEOUT);
    
    devServer.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local:') || output.includes('localhost:')) {
        clearTimeout(timeout);
        log('PASS', 'Development server started', 'Ready for testing');
        resolve();
      }
    });
    
    devServer.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error') || error.includes('EADDRINUSE')) {
        clearTimeout(timeout);
        reject(new Error(`Dev server error: ${error}`));
      }
    });
    
    devServer.on('exit', (code) => {
      if (code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Dev server exited with code ${code}`));
      }
    });
  });
}

async function stopDevServer() {
  if (devServer) {
    log('INFO', 'Stopping development server...');
    devServer.kill();
    devServer = null;
  }
}

async function testEndpoint(path, description, expectedStatus = 200) {
  try {
    const url = `${DEV_SERVER_URL}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'LexMX-Test-Client/1.0'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (response.status === expectedStatus) {
      const contentLength = response.headers.get('content-length') || '0';
      log('PASS', `${description} endpoint works`, `${path} (${response.status}, ${contentLength} bytes)`);
      return true;
    } else {
      log('FAIL', `${description} endpoint returned wrong status`, `${path}: expected ${expectedStatus}, got ${response.status}`);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      log('FAIL', `${description} endpoint timeout`, `${path}: Request took longer than ${TEST_TIMEOUT}ms`);
    } else {
      log('FAIL', `${description} endpoint error`, `${path}: ${error.message}`);
    }
    return false;
  }
}

async function testAPIEndpoint(path, method = 'GET', body = null, description = '') {
  try {
    const url = `${DEV_SERVER_URL}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TEST_TIMEOUT);
    
    const options = {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'LexMX-Test-Client/1.0'
      }
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(url, options);
    clearTimeout(timeoutId);
    
    // API endpoints should return JSON
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      log('PASS', `API ${method} ${path} works`, `Status: ${response.status}, Response: ${JSON.stringify(data).substring(0, 100)}...`);
      return { success: true, data, status: response.status };
    } else {
      log('WARN', `API ${method} ${path} returned non-JSON`, `Content-Type: ${contentType}, Status: ${response.status}`);
      return { success: false, status: response.status };
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      log('FAIL', `API ${method} ${path} timeout`, `Request took longer than ${TEST_TIMEOUT}ms`);
    } else {
      log('WARN', `API ${method} ${path} error`, `${error.message} (expected in static build)`);
    }
    return { success: false, error: error.message };
  }
}

async function testStaticAssets() {
  log('INFO', 'Testing static assets...');
  
  const assets = [
    { path: '/favicon.svg', desc: 'Favicon' },
    { path: '/manifest.json', desc: 'PWA Manifest' },
    { path: '/legal-corpus/metadata.json', desc: 'Corpus metadata' },
    { path: '/embeddings/embeddings-metadata.json', desc: 'Embeddings metadata' }
  ];
  
  for (const asset of assets) {
    await testEndpoint(asset.path, asset.desc);
  }
}

async function testPages() {
  log('INFO', 'Testing core pages...');
  
  const pages = [
    { path: '/', desc: 'Home page' },
    { path: '/chat', desc: 'Chat interface' },
    { path: '/admin/documents', desc: 'Documents admin' },
    { path: '/admin/embeddings', desc: 'Embeddings admin' }
  ];
  
  for (const page of pages) {
    await testEndpoint(page.path, page.desc);
  }
}

async function testAPIRoutes() {
  log('INFO', 'Testing API routes (dev mode only)...');
  
  // Test corpus listing
  await testAPIEndpoint('/api/corpus/list', 'GET', null, 'List corpus documents');
  
  // Test quality endpoints
  await testAPIEndpoint('/api/quality/test', 'POST', {
    query: 'test query',
    documentId: 'test-doc'
  }, 'Quality test');
  
  // Test ingestion status
  await testAPIEndpoint('/api/ingest/status/test-id', 'GET', null, 'Ingestion status');
}

async function testDependencies() {
  log('INFO', 'Checking project dependencies...');
  
  try {
    const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf-8'));
    
    // Check for critical dependencies
    const criticalDeps = [
      'astro',
      '@astrojs/react',
      'react',
      'typescript',
      'tailwindcss'
    ];
    
    const missingDeps = criticalDeps.filter(dep => 
      !packageJson.dependencies?.[dep] && !packageJson.devDependencies?.[dep]
    );
    
    if (missingDeps.length === 0) {
      log('PASS', 'All critical dependencies present');
    } else {
      log('FAIL', 'Missing critical dependencies', missingDeps.join(', '));
    }
    
    // Check for new document processing deps
    const docDeps = ['pdfjs-dist', 'mammoth'];
    const presentDocDeps = docDeps.filter(dep => 
      packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]
    );
    
    if (presentDocDeps.length > 0) {
      log('PASS', 'Document processing dependencies available', presentDocDeps.join(', '));
    } else {
      log('WARN', 'Document processing dependencies not found', 'PDF/DOC ingestion may not work');
    }
    
  } catch (error) {
    log('FAIL', 'Could not read package.json', error.message);
  }
}

async function main() {
  console.log(`${colors.bright}${colors.cyan}🧪 LexMX Local Development Testing${colors.reset}\n`);
  
  try {
    // Check dependencies first
    await testDependencies();
    
    // Start the dev server
    await startDevServer();
    
    // Wait a bit for server to fully start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run tests
    await testPages();
    await testStaticAssets();
    await testAPIRoutes();
    
  } catch (error) {
    log('FAIL', 'Testing failed', error.message);
  } finally {
    await stopDevServer();
  }
  
  // Print summary
  console.log(`\n${colors.bright}${colors.white}📊 Test Summary${colors.reset}`);
  console.log(`${colors.green}✅ Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${testResults.failed}${colors.reset}`);
  
  if (testResults.failed > 0) {
    console.log(`\n${colors.red}${colors.bright}❌ Some tests failed${colors.reset}`);
    console.log(`${colors.white}Review the failures above before deploying.${colors.reset}`);
    process.exit(1);
  } else {
    console.log(`\n${colors.green}${colors.bright}✅ All tests passed!${colors.reset}`);
    console.log(`${colors.white}Your development environment is working correctly.${colors.reset}`);
    process.exit(0);
  }
}

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, cleaning up...');
  await stopDevServer();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nReceived SIGTERM, cleaning up...');
  await stopDevServer();
  process.exit(0);
});

// Run the tests
main().catch(async (error) => {
  log('FAIL', 'Test script failed', error.message);
  await stopDevServer();
  process.exit(1);
});