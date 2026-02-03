#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Stop Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

MODE="${1:-docker}"

case "$MODE" in
    docker)
        echo "[OPS] Stopping Docker Compose services..."
        docker compose -f docker/docker-compose.yml down
        echo "[OPS] Services stopped"
        ;;
    native)
        if [[ -f /tmp/texas-holdem.pid ]]; then
            PID=$(cat /tmp/texas-holdem.pid)
            if kill -0 "$PID" 2>/dev/null; then
                echo "[OPS] Sending SIGTERM to PID $PID..."
                kill -TERM "$PID"
                # Wait for graceful shutdown
                timeout 35 tail --pid="$PID" -f /dev/null 2>/dev/null || true
                echo "[OPS] Server stopped"
            else
                echo "[OPS] Process not running"
            fi
            rm -f /tmp/texas-holdem.pid
        else
            echo "[OPS] No PID file found"
        fi
        ;;
    *)
        echo "Usage: $0 [docker|native]"
        exit 1
        ;;
esac
