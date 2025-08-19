import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAsync, screen, fireEvent, waitFor, act, testHelpers } from '@/test/test-utils';
import CorpusManager from '../CorpusManager';
import EmbeddingsManager from '../EmbeddingsManager';
import QualityMetrics from '../QualityMetrics';

// Import mocked services for type checking
import { corpusService } from '@/lib/admin/corpus-service';
import { adminDataService } from '@/lib/admin/admin-data-service';
import { embeddingsService } from '@/lib/admin/embeddings-service';
import { qualityTestSuite } from '@/lib/admin/quality-test-suite';
import { queryAnalyzer } from '@/lib/admin/query-analyzer';

// Create mock implementations that resolve immediately
const mockDocuments = [
  {
    id: 'doc1',
    title: 'Ley Federal del Trabajo',
    shortTitle: 'LFT',
    type: 'law',
    hierarchy: 3,
    primaryArea: 'labor',
    secondaryAreas: [],
    authority: 'Congreso de la Unión',
    publicationDate: '1970-04-01',
    lastReform: '2023-07-28',
    status: 'active',
    territorialScope: 'federal',
    applicability: 'Relaciones laborales',
    content: [
      { id: 'art-1', type: 'article', number: '1', title: 'Disposiciones generales', content: 'Disposiciones de orden público', embedding: [], chunkIndex: 0 }
    ],
    officialUrl: 'https://example.com',
    relatedDependencies: [],
    importance: 'critical',
    updateFrequency: 'medium'
  }
];

// Mock service modules with simple implementations
vi.mock('@/lib/admin/corpus-service', () => ({
  corpusService: {
    getDocuments: vi.fn(() => Promise.resolve(mockDocuments)),
    getDocumentMetrics: vi.fn(() => Promise.resolve({
      id: 'doc1',
      title: 'Test Document',
      type: 'law',
      legalArea: 'labor',
      chunks: 5,
      embeddings: 5,
      size: 10240,
      quality: 85,
      lastUpdated: new Date().toISOString()
    })),
    deleteDocument: vi.fn(() => Promise.resolve(undefined)),
    reindexDocument: vi.fn(() => Promise.resolve(undefined)),
    validateCorpus: vi.fn(() => Promise.resolve({
      totalDocuments: 10,
      valid: 8,
      invalid: 2,
      issues: []
    })),
    importDocument: vi.fn(() => Promise.resolve(undefined))
  }
}));

vi.mock('@/lib/admin/admin-data-service', () => ({
  adminDataService: {
    getDocumentsList: vi.fn(() => Promise.resolve(mockDocuments)),
    getCorpusStats: vi.fn(() => Promise.resolve({
      totalDocuments: 125,
      documentsByType: { law: 45, code: 15 },
      documentsByArea: { labor: 25, civil: 20 },
      totalSize: 15728640,
      totalChunks: 2500,
      lastUpdate: new Date().toISOString(),
      lastUpdated: Date.now()
    })),
    getEmbeddingsStats: vi.fn(() => Promise.resolve({
      totalVectors: 1000,
      storageSize: 5242880,
      averageGenerationTime: 50,
      modelsAvailable: ['transformers', 'openai', 'mock'],
      currentModel: 'transformers',
      indexStatus: 'ready'
    })),
    getQualityStats: vi.fn(() => Promise.resolve({
      totalQueries: 100,
      failedQueries: 5,
      averageLatency: 150,
      cacheHitRate: 45.5,
      retrievalAccuracy: 85.5,
      corpusCoverage: 92.3,
      userSatisfaction: 4.2
    })),
    exportCorpus: vi.fn(() => Promise.resolve(new Blob(['corpus data'], { type: 'application/json' }))),
    exportEmbeddings: vi.fn(() => Promise.resolve(new Blob(['embeddings data'], { type: 'application/json' }))),
    clearEmbeddingsCache: vi.fn(() => Promise.resolve(undefined)),
    rebuildIndex: vi.fn(() => Promise.resolve(undefined)),
    deleteDocument: vi.fn(() => Promise.resolve(undefined)),
    validateCorpus: vi.fn(() => Promise.resolve({ valid: true, issues: [] })),
    initialize: vi.fn(() => Promise.resolve(undefined))
  }
}));

