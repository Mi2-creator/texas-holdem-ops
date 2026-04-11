#!/bin/bash
# =============================================================================
# Check production health (remote)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

ENV_FILE="${1:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then echo "[CHECK] ERROR: $ENV_FILE not found"; exit 1; fi
set -a; source "$ENV_FILE"; set +a

REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH_PORT="${SSH_PORT:-22}"
SSH="ssh -p ${SSH_PORT} ${REMOTE}"
COMPOSE_PROD="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"

echo "========================================"
echo "[CHECK] Production Health Check"
echo "========================================"
echo "Server: ${SERVER_HOST}"
echo "Domain: ${DOMAIN}"
echo ""

# --- Container status ---
echo "--- Container Status ---"
$SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} ps"
echo ""

# --- Health status per container ---
echo "--- Container Health ---"
for cname in texas-holdem-postgres texas-holdem-server texas-holdem-caddy; do
    status=$($SSH "docker inspect --format='{{.State.Health.Status}}' $cname 2>/dev/null" || echo "not found")
    echo "$cname: $status"
done
echo ""

# --- HTTP health (internal) ---
echo "--- Internal Health ---"
$SSH "curl -sf http://localhost:8080/health" | python3 -m json.tool 2>/dev/null || echo "FAILED: localhost:8080/health unreachable"
echo ""

# --- HTTPS health (external) ---
if [[ -n "${DOMAIN:-}" ]]; then
    echo "--- External HTTPS ---"
    if curl -sf --max-time 10 "https://${DOMAIN}/health" 2>/dev/null; then
        echo ""
        echo "https://${DOMAIN}/health -> OK"
        echo ""
        # Check TLS certificate
        echo "--- TLS Certificate ---"
        echo | openssl s_client -servername "$DOMAIN" -connect "${DOMAIN}:443" 2>/dev/null | openssl x509 -noout -dates -subject 2>/dev/null || echo "(could not read cert)"
    else
        echo "https://${DOMAIN}/health -> FAILED (cert may still be provisioning)"
    fi
fi

echo ""
echo "========================================"
echo "[CHECK] Done"
echo "========================================"
