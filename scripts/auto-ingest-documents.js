#!/usr/bin/env node

/**
 * Auto-Ingest Documents Script for GitHub Actions
 * 
 * This script runs in GitHub Actions (Node.js environment) where there are no CORS restrictions.
 * It can directly fetch documents from Mexican government sites and process them automatically.
 * 
 * Usage: 
 *   node scripts/auto-ingest-documents.js [options]
 *   npm run ingest:auto [-- options]
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  documentQueuePath: path.join(__dirname, '../public/document-requests.json'),
  outputCorpusPath: path.join(__dirname, '../public/legal-corpus'),
  outputEmbeddingsPath: path.join(__dirname, '../public/embeddings'),
  tempPath: path.join(__dirname, '../temp'),
  maxFileSize: 50 * 1024 * 1024, // 50MB limit for server-side processing
  userAgent: 'LexMX-AutoIngest/1.0 (https://github.com/artemiopadilla/LexMX)',
  timeout: 60000, // 60 second timeout for government sites
};

// ANSI colors for console output
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

// Mexican government domains (for validation)
const MEXICAN_GOVT_DOMAINS = [
  'diputados.gob.mx',
  'dof.gob.mx', 
  'scjn.gob.mx',
  'senado.gob.mx',
  'gob.mx',
  'sat.gob.mx',
  'imss.gob.mx',
  'infonavit.org.mx',
  'conamer.gob.mx',
  'cndh.org.mx'
];

// Document processing statistics
const stats = {
  processed: 0,
  failed: 0,
  skipped: 0,
  totalSize: 0
};

function log(level, message, details = '') {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const levelColors = {
    INFO: colors.cyan,
    SUCCESS: colors.green,
    ERROR: colors.red,
    WARN: colors.yellow,
    DEBUG: colors.white
  };
  
  const color = levelColors[level] || colors.white;
  console.log(`${color}[${timestamp}] ${level}${colors.reset} ${message}`);
  
  if (details) {
    console.log(`${colors.white}    ${details}${colors.reset}`);
  }
}

/**
 * Validates if URL is from an official Mexican government domain
 */
