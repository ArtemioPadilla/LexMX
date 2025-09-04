/**
 * Comprehensive service mocks for admin and core services
 * Provides realistic mock implementations with proper EventEmitter support
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';
import { 
  createMockService,
  createMockDocument,
  createMockQueryMetrics,
  createMockTestResult,
  createMockTestSuiteResult,
  createMockVectorDocument,
  createMockDocumentMetrics,
  createMockPerformanceReport,
  createMockAsyncOperation
} from './factories';
import type { 
  LegalDocument as _LegalDocument
} from '@/types';

import type { QueryMetrics as _QueryMetrics, PerformanceReport as _PerformanceReport } from '../../lib/admin/query-analyzer';
import type { DocumentMetrics as _DocumentMetrics, CorpusFilter } from '../../lib/admin/corpus-service';

// Import correct test types from quality-test-suite
import type {
  TestResult,
  TestSuiteResult,
  QualityTest
} from '@/lib/admin/quality-test-suite';

/**
 * Mock CorpusService with realistic behavior
 */
export function createMockCorpusService() {
  const mockDocuments = Array.from({ length: 10 }, () => createMockDocument());
  
  return createMockService({
    // Document operations
    getDocuments: vi.fn().mockImplementation((filter?: CorpusFilter) => {
      let filtered = [...mockDocuments];
      
      if (filter?.type) {
        filtered = filtered.filter(doc => doc.type === filter.type);
      }
      if (filter?.legalArea) {
        filtered = filtered.filter(doc => doc.primaryArea === filter.legalArea);
      }
      if (filter?.searchTerm) {
        filtered = filtered.filter(doc => 
          doc.title.toLowerCase().includes(filter.searchTerm!.toLowerCase()) ||
          doc.content.some(content => 
            content.content.toLowerCase().includes(filter.searchTerm!.toLowerCase())
          )
        );
      }
      
      return createMockAsyncOperation(filtered, { delay: 50 });
    }),

    getDocument: vi.fn().mockImplementation((id: string) => {
      const doc = mockDocuments.find(d => d.id === id);
      return Promise.resolve(doc || null);
    }),

    getDocumentMetrics: vi.fn().mockImplementation((id: string) => {
      const doc = mockDocuments.find(d => d.id === id);
      if (!doc) return Promise.resolve(null);
      
      const metrics = createMockDocumentMetrics({
        id: doc.id,
        title: doc.title,
        type: doc.type,
        legalArea: doc.primaryArea
      });
      
      return Promise.resolve(metrics);
    }),

    deleteDocument: vi.fn().mockImplementation((id: string) => {
      return Promise.resolve().then(() => {
        // Progress events simulation removed for simplicity in mocks
      });
    }),

    reindexDocument: vi.fn().mockImplementation((id: string) => {
      const doc = mockDocuments.find(d => d.id === id);
      
      if (!doc) {
        return Promise.reject(new Error('Document not found'));
      }
      
      return Promise.resolve().then(() => {
        // Progress events simulation removed for simplicity in mocks
      });
    }),

    validateCorpus: vi.fn().mockImplementation(function() {
      // Using 'this' directly in callbacks to avoid this-alias lint error
      const totalDocs = mockDocuments.length;
      const validDocs = Math.floor(totalDocs * 0.9); // 90% valid
      const invalidDocs = totalDocs - validDocs;
      
      const result = {
        totalDocuments: totalDocs,
        valid: validDocs,
        invalid: invalidDocs,
        issues: Array.from({ length: invalidDocs }, (_, i) => ({
          documentId: `doc-invalid-${i}`,
          issues: ['Missing title', 'No content chunks', 'Invalid metadata']
        }))
      };
      
      // Validation progress events removed for simplicity in mocks
      
      return Promise.resolve(result);
    }),

    importDocument: vi.fn().mockImplementation((_file: File) => {
      return createMockAsyncOperation(undefined, { 
        delay: 500,
        failureRate: 0.1 // 10% failure rate for testing
      });
    }),

    searchDocuments: vi.fn().mockImplementation((query: string) => {
      const results = mockDocuments.filter(doc =>
        doc.title.toLowerCase().includes(query.toLowerCase()) ||
        doc.content.some(content =>
          content.content.toLowerCase().includes(query.toLowerCase())
        )
      );
      
      // Sort by relevance (mock scoring)
      results.sort((a, b) => {
        const scoreA = a.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
        const scoreB = b.title.toLowerCase().includes(query.toLowerCase()) ? 2 : 1;
        return scoreB - scoreA;
      });
      
      return createMockAsyncOperation(results, { delay: 80 });
    })
  });
}

