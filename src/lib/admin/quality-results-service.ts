/**
 * Quality Results Service
 * Manages historical quality test results
 */

export interface QualityResultsQuery {
  startDate?: string;
  endDate?: string;
  testType?: string;
  limit?: number;
}

export interface QualityResult {
  id: string;
  testType: string;
  timestamp: number;
  date: string;
  metrics: {
    accuracy: number;
    latency: number;
    relevance: number;
    coverage: number;
  };
  summary: {
    totalQueries: number;
    passedQueries: number;
    failedQueries: number;
    averageScore: number;
  };
  status: 'passed' | 'failed' | 'warning';
}

export class QualityResultsService {
  private results: QualityResult[] = [];
  
  constructor() {
    this.loadResults();
  }

  async getResults(query?: QualityResultsQuery): Promise<QualityResult[]> {
    let filteredResults = [...this.results];
    
    if (query) {
      // Filter by date range
      if (query.startDate) {
        const startTime = new Date(query.startDate).getTime();
        filteredResults = filteredResults.filter(r => r.timestamp >= startTime);
      }
      
      if (query.endDate) {
        const endTime = new Date(query.endDate).getTime() + 86400000; // Include end date
        filteredResults = filteredResults.filter(r => r.timestamp < endTime);
      }
      
      // Filter by test type
      if (query.testType) {
        filteredResults = filteredResults.filter(r => r.testType === query.testType);
      }
      
      // Apply limit
      if (query.limit) {
        filteredResults = filteredResults.slice(0, query.limit);
      }
    }
    
    // Sort by timestamp descending (most recent first)
    filteredResults.sort((a, b) => b.timestamp - a.timestamp);
    
    return filteredResults;
  }

  async addResult(result: Omit<QualityResult, 'id' | 'date' | 'status'>): Promise<void> {
    const id = `result-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const date = new Date(result.timestamp).toISOString().split('T')[0];
    
    // Determine status based on metrics
    let status: QualityResult['status'] = 'passed';
    if (result.metrics.accuracy < 0.6 || result.metrics.latency > 2000) {
      status = 'failed';
    } else if (result.metrics.accuracy < 0.8 || result.metrics.latency > 1000) {
      status = 'warning';
    }
    
    const fullResult: QualityResult = {
      ...result,
      id,
      date,
      status
    };
    
    this.results.push(fullResult);
    this.saveResults();
  }

  async deleteResult(id: string): Promise<void> {
    this.results = this.results.filter(r => r.id !== id);
    this.saveResults();
  }

  async clearResults(): Promise<void> {
    this.results = [];
    this.saveResults();
  }

  async getStatistics(): Promise<{
    totalTests: number;
    passedTests: number;
    failedTests: number;
    warningTests: number;
    averageAccuracy: number;
    averageLatency: number;
    testTypes: Record<string, number>;
  }> {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'passed').length;
    const failedTests = this.results.filter(r => r.status === 'failed').length;
    const warningTests = this.results.filter(r => r.status === 'warning').length;
    
    const averageAccuracy = totalTests > 0
      ? this.results.reduce((sum, r) => sum + r.metrics.accuracy, 0) / totalTests
      : 0;
    
    const averageLatency = totalTests > 0
      ? this.results.reduce((sum, r) => sum + r.metrics.latency, 0) / totalTests
      : 0;
    
    const testTypes: Record<string, number> = {};
    for (const result of this.results) {
      testTypes[result.testType] = (testTypes[result.testType] || 0) + 1;
    }
    
    return {
      totalTests,
      passedTests,
      failedTests,
      warningTests,
      averageAccuracy,
      averageLatency,
      testTypes
    };
  }

  private loadResults(): void {
    // Load from localStorage if available
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('lexmx_quality_results');
        if (stored) {
          this.results = JSON.parse(stored);
        } else {
          // Generate some sample data for demonstration (only in browser)
          this.generateSampleData();
        }
      } catch (error) {
        console.error('Failed to load quality results:', error);
        // Only generate sample data in browser context
        if (typeof window !== 'undefined') {
          this.generateSampleData();
        }
      }
    }
    // Don't generate sample data during SSG build
  }

  private saveResults(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('lexmx_quality_results', JSON.stringify(this.results));
      } catch (error) {
        console.error('Failed to save quality results:', error);
      }
    }
  }

  private generateSampleData(): void {
    const testTypes = ['basic', 'complex', 'edge_cases', 'performance'];
    const now = Date.now();
    const dayMs = 86400000;
    
    // Generate 30 days of sample data
    for (let i = 0; i < 30; i++) {
      const timestamp = now - (i * dayMs);
      const date = new Date(timestamp).toISOString().split('T')[0];
      
      // Generate 1-3 tests per day
      const testsPerDay = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < testsPerDay; j++) {
        const testType = testTypes[Math.floor(Math.random() * testTypes.length)];
        const accuracy = 0.5 + Math.random() * 0.5; // 50-100%
        const latency = 200 + Math.random() * 1800; // 200-2000ms
        const relevance = 0.6 + Math.random() * 0.4; // 60-100%
        const coverage = 0.4 + Math.random() * 0.6; // 40-100%
        
        const totalQueries = 10 + Math.floor(Math.random() * 40); // 10-50 queries
        const passedQueries = Math.floor(totalQueries * accuracy);
        const failedQueries = totalQueries - passedQueries;
        
        let status: QualityResult['status'] = 'passed';
        if (accuracy < 0.6 || latency > 1500) {
          status = 'failed';
        } else if (accuracy < 0.8 || latency > 1000) {
          status = 'warning';
        }
        
        this.results.push({
          id: `result-${timestamp}-${j}`,
          testType,
          timestamp: timestamp + (j * 3600000), // Spread throughout the day
          date,
          metrics: {
            accuracy,
            latency,
            relevance,
            coverage
          },
          summary: {
            totalQueries,
            passedQueries,
            failedQueries,
            averageScore: accuracy
          },
          status
        });
      }
    }
    
    this.saveResults();
  }
}