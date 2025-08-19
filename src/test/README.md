# LexMX Test Infrastructure

This directory contains comprehensive mock infrastructure for testing the LexMX legal AI assistant. The infrastructure provides factories, service mocks, fixtures, and utilities to improve test reliability and maintainability.

## Directory Structure

```
src/test/
├── mocks/
│   ├── factories.ts          # Data factories for creating test objects
│   ├── service-mocks.ts      # Comprehensive service mocks
│   ├── auto-mock.ts          # Automatic mocking utilities
│   └── index.ts              # Central export point
├── fixtures/
│   ├── legal-documents.json  # Sample legal document data
│   ├── query-metrics.json    # Sample query performance data
│   ├── test-results.json     # Sample quality test results
│   └── embeddings.json       # Sample embedding data
├── basic.test.tsx            # Basic React component tests
├── setupTests.ts             # Global test setup
├── test-utils.tsx            # React testing utilities
└── README.md                 # This file
```

## Quick Start

### 1. Basic Test Setup

```typescript
import { setupTestEnvironment, resetAllMocks } from '@/test/mocks';

describe('MyComponent', () => {
  const { beforeEach, afterEach } = setupTestEnvironment();
  
  beforeEach();
  afterEach();
  
  it('should work', () => {
    // Your test code
  });
});
```

### 2. Using Mock Factories

```typescript
import { createMockDocument, createMockQueryMetrics } from '@/test/mocks';

// Create realistic test data
const mockDoc = createMockDocument({
  title: 'Custom Test Document',
  type: 'law',
  primaryArea: 'labor'
});

const mockQuery = createMockQueryMetrics({
  query: 'Custom test query',
  success: true,
  relevanceScore: 0.95
});
```

### 3. Using Service Mocks

```typescript
import { createMockCorpusService } from '@/test/mocks';

describe('Component using CorpusService', () => {
  let mockService: ReturnType<typeof createMockCorpusService>;

  beforeEach(() => {
    mockService = createMockCorpusService();
  });

  it('should fetch documents', async () => {
    const docs = await mockService.getDocuments();
    expect(Array.isArray(docs)).toBe(true);
    expect(mockService.getDocuments).toHaveBeenCalledTimes(1);
  });
});
```

### 4. Using Fixture Data

```typescript
import { legalDocumentsFixture, queryMetricsFixture } from '@/test/mocks';

// Use realistic data from fixtures
const lftDocument = legalDocumentsFixture.find(doc => 
  doc.id === 'lft-mexico'
);

const successfulQueries = queryMetricsFixture.filter(q => 
  q.success === true
);
```

## Mock Factories

### Document Factories

```typescript
// Legal document with defaults
const doc = createMockDocument();

// Customized legal document
const customDoc = createMockDocument({
  type: 'code',
  primaryArea: 'civil',
  title: 'Código Civil Federal'
});

// Legal content chunks
const content = createMockLegalContent({
  type: 'article',
  number: '123',
  content: 'Custom article content'
});
```

### Performance Data Factories

```typescript
// Query metrics
const metrics = createMockQueryMetrics({
  latency: 150,
  success: true,
  legalArea: 'labor'
});

// Performance reports
const report = createMockPerformanceReport({
  totalQueries: 1000,
  averageLatency: 180,
  successfulQueries: 850
});

// Test results
const testResult = createMockTestResult({
  testId: 'citation-test-001',
  passed: true,
  score: 0.95
});
```

### Vector and Embedding Factories

```typescript
// Embedding vectors
const embedding = createMockEmbedding(1536); // 1536 dimensions

// Vector documents for search
const vectorDoc = createMockVectorDocument({
  content: 'Legal text content',
  metadata: {
    documentId: 'lft-mexico',
    legalArea: 'labor'
  }
});
```

## Service Mocks

### CorpusService Mock

```typescript
const mockCorpus = createMockCorpusService();

// Test document operations
await mockCorpus.getDocuments({ type: 'law' });
await mockCorpus.deleteDocument('doc-id');
await mockCorpus.validateCorpus();

// Listen to events
mockCorpus.on('progress', (event) => {
  console.log(`Progress: ${event.stage}`);
});
```

### QueryAnalyzer Mock

```typescript
const mockAnalyzer = createMockQueryAnalyzer();

// Track queries
mockAnalyzer.trackQuery('test query', 150, true, 'labor', 0.85, false);

// Generate reports
const report = await mockAnalyzer.getPerformanceReport(startTime, endTime);
const insights = await mockAnalyzer.generateInsights();
```

### QualityTestSuite Mock

```typescript
const mockTestSuite = createMockQualityTestSuite();

// Run individual tests
const result = await mockTestSuite.runTest('citation-test');

// Run all tests with progress monitoring
mockTestSuite.on('progress', (event) => {
  console.log(`Test progress: ${event.current}/${event.total}`);
});

const suiteResult = await mockTestSuite.runAllTests();
```

## Auto-Mocking

### Automatic Service Mocking

```typescript
import { autoMockService } from '@/test/mocks';

// Automatically mock all methods
const autoMocked = autoMockService(MyServiceClass, {
  defaultReturns: {
    getItems: [],
    getStatus: 'ready'
  },
  mockAsync: true,
  asyncDelay: 50
});

// Test with automatic call tracking
await autoMocked.initialize();
await autoMocked.getItems();

// Validate calls
expect(autoMocked.__mockCalls.length).toBe(2);
expect(autoMocked.__validateCalls({
  initialize: 1,
  getItems: 1
})).toBe(true);
```

### Conditional Mocking

