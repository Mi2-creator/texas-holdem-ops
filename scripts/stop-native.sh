#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Native Stop Script
# =============================================================================
set -euo pipefail

PID_FILE="/tmp/texas-holdem.pid"

if [[ ! -f "$PID_FILE" ]]; then
    echo "[OPS] No PID file found, server may not be running"
    exit 0
fi

PID=$(cat "$PID_FILE")

if ! kill -0 "$PID" 2>/dev/null; then
    echo "[OPS] Process $PID not running"
    rm -f "$PID_FILE"
    exit 0
fi

echo "[OPS] Sending SIGTERM to PID $PID..."
kill -TERM "$PID"

# Wait for graceful shutdown (up to 35 seconds)
for i in {1..35}; do
    if ! kill -0 "$PID" 2>/dev/null; then
        echo "[OPS] Server stopped"
        rm -f "$PID_FILE"
        exit 0
    fi
    sleep 1
done

echo "[OPS] Server did not stop gracefully, sending SIGKILL..."
kill -9 "$PID" 2>/dev/null || true
rm -f "$PID_FILE"
echo "[OPS] Server killed"
