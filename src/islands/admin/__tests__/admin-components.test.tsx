import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderAsync, screen, waitFor } from '@/test/test-utils';
import CorpusManager from '../CorpusManager';
import EmbeddingsManager from '../EmbeddingsManager';
import QualityMetrics from '../QualityMetrics';

// Mock documents data
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

// Mock all services with consistent data
vi.mock('../../i18n/index', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        // Corpus Manager
        'admin.corpus.stats.totalDocuments': 'Total Documents',
        'admin.corpus.stats.totalChunks': 'Total Chunks', 
        'admin.corpus.stats.totalSize': 'Total Size',
        'admin.corpus.stats.lastUpdate': 'Last Update',
        'admin.corpus.allTypes': 'All Types',
        'admin.corpus.validate': 'Validate Corpus',
        'admin.corpus.export': 'Export Corpus',
        'admin.corpus.delete': 'Delete',
        'admin.corpus.reindex': 'Reindex',
        'admin.corpus.table.title': 'Title',
        'admin.corpus.table.type': 'Type',
        'admin.corpus.table.area': 'Area',
        'admin.corpus.table.chunks': 'Chunks',
        'admin.corpus.table.actions': 'Actions',
        
        // Embeddings Manager
        'admin.embeddings.stats.totalVectors': 'Total Vectors',
        'admin.embeddings.stats.storageSize': 'Storage Size',
        'admin.embeddings.stats.avgTime': 'Average Time',
        'admin.embeddings.stats.status': 'Index Status',
        'admin.embeddings.provider.title': 'Provider Configuration',
        'admin.embeddings.provider.current': 'Current provider',
        'admin.embeddings.provider.model': 'Model',
        'admin.embeddings.provider.available': 'Available models',
        'admin.embeddings.provider.switching': 'Switching...',
        'admin.embeddings.generation.title': 'Embedding Generation',
        'admin.embeddings.generation.progress': 'Progress',
        'admin.embeddings.generateAll': 'Generate All',
        'admin.embeddings.generateSelected': 'Generate Selected',
        'admin.embeddings.generating': 'Generating...',
        'admin.embeddings.clearCache': 'Clear Cache',
        'admin.embeddings.clearing': 'Clearing...',
        'admin.embeddings.rebuildIndex': 'Rebuild Index', 
        'admin.embeddings.rebuilding': 'Rebuilding...',
        'admin.embeddings.export': 'Export',
        'admin.embeddings.exporting': 'Exporting...',
        'admin.embeddings.advanced': 'Advanced Options',
        'admin.embeddings.batchSize': 'Batch Size',
        'admin.embeddings.batchSizeHelp': 'Number of documents to process simultaneously',
        'admin.embeddings.documents.title': 'Documents',
        'admin.embeddings.documents.type': 'Type',
        'admin.embeddings.documents.chunks': 'Chunks',
        'admin.embeddings.documents.status': 'Status',
        'admin.embeddings.documents.indexed': 'Indexed',
        
        // Quality Metrics
        'admin.quality.metrics.accuracy': 'Accuracy Metrics',
        'admin.quality.tests.title': 'Quality Tests',
        'admin.quality.tests.runTest': 'Run Test',
        'admin.quality.tests.runAllTests': 'Run All Tests',
        'admin.quality.queries.title': 'Recent Queries',
        'admin.quality.queries.query': 'Query',
        'admin.quality.reports.export': 'Export Results'
      };
      return translations[key] || key;
    },
    language: 'en',
    setLanguage: vi.fn(),
    getSection: vi.fn().mockReturnValue({})
  })
}));

// Mock fetch globally for API calls
global.fetch = vi.fn((url, _options) => {
  
  // Mock different API endpoints
  if (typeof url === 'string') {
    if (url.includes('/api/corpus/list')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true, data: mockDocuments }),
      } as Response);
    }
    
    if (url.includes('/api/admin/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: {
            totalDocuments: 125,
            documentsByType: { law: 45, code: 15 },
            documentsByArea: { labor: 25, civil: 20 },
            totalSize: 15728640,
            totalChunks: 2500,
            lastUpdate: new Date().toISOString()
          }
        }),
      } as Response);
    }
    
    if (url.includes('/api/embeddings/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: {
            totalVectors: 1000,
            storageSize: 5242880,
            averageGenerationTime: 50,
            modelsAvailable: ['transformers', 'openai', 'mock'],
            currentModel: 'transformers',
            indexStatus: 'ready'
          }
        }),
      } as Response);
    }
    
    if (url.includes('/api/quality/stats')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          data: {
            totalQueries: 100,
            failedQueries: 5,
            averageLatency: 150,
            cacheHitRate: 45.5,
            retrievalAccuracy: 85.5,
            corpusCoverage: 92.3,
            userSatisfaction: 4.2
          }
        }),
      } as Response);
    }
  }
  
  // Default successful response
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ success: true, data: {} }),
    text: () => Promise.resolve('mocked response'),
  } as Response);
});

