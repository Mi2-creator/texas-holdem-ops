#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Smoke Test
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Load environment
if [[ -f .env ]]; then
    set -a
    source .env
    set +a
fi

PORT="${HOST_PORT:-8080}"
BASE_URL="http://localhost:${PORT}"
TIMEOUT="${TIMEOUT:-30}"
PASSED=0
FAILED=0

echo "========================================"
echo "[SMOKE] Texas Hold'em Server Smoke Test"
echo "========================================"
echo "Target: $BASE_URL"
echo ""

# Function to run a test
run_test() {
    local name="$1"
    local url="$2"
    local expected_code="${3:-200}"
    local check_field="${4:-}"

    echo -n "Testing: $name... "

    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null) || {
        echo "FAIL (connection refused)"
        ((FAILED++))
        return 1
    }

    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" != "$expected_code" ]]; then
        echo "FAIL (expected $expected_code, got $http_code)"
        ((FAILED++))
        return 1
    fi

    if [[ -n "$check_field" ]]; then
        if ! echo "$body" | grep -q "$check_field"; then
            echo "FAIL (missing field: $check_field)"
            ((FAILED++))
            return 1
        fi
    fi

    echo "PASS"
    ((PASSED++))
    return 0
}

# Wait for server to be ready
echo "Waiting for server (timeout: ${TIMEOUT}s)..."
end_time=$((SECONDS + TIMEOUT))
while [[ $SECONDS -lt $end_time ]]; do
    if curl -s "$BASE_URL/health" >/dev/null 2>&1; then
        echo "Server is ready!"
        echo ""
        break
    fi
    sleep 1
done

if ! curl -s "$BASE_URL/health" >/dev/null 2>&1; then
    echo "FAIL: Server not responding after ${TIMEOUT}s"
    exit 1
fi

# Run smoke tests
run_test "Health endpoint" "$BASE_URL/health" 200 '"status"'
run_test "Mode endpoint" "$BASE_URL/mode" 200 '"mode"'
run_test "Export history" "$BASE_URL/export/history" 200
run_test "Export non-existent hand (404)" "$BASE_URL/export/hand/nonexistent" 404

echo ""
echo "========================================"
echo "[SMOKE] Results: $PASSED passed, $FAILED failed"
echo "========================================"

if [[ $FAILED -gt 0 ]]; then
    exit 1
fi
exit 0
