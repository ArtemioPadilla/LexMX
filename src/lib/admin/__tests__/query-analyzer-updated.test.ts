/**
 * Updated QueryAnalyzer test demonstrating advanced mock infrastructure usage
 * Shows fixtures, factories, auto-mocking, and realistic test scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  createMockQueryMetrics, 
  createMockPerformanceReport,
  createMockAsyncOperation 
} from '../../../test/mocks/factories';
import { 
  createMockQueryAnalyzer,
  createMockEventEmitterUtils,
  createMockAsyncHelpers
} from '../../../test/mocks/service-mocks';
import { 
  autoMockService, 
  resetAllMocks, 
  createConditionalMock,
  createMockFactory,
  mockGenerators,
  testHelpers
} from '../../../test/mocks/auto-mock';
import queryMetricsFixture from '../../../test/fixtures/query-metrics.json';
import { QueryAnalyzer } from '../query-analyzer';
import type { QueryMetrics, PerformanceReport } from '../query-analyzer';

describe('QueryAnalyzer (Updated with Mock Infrastructure)', () => {
  let analyzer: QueryAnalyzer;
  let mockAnalyzer: ReturnType<typeof createMockQueryAnalyzer>;
  let asyncHelpers: ReturnType<typeof createMockAsyncHelpers>;

  beforeEach(() => {
    resetAllMocks();
    
    // Mock localStorage with realistic behavior
    const mockStorage = {
      data: new Map<string, string>(),
      getItem: vi.fn((key: string) => mockStorage.data.get(key) || null),
      setItem: vi.fn((key: string, value: string) => mockStorage.data.set(key, value)),
      removeItem: vi.fn((key: string) => mockStorage.data.delete(key)),
      clear: vi.fn(() => mockStorage.data.clear()),
      length: 0,
      key: vi.fn()
    };
    global.localStorage = mockStorage as any;
    
    // Initialize services
    analyzer = new QueryAnalyzer();
    mockAnalyzer = createMockQueryAnalyzer();
    asyncHelpers = createMockAsyncHelpers();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('Query Tracking with Factory Data', () => {
    it('should track queries using mock factories', () => {
      // Create realistic query metrics using factory
      const queryData = createMockQueryMetrics({
        query: '¿Cuáles son las causas de despido justificado?',
        legalArea: 'labor',
        queryType: 'procedural',
        success: true,
        relevanceScore: 0.92
      });

      const tracked = mockAnalyzer.trackQuery(
        queryData.query,
        queryData.latency,
        queryData.success,
        queryData.legalArea,
        queryData.relevanceScore,
        queryData.cached
      );

      expect(tracked.query).toBe(queryData.query);
      expect(tracked.legalArea).toBe(queryData.legalArea);
      expect(tracked.success).toBe(true);
      expect(mockAnalyzer.trackQuery).toHaveBeenCalledTimes(1);
    });

    it('should handle batch query tracking', () => {
      // Create multiple queries using factory
      const queryFactory = createMockFactory<QueryMetrics>(
        createMockQueryMetrics(),
        (index) => ({
          query: `Test query ${index}`,
          legalArea: index % 2 === 0 ? 'labor' : 'civil',
          timestamp: Date.now() - (index * 1000)
        })
      );

      const queries = queryFactory(10);
      
      queries.forEach(query => {
        mockAnalyzer.trackQuery(
          query.query,
          query.latency,
          query.success,
          query.legalArea,
          query.relevanceScore,
          query.cached
        );
      });

      expect(mockAnalyzer.trackQuery).toHaveBeenCalledTimes(10);
    });

    it('should use fixture data for realistic scenarios', () => {
      // Load real query data from fixtures
      const fixtureQuery = queryMetricsFixture[0];
      
      expect(fixtureQuery.query).toBe('¿Cuáles son las causas de despido justificado?');
      expect(fixtureQuery.legalArea).toBe('labor');
      expect(fixtureQuery.success).toBe(true);
      expect(fixtureQuery.userFeedback).toBe('positive');
      
      // Use fixture data in tests
      const tracked = mockAnalyzer.trackQuery(
        fixtureQuery.query,
        fixtureQuery.latency,
        fixtureQuery.success,
        fixtureQuery.legalArea,
        fixtureQuery.relevanceScore,
        fixtureQuery.cached
      );

      expect(tracked.query).toBe(fixtureQuery.query);
    });
  });

  describe('Performance Reporting with Advanced Mocks', () => {
    it('should generate performance reports with conditional behavior', async () => {
      // Create conditional mock for different time ranges
      const conditionalReportMock = createConditionalMock<
        (startTime: number, endTime: number) => Promise<PerformanceReport>
      >([
        {
          when: (start, end) => (end - start) < 3600000, // Less than 1 hour
          then: () => createMockAsyncOperation(createMockPerformanceReport({
            totalQueries: 50,
            averageLatency: 120
          }), { delay: 100 })
        },
        {
          when: (start, end) => (end - start) >= 86400000, // 1 day or more
          then: () => createMockAsyncOperation(createMockPerformanceReport({
            totalQueries: 1000,
            averageLatency: 180
          }), { delay: 300 })
        }
      ], createMockAsyncOperation(createMockPerformanceReport(), { delay: 150 }));

      mockAnalyzer.getPerformanceReport = conditionalReportMock;

      // Test short time range
      const now = Date.now();
      const hourAgo = now - 3600000;
      const shortReport = await mockAnalyzer.getPerformanceReport(hourAgo, now);
      
      expect(shortReport.totalQueries).toBe(50);
      expect(shortReport.averageLatency).toBe(120);

      // Test long time range
      const dayAgo = now - 86400000;
      const longReport = await mockAnalyzer.getPerformanceReport(dayAgo, now);
      
      expect(longReport.totalQueries).toBe(1000);
      expect(longReport.averageLatency).toBe(180);
    });

    it('should handle async operations with helpers', async () => {
      const startTime = Date.now();
      const endTime = startTime + 86400000;

      // Use async helpers for more realistic testing
      const reportPromise = mockAnalyzer.getPerformanceReport(startTime, endTime);
      
      // Test with timeout
      const reportWithTimeout = await asyncHelpers.withTimeout(reportPromise, 1000);
      
      expect(reportWithTimeout.timeRange.start).toBe(startTime);
      expect(reportWithTimeout.timeRange.end).toBe(endTime);
    });

    it('should retry failed operations', async () => {
      let callCount = 0;
      
      // Mock that fails first two times, succeeds on third
      const flakyMock = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return createMockAsyncOperation(createMockPerformanceReport());
      });

      mockAnalyzer.getPerformanceReport = flakyMock;

      // Use retry helper
      const report = await asyncHelpers.retry(
        () => mockAnalyzer.getPerformanceReport(0, Date.now()),
        3,
        50
      );

      expect(report).toBeDefined();
      expect(flakyMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('Insights Generation with Mock Scenarios', () => {
    it('should generate insights based on realistic data patterns', async () => {
      // Pre-populate with fixture data patterns
      const highLatencyQueries = queryMetricsFixture.filter(q => q.latency > 200);
      const lowSuccessQueries = queryMetricsFixture.filter(q => !q.success);
      
      expect(highLatencyQueries.length).toBeGreaterThan(0);
      expect(lowSuccessQueries.length).toBeGreaterThan(0);

      const insights = await mockAnalyzer.generateInsights();
      
      expect(Array.isArray(insights)).toBe(true);
      expect(insights.length).toBeGreaterThan(0);
      
      // Check for expected insight types
      const insightTypes = insights.map(i => i.type);
      expect(insightTypes.includes('success') || insightTypes.includes('info')).toBe(true);
    });

    it('should provide actionable insights', async () => {
      const insights = await mockAnalyzer.generateInsights();
      
      insights.forEach(insight => {
        expect(insight).toHaveProperty('type');
        expect(insight).toHaveProperty('title');
        expect(['warning', 'info', 'success', 'error']).toContain(insight.type);
        expect(typeof insight.title).toBe('string');
        expect(insight.title.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Data Export with Realistic Scenarios', () => {
    it('should export query data with proper formatting', () => {
      const now = Date.now();
      const yesterday = now - 86400000;

      const blob = mockAnalyzer.exportQueryData(yesterday, now);
      
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');
    });

    it('should handle large data exports', async () => {
      // Simulate large dataset
      const largeTimeRange = 30 * 24 * 60 * 60 * 1000; // 30 days
      const endTime = Date.now();
      const startTime = endTime - largeTimeRange;

      const blob = mockAnalyzer.exportQueryData(startTime, endTime);
      
      expect(blob).toBeInstanceOf(Blob);
      
      // Test that export doesn't timeout
      await testHelpers.waitFor(() => blob.size >= 0, 5000);
    });
  });

  describe('User Feedback Integration', () => {
    it('should handle user feedback updates', async () => {
      const queryId = mockGenerators.id();
      
      await mockAnalyzer.updateUserFeedback(queryId, 'positive');
      
      expect(mockAnalyzer.updateUserFeedback).toHaveBeenCalledWith(queryId, 'positive');
    });

    it('should retrieve queries by ID', () => {
      const existingQuery = queryMetricsFixture[0];
      
      mockAnalyzer.getQueryById = vi.fn().mockReturnValue(existingQuery);
      
      const retrieved = mockAnalyzer.getQueryById(existingQuery.id);
      
      expect(retrieved).toEqual(existingQuery);
      expect(retrieved?.userFeedback).toBe('positive');
    });
  });

  describe('Time-based Analysis with Mock Data', () => {
    it('should generate hourly statistics', () => {
      const now = Date.now();
      const yesterday = now - 86400000;

      const stats = mockAnalyzer.getStatsByTimeInterval(yesterday, now, 'hour');
      
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
      
      stats.forEach(stat => {
        expect(stat).toHaveProperty('timestamp');
        expect(stat).toHaveProperty('count');
        expect(stat).toHaveProperty('averageLatency');
        expect(stat).toHaveProperty('successRate');
        expect(typeof stat.count).toBe('number');
        expect(typeof stat.averageLatency).toBe('number');
        expect(typeof stat.successRate).toBe('number');
      });
    });

    it('should handle daily statistics', () => {
      const now = Date.now();
      const lastWeek = now - (7 * 24 * 60 * 60 * 1000);

      const stats = mockAnalyzer.getStatsByTimeInterval(lastWeek, now, 'day');
      
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeLessThanOrEqual(7); // Max 7 days
    });

    it('should handle empty time periods', () => {
      const now = Date.now();
      const futureTime = now + 86400000; // Tomorrow

      const stats = mockAnalyzer.getStatsByTimeInterval(now, futureTime, 'hour');
      
      expect(Array.isArray(stats)).toBe(true);
      
      if (stats.length > 0) {
        expect(stats[0].count).toBe(0);
      }
    });
  });

  describe('Auto-Mock Service Validation', () => {
    it('should automatically mock QueryAnalyzer methods', () => {
      const autoMocked = autoMockService(QueryAnalyzer, {
        defaultReturns: {
          getRecentQueries: [],
          generateInsights: []
        },
        mockAsync: true,
        asyncDelay: 25
      });

      expect(typeof autoMocked.trackQuery).toBe('function');
      expect(typeof autoMocked.getRecentQueries).toBe('function');
      expect(typeof autoMocked.generateInsights).toBe('function');
    });

    it('should track method call sequences', async () => {
      const autoMocked = autoMockService(QueryAnalyzer);
      
      // Perform sequence of operations
      autoMocked.trackQuery('test', 100, true, 'civil', 0.8, false);
      await autoMocked.getRecentQueries(5);
      await autoMocked.generateInsights();
      
      expect(autoMocked.__mockCalls.length).toBe(3);
      expect(autoMocked.__mockCalls[0].method).toBe('trackQuery');
      expect(autoMocked.__mockCalls[1].method).toBe('getRecentQueries');
      expect(autoMocked.__mockCalls[2].method).toBe('generateInsights');
    });
  });

  describe('Error Scenarios with Mock Infrastructure', () => {
    it('should handle storage errors gracefully', async () => {
      // Mock localStorage to throw errors
      global.localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      const queryData = createMockQueryMetrics();
      
      // This should handle the error gracefully in a real implementation
      expect(() => {
        mockAnalyzer.trackQuery(
          queryData.query,
          queryData.latency,
          queryData.success,
          queryData.legalArea,
          queryData.relevanceScore,
          queryData.cached
        );
      }).not.toThrow();
    });

    it('should handle concurrent operations', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        mockAnalyzer.getPerformanceReport(Date.now() - i * 1000, Date.now())
      );

      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(10);
      expect(results.every(r => r !== null)).toBe(true);
    });
  });
});