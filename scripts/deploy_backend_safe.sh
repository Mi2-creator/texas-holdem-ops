#!/bin/bash
# =============================================================================
# Safe backend-only deploy — codifies the manually verified path.
#
# Fixed behavior (DO NOT EXTEND):
#   1. backup production postgres (via existing scripts/prod/backup_prod.sh)
#   2. rsync ../texas-holdem-client/server/go/ -> REMOTE:SERVER_DIR/server/go/
#   3. remote: docker compose build app
#   4. remote: docker compose up -d app
#
# Hard rules (do not touch):
#   - does NOT upload local .env.prod
#   - does NOT overwrite remote .env
#   - does NOT rsync the whole ops repo
#   - does NOT regenerate Caddyfile
#   - does NOT touch caddy / postgres containers
#   - does NOT touch client/player-app or play/ bundle
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

ENV_FILE="${ENV_FILE:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then
    echo "[DEPLOY-SAFE] ERROR: $ENV_FILE not found (need SERVER_HOST / SERVER_USER / SERVER_DIR / SSH_PORT)"
    exit 1
fi
set -a; source "$ENV_FILE"; set +a

for var in SERVER_HOST SERVER_USER SERVER_DIR; do
    if [[ -z "${!var:-}" ]]; then
        echo "[DEPLOY-SAFE] ERROR: $var is not set in $ENV_FILE"
        exit 1
    fi
done

SSH_PORT="${SSH_PORT:-22}"
REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH="ssh -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new ${REMOTE}"
RSYNC_SSH="ssh -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new"
COMPOSE_PROD='docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml'

CLIENT_SRC="${PROJECT_DIR}/../texas-holdem-client"
if [[ ! -d "${CLIENT_SRC}/server/go" ]]; then
    echo "[DEPLOY-SAFE] ERROR: ${CLIENT_SRC}/server/go not found"
    exit 1
fi

# Sync the CF CIDR list into the Go source before rsync. This is a
# no-op if config/cf_cidrs.txt hasn't drifted from the Go file, so the
# normal deploy cost is zero. The separate refresh_cf_cidrs.sh is what
# actually changes the config file (weekly CI / on-demand).
"${SCRIPT_DIR}/sync_cf_cidrs_to_server.sh"

# Build-identity vars — injected into the Docker image as build args so
# /health reports real values instead of "dev" / "unknown".
# The client repo is not a git repo, so GIT_COMMIT tracks the ops repo state
# that built + shipped the image.
export BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
export VERSION="manual-$(date -u +%Y%m%d-%H%M)"
if GIT_COMMIT="$(git -C "$PROJECT_DIR" rev-parse --short HEAD 2>/dev/null)"; then
    export GIT_COMMIT
else
    export GIT_COMMIT="unknown-$(date -u +%s)"
fi

echo "========================================"
echo "[DEPLOY-SAFE] Backend-only safe deploy"
echo "========================================"
echo "Target     : ${REMOTE}:${REMOTE_DIR} (port ${SSH_PORT})"
echo "Source     : ${CLIENT_SRC}/server/go"
echo "VERSION    : ${VERSION}"
echo "GIT_COMMIT : ${GIT_COMMIT}"
echo "BUILD_TIME : ${BUILD_TIME}"
echo "Policy     : no .env upload, no ops rsync, no Caddyfile regen, app-only restart"
echo ""

# 1) backup
echo "[DEPLOY-SAFE] (1/4) backup production postgres..."
./scripts/prod/backup_prod.sh "$ENV_FILE"

# 2) rsync server/go only
echo ""
echo "[DEPLOY-SAFE] (2/4) rsync server/go -> remote..."
$SSH "mkdir -p ${REMOTE_DIR}/server/go"
rsync -avz --delete \
    -e "${RSYNC_SSH}" \
    --exclude='.git' \
    --exclude='.DS_Store' \
    --exclude='bin/' \
    "${CLIENT_SRC}/server/go/" "${REMOTE}:${REMOTE_DIR}/server/go/"

# Build args — must be present for both `build` (injection) and `up`
# (image tag resolution via docker-compose.yml ${VERSION:-latest}).
BUILD_ENV="VERSION='${VERSION}' GIT_COMMIT='${GIT_COMMIT}' BUILD_TIME='${BUILD_TIME}'"

# 3) build app only
echo ""
echo "[DEPLOY-SAFE] (3/4) remote build app (VERSION=${VERSION} GIT_COMMIT=${GIT_COMMIT})..."
$SSH "cd ${REMOTE_DIR} && ${BUILD_ENV} ${COMPOSE_PROD} build app"

# 4) restart app only
echo ""
echo "[DEPLOY-SAFE] (4/4) remote up -d app..."
$SSH "cd ${REMOTE_DIR} && ${BUILD_ENV} ${COMPOSE_PROD} up -d app"

sleep 6
$SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} ps app"

echo ""
echo "========================================"
echo "[DEPLOY-SAFE] DONE — app container replaced, postgres/caddy/.env untouched"
echo "========================================"

# Post-deploy observation: hit /health on the remote host so we can verify the
# newly injected VERSION / GIT_COMMIT / BUILD_TIME actually landed in the live
# image. Observational only — a failure here prints a warning but does not
# fail the deploy (container may still be warming up under compose healthcheck).
echo ""
echo "[DEPLOY-SAFE] Remote /health snapshot:"
HEALTH_BODY="$(ssh -p ${SSH_PORT} -o StrictHostKeyChecking=accept-new ${REMOTE} \
    "curl -sS --max-time 5 http://localhost:${HOST_PORT:-8080}/health" 2>/dev/null || true)"
if [[ -z "$HEALTH_BODY" ]]; then
    echo "  (warn) could not read /health from remote — service may still be starting"
else
    echo "$HEALTH_BODY"
fi

echo ""
echo "Acceptance commands (copy-paste):"
echo ""
echo "  DOMAIN=\$(ssh -p ${SSH_PORT} ${REMOTE} \"grep '^API_DOMAIN=' ${REMOTE_DIR}/.env | cut -d= -f2\")"
echo "  TOKEN=\$(ssh -p ${SSH_PORT} ${REMOTE} \"grep '^ADMIN_TOKEN=' ${REMOTE_DIR}/.env | cut -d= -f2\")"
echo ""
echo "  # /health must now return real version / git_commit / build_time"
echo "  curl -sS https://\$DOMAIN/health | jq '{status,mode,uptime_seconds,version,git_commit,build_time}'"
echo ""
echo "  curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' https://\$DOMAIN/health"
echo "  curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' -H \"X-Admin-Token: \$TOKEN\" https://\$DOMAIN/v1/admin/dashboard/recharge-reconcile"
echo "  curl -sS -o /dev/null -w 'HTTP %{http_code}\\n' -H \"X-Admin-Token: \$TOKEN\" \"https://\$DOMAIN/v1/admin/risk/events?limit=3\""
echo ""
