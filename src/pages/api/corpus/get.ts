import type { APIRoute, APIContext } from 'astro';
import { corpusService } from '@/lib/admin/corpus-service';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const GET: APIRoute = async (context: APIContext) => {
  try {
    const url = new URL(context.request.url);
    const documentId = url.searchParams.get('id');

    // Validate required parameter
    if (!documentId) {
      return new Response(JSON.stringify({ 
        error: 'Document ID is required' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Sanitize document ID to prevent malicious input
    const sanitizedId = documentId.replace(/[<>]/g, '');
    if (sanitizedId !== documentId) {
      return new Response(JSON.stringify({ 
        error: 'Invalid document ID format' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    await corpusService.initialize();

    // Get document and metrics
    const [document, metrics] = await Promise.all([
      corpusService.getDocument(sanitizedId),
      corpusService.getDocumentMetrics(sanitizedId)
    ]);

    if (!document) {
      return new Response(JSON.stringify({ 
        error: 'Document not found' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    const responseData = {
      document,
      metrics: metrics || {
        accessCount: 0,
        lastAccessed: new Date().toISOString(),
        averageRelevanceScore: 0,
        citationCount: 0
      }
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300', // 5 minutes cache
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error in corpus get API:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch document',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

export const OPTIONS: APIRoute = async (_context: APIContext) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};