/**
 * Mock QueryAnalyzer with performance tracking
 */
export function createMockQueryAnalyzer() {
  const mockQueries = Array.from({ length: 100 }, () => createMockQueryMetrics());
  
  return createMockService({
    trackQuery: vi.fn().mockImplementation((
      query: string,
      latency: number,
      success: boolean,
      legalArea?: string,
      relevanceScore?: number,
      cached?: boolean
    ) => {
      const queryMetrics = createMockQueryMetrics({
        query,
        latency,
        success,
        legalArea: legalArea as any,
        relevanceScore: relevanceScore || 0.8,
        cached: cached || false
      });
      
      mockQueries.unshift(queryMetrics);
      if (mockQueries.length > 1000) {
        mockQueries.pop();
      }
      
      return queryMetrics;
    }),

    getRecentQueries: vi.fn().mockImplementation((limit = 10) => {
      return mockQueries.slice(0, limit);
    }),

    getPerformanceReport: vi.fn().mockImplementation((startTime?: number, endTime?: number) => {
      const now = Date.now();
      const start = startTime || (now - 7 * 24 * 60 * 60 * 1000);
      const end = endTime || now;
      
      const filteredQueries = mockQueries.filter(q => 
        q.timestamp >= start && q.timestamp <= end
      );
      
      const report = createMockPerformanceReport({
        timeRange: { start, end },
        totalQueries: filteredQueries.length
      });
      
      return Promise.resolve(report);
    }),

    generateInsights: vi.fn().mockImplementation(() => {
      const insights = [
        {
          type: 'success',
          title: 'Excellent performance',
          description: 'Average latency is under 200ms',
          priority: 'low',
          actionRequired: false
        },
        {
          type: 'info',
          title: 'Cache optimization opportunity',
          description: 'Cache hit rate could be improved',
          priority: 'medium',
          actionRequired: false
        }
      ];
      
      return insights;
    }),

    clearHistory: vi.fn().mockImplementation(() => {
      mockQueries.length = 0;
      return Promise.resolve();
    }),

    exportQueryData: vi.fn().mockImplementation((startTime: number, endTime: number) => {
      const filteredQueries = mockQueries.filter(q => 
        q.timestamp >= startTime && q.timestamp <= endTime
      );
      
      const data = {
        exportDate: new Date().toISOString(),
        timeRange: { start: startTime, end: endTime },
        queries: filteredQueries
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
      });
      
      return blob;
    }),

    updateUserFeedback: vi.fn().mockImplementation((queryId: string, feedback: 'positive' | 'negative') => {
      const query = mockQueries.find(q => q.id === queryId);
      if (query) {
        query.userFeedback = feedback;
        query.userFeedbackTimestamp = Date.now();
      }
      return Promise.resolve();
    }),

    getQueryById: vi.fn().mockImplementation((queryId: string) => {
      return mockQueries.find(q => q.id === queryId) || null;
    }),

    getStatsByTimeInterval: vi.fn().mockImplementation((
      startTime: number, 
      endTime: number, 
      interval: 'hour' | 'day' = 'hour'
    ) => {
      const intervalMs = interval === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
      const stats = [];
      
      for (let time = startTime; time < endTime; time += intervalMs) {
        const queries = mockQueries.filter(q => 
          q.timestamp >= time && q.timestamp < time + intervalMs
        );
        
        stats.push({
          timestamp: time,
          count: queries.length,
          averageLatency: queries.length > 0 
            ? queries.reduce((sum, q) => sum + q.latency, 0) / queries.length 
            : 0,
          successRate: queries.length > 0
            ? queries.filter(q => q.success).length / queries.length
            : 0
        });
      }
      
      return stats;
    })
  });
}

/**
 * Mock QualityTestSuite with test execution
 */
