#!/bin/bash

echo "🧪 Testing E2E Test Isolation System"
echo "===================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Run isolation validation tests in parallel
echo "📊 Test 1: Running isolation validation tests in PARALLEL mode (6 workers)..."
echo "------------------------------------------------------------------------"
PARALLEL_TESTS=1 TEST_WORKERS=6 npx playwright test isolation-validation.test.ts --reporter=list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Parallel isolation tests PASSED${NC}"
else
    echo -e "${RED}❌ Parallel isolation tests FAILED${NC}"
    echo "This indicates isolation is not working properly."
fi

echo ""

# Test 2: Run corpus selector tests with isolation
echo "📊 Test 2: Running corpus selector tests with ISOLATION..."
echo "--------------------------------------------------------"
npx playwright test corpus-selector-journey.isolated.test.ts --project=chromium-isolated --reporter=list

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Isolated corpus selector tests PASSED${NC}"
else
    echo -e "${YELLOW}⚠️  Isolated corpus selector tests had issues${NC}"
fi

echo ""

# Test 3: Compare sequential vs parallel execution
echo "📊 Test 3: Comparing SEQUENTIAL vs PARALLEL execution..."
echo "------------------------------------------------------"

echo "Running in SEQUENTIAL mode (1 worker)..."
TEST_WORKERS=1 npx playwright test corpus-selector-journey.test.ts --reporter=list --grep "can open corpus selector" > /tmp/sequential.log 2>&1
SEQUENTIAL_RESULT=$?

echo "Running in PARALLEL mode (6 workers)..."
TEST_WORKERS=6 npx playwright test corpus-selector-journey.test.ts --reporter=list --grep "can open corpus selector" > /tmp/parallel.log 2>&1
PARALLEL_RESULT=$?

if [ $SEQUENTIAL_RESULT -eq 0 ] && [ $PARALLEL_RESULT -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Tests pass in SEQUENTIAL but fail in PARALLEL${NC}"
    echo "This confirms the isolation issue exists in the original tests."
elif [ $SEQUENTIAL_RESULT -eq 0 ] && [ $PARALLEL_RESULT -eq 0 ]; then
    echo -e "${GREEN}✅ Tests pass in both SEQUENTIAL and PARALLEL${NC}"
    echo "Isolation may be working or tests are naturally isolated."
else
    echo -e "${RED}❌ Tests failing in both modes${NC}"
    echo "There may be other issues beyond isolation."
fi

echo ""

# Test 4: Run all tests with new isolation system
echo "📊 Test 4: Running ALL tests with isolation enabled..."
echo "----------------------------------------------------"
echo -e "${YELLOW}Note: This will only work for tests that have been converted to use isolation fixtures.${NC}"

# Count isolated test files
ISOLATED_COUNT=$(ls tests/e2e/*.isolated.test.ts 2>/dev/null | wc -l)
echo "Found $ISOLATED_COUNT isolated test files."

if [ $ISOLATED_COUNT -gt 0 ]; then
    PARALLEL_TESTS=1 TEST_WORKERS=6 npx playwright test '*.isolated.test.ts' --reporter=list
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ All isolated tests PASSED in parallel${NC}"
    else
        echo -e "${RED}❌ Some isolated tests FAILED${NC}"
    fi
else
    echo -e "${YELLOW}No isolated test files found yet.${NC}"
fi

echo ""
echo "===================================="
echo "📋 Summary:"
echo ""
echo "The isolation system provides:"
echo "  • Namespaced storage keys per test"
echo "  • Complete cleanup after each test"
echo "  • Support for parallel execution"
echo "  • Prevention of state pollution"
echo ""
echo "To use isolation in your tests:"
echo "  1. Import from '../utils/isolated-fixtures'"
echo "  2. Use 'isolatedTest' instead of 'test'"
echo "  3. Or use setupIsolatedPage() in beforeEach"
echo ""
echo "To run tests:"
echo "  • Sequential: npm run test:e2e"
echo "  • Parallel: PARALLEL_TESTS=1 npm run test:e2e"
echo "  • Isolated: npx playwright test '*.isolated.test.ts'"
echo ""