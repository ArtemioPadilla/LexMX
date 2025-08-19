import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  // Return empty response during build
  if (import.meta.env.PROD === false || typeof window === 'undefined') {
    return new Response(JSON.stringify({
      corpus: { totalDocuments: 0, totalChunks: 0 },
      embeddings: { totalVectors: 0, dimensions: 0 },
      quality: { retrievalAccuracy: 0, averageLatency: 0 },
      timestamp: Date.now()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }

  // This code won't run in production (GitHub Pages)
  // Client-side API adapter will handle the actual implementation
  return new Response(JSON.stringify({ 
    error: 'API routes not available in static deployment' 
  }), { 
    status: 501,
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};