export function createMockQualityTestSuite() {
  const availableTests: QualityTest[] = [
    {
      id: 'citation-accuracy',
      name: 'Citation Accuracy',
      description: 'Tests if the system correctly identifies and cites legal articles',
      category: 'citation',
      query: '¿Qué establece el artículo 123 constitucional?',
      expectedResults: [
        {
          type: 'contains_text',
          value: 'derecho al trabajo',
          description: 'Should contain labor rights text'
        },
        {
          type: 'legal_area',
          value: 'labor',
          description: 'Should identify as labor law'
        }
      ],
      timeout: 5000
    },
    {
      id: 'semantic-relevance',
      name: 'Semantic Relevance', 
      description: 'Tests semantic understanding of legal concepts',
      category: 'semantic',
      query: '¿Cuáles son las causas de despido justificado?',
      expectedResults: [
        {
          type: 'legal_area',
          value: 'labor',
          description: 'Should identify as labor law'
        }
      ],
      timeout: 10000
    },
    {
      id: 'cross-reference',
      name: 'Cross Reference',
      description: 'Tests ability to find related legal provisions',
      category: 'cross-reference',
      query: 'Tipos de amparo en México',
      expectedResults: [
        {
          type: 'document_count',
          value: 2,
          threshold: 4,
          description: 'Should find multiple related documents'
        }
      ],
      timeout: 12000
    },
    {
      id: 'performance-benchmark',
      name: 'Performance Benchmark',
      description: 'Tests query response time',
      category: 'performance',
      query: 'Salario mínimo México',
      expectedResults: [
        {
          type: 'max_latency',
          value: 5000,
          description: 'Should respond within 5 seconds'
        }
      ],
      timeout: 8000
    }
  ];

  return createMockService({
    initialize: vi.fn().mockResolvedValue(undefined),
    
    getAvailableTests: vi.fn().mockReturnValue(availableTests),
    
    getStoredResults: vi.fn().mockReturnValue([
      createMockTestSuiteResult({
        suiteName: 'Mexican Legal Quality Suite',
        totalTests: 4,
        passedTests: 3,
        averageScore: 0.85,
        totalDuration: 450,
        timestamp: Date.now(),
        results: []
      })
    ]),

    runTest: vi.fn().mockImplementation((testId: string) => {
      const test = availableTests.find(t => t.id === testId);
      if (!test) {
        return Promise.reject(new Error('Test not found'));
      }

      let result: TestResult;
      
      switch (test.category) {
        case 'citation':
          result = createMockTestResult({
            testId,
            passed: true,
            score: 0.95,
            duration: 1200,
            details: [
              {
                expectation: {
                  type: 'contains_text',
                  value: 'derecho al trabajo',
                  description: 'Should contain labor rights text'
                },
                passed: true,
                actualValue: 'Found: derecho al trabajo',
                score: 1.0,
                message: 'Text found successfully'
              }
            ]
          });
          break;
          
        case 'semantic':
          result = createMockTestResult({
            testId,
            passed: true,
            score: 0.85,
            duration: 1500,
            details: [
              {
                expectation: {
                  type: 'legal_area',
                  value: 'labor',
                  description: 'Should identify as labor law'
                },
                passed: true,
                actualValue: 'labor',
                score: 1.0,
                message: 'Legal area: labor (expected: labor)'
              }
            ]
          });
          break;
          
        case 'cross-reference':
          result = createMockTestResult({
            testId,
            passed: true,
            score: 0.88,
            duration: 1800,
            details: [
              {
                expectation: {
                  type: 'document_count',
                  value: 2,
                  threshold: 4,
                  description: 'Should find multiple related documents'
                },
                passed: true,
                actualValue: 3,
                score: 0.75,
                message: 'Documents found: 3 (minimum: 2)'
              }
            ]
          });
          break;
          
        case 'performance':
          result = createMockTestResult({
            testId,
            passed: true,
            score: 0.90,
            duration: 180,
            details: [
              {
                expectation: {
                  type: 'max_latency',
                  value: 5000,
                  description: 'Should respond within 5 seconds'
                },
                passed: true,
                actualValue: 180,
                score: 1.0,
                message: 'Response time: 180ms (max: 5000ms)'
              }
            ]
          });
          break;
          
        default:
          result = createMockTestResult({ testId });
      }
      
      return Promise.resolve(result);
    }),

    runAllTests: vi.fn().mockImplementation(function() {
      // Using 'this' directly in callbacks to avoid this-alias lint error
      
      const results = availableTests.map(test => createMockTestResult({ testId: test.id }));
      
      const suiteResult = createMockTestSuiteResult({
        suiteName: 'Mexican Legal Quality Suite',
        totalTests: availableTests.length,
        results,
        passedTests: results.filter(r => r.passed).length,
        averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
        totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
      });
      
      // Progress events removed for simplicity in mocks
      
      return Promise.resolve(suiteResult);
    }),

    runTestsByCategory: vi.fn().mockImplementation((category: string) => {
      const categoryTests = availableTests.filter(t => t.category === category);
      // Using 'this' directly in callbacks to avoid this-alias lint error
      
      if (categoryTests.length === 0) {
        return createMockAsyncOperation(createMockTestSuiteResult({
          suiteName: `${category} Tests`,
          totalTests: 0,
          results: [],
          passedTests: 0,
          averageScore: 0,
          totalDuration: 0
        }));
      }
      
      return createMockAsyncOperation(undefined, { delay: 50 })
        .then(async () => {
          const results: TestResult[] = [];
          
          for (const test of categoryTests) {
            // Create mock result inline to avoid 'this' context issues
            const result = createMockTestResult({
              testId: test.id,
              testName: test.name,
              passed: Math.random() > 0.3,
              score: 70 + Math.random() * 30
            });
            results.push(result);
          }
          
          return createMockTestSuiteResult({
            suiteName: `${category} Tests`,
            totalTests: categoryTests.length,
            results,
            passedTests: results.filter(r => r.passed).length,
            averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
            totalDuration: results.reduce((sum, r) => sum + r.duration, 0)
          });
        });
    }),

    exportResults: vi.fn().mockImplementation((suiteResult?: TestSuiteResult) => {
      const mockSuite = suiteResult || createMockTestSuiteResult();
      const failedTests = mockSuite.totalTests - mockSuite.passedTests;
      const markdown = `# Quality Test Report\n\n## Summary\n- **Total Tests**: ${mockSuite.totalTests}\n- **Passed**: ${mockSuite.passedTests}\n- **Failed**: ${failedTests}\n`;
      
      return Promise.resolve(new Blob([markdown], { type: 'text/markdown' }));
    })
  });
}

