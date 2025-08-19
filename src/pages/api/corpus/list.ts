import type { APIRoute, APIContext } from 'astro';
import { corpusService } from '@/lib/admin/corpus-service';
import type { CorpusFilter } from '@/lib/admin/corpus-service';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const GET: APIRoute = async (context: APIContext) => {
  try {
    await corpusService.initialize();

    // Parse query parameters for filtering
    const url = new URL(context.request.url);
    const searchParams = url.searchParams;

    const filter: CorpusFilter = {};

    // Extract filter parameters
    if (searchParams.has('type')) {
      filter.type = searchParams.get('type') as any;
    }

    if (searchParams.has('legalArea')) {
      filter.legalArea = searchParams.get('legalArea') as any;
    }

    if (searchParams.has('hierarchy')) {
      const hierarchyValue = searchParams.get('hierarchy');
      const hierarchyNum = parseInt(hierarchyValue || '', 10);
      if (!isNaN(hierarchyNum) && hierarchyNum >= 1 && hierarchyNum <= 7) {
        filter.hierarchy = hierarchyNum;
      }
    }

    if (searchParams.has('search')) {
      filter.searchTerm = searchParams.get('search') || undefined;
    }

    // Get documents from corpus service
    const documents = await corpusService.getDocuments(filter);

    return new Response(JSON.stringify(documents), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error in corpus list API:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch documents',
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
