// Quality Test Suite for Mexican Legal RAG System
// Tests various aspects of retrieval and response quality

import type { LegalArea, QueryType, LegalResponse } from '@/types/legal';
import { LegalRAGEngine } from '@/lib/rag/engine';
import { adminDataService } from './admin-data-service';

export interface QualityTest {
  id: string;
  name: string;
  description: string;
  category: 'citation' | 'semantic' | 'cross-reference' | 'contradiction' | 'performance';
  query: string;
  expectedResults: TestExpectation[];
  timeout: number; // in milliseconds
}

export interface TestExpectation {
  type: 'contains_text' | 'min_relevance' | 'max_latency' | 'legal_area' | 'query_type' | 'document_count' | 'citation_accuracy';
  value: string | number | LegalArea | QueryType;
  threshold?: number;
  description: string;
}

export interface TestResult {
  testId: string;
  passed: boolean;
  score: number; // 0-1
  duration: number; // in milliseconds
  details: TestResultDetail[];
  response?: LegalResponse;
  error?: string;
  timestamp: number;
}

export interface TestResultDetail {
  expectation: TestExpectation;
  passed: boolean;
  actualValue: any;
  score: number;
  message: string;
}

export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passedTests: number;
  averageScore: number;
  totalDuration: number;
  results: TestResult[];
  timestamp: number;
}

export class QualityTestSuite {
  private ragEngine: LegalRAGEngine;
  private predefinedTests: QualityTest[] = [];
  
  constructor() {
    this.ragEngine = new LegalRAGEngine();
    this.initializePredefinedTests();
  }

  async initialize(): Promise<void> {
    await this.ragEngine.initialize();
  }

  private initializePredefinedTests(): void {
    this.predefinedTests = [
      // Legal Citation Accuracy Tests
      {
        id: 'citation-art-123',
        name: 'Artículo 123 Constitucional',
        description: 'Test retrieval accuracy for constitutional labor article',
        category: 'citation',
        query: 'Artículo 123 constitucional',
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
          },
          {
            type: 'query_type',
            value: 'citation',
            description: 'Should classify as citation query'
          },
          {
            type: 'min_relevance',
            value: 0.8,
            description: 'Top result should have high relevance'
          },
          {
            type: 'document_count',
            value: 1,
            threshold: 3,
            description: 'Should return at least 1 relevant document'
          }
        ],
        timeout: 10000
      },
      {
        id: 'citation-lft-47',
        name: 'Artículo 47 LFT',
        description: 'Test retrieval of specific labor law article on justified dismissal',
        category: 'citation',
        query: 'Artículo 47 de la Ley Federal del Trabajo',
        expectedResults: [
          {
            type: 'contains_text',
            value: 'rescisión',
            description: 'Should contain employment termination text'
          },
          {
            type: 'legal_area',
            value: 'labor',
            description: 'Should identify as labor law'
          },
          {
            type: 'citation_accuracy',
            value: 'artículo 47',
            description: 'Should accurately cite article 47'
          },
          {
            type: 'min_relevance',
            value: 0.85,
            description: 'Should have very high relevance for exact citation'
          }
        ],
        timeout: 10000
      },

      // Semantic Similarity Tests
      {
        id: 'semantic-despido',
        name: 'Requisitos Despido Justificado',
        description: 'Test semantic understanding of employment termination requirements',
        category: 'semantic',
        query: 'Requisitos para despido justificado',
        expectedResults: [
          {
            type: 'legal_area',
            value: 'labor',
            description: 'Should identify as labor law'
          },
          {
            type: 'query_type',
            value: 'procedural',
            description: 'Should classify as procedural query'
          },
          {
            type: 'contains_text',
            value: 'causas de rescisión',
            description: 'Should contain termination causes'
          },
          {
            type: 'min_relevance',
            value: 0.7,
            description: 'Should find relevant procedural information'
          }
        ],
        timeout: 10000
      },
      {
        id: 'semantic-pension-alimenticia',
        name: 'Pensión Alimenticia Porcentaje',
        description: 'Test understanding of alimony percentage requirements',
        category: 'semantic',
        query: 'Pensión alimenticia porcentaje',
        expectedResults: [
          {
            type: 'legal_area',
            value: 'family',
            description: 'Should identify as family law'
          },
          {
            type: 'contains_text',
            value: 'alimento',
            description: 'Should contain alimony-related content'
          },
          {
            type: 'min_relevance',
            value: 0.6,
            description: 'Should find relevant family law provisions'
          }
        ],
        timeout: 10000
      },

