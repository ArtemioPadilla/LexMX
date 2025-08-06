# Testing Guide for LexMX

This guide explains how to run tests in the LexMX project.

## Overview

LexMX uses two different testing frameworks:
- **Vitest** for unit tests (fast, isolated component tests)
- **Playwright** for end-to-end tests (full browser automation tests)

## Quick Commands

```bash
# Run unit tests only
make test

# Run E2E tests only
make test-e2e

# Run all tests (unit + E2E)
make test-all

# Clean up dev server ports if tests fail
make clean-ports
```

## Test Structure

```
src/
└── **/*.test.ts    # Unit tests (Vitest)
tests/
└── *.test.ts       # E2E tests (Playwright)
```

## Unit Tests (Vitest)

Unit tests are located alongside source files in the `src/` directory.

### Running Unit Tests
```bash
npm run test          # Run once
npm run test:watch    # Watch mode
make test            # Using Makefile
```

### Writing Unit Tests
```typescript
// src/lib/utils.test.ts
import { describe, it, expect } from 'vitest';

describe('Utils', () => {
  it('should work correctly', () => {
    expect(1 + 1).toBe(2);
  });
});
```

## E2E Tests (Playwright)

End-to-end tests are located in the `tests/` directory.

### Running E2E Tests
```bash
npm run test:e2e      # Run all E2E tests
make test-e2e         # Using Makefile (includes cleanup)
npx playwright test   # Direct Playwright command
```

### Running Specific Tests
```bash
# Run tests in a specific file
npx playwright test tests/chat-tests.test.ts

# Run tests with a specific name
npx playwright test -g "should load chat interface"

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in a specific browser
npx playwright test --project=chromium
```

### Test Configuration

Tests run against 6 different browser configurations:
- Desktop: Chromium, Firefox, WebKit (Safari)
- Mobile: Chrome (Android), Safari (iOS)
- Tablet: iPad

### Port Management

The tests automatically:
1. Kill any existing dev servers on ports 4321-4323
2. Start a fresh dev server on port 4321
3. Use relative URLs (e.g., `/chat` instead of `http://localhost:4321/chat`)

If you encounter port conflicts:
```bash
make clean-ports   # Kill all dev servers
```

## Debugging Failed Tests

### View Test Reports
```bash
# After tests run, view HTML report
npx playwright show-report
```

### Debug Mode
```bash
# Run with Playwright Inspector
npx playwright test --debug

# Run with browser DevTools open
npx playwright test --headed --devtools
```

### Common Issues

1. **Port conflicts**: Run `make clean-ports` before testing
2. **Browser not installed**: Run `npx playwright install --with-deps`
3. **Timeout errors**: Increase timeout in specific tests or config
4. **Hydration errors**: Check for server/client state mismatches

## CI/CD

In CI environments:
- Tests run with `--reporter=github` for better GitHub Actions integration
- Browsers are automatically installed
- Tests run in headless mode
- Artifacts (screenshots, videos) are saved on failure

## Test Categories

### Current Test Coverage

**Unit Tests** (`src/**/*.test.ts`):
- Utility functions
- Component logic
- Service modules

**E2E Tests** (`tests/*.test.ts`):
- `accessibility.test.ts` - WCAG compliance
- `chat-tests.test.ts` - Chat interface functionality
- `document-tests.test.ts` - Document viewer
- `error-detection.test.ts` - Console error monitoring
- `navigation.test.ts` - Page navigation
- `performance.test.ts` - Load time metrics
- `responsive.test.ts` - Mobile/tablet views
- `theme.test.ts` - Dark/light mode switching
- `wiki-tests.test.ts` - Legal wiki functionality
- And more...

## Best Practices

1. **Keep tests isolated**: Each test should be independent
2. **Use data-testid**: For reliable element selection
3. **Mock external services**: Don't make real API calls
4. **Test user journeys**: Focus on real user workflows
5. **Check for errors**: Always monitor console errors
6. **Clean up**: Reset state between tests

## Troubleshooting

### Tests won't start
```bash
# Check if dev server is running
ps aux | grep astro

# Kill all dev servers
make clean-ports

# Try again
make test-e2e
```

### Specific test keeps failing
```bash
# Run just that test
npx playwright test tests/failing-test.test.ts --headed

# Check the trace
npx playwright show-trace trace.zip
```

### Need to update all test URLs
```bash
# Run the URL update script
node scripts/update-test-urls.js
```

## Contributing

When adding new features:
1. Write unit tests for business logic
2. Write E2E tests for user workflows
3. Ensure all tests pass: `make test-all`
4. Check coverage gaps
5. Update this documentation if needed