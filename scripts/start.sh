#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Start Script
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

MODE="${1:-docker}"

case "$MODE" in
    docker)
        echo "[OPS] Starting server with Docker Compose..."
        docker compose -f docker/docker-compose.yml up -d
        echo "[OPS] Waiting for health check..."
        sleep 3
        ./scripts/status.sh
        ;;
    native)
        echo "[OPS] Starting server natively..."
        SERVER_SRC="${SERVER_SRC:-../texas-holdem-client}"
        cd "$SERVER_SRC/server/go"
        nohup go run ./cmd/server/main.go > /tmp/texas-holdem.log 2>&1 &
        echo $! > /tmp/texas-holdem.pid
        echo "[OPS] Server started with PID $(cat /tmp/texas-holdem.pid)"
        ;;
    *)
        echo "Usage: $0 [docker|native]"
        exit 1
        ;;
esac
