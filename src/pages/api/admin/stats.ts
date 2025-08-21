import type { APIRoute } from 'astro';
import { adminDataService } from '../../../lib/admin/admin-data-service';
import { corpusService } from '../../../lib/admin/corpus-service';
import { embeddingsService } from '../../../lib/admin/embeddings-service';
import { qualityTestSuite } from '../../../lib/admin/quality-test-suite';

export const prerender = false;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function calculateHealthScore(corpus: any, embeddings: any, quality: any): number {
  let score = 0;
  
  // Corpus health (30%)
  if (corpus.totalDocuments > 100) score += 15;
  else if (corpus.totalDocuments > 50) score += 10;
  else if (corpus.totalDocuments > 0) score += 5;
  
  if (corpus.totalChunks > 1000) score += 15;
  else if (corpus.totalChunks > 500) score += 10;
  else if (corpus.totalChunks > 0) score += 5;
  
  // Embeddings health (30%)
  if (embeddings.totalVectors > 1000) score += 15;
  else if (embeddings.totalVectors > 500) score += 10;
  else if (embeddings.totalVectors > 0) score += 5;
  
  if (embeddings.indexStatus === 'ready') score += 15;
  else if (embeddings.indexStatus === 'partial') score += 8;
  
  // Quality health (40%)
  if (quality.retrievalAccuracy > 80) score += 20;
  else if (quality.retrievalAccuracy > 60) score += 15;
  else if (quality.retrievalAccuracy > 40) score += 10;
  else if (quality.retrievalAccuracy > 0) score += 5;
  
  if (quality.averageLatency < 1000) score += 10;
  else if (quality.averageLatency < 2000) score += 8;
  else if (quality.averageLatency < 3000) score += 5;
  
  if (quality.cacheHitRate > 60) score += 10;
  else if (quality.cacheHitRate > 40) score += 8;
  else if (quality.cacheHitRate > 20) score += 5;
  
  return Math.min(100, score);
}

function calculateTrends(testHistory: any[]) {
  if (testHistory.length < 2) {
    return {
      scoresTrend: { direction: 'stable', magnitude: 0 },
      passRatesTrend: { direction: 'stable', magnitude: 0 },
      recentAverageScore: testHistory[0]?.averageScore || 0,
      recentAveragePassRate: testHistory[0] ? (testHistory[0].passedTests / testHistory[0].totalTests) * 100 : 0
    };
  }
  
  const recent = testHistory.slice(0, 3);
  const recentAvgScore = recent.reduce((sum, test) => sum + test.averageScore, 0) / recent.length;
  const recentAvgPassRate = recent.reduce((sum, test) => sum + (test.passedTests / test.totalTests) * 100, 0) / recent.length;
  
  const oldest = testHistory[testHistory.length - 1];
  const newest = testHistory[0];
  
  const scoreDiff = newest.averageScore - oldest.averageScore;
  const passRateDiff = (newest.passedTests / newest.totalTests) - (oldest.passedTests / oldest.totalTests);
  
  return {
    scoresTrend: {
      direction: scoreDiff > 1 ? 'improving' : scoreDiff < -1 ? 'declining' : 'stable',
      magnitude: Math.abs(scoreDiff)
    },
    passRatesTrend: {
      direction: passRateDiff > 0.05 ? 'improving' : passRateDiff < -0.05 ? 'declining' : 'stable',
      magnitude: Math.abs(passRateDiff) * 100
    },
    recentAverageScore: recentAvgScore,
    recentAveragePassRate: recentAvgPassRate
  };
}

