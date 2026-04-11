#!/bin/bash
# =============================================================================
# Backup production PostgreSQL (remote) and download locally
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

ENV_FILE="${1:-.env.prod}"
if [[ ! -f "$ENV_FILE" ]]; then echo "[BACKUP] ERROR: $ENV_FILE not found"; exit 1; fi
set -a; source "$ENV_FILE"; set +a

REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH_PORT="${SSH_PORT:-22}"
SSH="ssh -p ${SSH_PORT} ${REMOTE}"
LOCAL_BACKUP_DIR="./backups/prod"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_NAME="pg-prod-${DB_NAME:-texasholdem}-${TIMESTAMP}.sql.gz"

mkdir -p "$LOCAL_BACKUP_DIR"

echo "========================================"
echo "[BACKUP] Production PostgreSQL Backup"
echo "========================================"
echo "Server: ${SERVER_HOST}"
echo ""

# Run pg_dump on remote server
echo "[BACKUP] Running pg_dump on server..."
$SSH "docker exec texas-holdem-postgres pg_dump -U ${DB_USER:-texasholdem} -d ${DB_NAME:-texasholdem} --no-owner --no-acl | gzip > ${REMOTE_DIR}/backups/${DUMP_NAME}"

# Download to local
echo "[BACKUP] Downloading backup..."
scp -P ${SSH_PORT} "${REMOTE}:${REMOTE_DIR}/backups/${DUMP_NAME}" "${LOCAL_BACKUP_DIR}/${DUMP_NAME}"

# Verify
if [[ -f "${LOCAL_BACKUP_DIR}/${DUMP_NAME}" ]]; then
    SIZE=$(du -h "${LOCAL_BACKUP_DIR}/${DUMP_NAME}" | cut -f1)
    echo "[BACKUP] SUCCESS: ${LOCAL_BACKUP_DIR}/${DUMP_NAME} (${SIZE})"
else
    echo "[BACKUP] ERROR: download failed"
    exit 1
fi

# Cleanup old remote backups (keep last 10)
$SSH "ls -t ${REMOTE_DIR}/backups/pg-prod-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -v" || true

echo "========================================"