      // Cross-Reference Detection Tests
      {
        id: 'cross-ref-amparo',
        name: 'Amparo Directo vs Indirecto',
        description: 'Test ability to find and compare different types of amparo',
        category: 'cross-reference',
        query: 'Amparo directo vs indirecto',
        expectedResults: [
          {
            type: 'legal_area',
            value: 'constitutional',
            description: 'Should identify as constitutional law'
          },
          {
            type: 'query_type',
            value: 'comparative',
            description: 'Should classify as comparative query'
          },
          {
            type: 'contains_text',
            value: 'amparo',
            description: 'Should contain amparo information'
          },
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
        id: 'cross-ref-garantias',
        name: 'Garantías Individuales Referencias',
        description: 'Test cross-referencing of constitutional guarantees',
        category: 'cross-reference',
        query: 'garantías individuales constitucionales',
        expectedResults: [
          {
            type: 'legal_area',
            value: 'constitutional',
            description: 'Should identify as constitutional law'
          },
          {
            type: 'contains_text',
            value: 'derechos',
            description: 'Should contain rights information'
          },
          {
            type: 'min_relevance',
            value: 0.65,
            description: 'Should find constitutional provisions'
          }
        ],
        timeout: 12000
      },

      // Contradiction Detection Tests
      {
        id: 'contradiction-labor-hours',
        name: 'Contradicciones Jornada Laboral',
        description: 'Test detection of conflicting labor hour provisions',
        category: 'contradiction',
        query: 'jornada máxima de trabajo horas permitidas',
        expectedResults: [
          {
            type: 'legal_area',
            value: 'labor',
            description: 'Should identify as labor law'
          },
          {
            type: 'contains_text',
            value: 'jornada',
            description: 'Should contain work schedule information'
          },
          {
            type: 'document_count',
            value: 2,
            threshold: 5,
            description: 'Should find multiple relevant provisions'
          }
        ],
        timeout: 15000
      },

      // Performance Tests
      {
        id: 'performance-simple',
        name: 'Simple Query Performance',
        description: 'Test response time for simple constitutional query',
        category: 'performance',
        query: 'Constitución Política mexicana',
        expectedResults: [
          {
            type: 'max_latency',
            value: 5000,
            description: 'Should respond within 5 seconds'
          },
          {
            type: 'min_relevance',
            value: 0.5,
            description: 'Should find basic relevant content'
          }
        ],
        timeout: 8000
      }
    ];
  }

  /**
   * Run a single quality test
   */
  async runTest(testId: string): Promise<TestResult> {
    const test = this.predefinedTests.find(t => t.id === testId);
    if (!test) {
      throw new Error(`Test with ID ${testId} not found`);
    }

    const startTime = Date.now();
    
    try {
      console.log(`Running quality test: ${test.name}`);
      
      // Execute the query using RAG engine
      const response = await Promise.race([
        this.ragEngine.processLegalQuery(test.query),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), test.timeout)
        )
      ]);

      const duration = Date.now() - startTime;
      
      // Evaluate expectations
      const details: TestResultDetail[] = [];
      let totalScore = 0;
      let passedExpectations = 0;

      for (const expectation of test.expectedResults) {
        const detail = await this.evaluateExpectation(expectation, response, duration);
        details.push(detail);
        totalScore += detail.score;
        if (detail.passed) passedExpectations++;
      }

      const averageScore = test.expectedResults.length > 0 
        ? totalScore / test.expectedResults.length 
        : 0;
      
      const passed = passedExpectations === test.expectedResults.length;

      // Log query for analytics
      adminDataService.logQuery(duration, !passed, response.fromCache);

      return {
        testId: test.id,
        passed,
        score: averageScore,
        duration,
        details,
        response,
        timestamp: Date.now()
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log failed query
      adminDataService.logQuery(duration, true, false);

      return {
        testId: test.id,
        passed: false,
        score: 0,
        duration,
        details: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  /**
   * Run all tests in the suite
   */
  async runAllTests(): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const results: TestResult[] = [];

    console.log(`Running ${this.predefinedTests.length} quality tests...`);

    for (const test of this.predefinedTests) {
      try {
        const result = await this.runTest(test.id);
        results.push(result);
        console.log(`Test ${test.name}: ${result.passed ? 'PASS' : 'FAIL'} (${(result.score * 100).toFixed(1)}%)`);
      } catch (error) {
        console.error(`Failed to run test ${test.id}:`, error);
        results.push({
          testId: test.id,
          passed: false,
          score: 0,
          duration: 0,
          details: [],
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }
    }

    const totalDuration = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const averageScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length
      : 0;

    const suiteResult: TestSuiteResult = {
      suiteName: 'Mexican Legal RAG Quality Tests',
      totalTests: this.predefinedTests.length,
      passedTests,
      averageScore,
      totalDuration,
      results,
      timestamp: Date.now()
    };

    // Store results in localStorage for admin panel
    this.storeTestResults(suiteResult);

    return suiteResult;
  }

  /**
   * Run tests by category
   */
  async runTestsByCategory(category: QualityTest['category']): Promise<TestSuiteResult> {
    const categoryTests = this.predefinedTests.filter(test => test.category === category);
    const startTime = Date.now();
    const results: TestResult[] = [];

    console.log(`Running ${categoryTests.length} ${category} tests...`);

    for (const test of categoryTests) {
      const result = await this.runTest(test.id);
      results.push(result);
    }

    const totalDuration = Date.now() - startTime;
    const passedTests = results.filter(r => r.passed).length;
    const averageScore = results.length > 0
      ? results.reduce((sum, r) => sum + r.score, 0) / results.length
      : 0;

    return {
      suiteName: `${category} Tests`,
      totalTests: categoryTests.length,
      passedTests,
      averageScore,
      totalDuration,
      results,
      timestamp: Date.now()
    };
  }

  /**
   * Evaluate a single test expectation
   */
  private async evaluateExpectation(
    expectation: TestExpectation,
    response: LegalResponse,
    duration: number
  ): Promise<TestResultDetail> {
    let passed = false;
    let score = 0;
    let actualValue: any;
    let message = '';

    switch (expectation.type) {
      case 'contains_text':
        actualValue = response.answer.toLowerCase().includes(expectation.value.toString().toLowerCase());
        passed = actualValue;
        score = passed ? 1 : 0;
        message = passed 
          ? `Response contains expected text: "${expectation.value}"`
          : `Response does not contain expected text: "${expectation.value}"`;
        break;

      case 'min_relevance':
        actualValue = response.sources.length > 0 ? response.sources[0].relevanceScore : 0;
        passed = actualValue >= Number(expectation.value);
        score = Math.min(actualValue / Number(expectation.value), 1);
        message = `Relevance score: ${actualValue.toFixed(3)} (required: ${expectation.value})`;
        break;

      case 'max_latency':
        actualValue = duration;
        passed = actualValue <= Number(expectation.value);
        score = passed ? 1 : Math.max(0, 1 - (actualValue - Number(expectation.value)) / Number(expectation.value));
        message = `Response time: ${actualValue}ms (max: ${expectation.value}ms)`;
        break;

      case 'legal_area':
        actualValue = response.legalArea;
        passed = actualValue === expectation.value;
        score = passed ? 1 : 0.5; // Partial credit for wrong area but successful processing
        message = `Legal area: ${actualValue} (expected: ${expectation.value})`;
        break;

      case 'query_type':
        actualValue = response.queryType;
        passed = actualValue === expectation.value;
        score = passed ? 1 : 0.7; // Partial credit for wrong type but successful processing
        message = `Query type: ${actualValue} (expected: ${expectation.value})`;
        break;

      case 'document_count': {
        actualValue = response.sources.length;
        const threshold = expectation.threshold || 1;
        passed = actualValue >= threshold;
        score = Math.min(actualValue / threshold, 1);
        message = `Documents found: ${actualValue} (minimum: ${threshold})`;
        break;
      }

      case 'citation_accuracy': {
        const citationText = expectation.value.toString().toLowerCase();
        const responseText = response.answer.toLowerCase();
        const sourcesText = response.sources.map(s => s.title.toLowerCase() + ' ' + s.excerpt.toLowerCase()).join(' ');
        actualValue = responseText.includes(citationText) || sourcesText.includes(citationText);
        passed = actualValue;
        score = passed ? 1 : 0;
        message = passed 
          ? `Citation accurately referenced: "${expectation.value}"`
          : `Citation not found in response: "${expectation.value}"`;
        break;
      }

      default:
        passed = false;
        score = 0;
        actualValue = null;
        message = `Unknown expectation type: ${expectation.type}`;
    }

    return {
      expectation,
      passed,
      actualValue,
      score,
      message
    };
  }

  /**
   * Get list of all available tests
   */
  getAvailableTests(): QualityTest[] {
    return [...this.predefinedTests];
  }

  /**
   * Get tests by category
   */
  getTestsByCategory(category: QualityTest['category']): QualityTest[] {
    return this.predefinedTests.filter(test => test.category === category);
  }

  /**
   * Get test categories
   */
  getCategories(): QualityTest['category'][] {
    return ['citation', 'semantic', 'cross-reference', 'contradiction', 'performance'];
  }

  /**
   * Store test results in localStorage
   */
  private storeTestResults(results: TestSuiteResult): void {
    try {
      const key = 'lexmx_quality_test_results';
      const stored = localStorage.getItem(key);
      const history: TestSuiteResult[] = stored ? JSON.parse(stored) : [];
      
      history.unshift(results);
      
      // Keep only last 10 test runs
      if (history.length > 10) {
        history.splice(10);
      }
      
      localStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to store test results:', error);
    }
  }

  /**
   * Get stored test results
   */
  getStoredResults(): TestSuiteResult[] {
    try {
      const key = 'lexmx_quality_test_results';
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to retrieve test results:', error);
      return [];
    }
  }

  /**
   * Generate test report
   */
  generateReport(results: TestSuiteResult): string {
    const passRate = (results.passedTests / results.totalTests * 100).toFixed(1);
    const scorePercentage = (results.averageScore * 100).toFixed(1);
    
    let report = `# Quality Test Report\n\n`;
    report += `**Date:** ${new Date(results.timestamp).toLocaleString()}\n`;
    report += `**Suite:** ${results.suiteName}\n`;
    report += `**Pass Rate:** ${passRate}% (${results.passedTests}/${results.totalTests})\n`;
    report += `**Average Score:** ${scorePercentage}%\n`;
    report += `**Total Duration:** ${(results.totalDuration / 1000).toFixed(2)}s\n\n`;

    report += `## Test Results\n\n`;
    
    for (const result of results.results) {
      const test = this.predefinedTests.find(t => t.id === result.testId);
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      const score = (result.score * 100).toFixed(1);
      
      report += `### ${test?.name || result.testId} ${status}\n`;
      report += `**Score:** ${score}% | **Duration:** ${result.duration}ms\n`;
      
      if (result.error) {
        report += `**Error:** ${result.error}\n`;
      }
      
      if (result.details.length > 0) {
        report += `**Details:**\n`;
        for (const detail of result.details) {
          const detailStatus = detail.passed ? '✅' : '❌';
          report += `- ${detailStatus} ${detail.message}\n`;
        }
      }
      
      report += `\n`;
    }

    return report;
  }

  /**
   * Export test results to file
   */
  async exportResults(results: TestSuiteResult): Promise<Blob> {
    const report = this.generateReport(results);
    return new Blob([report], { type: 'text/markdown' });
  }
}

// Singleton instance
export const qualityTestSuite = new QualityTestSuite();