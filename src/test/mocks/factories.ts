/**
 * Mock factories for creating test data and service mocks
 * Provides type-safe factory functions for commonly used test objects
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';
import type { 
  LegalDocument, 
  LegalArea, 
  DocumentType, 
  LegalHierarchy,
  LegalContent,
  QueryMetrics,
  PerformanceReport,
  DocumentMetrics
} from '@/types';

// Import the correct types from quality-test-suite
import type {
  TestResult,
  TestSuiteResult,
  TestResultDetail,
  TestExpectation
} from '@/lib/admin/quality-test-suite';

/**
 * Generic service mocker with EventEmitter support
 */
export function createMockService<T extends object>(
  methods: Partial<T> = {},
  withEventEmitter = true
): T & EventEmitter {
  const mockService = withEventEmitter ? new EventEmitter() : {};
  
  // Add default mock implementations for common service methods
  const defaultMethods = {
    initialize: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    isInitialized: vi.fn().mockReturnValue(true),
    getStatus: vi.fn().mockReturnValue('ready')
  };

  Object.assign(mockService, defaultMethods, methods);
  
  return mockService as T & EventEmitter;
}

/**
 * Legal document factory with realistic Mexican legal data
 */
export function createMockDocument(overrides: Partial<LegalDocument> = {}): LegalDocument {
  const defaultDocument: LegalDocument = {
    id: `doc-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Ley Federal del Trabajo',
    shortTitle: 'LFT',
    type: 'law' as DocumentType,
    hierarchy: 3 as LegalHierarchy,
    primaryArea: 'labor' as LegalArea,
    secondaryAreas: [],
    
    // Publication info
    authority: 'Congreso de la Unión',
    publicationDate: '1970-04-01',
    lastReform: '2023-07-28',
    status: 'active',
    
    // Scope
    territorialScope: 'federal',
    applicability: 'Todas las relaciones de trabajo en territorio nacional',
    
    // Content
    content: [
      {
        id: 'art-1',
        type: 'article',
        number: '1',
        title: 'Disposiciones generales',
        content: 'Las disposiciones de esta Ley son de orden público e interés social, por lo que no podrá renunciarse a los beneficios que otorga.',
        embedding: Array.from({ length: 1536 }, () => Math.random()),
        chunkIndex: 0
      },
      {
        id: 'art-47',
        type: 'article', 
        number: '47',
        title: 'Causas de rescisión sin responsabilidad para el patrón',
        content: 'Son causas de rescisión de la relación de trabajo, sin responsabilidad para el patrón: I. Engañarlo el trabajador o en su caso, el sindicato que lo hubiese propuesto o recomendado...',
        embedding: Array.from({ length: 1536 }, () => Math.random()),
        chunkIndex: 1
      }
    ],
    
    // Metadata
    officialUrl: 'https://www.diputados.gob.mx/LeyesBiblio/pdf/125_280723.pdf',
    relatedDependencies: [],
    importance: 'critical',
    updateFrequency: 'medium'
  };

  return { ...defaultDocument, ...overrides };
}

/**
 * Query metrics factory for performance testing
 */
export function createMockQueryMetrics(overrides: Partial<QueryMetrics> = {}): QueryMetrics {
  const defaultMetrics: QueryMetrics = {
    id: `query-${Math.random().toString(36).substr(2, 9)}`,
    query: '¿Cuáles son las causas de despido justificado?',
    timestamp: Date.now(),
    
    // Performance metrics
    latency: 150 + Math.random() * 100, // 150-250ms
    success: true,
    cached: Math.random() > 0.7, // 30% cache hit rate
    
    // Quality metrics
    relevanceScore: 0.7 + Math.random() * 0.3, // 0.7-1.0
    documentCount: Math.floor(Math.random() * 10) + 1,
    confidence: 0.6 + Math.random() * 0.4, // 0.6-1.0
    
    // Classification
    legalArea: 'labor' as LegalArea,
    queryType: 'procedural',
    complexity: Math.random(),
    
    // User feedback
    userFeedback: null,
    userFeedbackTimestamp: undefined,
    
    // Context
    sessionId: `session-${Math.random().toString(36).substr(2, 9)}`,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    ipHash: 'sha256hash'
  };

  return { ...defaultMetrics, ...overrides };
}

/**
 * Test result factory for quality testing
 */
export function createMockTestResult(overrides: Partial<TestResult> = {}): TestResult {
  const mockDetails: TestResultDetail[] = [
    {
      expectation: {
        type: 'contains_text',
        value: 'derecho al trabajo',
        description: 'Should contain labor rights text'
      } as TestExpectation,
      passed: true,
      actualValue: 'Found: derecho al trabajo',
      score: 1.0,
      message: 'Text found successfully'
    }
  ];

  const defaultResult: TestResult = {
    testId: `test-${Math.random().toString(36).substr(2, 9)}`,
    passed: Math.random() > 0.2, // 80% pass rate
    score: Math.random(),
    duration: Math.floor(Math.random() * 1000) + 100, // 100-1100ms
    details: mockDetails,
    timestamp: Date.now(),
    response: {
      answer: 'Test response about Mexican legal provisions',
      confidence: 0.85,
      sources: [{
        id: 'doc1',
        title: 'Constitution',
        excerpt: 'Test excerpt',
        relevanceScore: 0.9,
        metadata: { documentTitle: 'Constitution', legalArea: 'constitutional' }
      }],
      legalArea: 'constitutional' as LegalArea,
      queryType: 'citation',
      fromCache: false,
      processingTime: 150,
      timestamp: Date.now()
    }
  };

  return { ...defaultResult, ...overrides };
}

/**
 * Test suite result factory
 */
export function createMockTestSuiteResult(overrides: Partial<TestSuiteResult> = {}): TestSuiteResult {
  const results = overrides.results || Array.from({ length: 10 }, () => createMockTestResult());
  const passedTests = results.filter(r => r.passed).length;
  const averageScore = results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const defaultSuiteResult: TestSuiteResult = {
    suiteName: 'Mexican Legal Quality Suite',
    totalTests: results.length,
    passedTests,
    averageScore,
    totalDuration,
    timestamp: Date.now(),
    results
  };

  return { ...defaultSuiteResult, ...overrides };
}

/**
 * Embedding data factory for vector operations
 */
export function createMockEmbedding(dimensions = 1536): number[] {
  return Array.from({ length: dimensions }, () => Math.random() * 2 - 1); // -1 to 1
}

/**
 * Vector document factory for search operations
 */
export function createMockVectorDocument(overrides: Partial<any> = {}) {
  const defaultVectorDoc = {
    id: `vec-${Math.random().toString(36).substr(2, 9)}`,
    content: 'Las disposiciones de esta Ley son de orden público e interés social.',
    embedding: createMockEmbedding(),
    metadata: {
      documentId: 'doc-lft',
      documentTitle: 'Ley Federal del Trabajo',
      legalArea: 'labor',
      type: 'article',
      number: '1',
      hierarchy: 3
    },
    score: Math.random() // For search results
  };

  return { ...defaultVectorDoc, ...overrides };
}

/**
 * Document metrics factory for corpus management
 */
export function createMockDocumentMetrics(overrides: Partial<DocumentMetrics> = {}): DocumentMetrics {
  const defaultMetrics: DocumentMetrics = {
    id: `doc-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Código Civil Federal',
    type: 'code' as DocumentType,
    legalArea: 'civil' as LegalArea,
    chunks: Math.floor(Math.random() * 100) + 10,
    embeddings: Math.floor(Math.random() * 100) + 10,
    lastUpdated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
    size: Math.floor(Math.random() * 1000000) + 50000, // 50KB - 1MB
    quality: Math.floor(Math.random() * 40) + 60 // 60-100
  };

  return { ...defaultMetrics, ...overrides };
}

