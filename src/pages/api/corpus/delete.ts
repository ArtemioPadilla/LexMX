import type { APIRoute, APIContext } from 'astro';
import { corpusService } from '@/lib/admin/corpus-service';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

async function getDocumentId(request: Request): Promise<string | null> {
  const url = new URL(request.url);
  
  // Try URL parameter first (for DELETE requests)
  let documentId = url.searchParams.get('id');
  
  // If not found, try request body (for POST requests)
  if (!documentId && request.method === 'POST') {
    try {
      const body = await request.json();
      documentId = body.id;
    } catch (_error) {
      // Invalid JSON body
      return null;
    }
  }
  
  return documentId;
}

export const DELETE: APIRoute = async (context: APIContext) => {
  try {
    const documentId = await getDocumentId(context.request);

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

    // Check if document exists first
    const existingDocument = await corpusService.getDocument(sanitizedId);
    if (!existingDocument) {
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

    // Delete the document
    await corpusService.deleteDocument(sanitizedId);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Document deleted successfully',
      documentId: sanitizedId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error in corpus delete API:', error);
    
    // Check if it's a "not found" error
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isNotFound = errorMessage.toLowerCase().includes('not found');
    
    return new Response(JSON.stringify({ 
      error: isNotFound ? 'Document not found' : 'Failed to delete document',
      message: errorMessage
    }), {
      status: isNotFound ? 404 : 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

export const POST: APIRoute = async (context: APIContext) => {
  // POST method should work the same as DELETE for flexibility
  return DELETE(context);
};

export const OPTIONS: APIRoute = async (_context: APIContext) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};
