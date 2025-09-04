/**
 * Mock Infrastructure Index
 * Central export point for all mock utilities, factories, and helpers
 */
import { vi } from 'vitest';

// Export all factory functions
export {
  createMockService,
  createMockDocument,
  createMockQueryMetrics,
  createMockTestResult,
  createMockTestSuiteResult,
  createMockEmbedding,
  createMockVectorDocument,
  createMockDocumentMetrics,
  createMockPerformanceReport,
  createMockLegalContent,
  createMockError,
  createMockAsyncOperation,
  createMockBatchOperation
} from './factories';

// Export all service mocks
export {
  createMockCorpusService,
  createMockQueryAnalyzer,
  createMockQualityTestSuite,
  createMockEmbeddingsService,
  createMockAdminDataService,
  createMockLegalRAGEngine,
  createMockEventEmitterUtils,
  createMockAsyncHelpers
} from './service-mocks';

// Export auto-mocking utilities
export {
  autoMockService,
  spyOnAllMethods,
  resetAllMocks,
  validateMockCalls,
  createSequenceMock,
  createConditionalMock,
  createMockFactory,
  mockGenerators,
  testHelpers,
  type AutoMockConfig,
  type MockCallTracker
} from './auto-mock';

// Re-export fixture data for convenience
export { default as legalDocumentsFixture } from '../fixtures/legal-documents.json';
export { default as queryMetricsFixture } from '../fixtures/query-metrics.json';
export { default as testResultsFixture } from '../fixtures/test-results.json';
export { default as embeddingsFixture } from '../fixtures/embeddings.json';

/**
 * Quick setup function for common test scenarios
 */
export function setupTestEnvironment(config: {
  mockLocalStorage?: boolean;
  mockConsole?: boolean;
  mockFetch?: boolean;
  resetBetweenTests?: boolean;
} = {}) {
  const {
    mockLocalStorage = true,
    mockConsole = false,
    mockFetch = false,
    resetBetweenTests = true
  } = config;

  if (mockLocalStorage) {
    const createMockStorage = () => {
      const data = new Map<string, string>();
      return {
        data,
        getItem: vi.fn((key: string) => data.get(key) || null),
        setItem: vi.fn((key: string, value: string) => data.set(key, value)),
        removeItem: vi.fn((key: string) => data.delete(key)),
        clear: vi.fn(() => data.clear()),
        length: 0,
        key: vi.fn()
      };
    };
    global.localStorage = createMockStorage() as any;
    global.sessionStorage = createMockStorage() as any;
  }

  if (mockConsole) {
    global.console = {
      ...console,
      log: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      info: vi.fn()
    };
  }

  if (mockFetch) {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
      text: vi.fn().mockResolvedValue(''),
      blob: vi.fn().mockResolvedValue(new Blob()),
      headers: new Headers()
    } as any);
  }

  if (resetBetweenTests) {
    return {
      beforeEach: () => {
        if (mockLocalStorage) {
          (global.localStorage as any).data.clear();
          (global.sessionStorage as any).data.clear();
        }
        resetAllMocks();
      },
      afterEach: () => {
        resetAllMocks();
      }
    };
  }

  return {};
}

/**
 * Test utilities for common assertions
 */
export const testAssertions = {
  /**
   * Assert that a mock service has the expected interface
   */
  assertMockServiceInterface<T>(service: T, expectedMethods: (keyof T)[]) {
    expectedMethods.forEach(method => {
      expect(typeof service[method]).toBe('function');
    });
  },

  /**
   * Assert that async operations have realistic timing
   */
  async assertRealisticTiming(operation: () => Promise<any>, minMs = 10, maxMs = 5000) {
    const start = Date.now();
    await operation();
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(minMs);
    expect(duration).toBeLessThanOrEqual(maxMs);
  },

  /**
   * Assert that an array of results has consistent structure
   */
  assertConsistentStructure<T>(results: T[], requiredKeys: (keyof T)[]) {
    expect(results.length).toBeGreaterThan(0);
    
    results.forEach((result, index) => {
      requiredKeys.forEach(key => {
        expect(result).toHaveProperty(key);
      });
    });
  },

  /**
   * Assert that a mock was called with expected patterns
   */
  assertMockCallPattern(mockFn: any, patterns: Array<{
    args?: any[];
    times?: number;
    nthCall?: number;
  }>) {
    patterns.forEach(pattern => {
      if (pattern.times !== undefined) {
        expect(mockFn).toHaveBeenCalledTimes(pattern.times);
      }
      
      if (pattern.args !== undefined) {
        expect(mockFn).toHaveBeenCalledWith(...pattern.args);
      }
      
      if (pattern.nthCall !== undefined && pattern.args !== undefined) {
        expect(mockFn).toHaveBeenNthCalledWith(pattern.nthCall, ...pattern.args);
      }
    });
  }
};