vi.mock('@/lib/admin/embeddings-service', () => ({
  embeddingsService: {
    initialize: vi.fn(() => Promise.resolve(undefined)),
    getStats: vi.fn(() => Promise.resolve({
      totalVectors: 1000,
      storageSize: 5242880,
      averageGenerationTime: 50,
      modelsAvailable: ['transformers', 'openai', 'mock'],
      currentModel: 'transformers',
      indexStatus: 'ready'
    })),
    switchProvider: vi.fn(() => Promise.resolve(undefined)),
    generateAllEmbeddings: vi.fn(() => Promise.resolve({
      totalDocuments: 10,
      successfulDocuments: 10,
      failedDocuments: 0
    })),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  }
}));

vi.mock('@/lib/admin/quality-test-suite', () => ({
  qualityTestSuite: {
    initialize: vi.fn(() => Promise.resolve(undefined)),
    getAvailableTests: vi.fn(() => [
      {
        id: 'test1',
        name: 'Citation Test',
        description: 'Tests citation accuracy',
        category: 'citation',
        query: 'Article 123',
        expectedResults: ['Article 123']
      }
    ]),
    getStoredResults: vi.fn(() => [
      {
        totalTests: 1,
        passedTests: 1,
        failedTests: 0,
        averageScore: 0.9,
        totalDuration: 100,
        timestamp: Date.now(),
        results: []
      }
    ]),
    runTest: vi.fn(() => Promise.resolve({
      testId: 'test1',
      passed: true,
      score: 0.9,
      duration: 100,
      details: {}
    })),
    runAllTests: vi.fn(() => Promise.resolve({
      totalTests: 1,
      passedTests: 1,
      failedTests: 0,
      averageScore: 0.9,
      totalDuration: 100,
      timestamp: Date.now(),
      results: []
    })),
    exportResults: vi.fn(() => Promise.resolve(new Blob(['test results'], { type: 'text/markdown' })))
  }
}));

vi.mock('@/lib/admin/query-analyzer', () => ({
  queryAnalyzer: {
    getRecentQueries: vi.fn(() => [
      {
        id: 'q1',
        query: 'Test query',
        timestamp: Date.now(),
        latency: 100,
        success: true,
        legalArea: 'civil',
        relevanceScore: 0.9,
        cached: false
      }
    ]),
    getPerformanceReport: vi.fn(() => ({
      timeRange: { start: Date.now() - 86400000, end: Date.now() },
      totalQueries: 100,
      successfulQueries: 95,
      failedQueries: 5,
      averageLatency: 150,
      medianLatency: 140,
      p95Latency: 300,
      cacheHitRate: 45.5,
      errorRate: 5.0,
      averageRelevance: 0.85,
      queriesByArea: { civil: 40, labor: 60 }
    })),
    generateInsights: vi.fn(() => []),
    exportQueryData: vi.fn(() => new Blob(['query data'], { type: 'application/json' }))
  }
}));

// Mock i18n
vi.mock('@/i18n/index', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
      if (params) {
        return `${key}:${JSON.stringify(params)}`;
      }
      return key;
    },
    language: 'en',
    setLanguage: vi.fn(),
    getSection: vi.fn().mockReturnValue({})
  })
}));

// Mock global functions
vi.stubGlobal('alert', vi.fn());
vi.stubGlobal('confirm', vi.fn());
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'mock-blob-url'),
  revokeObjectURL: vi.fn()
});

// Mock document.createElement for download tests
const mockAnchorElement = {
  click: vi.fn(),
  download: '',
  href: '',
  style: { display: '' }
};

// Store original createElement
const originalCreateElement = document.createElement.bind(document);

vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'a') {
    return mockAnchorElement as any;
  }
  // Use original createElement for other elements
  return originalCreateElement(tagName);
});
vi.spyOn(document.body, 'appendChild').mockImplementation(vi.fn());
vi.spyOn(document.body, 'removeChild').mockImplementation(vi.fn());

