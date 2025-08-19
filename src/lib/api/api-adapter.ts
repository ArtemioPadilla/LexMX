/**
 * API Adapter for GitHub Pages deployment
 * Intercepts API calls and routes them to client-side implementations
 */

import { clientAPI } from './client-api';

/**
 * Determine if we're running in a static environment (GitHub Pages)
 */
export function isStaticEnvironment(): boolean {
  // Check if we're on GitHub Pages domain
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    return hostname.includes('github.io') || 
           hostname === 'localhost' || 
           hostname === '127.0.0.1';
  }
  return false;
}

/**
 * API fetch wrapper that routes to client-side implementation in static environments
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  // If not in static environment, use regular fetch
  if (!isStaticEnvironment()) {
    return fetch(url, options);
  }
  
  // Parse the URL to determine which API endpoint is being called
  const urlPath = new URL(url, window.location.origin).pathname;
  const method = options?.method || 'GET';
  
  // Route to appropriate client-side implementation
  let result: any;
  
  // Admin API routes
  if (urlPath.includes('/api/admin/stats')) {
    result = await clientAPI.getAdminStats();
  }
  
  // Corpus API routes
  else if (urlPath.includes('/api/corpus/list')) {
    result = await clientAPI.getCorpusList();
  }
  else if (urlPath.includes('/api/corpus/get')) {
    const params = new URLSearchParams(new URL(url, window.location.origin).search);
    const id = params.get('id') || '';
    result = await clientAPI.getCorpusDocument(id);
  }
  else if (urlPath.includes('/api/corpus/delete')) {
    const body = options?.body ? JSON.parse(options.body as string) : {};
    result = await clientAPI.deleteCorpusDocument(body.id);
  }
  else if (urlPath.includes('/api/corpus/export')) {
    result = await clientAPI.exportCorpus();
    
    // Handle file download if successful
    if (result.status === 200 && result.data?.blob) {
      clientAPI.downloadFile(result.data.blob, result.data.filename);
    }
  }
  else if (urlPath.includes('/api/corpus/stats')) {
    result = await clientAPI.getCorpusStats();
  }
  
  // Embeddings API routes
  else if (urlPath.includes('/api/embeddings/generate')) {
    const body = options?.body ? JSON.parse(options.body as string) : {};
    result = await clientAPI.generateEmbeddings(body);
  }
  else if (urlPath.includes('/api/embeddings/clear')) {
    result = await clientAPI.clearEmbeddings();
  }
  else if (urlPath.includes('/api/embeddings/export')) {
    result = await clientAPI.exportEmbeddings();
    
    // Handle file download if successful
    if (result.status === 200 && result.data?.blob) {
      clientAPI.downloadFile(result.data.blob, result.data.filename);
    }
  }
  else if (urlPath.includes('/api/embeddings/stats')) {
    result = await clientAPI.getEmbeddingsStats();
  }
  
  // Quality API routes
  else if (urlPath.includes('/api/quality/test')) {
    const body = options?.body ? JSON.parse(options.body as string) : {};
    result = await clientAPI.runQualityTest(body);
  }
  else if (urlPath.includes('/api/quality/metrics')) {
    result = await clientAPI.getQualityMetrics();
  }
  else if (urlPath.includes('/api/quality/results')) {
    const params = new URLSearchParams(new URL(url, window.location.origin).search);
    result = await clientAPI.getQualityResults({
      startDate: params.get('startDate') || undefined,
      endDate: params.get('endDate') || undefined,
      testType: params.get('testType') || undefined,
      limit: params.get('limit') ? parseInt(params.get('limit')!) : undefined
    });
  }
  
  // Unknown route
  else {
    result = {
      error: `API route not found: ${urlPath}`,
      status: 404
    };
  }
  
  // Convert result to Response object
  const responseBody = result.error ? 
    JSON.stringify({ error: result.error }) : 
    JSON.stringify(result.data);
  
  return new Response(responseBody, {
    status: result.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

/**
 * Replace global fetch with our wrapper for API calls
 * This ensures all API calls go through our adapter
 */
export function installAPIAdapter(): void {
  if (typeof window === 'undefined') return;
  
  const originalFetch = window.fetch;
  
  window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input.toString();
    
    // Only intercept API calls
    if (url.includes('/api/')) {
      return apiFetch(url, init);
    }
    
    // Use original fetch for non-API calls
    return originalFetch(input, init);
  };
}

// Auto-install in browser environment
if (typeof window !== 'undefined') {
  // Install adapter when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAPIAdapter);
  } else {
    installAPIAdapter();
  }
}