// Mock admin data service - but keep the class structure
vi.mock('../../lib/admin/admin-data-service', () => {
  const mockService = {
    initialize: vi.fn(() => Promise.resolve()),
    getDocumentsList: vi.fn(() => Promise.resolve(mockDocuments)),
    getCorpusStats: vi.fn(() => Promise.resolve({
      totalDocuments: 125,
      documentsByType: { law: 45, code: 15 },
      documentsByArea: { labor: 25, civil: 20 },
      totalSize: 15728640,
      totalChunks: 2500,
      lastUpdate: new Date().toISOString()
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
    deleteDocument: vi.fn(() => Promise.resolve()),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  };

  return {
    AdminDataService: vi.fn(() => mockService),
    adminDataService: mockService
  };
});

// Mock embeddings service
vi.mock('../../lib/admin/embeddings-service', () => ({
  embeddingsService: {
    initialize: vi.fn(() => Promise.resolve()),
    getStats: vi.fn(() => Promise.resolve({
      totalVectors: 1000,
      storageSize: 5242880,
      averageGenerationTime: 50,
      modelsAvailable: ['transformers', 'openai', 'mock'],
      currentModel: 'transformers',
      indexStatus: 'ready'
    })),
    switchProvider: vi.fn(() => Promise.resolve()),
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

// Mock quality test suite
vi.mock('../../lib/admin/quality-test-suite', () => ({
  qualityTestSuite: {
    initialize: vi.fn(() => Promise.resolve()),
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
    getStoredResults: vi.fn(() => []),
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

// Mock query analyzer
vi.mock('../../lib/admin/query-analyzer', () => ({
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

// Mock global functions
vi.stubGlobal('alert', vi.fn());
vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
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

// Store the original createElement before mocking
const originalCreateElement = document.createElement.bind(document);

vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
  if (tagName === 'a') {
    return mockAnchorElement as HTMLAnchorElement;
  }
  return originalCreateElement(tagName);
});

describe('Admin Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('CorpusManager', () => {
    it('should render and display corpus statistics', async () => {
      const { container } = await renderAsync(<CorpusManager />);
      
      // Wait for component to render with reasonable timeout
      await waitFor(
        () => {
          expect(screen.getByText('Total Documents')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
      
      // Verify component rendered content
      expect(container.innerHTML).not.toBe('<body />');
      
      // Check for other expected statistics
      expect(screen.getByText('Total Chunks')).toBeInTheDocument();
      expect(screen.getByText('Total Size')).toBeInTheDocument();
      expect(screen.getByText('Last Update')).toBeInTheDocument();
    });

    it('should display document table', async () => {
      await renderAsync(<CorpusManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Documents')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Check table headers
      expect(screen.getByText('Title')).toBeInTheDocument();
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getByText('Area')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });

    it('should display action buttons', async () => {
      await renderAsync(<CorpusManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Documents')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Check action buttons
      expect(screen.getByText('Validate Corpus')).toBeInTheDocument();
      expect(screen.getByText('Export Corpus')).toBeInTheDocument();
    });
  });

  describe('EmbeddingsManager', () => {
    it('should render and display embeddings statistics', async () => {
      const { container } = await renderAsync(<EmbeddingsManager />);
      
      await waitFor(
        () => {
          expect(screen.getByText('Total Vectors')).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
      
      // Verify component rendered content
      expect(container.innerHTML).not.toBe('<body />');
    });

    it('should display action buttons', async () => {
      await renderAsync(<EmbeddingsManager />);
      
      await waitFor(() => {
        expect(screen.getByText('Total Vectors')).toBeInTheDocument();
      }, { timeout: 5000 });
      
      // Check for embeddings action buttons (using actual text from translation)
      expect(screen.getByText('Generate All')).toBeInTheDocument();
      expect(screen.getByText('Clear Cache')).toBeInTheDocument();
      expect(screen.getByText('Rebuild Index')).toBeInTheDocument();
    });
  });

  describe('QualityMetrics', () => {
    it('should render and display quality metrics', async () => {
      const { container } = await renderAsync(<QualityMetrics />);
      
      await waitFor(
        () => {
          // Use getAllByText since there are multiple elements with this text
          const elements = screen.getAllByText('Retrieval Accuracy');
          expect(elements.length).toBeGreaterThan(0);
        },
        { timeout: 5000 }
      );
      
      // Verify component rendered content
      expect(container.innerHTML).not.toBe('<body />');
    });

    it('should display quality test tabs', async () => {
      await renderAsync(<QualityMetrics />);
      
      await waitFor(() => {
        // Use getAllByText for the element that appears multiple times
        const elements = screen.getAllByText('Retrieval Accuracy');
        expect(elements.length).toBeGreaterThan(0);
      }, { timeout: 5000 });
      
      // Check for tab titles (using actual rendered text)
      expect(screen.getByText('Quality Tests')).toBeInTheDocument();
      expect(screen.getByText('Recent Query Analysis')).toBeInTheDocument();
    });
  });
});