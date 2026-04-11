#!/bin/bash
# =============================================================================
# View production logs (remote)
# Usage: ./scripts/prod/logs_prod.sh [service] [lines]
#   service: app, postgres, caddy, or all (default: all)
#   lines: number of tail lines (default: 100)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

ENV_FILE=".env.prod"
if [[ ! -f "$ENV_FILE" ]]; then echo "[LOGS] ERROR: $ENV_FILE not found"; exit 1; fi
set -a; source "$ENV_FILE"; set +a

REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH_PORT="${SSH_PORT:-22}"
SERVICE="${1:-}"
LINES="${2:-100}"
COMPOSE_PROD="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"

if [[ -n "$SERVICE" ]]; then
    ssh -p ${SSH_PORT} "${REMOTE}" "cd ${REMOTE_DIR} && ${COMPOSE_PROD} logs --tail=${LINES} ${SERVICE}"
else
    ssh -p ${SSH_PORT} "${REMOTE}" "cd ${REMOTE_DIR} && ${COMPOSE_PROD} logs --tail=${LINES}"
fi
