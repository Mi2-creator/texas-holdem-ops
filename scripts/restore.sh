#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Restore Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# Load environment
if [[ -f .env ]]; then
    set -a
    source .env
    set +a
fi

DATA_DIR="${DATA_DIR:-./data}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_FILE="${1:-}"

echo "========================================"
echo "[RESTORE] Texas Hold'em Server Restore"
echo "========================================"

# List available backups if no file specified
if [[ -z "$BACKUP_FILE" ]]; then
    echo "[RESTORE] Available backups:"
    ls -lht "$BACKUP_DIR"/texas-holdem-backup-*.tar.gz 2>/dev/null || {
        echo "[RESTORE] No backups found in $BACKUP_DIR"
        exit 1
    }
    echo ""
    echo "Usage: $0 <backup-file.tar.gz>"
    exit 0
fi

# Resolve backup file path
if [[ ! -f "$BACKUP_FILE" ]]; then
    BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILE"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "[RESTORE] ERROR: Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Confirm restore
echo "[RESTORE] Source: $BACKUP_FILE"
echo "[RESTORE] Target: $DATA_DIR"
echo ""
echo "WARNING: This will overwrite existing data!"
read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "[RESTORE] Aborted"
    exit 0
fi

# Stop server if running
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q 'texas-holdem-server'; then
    echo "[RESTORE] Stopping server..."
    ./scripts/stop.sh docker
    RESTART_AFTER=true
else
    RESTART_AFTER=false
fi

# Backup current data
if [[ -d "$DATA_DIR" ]]; then
    echo "[RESTORE] Backing up current data..."
    mv "$DATA_DIR" "${DATA_DIR}.pre-restore.$(date +%s)"
fi

# Restore from backup
echo "[RESTORE] Extracting backup..."
mkdir -p "$(dirname "$DATA_DIR")"
tar -xzf "$BACKUP_FILE" -C "$(dirname "$DATA_DIR")"

# Verify restore
if [[ -d "$DATA_DIR" ]]; then
    echo "[RESTORE] SUCCESS: Data restored"
    ls -la "$DATA_DIR"
else
    echo "[RESTORE] ERROR: Restore verification failed"
    exit 1
fi

# Restart server if it was running
if [[ "$RESTART_AFTER" == "true" ]]; then
    echo "[RESTORE] Restarting server..."
    ./scripts/start.sh docker
fi

echo "========================================"