/**
 * Mock EmbeddingsService for vector operations
 */
export function createMockEmbeddingsService() {
  const mockVectors = Array.from({ length: 50 }, () => createMockVectorDocument());
  
  return createMockService({
    initialize: vi.fn().mockResolvedValue(undefined),
    
    getStats: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalVectors: 1000,
        storageSize: 5242880,
        averageGenerationTime: 50,
        modelsAvailable: ['transformers', 'openai', 'mock'],
        currentModel: 'transformers',
        indexStatus: 'ready'
      });
    }),

    switchProvider: vi.fn().mockImplementation((_provider: string) => {
      return Promise.resolve();
    }),

    generateAllEmbeddings: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalDocuments: 10,
        successfulDocuments: 10,
        failedDocuments: 0
      });
    }),

    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    generateEmbeddings: vi.fn().mockImplementation((documentId: string) => {
      return Promise.resolve({
        success: true,
        documentId,
        embeddingsGenerated: 25,
        duration: 1500,
        tokensPerSecond: 16.7
      });
    }),

    testProvider: vi.fn().mockImplementation((query: string) => {
      return Promise.resolve({
        success: true,
        provider: 'transformers',
        dimensions: 384,
        latency: 150,
        testQuery: query,
        responseTime: 150
      });
    }),

    clearEmbeddings: vi.fn().mockResolvedValue(undefined),

    search: vi.fn().mockImplementation((query: string, limit = 10) => {
      const results = mockVectors
        .slice(0, limit)
        .map(vec => ({ ...vec, score: Math.random() }))
        .sort((a, b) => b.score - a.score);
      
      return createMockAsyncOperation(results, { delay: 80 });
    }),

    addDocuments: vi.fn().mockImplementation((documents: any[]) => {
      return createMockAsyncOperation(undefined, { 
        delay: 200 * documents.length,
        failureRate: 0.02 // 2% failure rate
      });
    }),

    deleteDocument: vi.fn().mockImplementation((_documentId: string) => {
      return createMockAsyncOperation(undefined, { delay: 150 });
    }),

    getVectorStats: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalVectors: mockVectors.length,
        dimensions: 1536,
        indexSize: mockVectors.length * 1536 * 4, // 4 bytes per float
        lastUpdated: Date.now()
      });
    })
  });
}

