#!/bin/bash
# Start all services (postgres + app)
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then set -a; source .env; set +a; fi

mkdir -p data backups

echo "[OPS] Starting services..."
docker compose --env-file .env -f docker/docker-compose.yml up -d

echo "[OPS] Waiting for postgres healthy..."
for i in $(seq 1 30); do
    if docker inspect --format='{{.State.Health.Status}}' texas-holdem-postgres 2>/dev/null | grep -q healthy; then
        echo "[OPS] postgres: healthy"
        break
    fi
    sleep 1
done

echo "[OPS] Waiting for app healthy..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:${HOST_PORT:-8080}/health >/dev/null 2>&1; then
        echo "[OPS] app: healthy"
        break
    fi
    sleep 1
done

echo ""
"$SCRIPT_DIR/health.sh"
