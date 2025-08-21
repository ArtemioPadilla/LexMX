import { useState, useEffect } from 'react';
import { useTranslation } from '../../i18n/index';
import { qualityTestSuite, type QualityTest, type TestResult, type TestSuiteResult } from '../../lib/admin/quality-test-suite';
import { queryAnalyzer, type QueryMetrics, type PerformanceReport, type PerformanceInsight } from '../../lib/admin/query-analyzer';
import type { QualityStats } from '../../lib/admin/admin-data-service';
import { getUrl } from '../../utils/urls';

export default function QualityMetrics() {
  const { t } = useTranslation();
  
  // State for metrics
  const [qualityStats, setQualityStats] = useState<QualityStats | null>(null);
  const [performanceReport, setPerformanceReport] = useState<PerformanceReport | null>(null);
  const [recentQueries, setRecentQueries] = useState<QueryMetrics[]>([]);
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  
  // State for tests
  const [availableTests, setAvailableTests] = useState<QualityTest[]>([]);
  const [runningTests, setRunningTests] = useState<Set<string>>(new Set());
  const [testResults, setTestResults] = useState<Map<string, TestResult>>(new Map());
  const [lastSuiteResult, setLastSuiteResult] = useState<TestSuiteResult | null>(null);
  const [runningAllTests, setRunningAllTests] = useState(false);
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'metrics' | 'tests' | 'queries' | 'insights'>('metrics');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [timeRange, setTimeRange] = useState('7d');

  // Initialize and load data
  useEffect(() => {
    initializeServices();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadMetricsData();
    }
  }, [loading, timeRange]);

  const initializeServices = async () => {
    try {
      setLoading(true);
      
      // Initialize quality test suite
      await qualityTestSuite.initialize();
      const tests = qualityTestSuite.getAvailableTests();
      setAvailableTests(tests);
      
      // Load stored test results
      const storedResults = qualityTestSuite.getStoredResults();
      if (storedResults.length > 0) {
        setLastSuiteResult(storedResults[0]);
        
        // Convert to test results map
        const resultsMap = new Map<string, TestResult>();
        for (const result of storedResults[0].results) {
          resultsMap.set(result.testId, result);
        }
        setTestResults(resultsMap);
      }
      
    } catch (error) {
      console.error('Failed to initialize quality metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetricsData = async () => {
    try {
      setError(null);
      
      // Load quality stats from API with detailed information
      const response = await fetch(getUrl('api/quality/metrics?detailed=true&historical=true'));
      if (!response.ok) {
        throw new Error(`Failed to fetch quality metrics: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch quality metrics');
      }
      
      // Set quality stats
      setQualityStats(data.data.current);
      
      // Set performance report from API data
      if (data.data.current) {
        setPerformanceReport({
          totalQueries: data.data.current.totalQueries || 0,
          averageLatency: data.data.current.averageLatency || 0,
          successRate: data.data.current.retrievalAccuracy || 0,
          cacheHitRate: data.data.current.cacheHitRate || 0,
          errorRate: ((data.data.current.failedQueries || 0) / Math.max(data.data.current.totalQueries, 1)) * 100,
        });
      }
      
      // For now, set empty arrays for queries and insights
      // These would come from a separate analytics service
      setRecentQueries([]);
      setInsights([
        {
          type: 'info',
          title: 'Quality Metrics Available',
          description: `Current system shows ${data.data.current?.retrievalAccuracy?.toFixed(1) || 0}% retrieval accuracy`,
          recommendation: 'Monitor quality metrics regularly to ensure optimal performance'
        }
      ]);
      
    } catch (error) {
      console.error('Failed to load metrics data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load quality metrics');
    }
  };

  const runSingleTest = async (testId: string) => {
    try {
      setRunningTests(prev => new Set(prev).add(testId));
      setError(null);
      
      const response = await fetch(getUrl('api/quality/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testId }),
      });
      
      if (!response.ok) {
        throw new Error(`Test failed: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Test execution failed');
      }
      
      setTestResults(prev => new Map(prev).set(testId, data.data));
      
    } catch (error) {
      console.error(`Failed to run test ${testId}:`, error);
      setError(error instanceof Error ? error.message : `Failed to run test ${testId}`);
    } finally {
      setRunningTests(prev => {
        const newSet = new Set(prev);
        newSet.delete(testId);
        return newSet;
      });
    }
  };

  const runAllTests = async () => {
    try {
      setRunningAllTests(true);
      setError(null);
      
      const response = await fetch(getUrl('api/quality/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'run_all' }),
      });
      
      if (!response.ok) {
        throw new Error(`Test suite failed: ${response.status}`);
      }
      
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Test suite execution failed');
      }
      
      const suiteResult = data.data;
      setLastSuiteResult(suiteResult);
      
      // Update individual test results
      const resultsMap = new Map<string, TestResult>();
      for (const result of suiteResult.results) {
        resultsMap.set(result.testId, result);
      }
      setTestResults(resultsMap);
      
      // Refresh metrics after tests
      await loadMetricsData();
      
    } catch (error) {
      console.error('Failed to run all tests:', error);
      setError(error instanceof Error ? error.message : 'Failed to run test suite');
    } finally {
      setRunningAllTests(false);
    }
  };

  const runTestsByCategory = async (category: QualityTest['category']) => {
    try {
      setRunningAllTests(true);
      
      const suiteResult = await qualityTestSuite.runTestsByCategory(category);
      
      // Update results for tests in this category
      for (const result of suiteResult.results) {
        setTestResults(prev => new Map(prev).set(result.testId, result));
      }
      
    } catch (error) {
      console.error(`Failed to run ${category} tests:`, error);
    } finally {
      setRunningAllTests(false);
    }
  };

  const exportReport = async () => {
    if (!lastSuiteResult) return;
    
    try {
      const reportBlob = await qualityTestSuite.exportResults(lastSuiteResult);
      const url = URL.createObjectURL(reportBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `quality-report-${new Date().toISOString().split('T')[0]}.md`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export report:', error);
    }
  };

  const exportQueryData = async () => {
    try {
      const endTime = Date.now();
      const startTime = timeRange === '7d' 
        ? endTime - 7 * 24 * 60 * 60 * 1000 
        : endTime - 30 * 24 * 60 * 60 * 1000;
      
      const dataBlob = queryAnalyzer.exportQueryData(startTime, endTime);
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `query-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export query data:', error);
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  const getTestStatusColor = (result: TestResult | undefined): string => {
    if (!result) return 'text-gray-500';
    if (result.passed) return 'text-green-600 dark:text-green-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getInsightColor = (type: PerformanceInsight['type']): string => {
    switch (type) {
      case 'success': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'error': return 'text-red-600 dark:text-red-400';
      case 'info': return 'text-blue-600 dark:text-blue-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getInsightIcon = (type: PerformanceInsight['type']): string => {
    switch (type) {
      case 'success': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '📊';
    }
  };

  const getFilteredTests = (): QualityTest[] => {
    if (selectedCategory === 'all') return availableTests;
    return availableTests.filter(test => test.category === selectedCategory);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-legal-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          <div className="flex items-start">
            <span className="text-red-500 mr-2 font-bold">⚠️</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">Error</p>
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-red-500 hover:text-red-700 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'metrics', label: t('admin.quality.metrics.accuracy') },
            { key: 'tests', label: t('admin.quality.tests.title') },
            { key: 'queries', label: t('admin.quality.queries.title') },
            { key: 'insights', label: t('admin.quality.insights.title') }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`py-2 px-1 text-sm font-medium border-b-2 ${
                activeTab === tab.key
                  ? 'border-legal-500 text-legal-600 dark:text-legal-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {activeTab === 'metrics' && t('admin.quality.metrics.accuracy')}
          {activeTab === 'tests' && t('admin.quality.tests.title')}
          {activeTab === 'queries' && t('admin.quality.queries.title')}
          {activeTab === 'insights' && t('admin.quality.insights.title')}
        </h2>
        
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="7d">{t('admin.quality.reports.last7Days')}</option>
            <option value="30d">{t('admin.quality.reports.last30Days')}</option>
          </select>
        </div>
      </div>

      {/* Metrics Tab */}
      {activeTab === 'metrics' && (
        <div className="space-y-6">
          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('admin.quality.metrics.accuracy')}
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {qualityStats ? formatPercentage(qualityStats.retrievalAccuracy) : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Top-5 relevance
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('admin.quality.metrics.avgLatency')}
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {qualityStats ? formatDuration(qualityStats.averageLatency) : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Query to response
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('admin.quality.metrics.coverage')}
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {qualityStats ? formatPercentage(qualityStats.corpusCoverage) : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Documents with embeddings
              </p>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                {t('admin.quality.metrics.userSatisfaction')}
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                {qualityStats ? `${qualityStats.userSatisfaction.toFixed(1)}/5` : '--'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Based on feedback
              </p>
            </div>
          </div>

          {/* Additional Metrics */}
          {performanceReport && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.quality.metrics.cacheHitRate')}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {formatPercentage(performanceReport.cacheHitRate)}
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.quality.metrics.totalQueries')}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {performanceReport.totalQueries.toLocaleString()}
                </p>
              </div>
              
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {t('admin.quality.metrics.errorRate')}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {formatPercentage(performanceReport.errorRate)}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tests Tab */}
      {activeTab === 'tests' && (
        <div className="space-y-6">
          {/* Test Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              >
                <option value="all">{t('common.all')}</option>
                <option value="citation">{t('admin.quality.tests.categories.citation')}</option>
                <option value="semantic">{t('admin.quality.tests.categories.semantic')}</option>
                <option value="cross-reference">{t('admin.quality.tests.categories.crossReference')}</option>
                <option value="contradiction">{t('admin.quality.tests.categories.contradiction')}</option>
                <option value="performance">{t('admin.quality.tests.categories.performance')}</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              {selectedCategory !== 'all' && (
                <button
                  onClick={() => runTestsByCategory(selectedCategory as QualityTest['category'])}
                  disabled={runningAllTests}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {runningAllTests ? t('admin.quality.tests.running') : `Run ${selectedCategory} Tests`}
                </button>
              )}
              
              <button
                onClick={runAllTests}
                disabled={runningAllTests}
                className="px-4 py-2 bg-legal-600 text-white rounded-lg hover:bg-legal-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {runningAllTests ? t('admin.quality.tests.running') : t('admin.quality.tests.runAllTests')}
              </button>
              
              {lastSuiteResult && (
                <button
                  onClick={exportReport}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
                >
                  {t('admin.quality.reports.export')}
                </button>
              )}
            </div>
          </div>

          {/* Test Results Summary */}
          {lastSuiteResult && (
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Last Test Run Results
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Pass Rate</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatPercentage((lastSuiteResult.passedTests / lastSuiteResult.totalTests) * 100)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.quality.tests.score')}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatPercentage(lastSuiteResult.averageScore * 100)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.quality.tests.duration')}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatDuration(lastSuiteResult.totalDuration)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Tests Run</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {lastSuiteResult.totalTests}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Individual Tests */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('admin.quality.tests.title')}
              </h3>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                {getFilteredTests().map((test) => {
                  const result = testResults.get(test.id);
                  const isRunning = runningTests.has(test.id);
                  
                  return (
                    <div key={test.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {test.name}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {test.description}
                        </p>
                        {result && (
                          <div className="mt-2 flex items-center space-x-4 text-xs">
                            <span className={getTestStatusColor(result)}>
                              {result.passed ? t('admin.quality.tests.passed') : t('admin.quality.tests.failed')}
                            </span>
                            <span className="text-gray-500">
                              {t('admin.quality.tests.score')}: {formatPercentage(result.score * 100)}
                            </span>
                            <span className="text-gray-500">
                              {t('admin.quality.tests.duration')}: {formatDuration(result.duration)}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3">
                        {result && (
                          <span className={`text-sm font-medium ${getTestStatusColor(result)}`}>
                            {result.passed ? '✅' : '❌'} {formatPercentage(result.score * 100)}
                          </span>
                        )}
                        <button
                          onClick={() => runSingleTest(test.id)}
                          disabled={isRunning || runningAllTests}
                          className="px-3 py-1 text-sm bg-legal-600 text-white rounded hover:bg-legal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isRunning ? t('admin.quality.tests.running') : t('admin.quality.tests.runTest')}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queries Tab */}
      {activeTab === 'queries' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={exportQueryData}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm"
            >
              {t('admin.quality.reports.export')} Data
            </button>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('admin.quality.queries.title')}
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.quality.queries.query')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.quality.queries.legalArea')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.quality.queries.relevanceScore')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {t('admin.quality.queries.responseTime')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {recentQueries.length > 0 ? recentQueries.map((query) => (
                    <tr key={query.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                        {query.query}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {query.legalArea || '--'}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span className={`${query.relevanceScore > 0.7 ? 'text-green-600 dark:text-green-400' : query.relevanceScore > 0.5 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                          {query.relevanceScore.toFixed(3)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                        {formatDuration(query.latency)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center space-x-2">
                          {query.success ? (
                            <span className="text-green-600 dark:text-green-400">✅</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400">❌</span>
                          )}
                          {query.cached && (
                            <span className="text-blue-600 dark:text-blue-400" title="Cached">💾</span>
                          )}
                          {query.userFeedback === 'positive' && (
                            <span className="text-green-600 dark:text-green-400">👍</span>
                          )}
                          {query.userFeedback === 'negative' && (
                            <span className="text-red-600 dark:text-red-400">👎</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">
                        {t('admin.quality.queries.noQueries')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('admin.quality.insights.title')}
              </h3>
            </div>
            
            <div className="p-6">
              {insights.length > 0 ? (
                <div className="space-y-4">
                  {insights.map((insight, index) => (
                    <div key={index} className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <span className="text-lg">{getInsightIcon(insight.type)}</span>
                      <div className="flex-1">
                        <h4 className={`text-sm font-medium ${getInsightColor(insight.type)}`}>
                          {insight.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {insight.description}
                        </p>
                        {insight.recommendation && (
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2 italic">
                            💡 {insight.recommendation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                  {t('admin.quality.insights.noInsights')}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}