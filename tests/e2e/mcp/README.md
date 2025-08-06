# Playwright MCP End-to-End Tests

## Overview

This directory contains comprehensive end-to-end tests for LexMX using Playwright with MCP (Model Context Protocol) server integration. These tests provide extensive coverage of user journeys, error scenarios, and accessibility compliance.

## Test Files

### 1. `legal-professional-workflow.test.ts`
Tests the complete workflow of a legal professional using LexMX:
- Multi-provider setup with performance optimization
- Complex legal queries with constitutional analysis
- Cross-feature navigation (Chat → Wiki → Documents)
- Provider failover and recovery
- Extended session memory management
- Advanced RAG configuration

### 2. `first-time-onboarding.test.ts`
Comprehensive testing of new user experiences:
- Homepage discovery and value proposition understanding
- Initial chat attempt without configuration
- Guided setup with profile selection
- First successful query experience
- Mobile-first onboarding
- Privacy-conscious user flow
- Non-Spanish speaker support
- Error recovery during setup

### 3. `legal-research-journey.test.ts`
Tests the legal research workflow using wiki and integrated features:
- Glossary exploration and term learning
- Legal hierarchy understanding
- Interactive legislative process visualization
- Cross-feature research (Wiki → Documents → Chat)
- Mobile wiki navigation
- Contextual chat queries based on research

### 4. `error-recovery-edge-cases.test.ts`
Comprehensive error handling and edge case testing:
- Network failure recovery during active sessions
- Storage quota exceeded handling
- Malformed API keys and provider switching
- Session recovery after browser crash
- Corrupt legal corpus data handling
- Race conditions with rapid interactions
- Browser compatibility fallbacks
- Deep navigation state recovery
- Invalid form submissions

### 5. `accessibility-compliance.test.ts`
Full WCAG 2.1 AA compliance testing:
- Automated accessibility audits with axe-core
- Complete keyboard navigation testing
- Screen reader compatibility
- Color contrast verification in light/dark modes
- Mobile touch target sizing
- Focus management and tab order
- Error messaging accessibility
- Reduced motion preferences

## Running the Tests

### Run all MCP tests:
```bash
npm run test:e2e tests/e2e/mcp/
```

### Run specific test file:
```bash
npx playwright test tests/e2e/mcp/legal-professional-workflow.test.ts
```

### Run with specific browser:
```bash
npx playwright test tests/e2e/mcp/ --project=chromium
```

### Run in headed mode for debugging:
```bash
npx playwright test tests/e2e/mcp/ --headed
```

### Generate HTML report:
```bash
npx playwright test tests/e2e/mcp/ --reporter=html
```

## Test Structure

Each test file follows a consistent pattern:

```typescript
test.describe('Journey Name', () => {
  test.beforeEach(async ({ page }) => {
    await setupPage(page);
    await clearAllStorage(page);
    // Additional setup as needed
  });

  test('specific user flow', async ({ page }) => {
    // Arrange: Navigate and setup
    // Act: Perform user actions
    // Assert: Verify expected outcomes
  });
});
```

## Key Testing Patterns

### 1. User Journey Testing
- Complete workflows from landing to task completion
- Multi-step processes with state verification
- Cross-feature integration testing

### 2. Error Resilience
- Network failure simulation
- Invalid input handling
- Recovery mechanisms
- Fallback strategies

### 3. Performance Testing
- Memory usage monitoring
- Load time verification
- Concurrent operation handling

### 4. Accessibility Testing
- Automated WCAG compliance checks
- Manual keyboard navigation
- Screen reader compatibility
- Mobile accessibility

## MCP Server Integration

These tests leverage the Playwright MCP server for:
- Advanced browser automation
- Visual testing capabilities
- Network condition simulation
- Multi-tab workflow testing
- Performance profiling

## Best Practices

1. **Isolation**: Each test starts with a clean state
2. **Reliability**: Tests use proper waits and assertions
3. **Maintainability**: Shared utilities in test-helpers
4. **Coverage**: Both happy paths and edge cases
5. **Accessibility**: Every journey includes a11y checks

## Future Enhancements

- Visual regression testing with screenshots
- Performance benchmarking
- Load testing with multiple concurrent users
- Integration with CI/CD pipelines
- Custom reporter for legal compliance tracking