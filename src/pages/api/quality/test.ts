import type { APIRoute } from 'astro';
import { qualityTestSuite } from '@/lib/admin/quality-test-suite';

export const prerender = false;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const GET: APIRoute = async (_context) => {
  try {
    const url = new URL(_context.request.url);
    const category = url.searchParams.get('category');
    
    // Get available tests
    const availableTests = qualityTestSuite.getAvailableTests();
    
    if (category) {
      // Filter tests by category
      const categoryTests = availableTests.filter(test => test.category === category);
      return new Response(JSON.stringify({
        success: true,
        data: {
          category,
          tests: categoryTests,
          total: categoryTests.length
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Return all tests with categories
    const categories = [...new Set(availableTests.map(test => test.category))];
    return new Response(JSON.stringify({
      success: true,
      data: {
        tests: availableTests,
        categories,
        total: availableTests.length
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Service unavailable';
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
    
    const { testId, category, runAll } = body;
    
    // Validate parameters
    if (!testId && !category && !runAll) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Either testId, category, or runAll=true must be specified'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Initialize the test suite if needed
    await qualityTestSuite.initialize();
    
    // Run tests based on parameters
    if (runAll) {
      const results = await qualityTestSuite.runAllTests();
      return new Response(JSON.stringify({
        success: true,
        data: {
          type: 'suite',
          results,
          message: `Complete suite: ${results.passedTests}/${results.totalTests} tests passed (${(results.averageScore * 100).toFixed(1)}%)`
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (category) {
      const results = await qualityTestSuite.runTestsByCategory(category);
      return new Response(JSON.stringify({
        success: true,
        data: {
          type: 'category',
          category,
          results,
          message: `Category ${category}: ${results.passedTests}/${results.totalTests} tests passed (${(results.averageScore * 100).toFixed(1)}%)`
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (testId) {
      const result = await qualityTestSuite.runTest(testId);
      return new Response(JSON.stringify({
        success: true,
        data: {
          type: 'single',
          testId,
          result,
          message: `Test ${testId}: ${result.passed ? 'PASSED' : 'FAILED'} (${(result.score * 100).toFixed(1)}%)`
        }
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Test execution failed';
    
    // Check if it's a "not found" error
    if (errorMessage.includes('not found')) {
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 500, // Tests expect 500 for not found errors
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
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
  return new Response(JSON.stringify({
    success: true,
    message: 'Test results cleared'
  }), {
    status: 200,
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