/**
 * Mock AdminDataService for data management
 */
export function createMockAdminDataService() {
  return createMockService({
    // Mock private methods that are called internally
    getQueryHistory: vi.fn().mockReturnValue([]),
    
    getCorpusStats: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalDocuments: 125,
        documentsByType: {
          law: 45,
          code: 15,
          regulation: 35,
          constitution: 1,
          jurisprudence: 20,
          treaty: 5,
          norm: 4
        },
        documentsByArea: {
          labor: 25,
          civil: 20,
          criminal: 18,
          tax: 15,
          commercial: 12,
          constitutional: 10,
          administrative: 15,
          environmental: 5,
          family: 3,
          property: 2
        },
        totalSize: 15728640, // ~15MB
        lastUpdated: Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
        totalChunks: 2500,
        lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      });
    }),

    getEmbeddingsStats: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalVectors: 2500,
        dimensions: 1536,
        indexSize: 2500 * 1536 * 4,
        averageQueryTime: 85,
        cacheHitRate: 0.35,
        lastReindexed: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        storageSize: 5242880,
        averageGenerationTime: 50,
        modelsAvailable: ['transformers', 'openai', 'mock'],
        currentModel: 'transformers',
        indexStatus: 'ready'
      });
    }),

    getQualityStats: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalQueries: 100,
        failedQueries: 5,
        averageLatency: 150,
        cacheHitRate: 45.5,
        retrievalAccuracy: 85.5,
        corpusCoverage: 92.3,
        userSatisfaction: 4.2
      });
    }),

    exportCorpus: vi.fn().mockImplementation(() => {
      return Promise.resolve(new Blob(['corpus data'], { type: 'application/json' }));
    }),

    clearEmbeddingsCache: vi.fn().mockImplementation(() => {
      return Promise.resolve();
    }),

    rebuildIndex: vi.fn().mockImplementation(() => {
      return Promise.resolve();
    }),
    
    logQuery: vi.fn().mockImplementation((_latency: number, _failed: boolean, _cached: boolean) => {
      // Mock implementation - just return void
      return;
    }),

    getSystemHealth: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        status: 'healthy',
        uptime: Date.now() - (5 * 24 * 60 * 60 * 1000), // 5 days
        memory: {
          used: 45678901,
          available: 123456789,
          percentage: 37
        },
        storage: {
          used: 156789012,
          available: 987654321,
          percentage: 16
        },
        services: {
          corpus: 'running',
          embeddings: 'running',
          search: 'running',
          cache: 'running'
        }
      });
    })
  });
}

/**
 * EventEmitter utilities for mocking event-driven services
 */
export function createMockEventEmitterUtils() {
  return {
    captureEvents: (emitter: EventEmitter, eventName: string, timeout = 1000) => {
      const events: any[] = [];
      
      return new Promise<any[]>((resolve) => {
        const handler = (event: any) => events.push(event);
        emitter.on(eventName, handler);
        
        setTimeout(() => {
          emitter.off(eventName, handler);
          resolve(events);
        }, timeout);
      });
    },

    waitForEvent: (emitter: EventEmitter, eventName: string, timeout = 1000) => {
      return new Promise<any>((resolve, reject) => {
        const handler = (event: any) => {
          emitter.off(eventName, handler);
          resolve(event);
        };
        
        emitter.on(eventName, handler);
        
        setTimeout(() => {
          emitter.off(eventName, handler);
          reject(new Error(`Event ${eventName} not received within ${timeout}ms`));
        }, timeout);
      });
    },

    emitSequence: async (emitter: EventEmitter, events: Array<{ event: string; data: any; delay?: number }>) => {
      for (const { event, data, delay = 0 } of events) {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        emitter.emit(event, data);
      }
    }
  };
}

