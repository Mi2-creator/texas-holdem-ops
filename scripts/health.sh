#!/bin/bash
# Check health of all services
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then set -a; source .env; set +a; fi

PORT="${HOST_PORT:-8080}"

echo "========================================"
echo "[HEALTH] Service Health Check"
echo "========================================"

# Postgres
PG_STATUS=$(docker inspect --format='{{.State.Health.Status}}' texas-holdem-postgres 2>/dev/null || echo "not running")
echo "postgres: $PG_STATUS"

# App container
APP_RUNNING=$(docker inspect --format='{{.State.Status}}' texas-holdem-server 2>/dev/null || echo "not running")
APP_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' texas-holdem-server 2>/dev/null || echo "unknown")
echo "app: $APP_RUNNING (health: $APP_HEALTH)"

# HTTP health endpoint
echo ""
if response=$(curl -sf "http://localhost:${PORT}/health" 2>/dev/null); then
    echo "GET /health -> OK"
    echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
else
    echo "GET /health -> FAILED"
fi

echo "========================================"