/**
 * Performance report factory with realistic data
 */
export function createMockPerformanceReport(overrides: Partial<PerformanceReport> = {}): PerformanceReport {
  const endTime = Date.now();
  const startTime = endTime - (24 * 60 * 60 * 1000); // 24 hours ago
  const totalQueries = Math.floor(Math.random() * 1000) + 100;
  const successfulQueries = Math.floor(totalQueries * (0.8 + Math.random() * 0.15)); // 80-95% success
  
  const defaultReport: PerformanceReport = {
    timeRange: {
      start: startTime,
      end: endTime
    },
    totalQueries,
    successfulQueries,
    
    // Performance metrics
    averageLatency: 150 + Math.random() * 100,
    medianLatency: 120 + Math.random() * 80,
    p95Latency: 300 + Math.random() * 200,
    cacheHitRate: Math.random() * 40 + 10, // 10-50%
    
    // Quality metrics
    averageRelevance: 0.7 + Math.random() * 0.25,
    averageConfidence: 0.65 + Math.random() * 0.3,
    userSatisfactionRate: 0.75 + Math.random() * 0.2,
    
    // Error analysis
    errorRate: Math.random() * 15 + 2, // 2-17%
    errorBreakdown: {
      timeout: Math.random() * 5,
      llm_error: Math.random() * 3,
      retrieval_error: Math.random() * 4,
      parsing_error: Math.random() * 2,
      unknown: Math.random() * 1
    },
    
    // Usage patterns
    queryTypeDistribution: {
      citation: Math.floor(Math.random() * 100),
      procedural: Math.floor(Math.random() * 150),
      conceptual: Math.floor(Math.random() * 120),
      analytical: Math.floor(Math.random() * 80),
      comparative: Math.floor(Math.random() * 60),
      interpretation: Math.floor(Math.random() * 90),
      analysis: Math.floor(Math.random() * 70),
      advice: Math.floor(Math.random() * 40),
      definition: Math.floor(Math.random() * 110),
      procedure: Math.floor(Math.random() * 95),
      general: Math.floor(Math.random() * 85),
      'document analysis': Math.floor(Math.random() * 30)
    },
    
    legalAreaDistribution: {
      constitutional: Math.floor(Math.random() * 50),
      civil: Math.floor(Math.random() * 80),
      criminal: Math.floor(Math.random() * 60),
      labor: Math.floor(Math.random() * 90),
      tax: Math.floor(Math.random() * 70),
      commercial: Math.floor(Math.random() * 55),
      administrative: Math.floor(Math.random() * 45),
      environmental: Math.floor(Math.random() * 25),
      family: Math.floor(Math.random() * 65),
      property: Math.floor(Math.random() * 40),
      migration: Math.floor(Math.random() * 20),
      'human-rights': Math.floor(Math.random() * 30)
    },
    
    complexityDistribution: {
      low: Math.floor(Math.random() * 200),
      medium: Math.floor(Math.random() * 150),
      high: Math.floor(Math.random() * 100)
    },
    
    // Trending
    popularQueries: [
      { query: '¿Cuáles son las causas de despido?', count: 45, averageRelevance: 0.92 },
      { query: 'Artículo 123 constitucional', count: 38, averageRelevance: 0.95 },
      { query: '¿Cómo tramitar un divorcio?', count: 32, averageRelevance: 0.87 },
      { query: 'Salario mínimo México', count: 28, averageRelevance: 0.89 },
      { query: '¿Qué es el amparo?', count: 25, averageRelevance: 0.91 }
    ],
    
    // Time-based analysis
    hourlyDistribution: Object.fromEntries(
      Array.from({ length: 24 }, (_, i) => [
        i.toString(),
        Math.floor(Math.random() * 50) + (i >= 9 && i <= 17 ? 20 : 5) // Higher during business hours
      ])
    ),
    
    dailyTrends: Array.from({ length: 7 }, (_, i) => ({
      date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      queries: Math.floor(Math.random() * 200) + 100,
      averageLatency: 140 + Math.random() * 60,
      successRate: 0.85 + Math.random() * 0.1
    }))
  };

  return { ...defaultReport, ...overrides };
}