function isOfficialMexicanSource(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return MEXICAN_GOVT_DOMAINS.some(domain => 
      hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

/**
 * Detects document type and format from URL and content
 */
function detectDocumentFormat(url, contentType = '') {
  const urlLower = url.toLowerCase();
  const contentLower = contentType.toLowerCase();
  
  if (urlLower.includes('.pdf') || contentLower.includes('pdf')) {
    return { format: 'pdf', icon: '📄', processor: 'pdf' };
  } else if (urlLower.includes('.doc') || contentLower.includes('msword')) {
    return { format: 'doc', icon: '📝', processor: 'doc' };
  } else if (urlLower.includes('.xml') || contentLower.includes('xml')) {
    return { format: 'xml', icon: '🔖', processor: 'xml' };
  } else if (contentLower.includes('html')) {
    return { format: 'html', icon: '🌐', processor: 'html' };
  } else {
    return { format: 'unknown', icon: '📄', processor: 'text' };
  }
}

/**
 * Fetches document from URL with proper headers and error handling
 */
async function fetchDocument(url) {
  log('INFO', `Fetching document: ${url}`);
  
  if (!isOfficialMexicanSource(url)) {
    throw new Error('URL is not from an official Mexican government source');
  }
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': CONFIG.userAgent,
        'Accept': 'application/pdf,application/msword,application/xml,text/html,text/plain,*/*',
        'Accept-Language': 'es-MX,es,en',
        'Cache-Control': 'no-cache'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > CONFIG.maxFileSize) {
      throw new Error(`Document too large: ${contentLength} bytes (max: ${CONFIG.maxFileSize})`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    const format = detectDocumentFormat(url, contentType);
    
    log('SUCCESS', `Document fetched successfully`, 
        `Format: ${format.icon} ${format.format}, Size: ${contentLength || 'unknown'} bytes`);
    
    return {
      response,
      contentType,
      format,
      size: contentLength ? parseInt(contentLength) : 0
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${CONFIG.timeout}ms`);
    }
    throw error;
  }
}

/**
 * Processes document content based on its format
 */
async function processDocumentContent(fetchResult, url) {
  const { response, format } = fetchResult;
  
  log('INFO', `Processing ${format.format} document...`);
  
  try {
    switch (format.processor) {
      case 'pdf':
        return await processPDF(response, url);
      case 'doc':
        return await processDoc(response, url);
      case 'xml':
        return await processXML(response, url);
      case 'html':
        return await processHTML(response, url);
      default:
        return await processText(response, url);
    }
  } catch (error) {
    log('ERROR', `Failed to process ${format.format} document`, error.message);
    throw error;
  }
}

/**
 * PDF processing (requires pdf-parse or similar)
 */
async function processPDF(response, url) {
  // For now, save raw PDF and return metadata
  // TODO: Implement PDF parsing with pdf-parse when available
  const buffer = await response.arrayBuffer();
  
  log('WARN', 'PDF processing not fully implemented', 'Saving as binary for future processing');
  
  return {
    title: extractTitleFromUrl(url),
    content: [], // Will be processed later
    format: 'pdf',
    size: buffer.byteLength,
    needsProcessing: true,
    rawData: buffer
  };
}

/**
 * DOC/DOCX processing (requires mammoth or similar)  
 */
async function processDoc(response, url) {
  // For now, save raw DOC and return metadata
  // TODO: Implement DOC parsing with mammoth when available
  const buffer = await response.arrayBuffer();
  
  log('WARN', 'DOC processing not fully implemented', 'Saving as binary for future processing');
  
  return {
    title: extractTitleFromUrl(url),
    content: [],
    format: 'doc', 
    size: buffer.byteLength,
    needsProcessing: true,
    rawData: buffer
  };
}

/**
 * XML processing
 */
async function processXML(response, url) {
  const text = await response.text();
  
  // Basic XML structure extraction
  const sections = extractXMLSections(text);
  
  return {
    title: extractTitleFromUrl(url),
    content: sections,
    format: 'xml',
    size: text.length,
    needsProcessing: false
  };
}

/**
 * HTML processing  
 */
async function processHTML(response, url) {
  const html = await response.text();
  
  // Basic HTML text extraction (remove tags)
  const text = html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<style[^>]*>.*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const sections = [{
    type: 'content',
    content: text,
    number: '1',
    title: extractTitleFromUrl(url)
  }];
  
  return {
    title: extractTitleFromUrl(url),
    content: sections,
    format: 'html',
    size: html.length,
    needsProcessing: false
  };
}

/**
 * Plain text processing
 */
async function processText(response, url) {
  const text = await response.text();
  
  const sections = [{
    type: 'content',
    content: text,
    number: '1', 
    title: extractTitleFromUrl(url)
  }];
  
  return {
    title: extractTitleFromUrl(url),
    content: sections,
    format: 'text',
    size: text.length,
    needsProcessing: false
  };
}

/**
 * Extract basic XML sections
 */
function extractXMLSections(xml) {
  const sections = [];
  
  // Very basic XML parsing - can be enhanced
  const articleMatches = xml.match(/<article[^>]*>(.*?)<\/article>/gis) || [];
  
  articleMatches.forEach((match, index) => {
    const content = match.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (content) {
      sections.push({
        type: 'article',
        content,
        number: (index + 1).toString(),
        title: `Article ${index + 1}`
      });
    }
  });
  
  // If no articles found, treat as single section
  if (sections.length === 0) {
    const cleanText = xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    sections.push({
      type: 'content',
      content: cleanText,
      number: '1',
      title: 'Document Content'
    });
  }
  
  return sections;
}

/**
 * Extract title from URL
 */
function extractTitleFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const filename = path.basename(pathname, path.extname(pathname));
    
    // Convert filename to readable title
    return filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim() || 'Legal Document';
  } catch {
    return 'Legal Document';
  }
}

/**
 * Saves processed document to corpus
 */
async function saveToCorpus(processedDoc, url) {
  const docId = generateDocumentId(url);
  const corpusFile = path.join(CONFIG.outputCorpusPath, `${docId}.json`);
  
  // Create legal document structure
  const legalDocument = {
    id: docId,
    title: processedDoc.title,
    type: 'law', // Can be enhanced with better type detection
    primaryArea: 'general',
    hierarchy: 4, // Default to "ley" level
    authority: extractAuthority(url),
    publicationDate: new Date().toISOString().split('T')[0],
    lastUpdated: new Date().toISOString(),
    source: url,
    language: 'es',
    content: processedDoc.content,
    metadata: {
      format: processedDoc.format,
      size: processedDoc.size,
      needsProcessing: processedDoc.needsProcessing || false,
      ingestionDate: new Date().toISOString(),
      ingestionMethod: 'auto-fetch'
    }
  };
  
  // Ensure output directory exists
  await fs.mkdir(CONFIG.outputCorpusPath, { recursive: true });
  
  // Save document
  await fs.writeFile(corpusFile, JSON.stringify(legalDocument, null, 2));
  
  log('SUCCESS', `Document saved to corpus`, `ID: ${docId}, File: ${corpusFile}`);
  
  return {
    docId,
    document: legalDocument
  };
}

/**
 * Generate consistent document ID from URL
 */
function generateDocumentId(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = path.basename(pathname, path.extname(pathname));
    
    // Create clean ID
    return filename
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50) || 'doc-' + Date.now();
  } catch {
    return 'doc-' + Date.now();
  }
}

/**
 * Extract authority from URL
 */
function extractAuthority(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    
    if (hostname.includes('diputados')) return 'Cámara de Diputados';
    if (hostname.includes('senado')) return 'Senado de la República';
    if (hostname.includes('scjn')) return 'Suprema Corte de Justicia';
    if (hostname.includes('dof')) return 'Diario Oficial de la Federación';
    if (hostname.includes('sat')) return 'SAT';
    if (hostname.includes('imss')) return 'IMSS';
    
    return 'Gobierno de México';
  } catch {
    return 'Unknown Authority';
  }
}

/**
 * Load document queue from JSON file
 */
async function loadDocumentQueue() {
  try {
    const queueData = await fs.readFile(CONFIG.documentQueuePath, 'utf-8');
    const queue = JSON.parse(queueData);
    log('INFO', `Loaded document queue`, `${queue.documents?.length || 0} documents pending`);
    return queue;
  } catch (error) {
    log('WARN', 'Document queue not found, creating empty queue');
    
    const emptyQueue = {
      version: '1.0',
      lastUpdated: new Date().toISOString(),
      documents: []
    };
    
    // Create directory and file
    await fs.mkdir(path.dirname(CONFIG.documentQueuePath), { recursive: true });
    await fs.writeFile(CONFIG.documentQueuePath, JSON.stringify(emptyQueue, null, 2));
    
    return emptyQueue;
  }
}

/**
 * Update document queue after processing
 */
async function updateDocumentQueue(queue, processedDocIds) {
  // Mark processed documents as completed
  queue.documents = queue.documents.map(doc => {
    if (processedDocIds.includes(doc.id || generateDocumentId(doc.url))) {
      return {
        ...doc,
        status: 'completed',
        processedAt: new Date().toISOString()
      };
    }
    return doc;
  });
  
  queue.lastUpdated = new Date().toISOString();
  
  await fs.writeFile(CONFIG.documentQueuePath, JSON.stringify(queue, null, 2));
  log('INFO', 'Document queue updated');
}

/**
 * Update corpus metadata
 */
async function updateCorpusMetadata(processedDocs) {
  const metadataPath = path.join(CONFIG.outputCorpusPath, 'metadata.json');
  
  let metadata;
  try {
    const metadataData = await fs.readFile(metadataPath, 'utf-8');
    metadata = JSON.parse(metadataData);
  } catch {
    metadata = {
      version: '1.0.0',
      buildDate: new Date().toISOString(),
      totalDocuments: 0,
      documents: []
    };
  }
  
  // Add new documents to metadata
  for (const { docId, document } of processedDocs) {
    // Remove existing entry if updating
    metadata.documents = metadata.documents.filter(d => d.id !== docId);
    
    // Add new entry
    metadata.documents.push({
      id: docId,
      title: document.title,
      type: document.type,
      hierarchy: document.hierarchy,
      primaryArea: document.primaryArea,
      source: document.source,
      size: document.metadata.size,
      lastUpdated: document.lastUpdated
    });
  }
  
  metadata.totalDocuments = metadata.documents.length;
  metadata.buildDate = new Date().toISOString();
  
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  log('SUCCESS', 'Corpus metadata updated', `${metadata.totalDocuments} total documents`);
}

/**
 * Main processing function
 */
async function main() {
  console.log(`${colors.bright}${colors.cyan}🚀 LexMX Auto-Ingest Documents${colors.reset}\n`);
  
  try {
    // Create output directories
    await fs.mkdir(CONFIG.outputCorpusPath, { recursive: true });
    await fs.mkdir(CONFIG.tempPath, { recursive: true });
    
    // Load document queue
    const queue = await loadDocumentQueue();
    
    if (!queue.documents || queue.documents.length === 0) {
      log('INFO', 'No documents in queue');
      return;
    }
    
    // Filter pending documents
    const pendingDocs = queue.documents.filter(doc => 
      doc.status !== 'completed' && doc.status !== 'failed'
    );
    
    log('INFO', `Processing ${pendingDocs.length} pending documents...`);
    
    const processedDocs = [];
    const processedIds = [];
    
    // Process each document
    for (const docRequest of pendingDocs) {
      const url = docRequest.url;
      
      try {
        log('INFO', `Processing: ${docRequest.title || url}`);
        
        // Fetch document
        const fetchResult = await fetchDocument(url);
        stats.totalSize += fetchResult.size;
        
        // Process content
        const processedDoc = await processDocumentContent(fetchResult, url);
        
        // Save to corpus
        const savedDoc = await saveToCorpus(processedDoc, url);
        
        processedDocs.push(savedDoc);
        processedIds.push(savedDoc.docId);
        stats.processed++;
        
      } catch (error) {
        log('ERROR', `Failed to process ${url}`, error.message);
        stats.failed++;
      }
    }
    
    if (processedDocs.length > 0) {
      // Update corpus metadata
      await updateCorpusMetadata(processedDocs);
      
      // Update queue status
      await updateDocumentQueue(queue, processedIds);
    }
    
    // Print summary
    console.log(`\n${colors.bright}${colors.white}📊 Processing Summary${colors.reset}`);
    console.log(`${colors.green}✅ Processed: ${stats.processed}${colors.reset}`);
    console.log(`${colors.red}❌ Failed: ${stats.failed}${colors.reset}`);
    console.log(`${colors.yellow}📦 Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB${colors.reset}`);
    
    if (stats.processed > 0) {
      console.log(`\n${colors.green}${colors.bright}✅ Auto-ingestion completed successfully!${colors.reset}`);
      console.log(`${colors.white}Documents are ready for embedding generation and deployment.${colors.reset}`);
    } else if (stats.failed > 0) {
      console.log(`\n${colors.red}${colors.bright}❌ Auto-ingestion completed with errors${colors.reset}`);
      process.exit(1);
    } else {
      console.log(`\n${colors.cyan}${colors.bright}ℹ️ No documents processed${colors.reset}`);
    }
    
  } catch (error) {
    log('ERROR', 'Auto-ingestion failed', error.message);
    process.exit(1);
  }
}

// Handle errors gracefully
process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught exception', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log('ERROR', 'Unhandled rejection', error.message);
  process.exit(1);
});

// Run the main function
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    log('ERROR', 'Script failed', error.message);
    process.exit(1);
  });
}

export { main, fetchDocument, processDocumentContent, isOfficialMexicanSource };