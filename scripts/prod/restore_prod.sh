#!/bin/bash
# =============================================================================
# Restore production PostgreSQL from a backup file
# Usage: ./scripts/prod/restore_prod.sh <backup-file.sql.gz>
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

ENV_FILE=".env.prod"
if [[ ! -f "$ENV_FILE" ]]; then echo "[RESTORE] ERROR: $ENV_FILE not found"; exit 1; fi
set -a; source "$ENV_FILE"; set +a

REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH_PORT="${SSH_PORT:-22}"
SSH="ssh -p ${SSH_PORT} ${REMOTE}"
COMPOSE_PROD="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"
DUMP_FILE="${1:-}"

if [[ -z "$DUMP_FILE" ]]; then
    echo "Usage: $0 <backup-file.sql.gz>"
    echo ""
    echo "Available local backups:"
    ls -lht backups/prod/pg-prod-*.sql.gz 2>/dev/null || echo "  (none)"
    echo ""
    echo "Available remote backups:"
    $SSH "ls -lht ${REMOTE_DIR}/backups/pg-prod-*.sql.gz 2>/dev/null" || echo "  (none)"
    exit 0
fi

if [[ ! -f "$DUMP_FILE" ]]; then
    echo "[RESTORE] ERROR: File not found: $DUMP_FILE"
    exit 1
fi

echo "========================================"
echo "[RESTORE] Production PostgreSQL Restore"
echo "========================================"
echo "Server: ${SERVER_HOST}"
echo "Source: $DUMP_FILE"
echo "Target: ${DB_NAME:-texasholdem}"
echo ""
echo "WARNING: This will stop the app, restore the database, and restart."
echo "A pre-restore backup will be taken automatically."
read -p "Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "[RESTORE] Aborted"
    exit 0
fi

# Pre-restore backup
echo "[RESTORE] Taking pre-restore backup..."
"$SCRIPT_DIR/backup_prod.sh" "$ENV_FILE" || echo "[RESTORE] WARNING: pre-restore backup failed"

# Upload dump to server
REMOTE_DUMP="${REMOTE_DIR}/backups/restore-upload.sql.gz"
echo "[RESTORE] Uploading dump to server..."
scp -P ${SSH_PORT} "$DUMP_FILE" "${REMOTE}:${REMOTE_DUMP}"

# Stop app
echo "[RESTORE] Stopping app..."
$SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} stop app"

# Restore
echo "[RESTORE] Restoring database..."
$SSH "gunzip -c ${REMOTE_DUMP} | docker exec -i texas-holdem-postgres psql -U ${DB_USER:-texasholdem} -d ${DB_NAME:-texasholdem} --quiet --single-transaction"

# Restart app
echo "[RESTORE] Starting app..."
$SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} start app"

# Cleanup
$SSH "rm -f ${REMOTE_DUMP}"

echo ""
echo "[RESTORE] Done. Run: make check-prod"
echo "========================================"