/**
 * Legal content factory for creating document chunks
 */
export function createMockLegalContent(overrides: Partial<LegalContent> = {}): LegalContent {
  const articles = [
    { number: '1', content: 'Las disposiciones de esta Ley son de orden público e interés social.' },
    { number: '47', content: 'Son causas de rescisión de la relación de trabajo, sin responsabilidad para el patrón...' },
    { number: '123', content: 'Toda persona tiene derecho al trabajo digno y socialmente útil.' },
    { number: '2', content: 'Las normas del trabajo tienden a conseguir el equilibrio entre los factores de la producción.' }
  ];
  
  const randomArticle = articles[Math.floor(Math.random() * articles.length)];
  
  const defaultContent: LegalContent = {
    id: `content-${Math.random().toString(36).substr(2, 9)}`,
    type: 'article',
    number: randomArticle.number,
    title: `Artículo ${randomArticle.number}`,
    content: randomArticle.content,
    embedding: createMockEmbedding(),
    chunkIndex: Math.floor(Math.random() * 100)
  };

  return { ...defaultContent, ...overrides };
}

/**
 * Error factory for testing error scenarios
 */
export function createMockError(message = 'Mock error', type = 'Error'): Error {
  const error = new Error(message);
  error.name = type;
  return error;
}

/**
 * Async operation factory that can simulate delays and failures
 */
export function createMockAsyncOperation<T>(
  result: T,
  options: {
    delay?: number;
    failureRate?: number;
    error?: Error;
  } = {}
): Promise<T> {
  const { delay = 0, failureRate = 0, error = new Error('Operation failed') } = options;
  
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < failureRate) {
        reject(error);
      } else {
        resolve(result);
      }
    }, delay);
  });
}

/**
 * Batch operation factory for testing bulk operations
 */
export function createMockBatchOperation<T>(
  items: T[],
  processor: (item: T) => Promise<any>,
  options: {
    batchSize?: number;
    delay?: number;
    failureRate?: number;
  } = {}
): Promise<any[]> {
  const { batchSize = 5, delay = 10, failureRate = 0 } = options;
  const results: any[] = [];
  
  return new Promise(async (resolve, reject) => {
    try {
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchResults = await Promise.all(
          batch.map(item => 
            createMockAsyncOperation(
              processor(item),
              { delay, failureRate }
            )
          )
        );
        results.push(...batchResults);
      }
      resolve(results);
    } catch (error) {
      reject(error);
    }
  });
}