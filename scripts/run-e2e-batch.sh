#!/bin/bash

# E2E Test Batch Runner
# Runs tests in batches with proper isolation and reporting

echo "🚀 LexMX E2E Test Batch Runner"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BATCH_SIZE=${BATCH_SIZE:-3}
WORKERS=${TEST_WORKERS:-6}
RETRY_COUNT=${RETRY_COUNT:-1}
USE_ISOLATED=${USE_ISOLATED:-true}

# Results tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
FLAKY_TESTS=0

# Create results directory
RESULTS_DIR="test-results-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RESULTS_DIR"

# Log file
LOG_FILE="$RESULTS_DIR/test-run.log"

# Function to run a batch of tests
run_test_batch() {
    local batch_name=$1
    local test_pattern=$2
    local workers=$3
    
    echo -e "${BLUE}📦 Running batch: $batch_name${NC}"
    echo "   Pattern: $test_pattern"
    echo "   Workers: $workers"
    echo ""
    
    # Run tests and capture output
    if [ "$USE_ISOLATED" = "true" ]; then
        pattern="$test_pattern.isolated.test.ts"
    else
        pattern="$test_pattern.test.ts"
    fi
    
    TEST_WORKERS=$workers npx playwright test \
        --config=playwright.e2e.config.ts \
        "$pattern" \
        --reporter=json \
        --retries=$RETRY_COUNT \
        > "$RESULTS_DIR/${batch_name}.json" 2>&1
    
    local exit_code=$?
    
    # Parse results
    if [ -f "$RESULTS_DIR/${batch_name}.json" ]; then
        local batch_total=$(jq '.stats.expected' "$RESULTS_DIR/${batch_name}.json" 2>/dev/null || echo 0)
        local batch_passed=$(jq '.stats.expected - .stats.unexpected - .stats.flaky' "$RESULTS_DIR/${batch_name}.json" 2>/dev/null || echo 0)
        local batch_failed=$(jq '.stats.unexpected' "$RESULTS_DIR/${batch_name}.json" 2>/dev/null || echo 0)
        local batch_flaky=$(jq '.stats.flaky' "$RESULTS_DIR/${batch_name}.json" 2>/dev/null || echo 0)
        
        TOTAL_TESTS=$((TOTAL_TESTS + batch_total))
        PASSED_TESTS=$((PASSED_TESTS + batch_passed))
        FAILED_TESTS=$((FAILED_TESTS + batch_failed))
        FLAKY_TESTS=$((FLAKY_TESTS + batch_flaky))
        
        if [ $exit_code -eq 0 ]; then
            echo -e "   ${GREEN}✅ Batch completed: $batch_passed/$batch_total passed${NC}"
        else
            echo -e "   ${RED}❌ Batch failed: $batch_failed tests failed${NC}"
            if [ $batch_flaky -gt 0 ]; then
                echo -e "   ${YELLOW}⚠️  $batch_flaky flaky tests${NC}"
            fi
        fi
    else
        echo -e "   ${RED}❌ No results generated${NC}"
    fi
    
    echo ""
    return $exit_code
}

# Function to run tests sequentially for debugging
run_sequential() {
    echo -e "${YELLOW}🔍 Running in SEQUENTIAL mode (debugging)${NC}"
    echo ""
    
    TEST_WORKERS=1 npx playwright test \
        --config=playwright.e2e.config.ts \
        --reporter=html \
        --retries=0
}

# Function to generate summary report
generate_summary() {
    echo ""
    echo "📊 Test Summary"
    echo "==============="
    echo ""
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "Flaky: ${YELLOW}$FLAKY_TESTS${NC}"
    echo ""
    
    local pass_rate=0
    if [ $TOTAL_TESTS -gt 0 ]; then
        pass_rate=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    echo "Pass Rate: $pass_rate%"
    
    if [ $pass_rate -eq 100 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
    elif [ $pass_rate -ge 90 ]; then
        echo -e "${GREEN}✅ Good pass rate${NC}"
    elif [ $pass_rate -ge 70 ]; then
        echo -e "${YELLOW}⚠️  Acceptable pass rate${NC}"
    else
        echo -e "${RED}❌ Low pass rate - investigation needed${NC}"
    fi
    
    echo ""
    echo "Results saved to: $RESULTS_DIR"
    
    # Generate HTML report
    echo ""
    echo "Generating HTML report..."
    npx playwright merge-reports --reporter=html "$RESULTS_DIR" 2>/dev/null || true
}

# Function to list failed tests
list_failed_tests() {
    if [ $FAILED_TESTS -gt 0 ]; then
        echo ""
        echo "Failed Tests:"
        echo "============="
        
        for file in "$RESULTS_DIR"/*.json; do
            if [ -f "$file" ]; then
                jq -r '.suites[].suites[].specs[] | select(.tests[].results[].status == "failed") | "  - \(.title)"' "$file" 2>/dev/null || true
            fi
        done
    fi
}

# Main execution
echo "Configuration:"
echo "  - Batch Size: $BATCH_SIZE"
echo "  - Workers: $WORKERS"
echo "  - Retries: $RETRY_COUNT"
echo "  - Use Isolated: $USE_ISOLATED"
echo ""

# Check for mode
MODE=${1:-batch}

if [ "$MODE" = "sequential" ]; then
    run_sequential
    exit $?
fi

if [ "$MODE" = "quick" ]; then
    echo -e "${YELLOW}⚡ Quick mode - running only isolated tests${NC}"
    echo ""
    
    TEST_WORKERS=$WORKERS npx playwright test \
        --config=playwright.e2e.config.ts \
        '*.isolated.test.ts' \
        --reporter=html
    exit $?
fi

# Batch mode - run tests in groups
echo "Starting batch execution..."
echo ""

# Define test batches
# Group 1: Core UI tests
run_test_batch "ui-core" "corpus-selector-journey" 3
run_test_batch "ui-dark" "dark-mode-journey" 3
run_test_batch "ui-lang" "language-switching" 3

# Group 2: Provider tests
run_test_batch "provider-selector" "provider-selector-journey" 2
run_test_batch "provider-setup" "provider-setup-journey" 2
run_test_batch "webllm" "webllm-*" 2

# Group 3: Chat and interaction tests
run_test_batch "chat" "integrated-chat-journey" 3
run_test_batch "markdown" "*markdown" 2

# Group 4: Case management tests
run_test_batch "cases" "case-management-journey" 3

# Group 5: User journeys and verification
run_test_batch "journeys" "user-journeys" 2
run_test_batch "verification" "*fix*" 2

# Generate summary
generate_summary
list_failed_tests

# Exit with appropriate code
if [ $FAILED_TESTS -gt 0 ]; then
    exit 1
else
    exit 0
fi