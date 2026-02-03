#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Status Script
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
HEALTH_URL="http://localhost:${PORT}/health"

echo "[OPS] Checking server status..."
echo "========================================"

# Check Docker container status
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'texas-holdem-server'; then
    echo "Container: RUNNING"
    docker ps --filter name=texas-holdem-server --format 'table {{.Status}}\t{{.Ports}}'
else
    echo "Container: NOT RUNNING"
fi

echo ""

# Check health endpoint
echo "Health Check: $HEALTH_URL"
if response=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null); then
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [[ "$http_code" == "200" ]]; then
        echo "Status: HEALTHY (HTTP $http_code)"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
    else
        echo "Status: UNHEALTHY (HTTP $http_code)"
        echo "$body"
    fi
else
    echo "Status: UNREACHABLE"
fi

echo "========================================"
