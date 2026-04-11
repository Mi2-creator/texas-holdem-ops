#!/bin/bash
# Stop all services
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "[OPS] Stopping services..."
docker compose --env-file .env -f docker/docker-compose.yml down
echo "[OPS] All services stopped."
