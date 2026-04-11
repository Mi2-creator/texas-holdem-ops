#!/bin/bash
# =============================================================================
# Restart production services (remote)
# Usage: ./scripts/prod/restart_prod.sh [service]
#   service: app, postgres, caddy, or blank for all
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

ENV_FILE=".env.prod"
if [[ ! -f "$ENV_FILE" ]]; then echo "[RESTART] ERROR: $ENV_FILE not found"; exit 1; fi
set -a; source "$ENV_FILE"; set +a

REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH_PORT="${SSH_PORT:-22}"
SSH="ssh -p ${SSH_PORT} ${REMOTE}"
COMPOSE_PROD="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"
SERVICE="${1:-}"

echo "[RESTART] Restarting production services..."
if [[ -n "$SERVICE" ]]; then
    $SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} restart ${SERVICE}"
    echo "[RESTART] Restarted: $SERVICE"
else
    $SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} down && ${COMPOSE_PROD} up -d"
    echo "[RESTART] All services restarted"
fi

sleep 5
echo ""
"$SCRIPT_DIR/check_prod.sh" "$ENV_FILE" 2>/dev/null || echo "[RESTART] Health check ran (see above)"
