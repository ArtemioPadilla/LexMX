/**
 * Global test setup for Vitest
 * Sets up @testing-library/jest-dom matchers, mocks, and global test utilities
 */

import '@testing-library/jest-dom';
import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Mock admin services globally - must be at top level
vi.mock('../lib/admin/embeddings-service', () => {
  const mockEmbeddingsService = {
    initialize: vi.fn().mockResolvedValue(undefined),
    generateEmbeddings: vi.fn().mockImplementation((documentId: string) => {
      return Promise.resolve({
        success: true,
        documentId,
        embeddingsGenerated: 25,
        duration: 1500,
        tokensPerSecond: 16.7
      });
    }),
    generateAllEmbeddings: vi.fn().mockImplementation(() => {
      return Promise.resolve({
        totalDocuments: 10,
        successfulDocuments: 8,
        failedDocuments: 2,
        errors: [],
        averageDuration: 1500,
        totalDuration: 15000
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
    getStats: vi.fn().mockResolvedValue({
      totalVectors: 1000,
      storageSize: 5242880,
      averageGenerationTime: 50,
      modelsAvailable: ['transformers', 'openai', 'mock'],
      currentModel: 'transformers',
      indexStatus: 'ready'
    }),
    switchProvider: vi.fn().mockResolvedValue(undefined),
    clearEmbeddings: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  };

  return {
    EmbeddingsService: vi.fn().mockImplementation(() => mockEmbeddingsService),
    embeddingsService: mockEmbeddingsService
  };
});

vi.mock('../lib/admin/quality-test-suite', () => {
  const mockQualityTestSuite = {
    initialize: vi.fn().mockResolvedValue(undefined),
    getAvailableTests: vi.fn().mockReturnValue([
      {
        id: 'citation-accuracy',
        name: 'Citation Accuracy',
        description: 'Tests if the system correctly identifies and cites legal articles',
        category: 'citation',
        query: '¿Qué establece el artículo 123 constitucional?',
        expectedResults: [],
        timeout: 5000
      }
    ]),
    runTest: vi.fn().mockImplementation((testId: string) => {
      return Promise.resolve({
        testId,
        passed: true,
        score: 0.95,
        duration: 1200,
        details: [],
        timestamp: Date.now()
      });
    }),
    runAllTests: vi.fn().mockResolvedValue({
      suiteName: 'Mexican Legal Quality Suite',
      totalTests: 4,
      passedTests: 3,
      failedTests: 1,
      averageScore: 0.85,
      totalDuration: 4500,
      timestamp: Date.now(),
      results: []
    }),
    runTestsByCategory: vi.fn().mockResolvedValue({
      suiteName: 'Category Tests',
      totalTests: 2,
      passedTests: 2,
      failedTests: 0,
      averageScore: 0.90,
      totalDuration: 2500,
      timestamp: Date.now(),
      results: []
    }),
    getStoredResults: vi.fn().mockReturnValue([])
  };

  return {
    QualityTestSuite: vi.fn().mockImplementation(() => mockQualityTestSuite),
    qualityTestSuite: mockQualityTestSuite
  };
});

vi.mock('../lib/admin/data-service', () => {
  const mockAdminDataService = {
    getQueryHistory: vi.fn().mockReturnValue([]),
    getCorpusStats: vi.fn().mockResolvedValue({
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
      totalSize: 15728640,
      lastUpdated: Date.now() - 24 * 60 * 60 * 1000,
      totalChunks: 2500,
      lastUpdate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }),
    getEmbeddingsStats: vi.fn().mockResolvedValue({
      totalVectors: 2500,
      dimensions: 1536,
      indexSize: 2500 * 1536 * 4,
      averageQueryTime: 85,
      cacheHitRate: 0.35,
      lastReindexed: Date.now() - 7 * 24 * 60 * 60 * 1000,
      storageSize: 5242880,
      averageGenerationTime: 50,
      modelsAvailable: ['transformers', 'openai', 'mock'],
      currentModel: 'transformers',
      indexStatus: 'ready'
    }),
    getQualityStats: vi.fn().mockResolvedValue({
      totalQueries: 100,
      failedQueries: 5,
      averageLatency: 150,
      cacheHitRate: 45.5,
      retrievalAccuracy: 85.5,
      corpusCoverage: 92.3,
      userSatisfaction: 4.2
    })
  };

  return {
    AdminDataService: vi.fn().mockImplementation(() => mockAdminDataService),
    adminDataService: mockAdminDataService
  };
});

// Extend Vitest's expect with jest-dom matchers
// Using module declaration instead of namespace
declare module 'vitest' {
  interface Assertion<T = any> extends jest.Matchers<void, T> {}
  interface AsymmetricMatchersContaining extends jest.AsymmetricMatchers {}
}

// Mock global fetch for Node.js environment
global.fetch = vi.fn((_url, _options) => {
  // Default mock response
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve({ data: 'mocked' }),
    text: () => Promise.resolve('mocked text'),
    blob: () => Promise.resolve(new Blob(['mocked blob'])),
    headers: new Headers(),
  } as Response);
}) as jest.MockedFunction<typeof fetch>;

// Mock Astro-specific globals and features
beforeEach(() => {
  // Reset fetch mock for each test
  vi.mocked(global.fetch).mockClear();
  
  // Clean up DOM
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  
  // Ensure proper DOM structure for React 18
  if (!document.body) {
    document.body = document.createElement('body');
    document.documentElement.appendChild(document.body);
  }
  
  // Create a test container div for React to mount to
  const testContainer = document.createElement('div');
  testContainer.id = 'test-root';
  document.body.appendChild(testContainer);
  // Mock URL constructor first
  if (!global.URL) {
    global.URL = class MockURL {
      constructor(public href: string, _base?: string | URL) {
        this.href = href;
      }
      toString() { return this.href; }
    } as typeof URL;
  }

  // Mock Request constructor
  if (!global.Request) {
    global.Request = class MockRequest {
      constructor(public url: string, _init?: RequestInit) {
        this.url = url;
      }
    } as typeof Request;
  }

  // Mock Astro global
  global.Astro = {
    url: { href: 'http://localhost:3000', toString: () => 'http://localhost:3000' } as URL,
    params: {},
    request: { url: 'http://localhost:3000' } as Request,
    site: { href: 'http://localhost:3000', toString: () => 'http://localhost:3000' } as URL,
    generator: 'Astro v4.0.0',
    slots: {}
  };

  // Mock Astro client directives
  global.__astro_client_only = vi.fn();
  global.__astro_client_load = vi.fn();
  global.__astro_client_idle = vi.fn();
  global.__astro_client_visible = vi.fn();
  global.__astro_client_media = vi.fn();

  // Mock hydration state for islands
  Object.defineProperty(window, '__astro_island_state', {
    value: new Map(),
    writable: true
  });

  // Mock import.meta for Vite/Astro
  Object.defineProperty(global, 'import', {
    value: {
      meta: {
        env: {
          DEV: true,
          PROD: false,
          SSR: false,
          MODE: 'test'
        },
        url: 'http://localhost:3000'
      }
    },
    writable: true
  });

  // Mock window.localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    },
    writable: true
  });

  // Mock window.sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn()
    },
    writable: true
  });

  // Mock IndexedDB
  Object.defineProperty(window, 'indexedDB', {
    value: {
      open: vi.fn(),
      deleteDatabase: vi.fn(),
      databases: vi.fn().mockResolvedValue([])
    },
    writable: true
  });

  // Mock navigator
  Object.defineProperty(window.navigator, 'language', {
    value: 'es-ES',
    writable: true
  });

  // Mock WebGPU for WebLLM tests
  Object.defineProperty(navigator, 'gpu', {
    value: {
      requestAdapter: vi.fn().mockResolvedValue({
        features: new Set(),
        limits: {},
        info: {}
      })
    },
    configurable: true,
    writable: true
  });

  // Mock window.URL and URL.createObjectURL
  if (!global.URL.createObjectURL) {
    global.URL.createObjectURL = vi.fn(() => 'mocked-object-url');
  }
  if (!global.URL.revokeObjectURL) {
    global.URL.revokeObjectURL = vi.fn();
  }

  // Mock Blob with proper constructor handling
  global.Blob = vi.fn().mockImplementation((parts, options = {}) => ({
    size: parts ? parts.reduce((acc, part) => acc + (part?.length || 0), 0) : 0,
    type: options.type || 'text/plain',
    text: () => Promise.resolve(parts ? parts.join('') : ''),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0))
  }));

  // Mock File
  global.File = vi.fn().mockImplementation(() => ({
    size: 0,
    type: 'text/plain',
    name: 'test-file.txt'
  }));

  // Mock window.alert, confirm, prompt
  window.alert = vi.fn();
  window.confirm = vi.fn().mockReturnValue(true);
  window.prompt = vi.fn();

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }));

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn()
  }));

  // Mock Worker for WebLLM
  global.Worker = vi.fn().mockImplementation(() => ({
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));

  // Mock performance API for timing
  Object.defineProperty(global, 'performance', {
    value: {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => [])
    },
    writable: true
  });

  // Mock requestIdleCallback for React 18 concurrent features
  global.requestIdleCallback = vi.fn((callback) => {
    return setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 50 }), 0);
  });
  global.cancelIdleCallback = vi.fn();

  // Mock React 18 concurrent features
  global.MessageChannel = vi.fn().mockImplementation(() => ({
    port1: { onmessage: null, postMessage: vi.fn() },
    port2: { onmessage: null, postMessage: vi.fn() }
  }));

  // Mock scheduler for React 18
  global.scheduler = {
    postTask: vi.fn((callback) => {
      setTimeout(callback, 0);
      return { abort: vi.fn() };
    })
  };
});

afterEach(() => {
  cleanup();
  // Use clearAllMocks instead of restoreAllMocks to preserve mock implementations
  // while clearing call history between tests
  vi.clearAllMocks();
});

// Global error handler for unhandled promise rejections in tests
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection in test:', reason);
});

// Mock crypto for security tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'mock-uuid'),
    getRandomValues: vi.fn(),
    subtle: {
      encrypt: vi.fn(),
      decrypt: vi.fn(),
      generateKey: vi.fn(),
      importKey: vi.fn(),
      exportKey: vi.fn(),
      digest: vi.fn()
    }
  }
});

// Mock TextEncoder/TextDecoder for browser compatibility
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

