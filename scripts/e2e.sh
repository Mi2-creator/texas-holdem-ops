#!/bin/bash
# =============================================================================
# Texas Hold'em Server - End-to-End Test
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
SERVER_SRC="${SERVER_SRC:-../texas-holdem-client}"

echo "========================================"
echo "[E2E] Texas Hold'em Server E2E Test"
echo "========================================"
echo "Target: $BASE_URL"
echo ""

# First run smoke test
echo "[E2E] Running smoke tests..."
./scripts/smoke.sh || {
    echo "[E2E] Smoke tests failed, aborting E2E"
    exit 1
}

echo ""
echo "[E2E] Running server's built-in e2e-curl.sh if available..."

# Try to run the server's e2e-curl.sh script
E2E_SCRIPT="$SERVER_SRC/server/go/scripts/e2e-curl.sh"
if [[ -f "$E2E_SCRIPT" ]]; then
    echo "[E2E] Found: $E2E_SCRIPT"
    PORT="$PORT" bash "$E2E_SCRIPT" || {
        echo "[E2E] Server e2e-curl.sh failed"
        exit 1
    }
else
    echo "[E2E] No server e2e-curl.sh found, running extended ops tests..."

    # Extended E2E tests
    echo ""
    echo "[E2E] Testing health response structure..."
    health=$(curl -s "$BASE_URL/health")

    # Validate health response fields
    for field in status mode uptime_seconds table_count player_count version storage; do
        if echo "$health" | grep -q "\"$field\""; then
            echo "  - $field: PRESENT"
        else
            echo "  - $field: MISSING"
            exit 1
        fi
    done

    echo ""
    echo "[E2E] Testing mode endpoint..."
    mode=$(curl -s "$BASE_URL/mode")
    if echo "$mode" | grep -qE '"mode":\s*"(NORMAL|READ_ONLY|SHUTDOWN)"'; then
        echo "  - Mode value valid: $(echo "$mode" | grep -o '"mode":"[^"]*"')"
    else
        echo "  - Mode value invalid"
        exit 1
    fi
fi

echo ""
echo "========================================"
echo "[E2E] All E2E tests passed!"
echo "========================================"
