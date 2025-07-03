#!/bin/bash

# LocoDex Integration Test Script
# Tests all components and their integrations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
TEST_HOST="localhost"
AI_AGENT_PORT="3001"
SANDBOX_PORT="3002"
GATEWAY_PORT="8080"
REDIS_PORT="6379"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
FAILED_TESTS=()

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((TESTS_FAILED++))
    FAILED_TESTS+=("$1")
}

warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Test helper functions
test_http_endpoint() {
    local url="$1"
    local expected_status="${2:-200}"
    local description="$3"
    
    log "Testing: $description"
    
    local response
    response=$(curl -s -w "%{http_code}" -o /dev/null "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        success "$description - HTTP $response"
        return 0
    else
        fail "$description - Expected HTTP $expected_status, got $response"
        return 1
    fi
}

test_json_endpoint() {
    local url="$1"
    local description="$2"
    local expected_field="$3"
    
    log "Testing: $description"
    
    local response
    response=$(curl -s "$url" 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$response" | jq -e "$expected_field" >/dev/null 2>&1; then
        success "$description - JSON response valid"
        return 0
    else
        fail "$description - Invalid JSON response or missing field: $expected_field"
        return 1
    fi
}

test_post_endpoint() {
    local url="$1"
    local data="$2"
    local description="$3"
    local expected_status="${4:-200}"
    
    log "Testing: $description"
    
    local response
    response=$(curl -s -w "%{http_code}" -o /dev/null -X POST \
        -H "Content-Type: application/json" \
        -d "$data" \
        "$url" || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        success "$description - HTTP $response"
        return 0
    else
        fail "$description - Expected HTTP $expected_status, got $response"
        return 1
    fi
}

# Wait for services to be ready
wait_for_services() {
    log "Waiting for services to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s "http://$TEST_HOST:$AI_AGENT_PORT/health" >/dev/null 2>&1 && \
           curl -s "http://$TEST_HOST:$SANDBOX_PORT/health" >/dev/null 2>&1 && \
           curl -s "http://$TEST_HOST:$GATEWAY_PORT/health" >/dev/null 2>&1; then
            success "All services are ready"
            return 0
        fi
        
        ((attempt++))
        log "Attempt $attempt/$max_attempts - Waiting for services..."
        sleep 2
    done
    
    fail "Services did not become ready within timeout"
    return 1
}

# Test AI Agent Service
test_ai_agent() {
    log "Testing AI Agent Service..."
    
    # Health check
    test_http_endpoint "http://$TEST_HOST:$AI_AGENT_PORT/health" 200 "AI Agent health check"
    
    # Model discovery
    test_json_endpoint "http://$TEST_HOST:$AI_AGENT_PORT/api/models/discover" \
        "AI Agent model discovery" ".providers"
    
    # Chat completion (mock test)
    local chat_data='{"model":"test","messages":[{"role":"user","content":"Hello"}]}'
    test_post_endpoint "http://$TEST_HOST:$AI_AGENT_PORT/api/chat/completions" \
        "$chat_data" "AI Agent chat completion" 500  # Expected to fail without real model
}

# Test Sandbox Service
test_sandbox() {
    log "Testing Sandbox Service..."
    
    # Health check
    test_http_endpoint "http://$TEST_HOST:$SANDBOX_PORT/health" 200 "Sandbox health check"
    
    # Stats endpoint
    test_json_endpoint "http://$TEST_HOST:$SANDBOX_PORT/stats" \
        "Sandbox stats" ".cpu_percent"
    
    # Workspace listing
    test_json_endpoint "http://$TEST_HOST:$SANDBOX_PORT/workspace" \
        "Sandbox workspace" ".files"
    
    # Code execution test
    local python_code='{"code":"print(\"Hello, World!\")", "language":"python"}'
    test_post_endpoint "http://$TEST_HOST:$SANDBOX_PORT/execute" \
        "$python_code" "Sandbox Python execution" 200
    
    # JavaScript execution test
    local js_code='{"code":"console.log(\"Hello, World!\")", "language":"javascript"}'
    test_post_endpoint "http://$TEST_HOST:$SANDBOX_PORT/execute" \
        "$js_code" "Sandbox JavaScript execution" 200
    
    # Security test - should fail
    local malicious_code='{"code":"import os; os.system(\"ls\")", "language":"python"}'
    test_post_endpoint "http://$TEST_HOST:$SANDBOX_PORT/execute" \
        "$malicious_code" "Sandbox security test (should fail)" 403
}

# Test API Gateway
test_api_gateway() {
    log "Testing API Gateway..."
    
    # Health check
    test_http_endpoint "http://$TEST_HOST:$GATEWAY_PORT/health" 200 "API Gateway health check"
    
    # Proxy to AI Agent
    test_http_endpoint "http://$TEST_HOST:$GATEWAY_PORT/api/models/discover" 200 \
        "API Gateway proxy to AI Agent"
    
    # Proxy to Sandbox
    test_http_endpoint "http://$TEST_HOST:$GATEWAY_PORT/sandbox/health" 200 \
        "API Gateway proxy to Sandbox"
    
    # CORS test
    local cors_response
    cors_response=$(curl -s -H "Origin: http://localhost:3000" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS "http://$TEST_HOST:$GATEWAY_PORT/api/models/discover" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$cors_response" = "204" ]; then
        success "API Gateway CORS preflight"
    else
        fail "API Gateway CORS preflight - Expected 204, got $cors_response"
    fi
}

# Test Redis
test_redis() {
    log "Testing Redis..."
    
    # Check if Redis container is running
    if docker exec locodex-redis redis-cli ping >/dev/null 2>&1; then
        success "Redis ping test"
    else
        fail "Redis ping test"
        return 1
    fi
    
    # Test basic operations
    if docker exec locodex-redis redis-cli set test_key "test_value" >/dev/null 2>&1 && \
       [ "$(docker exec locodex-redis redis-cli get test_key 2>/dev/null)" = "test_value" ]; then
        success "Redis set/get test"
        docker exec locodex-redis redis-cli del test_key >/dev/null 2>&1
    else
        fail "Redis set/get test"
    fi
}

# Test Docker containers
test_docker_containers() {
    log "Testing Docker containers..."
    
    local containers=("locodex-ai-agent" "locodex-sandbox" "locodex-api-gateway" "locodex-redis")
    
    for container in "${containers[@]}"; do
        if docker ps --format "table {{.Names}}" | grep -q "^$container$"; then
            success "Container $container is running"
        else
            fail "Container $container is not running"
        fi
        
        # Check container health
        local health_status
        health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "none")
        
        if [ "$health_status" = "healthy" ] || [ "$health_status" = "none" ]; then
            success "Container $container health check"
        else
            fail "Container $container health check - Status: $health_status"
        fi
    done
}

# Test network connectivity
test_network_connectivity() {
    log "Testing network connectivity..."
    
    # Test inter-container communication
    if docker exec locodex-ai-agent curl -s http://sandbox:3002/health >/dev/null 2>&1; then
        success "AI Agent to Sandbox connectivity"
    else
        fail "AI Agent to Sandbox connectivity"
    fi
    
    if docker exec locodex-sandbox curl -s http://ai-agent:3001/health >/dev/null 2>&1; then
        success "Sandbox to AI Agent connectivity"
    else
        fail "Sandbox to AI Agent connectivity"
    fi
    
    if docker exec locodex-api-gateway curl -s http://ai-agent:3001/health >/dev/null 2>&1; then
        success "API Gateway to AI Agent connectivity"
    else
        fail "API Gateway to AI Agent connectivity"
    fi
}

# Test file operations
test_file_operations() {
    log "Testing file operations..."
    
    # Test file creation in sandbox
    local file_data='{"content":"print(\"Test file\")"}'
    local response
    response=$(curl -s -X PUT \
        -H "Content-Type: application/json" \
        -d "$file_data" \
        "http://$TEST_HOST:$SANDBOX_PORT/workspace/test.py" \
        -w "%{http_code}" -o /dev/null)
    
    if [ "$response" = "200" ]; then
        success "Sandbox file creation"
        
        # Test file reading
        if curl -s "http://$TEST_HOST:$SANDBOX_PORT/workspace/test.py" | jq -e '.content' >/dev/null 2>&1; then
            success "Sandbox file reading"
        else
            fail "Sandbox file reading"
        fi
    else
        fail "Sandbox file creation - HTTP $response"
    fi
}

# Test security features
test_security() {
    log "Testing security features..."
    
    # Test rate limiting (simplified)
    local rate_limit_passed=true
    for i in {1..5}; do
        local response
        response=$(curl -s -w "%{http_code}" -o /dev/null "http://$TEST_HOST:$GATEWAY_PORT/api/models/discover")
        if [ "$response" != "200" ] && [ "$response" != "429" ]; then
            rate_limit_passed=false
            break
        fi
    done
    
    if [ "$rate_limit_passed" = true ]; then
        success "Rate limiting test"
    else
        fail "Rate limiting test"
    fi
    
    # Test malicious code execution prevention
    local malicious_tests=(
        '{"code":"import subprocess; subprocess.run([\"ls\", \"/\"])", "language":"python"}'
        '{"code":"require(\"child_process\").exec(\"ls\")", "language":"javascript"}'
        '{"code":"eval(\"console.log(process.env)\")", "language":"javascript"}'
    )
    
    local security_passed=0
    for test_data in "${malicious_tests[@]}"; do
        local response
        response=$(curl -s -w "%{http_code}" -o /dev/null -X POST \
            -H "Content-Type: application/json" \
            -d "$test_data" \
            "http://$TEST_HOST:$SANDBOX_PORT/execute")
        
        if [ "$response" = "403" ] || [ "$response" = "400" ]; then
            ((security_passed++))
        fi
    done
    
    if [ $security_passed -eq ${#malicious_tests[@]} ]; then
        success "Security validation tests"
    else
        fail "Security validation tests - $security_passed/${#malicious_tests[@]} passed"
    fi
}

# Performance tests
test_performance() {
    log "Testing performance..."
    
    # Simple load test
    local start_time
    start_time=$(date +%s)
    
    for i in {1..10}; do
        curl -s "http://$TEST_HOST:$AI_AGENT_PORT/health" >/dev/null &
    done
    wait
    
    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    if [ $duration -lt 5 ]; then
        success "Performance test - 10 concurrent requests in ${duration}s"
    else
        warning "Performance test - 10 concurrent requests took ${duration}s (may be slow)"
    fi
}

# Generate test report
generate_report() {
    log "Generating test report..."
    
    local total_tests=$((TESTS_PASSED + TESTS_FAILED))
    local success_rate=0
    
    if [ $total_tests -gt 0 ]; then
        success_rate=$((TESTS_PASSED * 100 / total_tests))
    fi
    
    echo
    echo "=================================="
    echo "       TEST REPORT"
    echo "=================================="
    echo "Total Tests: $total_tests"
    echo "Passed: $TESTS_PASSED"
    echo "Failed: $TESTS_FAILED"
    echo "Success Rate: $success_rate%"
    echo
    
    if [ $TESTS_FAILED -gt 0 ]; then
        echo "Failed Tests:"
        for test in "${FAILED_TESTS[@]}"; do
            echo "  - $test"
        done
        echo
    fi
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed! ✅${NC}"
        return 0
    else
        echo -e "${RED}Some tests failed! ❌${NC}"
        return 1
    fi
}

# Main test execution
main() {
    log "Starting LocoDex Integration Tests..."
    echo
    
    # Check if services are running
    if ! docker ps | grep -q locodex; then
        log "Starting LocoDex services..."
        cd "$(dirname "$0")/.."
        ./scripts/docker-setup.sh start
        sleep 10
    fi
    
    # Wait for services
    wait_for_services || exit 1
    
    # Run test suites
    test_docker_containers
    test_ai_agent
    test_sandbox
    test_api_gateway
    test_redis
    test_network_connectivity
    test_file_operations
    test_security
    test_performance
    
    # Generate report
    generate_report
}

# Handle script arguments
case "${1:-run}" in
    "run")
        main
        ;;
    "quick")
        log "Running quick tests..."
        wait_for_services
        test_ai_agent
        test_sandbox
        test_api_gateway
        generate_report
        ;;
    "security")
        log "Running security tests..."
        wait_for_services
        test_security
        generate_report
        ;;
    "performance")
        log "Running performance tests..."
        wait_for_services
        test_performance
        generate_report
        ;;
    "help"|"-h"|"--help")
        echo "LocoDex Integration Test Script"
        echo
        echo "Usage: $0 [command]"
        echo
        echo "Commands:"
        echo "  run          Run all tests (default)"
        echo "  quick        Run quick smoke tests"
        echo "  security     Run security tests only"
        echo "  performance  Run performance tests only"
        echo "  help         Show this help message"
        ;;
    *)
        echo "Unknown command: $1"
        echo "Run '$0 help' for usage information"
        exit 1
        ;;
esac

