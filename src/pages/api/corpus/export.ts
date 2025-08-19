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
    const format = url.searchParams.get('format') || 'json';
    const compress = url.searchParams.get('compress') === 'true';

    // Only support JSON format for now
    if (format !== 'json') {
      return new Response(JSON.stringify({ 
        error: 'Unsupported format. Only JSON is currently supported.' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    await corpusService.initialize();

    // Get all documents
    const documents = await corpusService.getDocuments();

    // Create export data
    const exportData = {
      documents,
      metadata: {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        totalDocuments: documents.length,
        format: 'LexMX-Corpus-JSON',
        generator: 'LexMX Corpus API v1.0'
      }
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const filename = `corpus-export-${timestamp}.json`;

    const responseHeaders = {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      ...corsHeaders
    };

    // Add compression headers if requested (though actual compression would need implementation)
    if (compress) {
      // Note: Actual compression would require additional implementation
      // This is a placeholder for the compression logic
      responseHeaders['X-Compression-Requested'] = 'true';
    }

    return new Response(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Error in corpus export API:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to export corpus',
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
