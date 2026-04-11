#!/bin/bash
# Restore PostgreSQL database from pg_dump backup
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then set -a; source .env; set +a; fi

DB_USER="${DB_USER:-texasholdem}"
DB_NAME="${DB_NAME:-texasholdem}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DUMP_FILE="${1:-}"

echo "========================================"
echo "[RESTORE] PostgreSQL Restore"
echo "========================================"

# List available backups if no file specified
if [[ -z "$DUMP_FILE" ]]; then
    echo "Available PostgreSQL backups:"
    ls -lht "$BACKUP_DIR"/pg-*.sql.gz 2>/dev/null || echo "  (none found)"
    echo ""
    echo "Usage: $0 <backup-file.sql.gz>"
    exit 0
fi

# Resolve path
if [[ ! -f "$DUMP_FILE" ]]; then
    DUMP_FILE="$BACKUP_DIR/$DUMP_FILE"
fi
if [[ ! -f "$DUMP_FILE" ]]; then
    echo "[RESTORE] ERROR: File not found: $DUMP_FILE"
    exit 1
fi

echo "Source: $DUMP_FILE"
echo "Target: $DB_NAME"
echo ""
echo "WARNING: This will DROP and re-create all tables!"
read -p "Continue? [y/N] " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "[RESTORE] Aborted"
    exit 0
fi

# Verify postgres is running
if ! docker inspect --format='{{.State.Health.Status}}' texas-holdem-postgres 2>/dev/null | grep -q healthy; then
    echo "[RESTORE] ERROR: postgres container is not healthy"
    exit 1
fi

# Stop app to avoid writes during restore
echo "[RESTORE] Stopping app..."
docker stop texas-holdem-server 2>/dev/null || true

# Restore
echo "[RESTORE] Restoring database..."
gunzip -c "$DUMP_FILE" | docker exec -i texas-holdem-postgres psql -U "$DB_USER" -d "$DB_NAME" --quiet --single-transaction

echo "[RESTORE] Database restored."

# Restart app
echo "[RESTORE] Starting app..."
docker start texas-holdem-server 2>/dev/null || docker compose --env-file .env -f docker/docker-compose.yml up -d app

echo "[RESTORE] Done."
echo "========================================"