/**
 * Mock LegalRAGEngine for quality testing
 */
export function createMockLegalRAGEngine() {
  const mockSearchResult = {
    answer: 'Test answer about Mexican law',
    sources: [
      {
        id: 'doc1',
        content: 'Article 123 constitucional establishes labor rights',
        score: 0.9,
        metadata: {
          documentTitle: 'Constitution',
          legalArea: 'constitutional'
        }
      }
    ],
    confidence: 0.85,
    legalArea: 'constitutional' as any, // Allow changing in mocks
    queryType: 'citation' as any, // Allow changing in mocks
    timestamp: Date.now(),
    processingTime: 150
  };

  return createMockService({
    initialize: vi.fn().mockResolvedValue(undefined),
    
    search: vi.fn().mockImplementation(async (query: string, _options?: any) => {
      // Simulate processing time based on query complexity
      const processingTime = Math.max(50, Math.min(300, query.length * 2));
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      // Customize response based on query content
      const customizedResult = { ...mockSearchResult };
      
      if (query.includes('123')) {
        customizedResult.sources = [{
          id: 'constitution-art-123',
          content: 'El artículo 123 de la Constitución establece los derechos laborales',
          score: 0.95,
          metadata: {
            documentTitle: 'Constitución Política de los Estados Unidos Mexicanos',
            legalArea: 'labor'
          }
        }];
        customizedResult.legalArea = 'labor';
      }
      
      if (query.includes('despido')) {
        customizedResult.sources = [{
          id: 'lft-art-47',
          content: 'Son causas de rescisión de la relación de trabajo, sin responsabilidad para el patrón',
          score: 0.88,
          metadata: {
            documentTitle: 'Ley Federal del Trabajo',
            legalArea: 'labor'
          }
        }];
        customizedResult.legalArea = 'labor';
      }
      
      if (query.includes('amparo')) {
        customizedResult.sources = [
          {
            id: 'amparo-direct',
            content: 'Amparo directo ante tribunales colegiados',
            score: 0.9,
            metadata: { documentTitle: 'Ley de Amparo', legalArea: 'constitutional' }
          },
          {
            id: 'amparo-indirect',
            content: 'Amparo indirecto ante juzgados de distrito',
            score: 0.85,
            metadata: { documentTitle: 'Ley de Amparo', legalArea: 'constitutional' }
          }
        ];
      }
      
      customizedResult.processingTime = processingTime;
      customizedResult.timestamp = Date.now();
      
      return customizedResult;
    }),
    
    getConfig: vi.fn().mockReturnValue({
      corpusPath: '/legal-corpus/',
      embeddingsPath: '/embeddings/',
      chunkSize: 512,
      chunkOverlap: 50,
      vectorDimensions: 1536,
      similarityThreshold: 0.7,
      maxResults: 5
    }),
    
    setConfig: vi.fn().mockResolvedValue(undefined),
    
    getStatus: vi.fn().mockReturnValue({
      initialized: true,
      documentsLoaded: 125,
      vectorsLoaded: 2500,
      lastUpdate: Date.now() - 60000
    }),
    
    reloadCorpus: vi.fn().mockImplementation(async () => {
      // Progress events removed for simplicity in mocks
      await new Promise(resolve => setTimeout(resolve, 200));
    }),
    
    clearCache: vi.fn().mockResolvedValue(undefined),
    
    getCacheStats: vi.fn().mockReturnValue({
      size: 45,
      hits: 234,
      misses: 67,
      hitRate: 0.78
    })
  });
}

/**
 * Async operation mocking helpers
 */
export function createMockAsyncHelpers() {
  return {
    delay: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
    
    withTimeout: <T>(promise: Promise<T>, timeoutMs: number) => {
      return Promise.race([
        promise,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
        )
      ]);
    },
    
    retry: async <T>(
      operation: () => Promise<T>,
      maxAttempts = 3,
      delay = 100
    ): Promise<T> => {
      let lastError: Error;
      
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          return await operation();
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, delay * attempt));
          }
        }
      }
      
      throw lastError!;
    }
  };
}