/**
 * Performance testing utilities
 */
export const performanceUtils = {
  /**
   * Measure average execution time over multiple runs
   */
  async measureAverageTime(operation: () => Promise<any>, runs = 10): Promise<number> {
    const times: number[] = [];
    
    for (let i = 0; i < runs; i++) {
      const start = Date.now();
      await operation();
      times.push(Date.now() - start);
    }
    
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  },

  /**
   * Test concurrent operations
   */
  async testConcurrency<T>(operation: () => Promise<T>, concurrency = 5): Promise<T[]> {
    const promises = Array.from({ length: concurrency }, () => operation());
    return Promise.all(promises);
  },

  /**
   * Test operation with timeout
   */
  async testWithTimeout<T>(operation: () => Promise<T>, timeoutMs = 5000): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }
};

/**
 * Data generation utilities for testing
 */
export const dataGenerators = {
  /**
   * Generate test data for legal documents
   */
  generateLegalDocuments(count: number) {
    return Array.from({ length: count }, (_, i) => 
      createMockDocument({
        id: `doc-${i}`,
        title: `Documento Legal ${i + 1}`
      })
    );
  },

  /**
   * Generate test query metrics
   */
  generateQueryMetrics(count: number) {
    return Array.from({ length: count }, (_, i) => 
      createMockQueryMetrics({
        id: `query-${i}`,
        query: `Consulta legal ${i + 1}`,
        timestamp: Date.now() - (i * 1000)
      })
    );
  },

  /**
   * Generate test results for quality testing
   */
  generateTestResults(count: number) {
    return Array.from({ length: count }, (_, i) => 
      createMockTestResult({
        testId: `test-${i}`,
        passed: Math.random() > 0.2 // 80% pass rate
      })
    );
  }
};

/**
 * Common test patterns and helpers
 */
export const commonPatterns = {
  /**
   * Test a service's full lifecycle
   */
  async testServiceLifecycle(service: any) {
    // Initialize
    if (typeof service.initialize === 'function') {
      await service.initialize();
    }
    
    // Test basic operations
    if (typeof service.getStatus === 'function') {
      const status = service.getStatus();
      expect(status).toBeDefined();
    }
    
    // Cleanup
    if (typeof service.destroy === 'function') {
      await service.destroy();
    }
  },

  /**
   * Test error handling patterns
   */
  async testErrorHandling(operation: () => Promise<any>, expectedErrorTypes: string[] = []) {
    try {
      await operation();
      // If we reach here, the operation didn't throw as expected
      if (expectedErrorTypes.length > 0) {
        throw new Error('Expected operation to throw an error');
      }
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      
      if (expectedErrorTypes.length > 0) {
        const errorMessage = (error as Error).message.toLowerCase();
        const matchesExpectedType = expectedErrorTypes.some(type => 
          errorMessage.includes(type.toLowerCase())
        );
        expect(matchesExpectedType).toBe(true);
      }
    }
  },

  /**
   * Test event emission patterns
   */
  async testEventEmission(
    emitter: any, 
    operation: () => Promise<any>,
    expectedEvents: string[]
  ) {
    const capturedEvents: { event: string; data: any }[] = [];
    
    // Set up event listeners
    expectedEvents.forEach(eventName => {
      emitter.on(eventName, (data: any) => {
        capturedEvents.push({ event: eventName, data });
      });
    });
    
    // Execute operation
    await operation();
    
    // Validate events
    expectedEvents.forEach(eventName => {
      const found = capturedEvents.some(captured => captured.event === eventName);
      expect(found).toBe(true);
    });
    
    return capturedEvents;
  }
};