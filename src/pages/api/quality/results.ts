import type { APIRoute } from 'astro';

export const prerender = false;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Storage key for test results
const STORAGE_KEY = 'quality_test_results';

// Helper to get stored results
function getStoredResults(): any[] {
  if (typeof globalThis.localStorage === 'undefined') {
    // In test environment, use a simple in-memory store
    if (!globalThis.__testResults) {
      globalThis.__testResults = [];
    }
    return globalThis.__testResults;
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : [];
}

// Helper to store results
function storeResults(results: any[]): void {
  if (typeof globalThis.localStorage === 'undefined') {
    globalThis.__testResults = results;
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
  }
}

// Helper to generate markdown report
function generateMarkdownReport(results: any): string {
  let markdown = '# Quality Test Results\n\n';
  markdown += `**Date:** ${new Date(results.timestamp).toISOString()}\n\n`;
  markdown += `## Summary\n\n`;
  markdown += `- **Total Tests:** ${results.totalTests || 0}\n`;
  markdown += `- **Passed:** ${results.passedTests || 0}\n`;
  markdown += `- **Failed:** ${(results.totalTests || 0) - (results.passedTests || 0)}\n`;
  markdown += `- **Average Score:** ${((results.averageScore || 0) * 100).toFixed(1)}%\n\n`;
  
  if (results.results) {
    markdown += '## Test Details\n\n';
    results.results.forEach((test: any) => {
      markdown += `### ${test.testId}\n`;
      markdown += `- **Status:** ${test.passed ? 'PASSED' : 'FAILED'}\n`;
      markdown += `- **Score:** ${(test.score * 100).toFixed(1)}%\n`;
      markdown += `- **Duration:** ${test.duration}ms\n\n`;
    });
  }
  
  return markdown;
}

export const GET: APIRoute = async (_context) => {
  try {
    const url = new URL(_context.request.url);
    const latest = url.searchParams.get('latest') === 'true';
    const format = url.searchParams.get('format') || 'json';
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    const results = getStoredResults();
    
    if (latest) {
      const latestResult = results[results.length - 1];
      
      if (!latestResult) {
        return new Response(JSON.stringify({
          success: true,
          data: null,
          message: 'No test results available'
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      if (format === 'markdown') {
        const markdown = generateMarkdownReport(latestResult);
        return new Response(markdown, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/markdown'
          }
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        data: latestResult
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Return historical results with limit
    const limitedResults = results.slice(-limit).reverse();
    
    if (format === 'summary') {
      const summary = limitedResults.map((r: any) => ({
        timestamp: r.timestamp,
        totalTests: r.totalTests,
        passedTests: r.passedTests,
        averageScore: r.averageScore
      }));
      
      return new Response(JSON.stringify({
        success: true,
        data: summary,
        total: results.length
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: limitedResults,
      total: results.length
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to retrieve results';
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
  try {
    // Parse request body
    let body: any;
    try {
      const text = await _context.request.text();
      body = text ? JSON.parse(text) : {};
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    const { operation, timestamp } = body;
    
    if (!operation) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Operation parameter is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    const results = getStoredResults();
    
    if (operation === 'export_latest') {
      const latestResult = results[results.length - 1];
      
      if (!latestResult) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No test results available to export'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      const markdown = generateMarkdownReport(latestResult);
      return new Response(markdown, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/markdown',
          'Content-Disposition': 'attachment; filename="test-results.md"'
        }
      });
    }
    
    if (operation === 'export_by_timestamp') {
      if (!timestamp) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Timestamp parameter is required for this operation'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      const result = results.find((r: any) => r.timestamp === timestamp);
      
      if (!result) {
        return new Response(JSON.stringify({
          success: false,
          error: 'No test results found for the specified timestamp'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      const markdown = generateMarkdownReport(result);
      return new Response(markdown, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/markdown',
          'Content-Disposition': 'attachment; filename="test-results.md"'
        }
      });
    }
    
    return new Response(JSON.stringify({
      success: false,
      error: `Invalid operation: ${operation}`
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Export operation failed';
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

export const DELETE: APIRoute = async (_context) => {
  try {
    // Clear stored results
    storeResults([]);
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Test results cleared successfully'
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to clear results';
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

export const OPTIONS: APIRoute = async (_context) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders
  });
};

// Declare global type for test environment
declare global {
  var __testResults: any[] | undefined;
}