export const GET: APIRoute = async (context) => {
  try {
    const url = new URL(context.request.url);
    const searchParams = new URLSearchParams(url.search);
    const section = searchParams.get('section');
    const detailed = searchParams.get('detailed') === 'true';
    
    // Handle section-specific requests
    if (section) {
      const validSections = ['corpus', 'embeddings', 'quality'];
      if (!validSections.includes(section)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid section. Valid sections: corpus, embeddings, quality',
          timestamp: new Date().toISOString()
        }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          }
        });
      }
      
      let sectionData;
      switch (section) {
        case 'corpus':
          if (detailed) {
            const [corpusStats, corpusDetailed] = await Promise.all([
              adminDataService.getCorpusStats(),
              corpusService.getStatistics()
            ]);
            sectionData = {
              overview: corpusStats,
              detailed: corpusDetailed
            };
          } else {
            sectionData = await adminDataService.getCorpusStats();
          }
          break;
        case 'embeddings':
          if (detailed) {
            const [embeddingsStats, embeddingsDetailed] = await Promise.all([
              adminDataService.getEmbeddingsStats(),
              embeddingsService.getStats()
            ]);
            sectionData = {
              overview: embeddingsStats,
              detailed: embeddingsDetailed
            };
          } else {
            sectionData = await adminDataService.getEmbeddingsStats();
          }
          break;
        case 'quality':
          sectionData = await adminDataService.getQualityStats();
          break;
      }
      
      return new Response(JSON.stringify({
        success: true,
        section,
        data: sectionData,
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Get comprehensive stats
    const [corpusStats, embeddingsStats, qualityStats] = await Promise.all([
      adminDataService.getCorpusStats(),
      adminDataService.getEmbeddingsStats(),
      adminDataService.getQualityStats()
    ]);
    
    const overview = {
      totalDocuments: corpusStats.totalDocuments,
      totalVectors: embeddingsStats.totalVectors,
      retrievalAccuracy: qualityStats.retrievalAccuracy,
      averageLatency: qualityStats.averageLatency,
      healthScore: calculateHealthScore(corpusStats, embeddingsStats, qualityStats)
    };
    
    const system = {
      uptime: process?.uptime ? process.uptime() * 1000 : Date.now() % (24 * 60 * 60 * 1000),
      timestamp: new Date().toISOString(),
      browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'Server'
    };
    
    let responseData: any = {
      overview,
      corpus: corpusStats,
      embeddings: embeddingsStats,
      quality: qualityStats,
      system
    };
    
    // Add detailed information if requested
    if (detailed) {
      const [corpusDetailed, embeddingsDetailed, testHistory] = await Promise.all([
        corpusService.getStatistics(),
        embeddingsService.getStats(),
        Promise.resolve(qualityTestSuite.getStoredResults())
      ]);
      
      responseData.detailed = {
        corpus: corpusDetailed,
        embeddings: embeddingsDetailed,
        testHistory,
        trends: calculateTrends(testHistory)
      };
    }
    
    return new Response(JSON.stringify({
      success: true,
      data: responseData,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch admin statistics';
    
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

export const POST: APIRoute = async (context) => {
  try {
    const requestBody = await context.request.json();
    const { operation } = requestBody as { operation?: string };
    
    const validOperations = ['health_check', 'clear_all_cache'];
    
    if (!operation || !validOperations.includes(operation)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid operation. Valid operations: health_check, clear_all_cache',
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (operation === 'health_check') {
      // Perform comprehensive health check
      const [corpusStats, embeddingsStats, qualityStats] = await Promise.all([
        adminDataService.getCorpusStats(),
        adminDataService.getEmbeddingsStats(),
        adminDataService.getQualityStats()
      ]);
      
      const checks = {
        corpus: {
          status: corpusStats.totalDocuments > 0 ? 'healthy' : 'warning',
          documents: corpusStats.totalDocuments,
          chunks: corpusStats.totalChunks
        },
        embeddings: {
          status: embeddingsStats.totalVectors > 0 && embeddingsStats.indexStatus === 'ready' ? 'healthy' : 'warning',
          vectors: embeddingsStats.totalVectors,
          indexStatus: embeddingsStats.indexStatus
        },
        quality: {
          status: qualityStats.retrievalAccuracy > 70 ? 'healthy' : qualityStats.retrievalAccuracy > 50 ? 'warning' : 'error',
          accuracy: qualityStats.retrievalAccuracy,
          latency: qualityStats.averageLatency
        },
        storage: {
          status: 'healthy',
          corpusSize: corpusStats.totalSize,
          embeddingsSize: embeddingsStats.storageSize
        }
      };
      
      const allHealthy = Object.values(checks).every(check => check.status === 'healthy');
      const hasWarnings = Object.values(checks).some(check => check.status === 'warning');
      
      const overallStatus = allHealthy ? 'healthy' : hasWarnings ? 'warning' : 'error';
      
      return new Response(JSON.stringify({
        success: true,
        message: `Health check completed - System status: ${overallStatus}`,
        data: {
          status: overallStatus,
          checks
        },
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    if (operation === 'clear_all_cache') {
      // Clear all caches
      await adminDataService.clearEmbeddingsCache();
      
      return new Response(JSON.stringify({
        success: true,
        message: 'All caches cleared successfully',
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
    const errorMessage = error instanceof Error ? error.message : 'Failed to perform admin operation';
    
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

export const OPTIONS: APIRoute = async (_context) => {
  return new Response('', {
    status: 200,
    headers: corsHeaders
  });
};