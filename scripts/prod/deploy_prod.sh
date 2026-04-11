#!/bin/bash
# =============================================================================
# Deploy Texas Hold'em BACKEND to production server
# =============================================================================
# WHAT THIS DEPLOYS:
#   - Ops files (Makefile, docker/, scripts/, etc.)
#   - Go server source (server/go/) for Docker image build
#   - Production .env
#
# WHAT THIS DOES NOT DEPLOY:
#   - player-app (mobile app — distributed via TestFlight/APK, NOT on server)
#   - node_modules, package*.json, tsconfig*, jest.config*
#   - TypeScript source files (*.ts)
#   - Any frontend/client assets
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

# Load prod env
ENV_FILE="${1:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[DEPLOY] ERROR: $ENV_FILE not found. Copy .env.prod.example to $ENV_FILE and configure."
    exit 1
fi
set -a; source "$ENV_FILE"; set +a

# Validate required vars
for var in SERVER_HOST SERVER_USER SERVER_DIR DOMAIN DB_PASSWORD ADMIN_TOKEN; do
    if [[ -z "${!var:-}" ]] || [[ "${!var}" == *"CHANGE_ME"* ]]; then
        echo "[DEPLOY] ERROR: $var is not set or still contains placeholder in $ENV_FILE"
        exit 1
    fi
done

SSH_PORT="${SSH_PORT:-22}"
REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH="ssh -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new ${REMOTE}"
SCP="scp -P ${SSH_PORT}"
RSYNC_SSH="ssh -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new"
COMPOSE_PROD="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"

echo "========================================"
echo "[DEPLOY] Texas Hold'em Production Deploy"
echo "========================================"
echo "Target: ${REMOTE}:${REMOTE_DIR} (port ${SSH_PORT})"
echo "Domain: ${DOMAIN}"
echo ""

# --- Sync ops files (NOT client code, NOT player-app) ---
echo "[DEPLOY] Syncing ops files to server..."
rsync -avz --delete \
    -e "${RSYNC_SSH}" \
    --exclude='.git' \
    --exclude='.env' \
    --exclude='.env.prod' \
    --exclude='data/' \
    --exclude='backups/' \
    --exclude='bin/' \
    --exclude='server/' \
    --exclude='node_modules' \
    --exclude='dist/' \
    --exclude='coverage/' \
    --exclude='.DS_Store' \
    --exclude='docker/Caddyfile' \
    ./ "${REMOTE}:${REMOTE_DIR}/"

# --- Sync .env.prod as .env on server ---
echo "[DEPLOY] Uploading production .env..."
${SCP} "$ENV_FILE" "${REMOTE}:${REMOTE_DIR}/.env"

# --- Sync ONLY server/go — nothing else from texas-holdem-client ---
# HARD RULE: only server/go/ is deployed. No player-app, no TS, no node_modules.
CLIENT_SRC="${PROJECT_DIR}/../texas-holdem-client"
if [[ -d "$CLIENT_SRC/server/go" ]]; then
    echo "[DEPLOY] Syncing Go server source (server/go only)..."
    $SSH "mkdir -p ${REMOTE_DIR}/server/go"
    rsync -avz --delete \
        -e "${RSYNC_SSH}" \
        --exclude='.git' \
        --exclude='.DS_Store' \
        --exclude='bin/' \
        "$CLIENT_SRC/server/go/" "${REMOTE}:${REMOTE_DIR}/server/go/"

    # Safety: remove any non-Go waste that might exist in server/ (TS leftovers, etc.)
    $SSH "find ${REMOTE_DIR}/server/ -maxdepth 1 -type f -name '*.ts' -o -name '*.js' -o -name 'tsconfig*' -o -name 'package*.json' -o -name 'jest.config*' | xargs -r rm -f"
else
    echo "[DEPLOY] WARNING: texas-holdem-client/server/go not found at $CLIENT_SRC — remote build may fail"
fi

# --- Create directories ---
echo "[DEPLOY] Ensuring remote directories..."
$SSH "mkdir -p ${REMOTE_DIR}/{data,backups,data/caddy,landing,play}"

# --- Generate Caddyfile from env vars (never use a hand-written Caddyfile) ---
if [[ -z "${PLAY_DOMAIN:-}" ]]; then
    echo "[DEPLOY] WARNING: PLAY_DOMAIN is not set — play.* subdomain will NOT be configured in Caddy"
fi
echo "[DEPLOY] Generating Caddyfile..."
$SSH "cd ${REMOTE_DIR} && DOMAIN=${DOMAIN} API_DOMAIN=${API_DOMAIN:-} PLAY_DOMAIN=${PLAY_DOMAIN:-} bash scripts/generate_caddyfile.sh docker/Caddyfile"

# --- Build and start ---
echo "[DEPLOY] Building on server..."
$SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} build"

echo "[DEPLOY] Starting services..."
$SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} up -d"

# --- Wait and check ---
echo "[DEPLOY] Waiting for services..."
sleep 10

echo "[DEPLOY] Checking health..."
$SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} ps"
$SSH "curl -sf http://localhost:8080/health || curl -sf https://localhost:8443/health -k" \
    || echo "[DEPLOY] WARNING: health check failed (Caddy may take a moment)"

echo ""
echo "========================================"
echo "[DEPLOY] DONE"
echo "========================================"
echo "Check: https://${DOMAIN}/health"
echo "Run:   make check-prod"
echo "========================================"
