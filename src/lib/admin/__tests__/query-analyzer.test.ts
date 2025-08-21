import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { QueryAnalyzer } from '../query-analyzer';
import type { QueryMetrics as _QueryMetrics, PerformanceReport as _PerformanceReport, PerformanceInsight as _PerformanceInsight } from '../query-analyzer';
import { setupTestEnvironment, queryMetricsFixture as _queryMetricsFixture } from '../../../test/mocks';

describe('QueryAnalyzer', () => {
  let analyzer: QueryAnalyzer;
  let mockStorage: any;
  let fixedDate: Date;

  beforeEach(() => {
    // Set up fixed date for consistent timestamps
    fixedDate = new Date('2024-01-15T10:30:00.000Z');
    vi.setSystemTime(fixedDate);
    
    // Set up test environment with localStorage mock
    const _testEnv = setupTestEnvironment({ mockLocalStorage: true });
    mockStorage = global.localStorage;
    
    // Clear any existing data
    mockStorage.data.clear();
    
    // Mock Blob for export tests
    class MockBlob {
      size: number;
      type: string;
      data: string;
      
      constructor(data: any[], options: any = {}) {
        this.data = data.join('');
        this.size = this.data.length;
        this.type = options?.type || 'text/plain';
      }
      
      text() {
        return Promise.resolve(this.data);
      }
      
      stream() { return {}; }
      arrayBuffer() { return Promise.resolve(new ArrayBuffer(0)); }
      slice() { return new MockBlob([''], {}); }
    }
    
    global.Blob = MockBlob as any;
    
    // Mock FileReader
    class MockFileReader {
      result: string = '';
      onload: (() => void) | null = null;
      
      readAsText(blob: any) {
        // Synchronously set the result to avoid timeout issues
        if (blob && blob.data) {
          this.result = blob.data;
        } else {
          this.result = typeof blob === 'string' ? blob : JSON.stringify(blob);
        }
        
        // Call onload immediately
        if (this.onload) {
          this.onload();
        }
      }
    }
    
    global.FileReader = MockFileReader as any;
    
    // Create new analyzer instance
    analyzer = new QueryAnalyzer();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('trackQuery', () => {
    it('should track a successful query', () => {
      const query = analyzer.trackQuery(
        'test query',
        100,
        true,
        'labor',
        0.85,
        false
      );

      expect(query).toMatchObject({
        query: 'test query',
        latency: 100,
        success: true,
        legalArea: 'labor',
        relevanceScore: 0.85,
        cached: false
      });
      expect(query.id).toBeDefined();
      expect(query.timestamp).toBeDefined();
    });

    it('should save query to localStorage', () => {
      analyzer.trackQuery('test', 100, true, 'civil', 0.9, false);
      
      expect(mockStorage.setItem).toHaveBeenCalledWith(
        'lexmx_query_metrics',
        expect.any(String)
      );
      
      const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(savedData).toHaveLength(1);
      expect(savedData[0].query).toBe('test');
    });

    it('should maintain query history limit', () => {
      // Create existing history with 1000 items
      const existingHistory = Array(1000).fill(null).map((_, i) => ({
        id: `old-${i}`,
        query: `old query ${i}`,
        timestamp: Date.now() - i * 1000,
        latency: 100,
        success: true,
        legalArea: 'civil',
        relevanceScore: 0.8,
        cached: false,
        complexity: 0.5
      }));
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(existingHistory));
      
      analyzer.trackQuery('new query', 100, true, 'civil', 0.9, false);
      
      const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(savedData.length).toBe(1000);
      expect(savedData[0].query).toBe('new query');
    });
  });

  describe('getRecentQueries', () => {
    it('should return recent queries', () => {
      const mockQueries = [
        {
          id: '1',
          query: 'query 1',
          timestamp: Date.now(),
          latency: 100,
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.9,
          cached: false,
          complexity: 0.5
        },
        {
          id: '2',
          query: 'query 2',
          timestamp: Date.now() - 1000,
          latency: 200,
          success: false,
          legalArea: 'labor',
          relevanceScore: 0.5,
          cached: true,
          complexity: 0.6
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const recent = analyzer.getRecentQueries(1);
      
      expect(recent).toHaveLength(1);
      expect(recent[0].query).toBe('query 1');
    });

    it('should return empty array when no queries exist', () => {
      // No data in mockStorage, should return empty array
      const recent = analyzer.getRecentQueries(10);
      
      expect(recent).toEqual([]);
    });

    it('should limit returned queries', () => {
      const mockQueries = Array(100).fill(null).map((_, i) => ({
        id: `${i}`,
        query: `query ${i}`,
        timestamp: Date.now() - i * 1000,
        latency: 100,
        success: true,
        legalArea: 'civil',
        relevanceScore: 0.8,
        cached: false,
        complexity: 0.5
      }));
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const recent = analyzer.getRecentQueries(5);
      
      expect(recent).toHaveLength(5);
    });
  });

  describe('getPerformanceReport', () => {
    it('should generate performance report for time range', () => {
      const now = Date.now();
      const mockQueries = [
        {
          id: '1',
          query: 'query 1',
          timestamp: now - 1000,
          latency: 100,
          success: true,
          cached: false,
          legalArea: 'civil',
          relevanceScore: 0.9,
          confidence: 0.85,
          complexity: 0.5,
          queryType: 'procedural'
        },
        {
          id: '2',
          query: 'query 2',
          timestamp: now - 2000,
          latency: 200,
          success: false,
          cached: true,
          legalArea: 'labor',
          relevanceScore: 0.5,
          confidence: 0.45,
          complexity: 0.7,
          queryType: 'analytical',
          error: 'timeout',
          errorType: 'timeout'
        },
        {
          id: '3',
          query: 'query 3',
          timestamp: now - 3000,
          latency: 150,
          success: true,
          cached: false,
          legalArea: 'civil',
          relevanceScore: 0.8,
          confidence: 0.9,
          complexity: 0.4,
          queryType: 'citation'
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const report = analyzer.getPerformanceReport(now - 5000, now);
      
      expect(report.totalQueries).toBe(3);
      expect(report.successfulQueries).toBe(2);
      expect(report.averageLatency).toBe(125); // (100 + 150) / 2 for successful queries
      expect(report.medianLatency).toBe(125); // median of [100, 150]
      expect(report.p95Latency).toBe(150); // 95th percentile of [100, 150]
      expect(report.cacheHitRate).toBeCloseTo(33.33, 1);
      expect(report.errorRate).toBeCloseTo(33.33, 1);
      expect(report.averageRelevance).toBeCloseTo(0.85, 1); // (0.9 + 0.8) / 2 for successful queries
    });

    it('should handle empty time range', () => {
      // No data in storage, should return empty report
      const report = analyzer.getPerformanceReport(0, Date.now());
      
      expect(report.totalQueries).toBe(0);
      expect(report.averageLatency).toBe(0);
      expect(report.cacheHitRate).toBe(0);
    });

    it('should calculate queries by legal area', () => {
      const mockQueries = [
        { 
          id: '1', 
          query: 'test 1',
          timestamp: Date.now(), 
          legalArea: 'civil', 
          success: true, 
          latency: 100,
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5,
          confidence: 0.8
        },
        { 
          id: '2', 
          query: 'test 2',
          timestamp: Date.now(), 
          legalArea: 'civil', 
          success: true, 
          latency: 100,
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5,
          confidence: 0.8
        },
        { 
          id: '3', 
          query: 'test 3',
          timestamp: Date.now(), 
          legalArea: 'labor', 
          success: true, 
          latency: 100,
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5,
          confidence: 0.8
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const report = analyzer.getPerformanceReport(0, Date.now());
      
      expect(report.legalAreaDistribution).toEqual({
        civil: 2,
        labor: 1
      });
    });

    it('should calculate percentiles correctly', () => {
      const mockQueries = Array(100).fill(null).map((_, i) => ({
        id: `${i}`,
        query: `test query ${i}`,
        timestamp: Date.now(),
        latency: i * 10, // 0, 10, 20, ..., 990
        success: true,
        legalArea: 'civil',
        relevanceScore: 0.8,
        cached: false,
        complexity: 0.5,
        confidence: 0.8
      }));
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const report = analyzer.getPerformanceReport(0, Date.now());
      
      expect(report.p95Latency).toBe(950); // 95th percentile
      expect(report.medianLatency).toBe(495); // 50th percentile
    });
  });

  describe('generateInsights', () => {
    it('should generate performance insights', () => {
      const mockQueries = [
        {
          id: '1',
          query: 'slow query',
          timestamp: Date.now(),
          latency: 5000, // High latency
          success: true,
          cached: false,
          relevanceScore: 0.9,
          legalArea: 'civil',
          complexity: 0.5,
          confidence: 0.8
        },
        {
          id: '2',
          query: 'failed query',
          timestamp: Date.now(),
          latency: 100,
          success: false, // Failed query
          cached: false,
          relevanceScore: 0.3,
          legalArea: 'labor',
          complexity: 0.6,
          confidence: 0.4,
          error: 'timeout',
          errorType: 'timeout'
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const insights = analyzer.generateInsights();
      
      expect(insights).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          title: expect.stringContaining('Latency')
        })
      );
      
      expect(insights).toContainEqual(
        expect.objectContaining({
          type: 'error',
          title: expect.stringContaining('Error Rate')
        })
      );
    });

    it('should identify cache optimization opportunities', () => {
      const mockQueries = Array(20).fill(null).map((_, i) => ({
        id: `${i}`,
        query: `test query ${i}`,
        timestamp: Date.now(),
        latency: 100,
        success: true,
        cached: false, // No caching
        relevanceScore: 0.8,
        legalArea: 'civil',
        complexity: 0.5,
        confidence: 0.8
      }));
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const insights = analyzer.generateInsights();
      
      expect(insights).toContainEqual(
        expect.objectContaining({
          type: 'info',
          title: expect.stringContaining('Cache')
        })
      );
    });

    it('should identify relevance issues', () => {
      const mockQueries = Array(10).fill(null).map((_, i) => ({
        id: `${i}`,
        query: `low relevance query ${i}`,
        timestamp: Date.now(),
        latency: 100,
        success: true,
        cached: false,
        relevanceScore: 0.3, // Low relevance
        legalArea: 'civil',
        complexity: 0.5,
        confidence: 0.8
      }));
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const insights = analyzer.generateInsights();
      
      expect(insights).toContainEqual(
        expect.objectContaining({
          type: 'warning',
          title: expect.stringContaining('Relevance')
        })
      );
    });

    it('should provide success insights for good performance', () => {
      const mockQueries = Array(100).fill(null).map((_, i) => ({
        id: `${i}`,
        query: `good query ${i}`,
        timestamp: Date.now(),
        latency: 50, // Low latency
        success: true,
        cached: i % 2 === 0, // 50% cache hit
        relevanceScore: 0.9, // High relevance
        legalArea: 'civil',
        complexity: 0.5,
        confidence: 0.9
      }));
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const insights = analyzer.generateInsights();
      
      expect(insights.some(i => i.type === 'success')).toBe(true);
    });
  });

  describe('clearHistory', () => {
    it('should clear query history', () => {
      analyzer.clearHistory();
      
      expect(mockStorage.removeItem).toHaveBeenCalledWith('lexmx_query_metrics');
    });
  });

  describe('exportQueryData', () => {
    it('should export query data as JSON blob', () => {
      const mockQueries = [
        {
          id: '1',
          query: 'test query',
          timestamp: Date.now(),
          latency: 100,
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5,
          confidence: 0.8
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const blob = analyzer.exportQueryData(0, Date.now());
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should filter queries by time range', () => {
      const now = Date.now();
      const mockQueries = [
        { 
          id: '1', 
          timestamp: now - 10000, 
          query: 'old',
          latency: 100,
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        },
        { 
          id: '2', 
          timestamp: now - 1000, 
          query: 'recent',
          latency: 100,
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const blob = analyzer.exportQueryData(now - 5000, now);
      const reader = new FileReader();
      
      return new Promise<void>((resolve) => {
        reader.onload = () => {
          const data = JSON.parse(reader.result as string);
          expect(data.queries).toHaveLength(1);
          expect(data.queries[0].query).toBe('recent');
          resolve();
        };
        reader.readAsText(blob);
      });
    });
  });

  describe('updateUserFeedback', () => {
    it('should update user feedback for a query', () => {
      const mockQueries = [
        {
          id: 'query-1',
          query: 'test',
          timestamp: Date.now(),
          latency: 100,
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      analyzer.updateUserFeedback('query-1', 'positive');
      
      const savedData = JSON.parse(mockStorage.setItem.mock.calls[0][1]);
      expect(savedData[0].userFeedback).toBe('positive');
    });

    it('should handle query not found', () => {
      // No data in storage, should not throw
      expect(() => {
        analyzer.updateUserFeedback('nonexistent', 'positive');
      }).not.toThrow();
    });
  });

  describe('getQueryById', () => {
    it('should retrieve query by ID', () => {
      const mockQueries = [
        { 
          id: 'query-1', 
          query: 'test 1',
          timestamp: Date.now(),
          latency: 100,
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        },
        { 
          id: 'query-2', 
          query: 'test 2',
          timestamp: Date.now(),
          latency: 100,
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const query = analyzer.getQueryById('query-2');
      
      expect(query?.query).toBe('test 2');
    });

    it('should return undefined for non-existent query', () => {
      // No data in storage
      const query = analyzer.getQueryById('nonexistent');
      
      expect(query).toBeUndefined();
    });
  });

  describe('getStatsByTimeInterval', () => {
    it('should calculate stats by hour intervals', () => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      const twoHoursAgo = now - 7200000;
      
      const mockQueries = [
        { 
          id: '1', 
          query: 'query 1',
          timestamp: oneHourAgo + 100, // Within same hour interval
          latency: 100, 
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        },
        { 
          id: '2', 
          query: 'query 2',
          timestamp: oneHourAgo + 200, // Within same hour interval
          latency: 200, 
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        },
        { 
          id: '3', 
          query: 'query 3',
          timestamp: twoHoursAgo + 100, // Different hour interval
          latency: 150, 
          success: true,
          legalArea: 'civil',
          relevanceScore: 0.8,
          cached: false,
          complexity: 0.5
        }
      ];
      
      mockStorage.data.set('lexmx_query_metrics', JSON.stringify(mockQueries));
      
      const stats = analyzer.getStatsByTimeInterval(now - 10800000, now, 'hour');
      
      expect(stats).toHaveLength(3);
      // Find the interval that should contain 2 queries
      const intervalWithTwoQueries = stats.find(stat => stat.count === 2);
      expect(intervalWithTwoQueries).toBeDefined();
      expect(intervalWithTwoQueries!.averageLatency).toBe(150); // (100 + 200) / 2
    });

    it('should handle empty intervals', () => {
      // No data in storage
      const stats = analyzer.getStatsByTimeInterval(Date.now() - 3600000, Date.now(), 'hour');
      
      expect(stats).toHaveLength(1);
      expect(stats[0].count).toBe(0);
    });
  });
});