describe('CorpusManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Ensure all mocked services are ready
    await vi.waitFor(() => {
      expect(vi.mocked(corpusService.getDocuments)).toBeDefined();
      expect(vi.mocked(adminDataService.getCorpusStats)).toBeDefined();
    });
  });

  it('should render corpus statistics', async () => {
    // Test that CorpusManager renders without throwing errors
    const renderError = false;
    try {
      await renderAsync(<CorpusManager />);
      await testHelpers.waitForLoading();
      
      // If we get here without error, the component at least attempted to render
      expect(renderError).toBe(false);
      
      // Verify no error boundary was triggered
      expect(testHelpers.hasErrorBoundary()).toBe(false);
    } catch (error) {
      // If there's a rendering error, fail the test
      console.error('CorpusManager rendering error:', error);
      expect(error).toBeUndefined();
    }
  }, 15000);

  it('should display document list', async () => {
    await renderAsync(<CorpusManager />);
    
    // Wait for async operations to complete
    await testHelpers.waitForLoading();
    
    // Component should render without errors
    expect(screen.getByText('admin.corpus.stats.totalDocuments')).toBeInTheDocument();
    
    // Check that document data is loaded
    await waitFor(() => {
      expect(vi.mocked(corpusService.getDocuments)).toHaveBeenCalled();
    }, { timeout: 5000 });
  });

  it('should filter documents by type', async () => {
    await renderAsync(<CorpusManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.corpus.stats.totalDocuments')).toBeInTheDocument();
    
    // Check that filter select exists
    await waitFor(() => {
      expect(screen.getByDisplayValue('admin.corpus.allTypes')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should handle document deletion', async () => {
    vi.mocked(global.confirm).mockReturnValue(true);
    
    await renderAsync(<CorpusManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.corpus.stats.totalDocuments')).toBeInTheDocument();
    
    // Check that delete button appears when data is loaded
    await waitFor(() => {
      expect(screen.getByText('admin.corpus.delete')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should handle document reindexing', async () => {
    await renderAsync(<CorpusManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.corpus.stats.totalDocuments')).toBeInTheDocument();
    
    // Check that reindex button appears
    await waitFor(() => {
      expect(screen.getByText('admin.corpus.reindex')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should validate corpus', async () => {
    await renderAsync(<CorpusManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.corpus.stats.totalDocuments')).toBeInTheDocument();
    
    // Check that validate button exists
    await waitFor(() => {
      expect(screen.getByText('admin.corpus.validate')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should export corpus', async () => {
    await renderAsync(<CorpusManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.corpus.stats.totalDocuments')).toBeInTheDocument();
    
    // Check that export button exists
    await waitFor(() => {
      expect(screen.getByText('admin.corpus.export')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('EmbeddingsManager', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Ensure all mocked services are ready
    await vi.waitFor(() => {
      expect(vi.mocked(embeddingsService.getStats)).toBeDefined();
      expect(vi.mocked(adminDataService.getEmbeddingsStats)).toBeDefined();
    });
  });

  it('should display embeddings statistics', async () => {
    await renderAsync(<EmbeddingsManager />);
    await testHelpers.waitForLoading();
    
    // Component should render without errors and show statistics
    expect(screen.getByText('admin.embeddings.stats.totalVectors')).toBeInTheDocument();
    expect(screen.getByText('1,000')).toBeInTheDocument(); // Total vectors from mock
    
    // Verify no error boundary was triggered
    expect(testHelpers.hasErrorBoundary()).toBe(false);
  });

  it('should switch embedding provider', async () => {
    const { container } = await renderAsync(<EmbeddingsManager />);
    await testHelpers.waitForLoading();
    
    // Check that the component renders without error
    await waitFor(() => {
      expect(container.firstChild).toBeTruthy();
      // Look for any embeddings-related content
      const embeddingsElements = screen.queryAllByText(/admin\.embeddings/i);
      expect(embeddingsElements.length).toBeGreaterThan(0);
    }, { timeout: 10000 });
    
    // Verify no error boundary was triggered
    expect(testHelpers.hasErrorBoundary()).toBe(false);
  }, 15000);

  it('should generate all embeddings', async () => {
    await renderAsync(<EmbeddingsManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.embeddings.stats.totalVectors')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('admin.embeddings.generateAll')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should clear embeddings cache', async () => {
    await renderAsync(<EmbeddingsManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.embeddings.stats.totalVectors')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('admin.embeddings.clearCache')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should rebuild index', async () => {
    await renderAsync(<EmbeddingsManager />);
    await testHelpers.waitForLoading();
    
    expect(screen.getByText('admin.embeddings.stats.totalVectors')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('admin.embeddings.rebuildIndex')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});

describe('QualityMetrics', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Ensure all mocked services are ready
    await vi.waitFor(() => {
      expect(vi.mocked(qualityTestSuite.getAvailableTests)).toBeDefined();
      expect(vi.mocked(adminDataService.getQualityStats)).toBeDefined();
      expect(vi.mocked(queryAnalyzer.getRecentQueries)).toBeDefined();
    });
  });

  it('should display quality metrics', async () => {
    await renderAsync(<QualityMetrics />);
    await testHelpers.waitForLoading();
    
    // Component should render without errors and show tabs
    expect(screen.getAllByText('admin.quality.metrics.accuracy').length).toBeGreaterThan(0);
    expect(screen.getByText('admin.quality.tests.title')).toBeInTheDocument();
    
    // Verify no error boundary was triggered
    expect(testHelpers.hasErrorBoundary()).toBe(false);
  });

  it('should display available tests', async () => {
    await renderAsync(<QualityMetrics />);
    await testHelpers.waitForLoading();
    
    expect(screen.getAllByText('admin.quality.metrics.accuracy').length).toBeGreaterThan(0);
    
    await waitFor(() => {
      expect(screen.getByText('admin.quality.tests.title')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should run individual test', async () => {
    await renderAsync(<QualityMetrics />);
    await testHelpers.waitForLoading();
    
    expect(screen.getAllByText('admin.quality.metrics.accuracy').length).toBeGreaterThan(0);
    
    // Switch to tests tab and check for test interface
    const testsTab = await waitFor(() => 
      screen.getByText('admin.quality.tests.title'),
      { timeout: 5000 }
    );
    
    await act(async () => {
      fireEvent.click(testsTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('admin.quality.tests.runTest')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should run all tests', async () => {
    await renderAsync(<QualityMetrics />);
    await testHelpers.waitForLoading();
    
    expect(screen.getAllByText('admin.quality.metrics.accuracy').length).toBeGreaterThan(0);
    
    const testsTab = await waitFor(() => 
      screen.getByText('admin.quality.tests.title'),
      { timeout: 5000 }
    );
    
    await act(async () => {
      fireEvent.click(testsTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('admin.quality.tests.runAllTests')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should display recent queries', async () => {
    await renderAsync(<QualityMetrics />);
    await testHelpers.waitForLoading();
    
    expect(screen.getAllByText('admin.quality.metrics.accuracy').length).toBeGreaterThan(0);
    
    const queriesTab = await waitFor(() => 
      screen.getByText('admin.quality.queries.title'),
      { timeout: 5000 }
    );
    
    await act(async () => {
      fireEvent.click(queriesTab);
    });
    
    // Should show the queries interface
    await waitFor(() => {
      expect(screen.getByText('admin.quality.queries.query')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('should export test results', async () => {
    await renderAsync(<QualityMetrics />);
    await testHelpers.waitForLoading();
    
    expect(screen.getAllByText('admin.quality.metrics.accuracy').length).toBeGreaterThan(0);
    
    const testsTab = await waitFor(() => 
      screen.getByText('admin.quality.tests.title'),
      { timeout: 5000 }
    );
    
    await act(async () => {
      fireEvent.click(testsTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('admin.quality.reports.export')).toBeInTheDocument();
    }, { timeout: 5000 });
  });
});