```typescript
import { createConditionalMock } from '@/test/mocks';

const conditionalMock = createConditionalMock([
  {
    when: (args) => args[0] === 'special',
    then: 'special result'
  },
  {
    when: (args) => args.length > 2,
    then: 'multiple args result'
  }
], 'default result');
```

### Sequence Validation

```typescript
import { createSequenceMock } from '@/test/mocks';

const sequenceMock = createSequenceMock(
  ['initialize', 'process', 'cleanup'],
  ['initialize', 'process', 'cleanup']
);

await sequenceMock.initialize();
await sequenceMock.process();
await sequenceMock.cleanup();

expect(sequenceMock.__validateSequence()).toBe(true);
```

## Event Testing

### Capturing Events

```typescript
import { createMockEventEmitterUtils } from '@/test/mocks';

const eventUtils = createMockEventEmitterUtils();
const service = createMockCorpusService();

// Capture all progress events
const operation = service.deleteDocument('doc-id');
const events = await eventUtils.captureEvents(service, 'progress', 1000);

await operation;

expect(events.length).toBeGreaterThan(0);
expect(events.some(e => e.stage === 'complete')).toBe(true);
```

### Waiting for Specific Events

```typescript
// Wait for a specific event
const deletePromise = service.deleteDocument('doc-id');
const completeEvent = await eventUtils.waitForEvent(service, 'progress');

expect(completeEvent.stage).toBe('deleting_vectors');
await deletePromise;
```

## Performance Testing

### Measuring Execution Time

```typescript
import { performanceUtils } from '@/test/mocks';

// Measure average execution time
const avgTime = await performanceUtils.measureAverageTime(
  () => service.getDocuments(),
  10 // 10 runs
);

expect(avgTime).toBeLessThan(200); // Under 200ms average
```

### Concurrency Testing

```typescript
// Test concurrent operations
const results = await performanceUtils.testConcurrency(
  () => service.getDocument('doc-id'),
  5 // 5 concurrent calls
);

expect(results).toHaveLength(5);
expect(results.every(r => r !== null)).toBe(true);
```

## Test Patterns

### Service Lifecycle Testing

```typescript
import { commonPatterns } from '@/test/mocks';

await commonPatterns.testServiceLifecycle(service);
```

### Error Handling Testing

```typescript
await commonPatterns.testErrorHandling(
  () => service.invalidOperation(),
  ['not found', 'invalid']
);
```

### Event Emission Testing

```typescript
const events = await commonPatterns.testEventEmission(
  service,
  () => service.performOperation(),
  ['start', 'progress', 'complete']
);

expect(events).toHaveLength(3);
```

## Best Practices

### 1. Use Factories Over Manual Creation

```typescript
// ❌ Don't create objects manually
const doc = {
  id: 'test',
  title: 'Test',
  type: 'law',
  // ... many required fields
};

// ✅ Use factories with overrides
const doc = createMockDocument({
  title: 'Test Document',
  type: 'law'
});
```

### 2. Leverage Fixture Data for Realism

```typescript
// ❌ Don't use minimal test data
const query = { text: 'test', success: true };

// ✅ Use realistic fixture data
const query = queryMetricsFixture.find(q => 
  q.legalArea === 'labor' && q.success === true
);
```

### 3. Test Event-Driven Behavior

```typescript
// ❌ Don't ignore events
await service.longRunningOperation();

// ✅ Test events and progress
const progressEvents = await eventUtils.captureEvents(
  service, 
  'progress', 
  5000
);
const result = await service.longRunningOperation();

expect(progressEvents.length).toBeGreaterThan(0);
```

### 4. Validate Mock Interactions

```typescript
// ❌ Don't just check if mocks were called
expect(mockService.getDocuments).toHaveBeenCalled();

// ✅ Validate interaction patterns
expect(mockService.getDocuments).toHaveBeenCalledWith({
  type: 'law',
  legalArea: 'labor'
});

expect(mockService.__validateCalls({
  getDocuments: { times: 1, with: [{ type: 'law' }] }
})).toBe(true);
```

### 5. Test with Realistic Timing

```typescript
// ❌ Don't ignore async timing
const result = await service.search('query');

// ✅ Test realistic timing
const startTime = Date.now();
const result = await service.search('query');
const duration = Date.now() - startTime;

expect(duration).toBeGreaterThan(50); // Realistic minimum
expect(duration).toBeLessThan(5000); // Reasonable maximum
```

## Integration with Existing Tests

To integrate the mock infrastructure with existing tests:

1. **Import the infrastructure**:
   ```typescript
   import { setupTestEnvironment, createMockCorpusService } from '@/test/mocks';
   ```

2. **Replace manual mocks**:
   ```typescript
   // Replace manual mock creation with factories
   const mockData = createMockDocument({ /* overrides */ });
   ```

3. **Use service mocks**:
   ```typescript
   // Replace vi.mock with service mocks
   const mockService = createMockCorpusService();
   ```

4. **Add event testing**:
   ```typescript
   // Test event emission where applicable
   const events = await eventUtils.captureEvents(service, 'progress');
   ```

## Troubleshooting

### Common Issues

1. **Mock not being called**: Ensure you're testing the mock instance, not the real service
2. **Event timeout**: Increase timeout or check if events are actually emitted
3. **Type errors**: Ensure mock interfaces match the real service interfaces
4. **Async timing**: Use proper async/await and realistic delays

### Debug Utilities

```typescript
// Check mock call history
console.log(autoMocked.__mockCalls);

// Validate call patterns
const isValid = autoMocked.__validateCalls({
  methodName: { times: 1, with: ['expected', 'args'] }
});

// Reset mocks between tests
autoMocked.__resetMocks();
```

This infrastructure provides a solid foundation for reliable, maintainable tests while ensuring consistency across the LexMX test suite.