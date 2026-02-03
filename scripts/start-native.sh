#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Native Start Script
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

BIN_PATH="${PROJECT_DIR}/bin/texas-holdem-server"
PID_FILE="/tmp/texas-holdem.pid"
LOG_FILE="/tmp/texas-holdem.log"

# Check if binary exists
if [[ ! -f "$BIN_PATH" ]]; then
    echo "[OPS] Binary not found, building..."
    make build-local
fi

# Check if already running
if [[ -f "$PID_FILE" ]]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[OPS] Server already running (PID: $PID)"
        exit 0
    fi
    rm -f "$PID_FILE"
fi

# Export environment
export HTTP_ADDR="${HTTP_ADDR:-:8080}"
export LOG_LEVEL="${LOG_LEVEL:-info}"
export STORAGE_MODE="${STORAGE_MODE:-file}"
export DATA_DIR="${DATA_DIR:-./data}"
export SHUTDOWN_TIMEOUT="${SHUTDOWN_TIMEOUT:-30}"
export SOFT_LAUNCH="${SOFT_LAUNCH:-false}"
export READ_ONLY="${READ_ONLY:-false}"
export SHUTDOWN="${SHUTDOWN:-false}"
export RATE_LIMIT_ENABLED="${RATE_LIMIT_ENABLED:-true}"
export RATE_LIMIT_RPS="${RATE_LIMIT_RPS:-10.0}"
export RATE_LIMIT_BURST="${RATE_LIMIT_BURST:-20}"

# Create data directory
mkdir -p "$DATA_DIR"

echo "[OPS] Starting server natively..."
echo "[OPS] Binary: $BIN_PATH"
echo "[OPS] Log: $LOG_FILE"
echo "[OPS] HTTP_ADDR: $HTTP_ADDR"

nohup "$BIN_PATH" > "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"

echo "[OPS] Server started with PID $(cat $PID_FILE)"
