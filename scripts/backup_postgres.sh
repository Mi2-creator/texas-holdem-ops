#!/bin/bash
# Backup PostgreSQL database via pg_dump
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then set -a; source .env; set +a; fi

DB_USER="${DB_USER:-texasholdem}"
DB_NAME="${DB_NAME:-texasholdem}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="${BACKUP_DIR}/pg-${DB_NAME}-${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

echo "========================================"
echo "[BACKUP] PostgreSQL Backup"
echo "========================================"
echo "Database: $DB_NAME"
echo "Target:   $DUMP_FILE"

# Verify postgres is running
if ! docker inspect --format='{{.State.Health.Status}}' texas-holdem-postgres 2>/dev/null | grep -q healthy; then
    echo "[BACKUP] ERROR: postgres container is not healthy"
    exit 1
fi

# Run pg_dump inside the postgres container
docker exec texas-holdem-postgres pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl | gzip > "$DUMP_FILE"

if [[ -f "$DUMP_FILE" ]]; then
    SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    echo "[BACKUP] SUCCESS: $DUMP_FILE ($SIZE)"

    # Keep last 10 postgres backups
    ls -t "$BACKUP_DIR"/pg-*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -v
else
    echo "[BACKUP] ERROR: backup failed"
    exit 1
fi

echo "========================================"
