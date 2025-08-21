import type { APIRoute } from 'astro';
import { embeddingsService } from '../../../lib/admin/embeddings-service';
import { adminDataService } from '../../../lib/admin/admin-data-service';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const DELETE: APIRoute = async ({ request, ...context }) => {
  // Avoid unused parameter warnings
  void context;
  
  try {
    let requestBody = {};
    
    // Try to parse JSON body, but don't fail if malformed or missing
    try {
      const text = await request.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch {
      // Continue with empty object for malformed JSON
    }
    
    const { clearCache } = requestBody as { clearCache?: boolean };
    
    if (clearCache === true) {
      // Clear cache only
      const result = await adminDataService.clearEmbeddingsCache();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Embeddings cache cleared successfully',
        operation: 'clear_cache',
        data: result,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    } else {
      // Clear all embeddings (default)
      const result = await embeddingsService.clearEmbeddings();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'All embeddings cleared successfully',
        operation: 'clear_all',
        data: result,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to clear embeddings';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

export const POST: APIRoute = async ({ request, ...context }) => {
  // Avoid unused parameter warnings
  void context;
  
  try {
    const requestBody = await request.json();
    const { operation } = requestBody as { operation?: string };
    
    const validOperations = ['clear_all', 'clear_cache', 'rebuild_index'];
    
    if (!operation || !validOperations.includes(operation)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid operation. Valid operations: clear_all, clear_cache, rebuild_index',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    let result;
    let message: string;
    
    switch (operation) {
      case 'clear_all':
        result = await embeddingsService.clearEmbeddings();
        message = 'All embeddings cleared successfully';
        break;
        
      case 'clear_cache':
        result = await adminDataService.clearEmbeddingsCache();
        message = 'Embeddings cache cleared successfully';
        break;
        
      case 'rebuild_index':
        result = await adminDataService.rebuildIndex();
        message = 'Embeddings index rebuilt successfully';
        break;
        
      default:
        throw new Error('Invalid operation');
    }
    
    return new Response(JSON.stringify({
      success: true,
      message,
      operation,
      data: result,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to perform embeddings operation';
    
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
};

export const OPTIONS: APIRoute = async ({ ...context }) => {
  // Avoid unused parameter warnings
  void context;
  
  return new Response('', {
    status: 200,
    headers: corsHeaders
  });
};
