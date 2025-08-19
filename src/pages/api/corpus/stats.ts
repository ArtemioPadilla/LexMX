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
    const includeDetailed = url.searchParams.get('detailed') === 'true';

    await corpusService.initialize();

    // Get basic statistics
    const basicStats = await corpusService.getStatistics();

    // Convert internal statistics format to API format
    const responseData = {
      totalDocuments: Object.values(basicStats.byType).reduce((sum, count) => sum + count, 0),
      documentsByType: basicStats.byType,
      documentsByArea: basicStats.byArea,
      hierarchyDistribution: basicStats.byHierarchy,
      totalChunks: Math.round(basicStats.averageChunks * Object.values(basicStats.byType).reduce((sum, count) => sum + count, 0)),
      averageChunksPerDocument: Math.round(basicStats.averageChunks),
      storageSize: basicStats.totalSize,
      lastUpdate: new Date().toISOString()
    };

    // Include validation results if detailed=true
    if (includeDetailed) {
      const validation = await corpusService.validateCorpus();
      (responseData as any).validation = {
        totalDocuments: validation.valid + validation.invalid,
        valid: validation.valid,
        invalid: validation.invalid,
        issues: validation.issues
      };
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=60', // 1 minute cache for stats
        ...corsHeaders
      }
    });

  } catch (error) {
    console.error('Error in corpus stats API:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to get corpus statistics',
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
