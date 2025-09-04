#!/usr/bin/env node

/**
 * Local Development CORS Proxy
 * 
 * Simple proxy server for development that bypasses CORS restrictions.
 * Only for local development - not for production use.
 * 
 * Usage:
 *   node scripts/dev-proxy.js
 *   npm run dev:proxy
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

const PORT = 3002;
const ALLOWED_DOMAINS = [
  'diputados.gob.mx',
  'dof.gob.mx',
  'scjn.gob.mx', 
  'senado.gob.mx',
  'sat.gob.mx',
  'imss.gob.mx',
  'infonavit.org.mx'
];

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

function log(level, message, details = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const levelColors = {
    INFO: colors.cyan,
    SUCCESS: colors.green,
    ERROR: colors.red,
    WARN: colors.yellow
  };
  
  const color = levelColors[level] || colors.white;
  console.log(`${color}[${timestamp}] ${level}${colors.reset} ${message}`);
  
  if (details) {
    console.log(`${colors.white}    ${details}${colors.reset}`);
  }
}

/**
 * Check if URL is from allowed domain
 */
function isAllowedDomain(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return ALLOWED_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Proxy request to target URL
 */
function proxyRequest(targetUrl, req, res) {
  log('INFO', `Proxying request: ${req.method} ${targetUrl}`);
  
  const urlObj = new URL(targetUrl);
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : http;
  
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method: req.method,
    headers: {
      ...req.headers,
      'Host': urlObj.hostname,
      'User-Agent': 'LexMX-DevProxy/1.0 (Development)',
      'Accept': 'application/pdf,application/msword,application/xml,text/html,*/*',
      'Accept-Language': 'es-MX,es,en'
    }
  };
  
  // Remove headers that might cause issues
  delete options.headers['origin'];
  delete options.headers['referer'];
  delete options.headers['host'];
  
  const proxyReq = client.request(options, (proxyRes) => {
    log('SUCCESS', `Response received: ${proxyRes.statusCode}`, 
        `Content-Type: ${proxyRes.headers['content-type'] || 'unknown'}`);
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // Forward response headers (except CORS conflicting ones)
    Object.keys(proxyRes.headers).forEach(key => {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, proxyRes.headers[key]);
      }
    });
    
    res.statusCode = proxyRes.statusCode;
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (error) => {
    log('ERROR', `Proxy request failed: ${error.message}`);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({
      error: 'Proxy request failed',
      message: error.message,
      target: targetUrl
    }));
  });
  
  // Forward request body
  req.pipe(proxyReq);
}

/**
 * Handle preflight OPTIONS requests
 */
function handlePreflight(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.statusCode = 200;
  res.end();
}

/**
 * Send error response
 */
function sendError(res, statusCode, message, details = '') {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify({
    error: message,
    details: details,
    proxy: 'LexMX-DevProxy/1.0'
  }));
}

/**
 * Main request handler
 */
function handleRequest(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    handlePreflight(req, res);
    return;
  }
  
  // Health check endpoint
  if (url.pathname === '/health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({
      status: 'healthy',
      proxy: 'LexMX-DevProxy/1.0',
      allowedDomains: ALLOWED_DOMAINS,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // Extract target URL from query parameter
  const targetUrl = url.searchParams.get('url');
  
  if (!targetUrl) {
    log('WARN', 'Missing URL parameter');
    sendError(res, 400, 'Missing url parameter', 
              'Usage: http://localhost:3001/?url=https://example.com');
    return;
  }
  
  // Validate URL
  try {
    new URL(targetUrl);
  } catch {
    log('WARN', `Invalid URL: ${targetUrl}`);
    sendError(res, 400, 'Invalid URL', targetUrl);
    return;
  }
  
  // Check if domain is allowed
  if (!isAllowedDomain(targetUrl)) {
    log('WARN', `Domain not allowed: ${targetUrl}`);
    sendError(res, 403, 'Domain not allowed', 
              `Only Mexican government sites are allowed: ${ALLOWED_DOMAINS.join(', ')}`);
    return;
  }
  
  // Proxy the request
  proxyRequest(targetUrl, req, res);
}

/**
 * Start the proxy server
 */
function startServer() {
  const server = http.createServer(handleRequest);
  
  server.listen(PORT, 'localhost', () => {
    console.log(`${colors.bright}${colors.cyan}🚀 LexMX Development CORS Proxy${colors.reset}\n`);
    console.log(`${colors.green}✅ Server running at: http://localhost:${PORT}${colors.reset}`);
    console.log(`${colors.yellow}⚠️  Development only - not for production use${colors.reset}\n`);
    
    console.log(`${colors.white}Usage:${colors.reset}`);
    console.log(`  Proxy URL: http://localhost:${PORT}/?url=TARGET_URL`);
    console.log(`  Health check: http://localhost:${PORT}/health`);
    console.log(`  Allowed domains: ${ALLOWED_DOMAINS.join(', ')}\n`);
    
    console.log(`${colors.cyan}Example:${colors.reset}`);
    console.log(`  http://localhost:${PORT}/?url=https://www.diputados.gob.mx/LeyesBiblio/pdf/CPEUM.pdf\n`);
    
    console.log(`${colors.white}To use in your application:${colors.reset}`);
    console.log(`  const proxyUrl = \`http://localhost:${PORT}/?url=\${encodeURIComponent(originalUrl)}\`;`);
    console.log(`  fetch(proxyUrl).then(response => response.blob());\n`);
  });
  
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      log('ERROR', `Port ${PORT} is already in use`);
      console.log(`${colors.yellow}Try stopping other services or use a different port${colors.reset}`);
    } else {
      log('ERROR', 'Server error', error.message);
    }
    process.exit(1);
  });
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Shutting down proxy server...${colors.reset}`);
    server.close(() => {
      console.log(`${colors.green}✅ Server stopped${colors.reset}`);
      process.exit(0);
    });
  });
  
  process.on('SIGTERM', () => {
    console.log(`\n${colors.yellow}Shutting down proxy server...${colors.reset}`);
    server.close(() => {
      console.log(`${colors.green}✅ Server stopped${colors.reset}`);
      process.exit(0);
    });
  });
}

// Start the server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}

export { startServer, isAllowedDomain, handleRequest };