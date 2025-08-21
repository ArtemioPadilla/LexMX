import type { APIRoute } from 'astro';
import { adminDataService } from '@/lib/admin/admin-data-service';
import { qualityTestSuite } from '@/lib/admin/quality-test-suite';

export const prerender = false;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Helper function to calculate trends from historical data
function calculateTrends(history: any[]): any {
  if (!history || history.length < 2) {
    return null;
  }
  
  const scoreProgress = history.map(run => ({
    timestamp: run.timestamp,
    score: run.averageScore,
    passRate: run.passedTests / run.totalTests
  }));
  
  const categoryPerformance: Record<string, number[]> = {};
  history.forEach(run => {
    if (run.results) {
      run.results.forEach((result: any) => {
        const category = result.category || 'unknown';
        if (!categoryPerformance[category]) {
          categoryPerformance[category] = [];
        }
        categoryPerformance[category].push(result.score);
      });
    }
  });
  
  return {
    scoreProgress,
    categoryPerformance
  };
}

export const GET: APIRoute = async (_context) => {
  try {
    const url = new URL(_context.request.url);
    const detailed = url.searchParams.get('detailed') !== 'false';
    const historical = url.searchParams.get('historical') !== 'false';
    
    // Get basic quality statistics
    const qualityStats = await adminDataService.getQualityStats();
    
    const response: any = {
      success: true,
      data: {
        totalQueries: qualityStats.totalQueries || 0,
        averageResponseTime: qualityStats.averageResponseTime || 0,
        averageRelevanceScore: qualityStats.averageRelevanceScore || 0,
        topPerformingAreas: qualityStats.topPerformingAreas || [],
        queryDistribution: qualityStats.queryDistribution || {},
        recentTrends: qualityStats.recentTrends || {},
        lastUpdated: qualityStats.lastUpdated || new Date().toISOString()
      }
    };
    
    // Add detailed information if requested
    if (detailed) {
      // Get available tests information
      const availableTests = qualityTestSuite.getAvailableTests();
      const categories = qualityTestSuite.getCategories();
      
      response.data.testInfo = {
        totalAvailable: availableTests.length,
        categories: categories,
        testsByCategory: categories.reduce((acc: any, category: string) => {
          acc[category] = qualityTestSuite.getTestsByCategory(category).length;
          return acc;
        }, {})
      };
      
      // Get test history
      const storedResults = qualityTestSuite.getStoredResults();
      response.data.history = {
        totalRuns: storedResults.length,
        latestRun: storedResults[0] || null,
        averagePassRate: storedResults.length > 0
          ? storedResults.reduce((sum: number, run: any) => sum + (run.passedTests / run.totalTests), 0) / storedResults.length
          : 0
      };
      
      // Add trends if historical data is requested and available
      if (historical) {
        response.data.trends = calculateTrends(storedResults);
      } else {
        response.data.trends = null;
      }
    }
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quality metrics';
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
};

export const POST: APIRoute = async (_context) => {
  return new Response(JSON.stringify({
    success: false,
    error: 'Method not implemented'
  }), {
    status: 501,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
};

export const DELETE: APIRoute = async (_context) => {
  return new Response(JSON.stringify({
    success: false,
    error: 'Method not implemented'
  }), {
    status: 501,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
};

export const OPTIONS: APIRoute = async (_context) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};