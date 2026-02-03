#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Backup Script
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
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="texas-holdem-backup-${TIMESTAMP}"

echo "========================================"
echo "[BACKUP] Texas Hold'em Server Backup"
echo "========================================"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Check if data directory exists
if [[ ! -d "$DATA_DIR" ]]; then
    echo "[BACKUP] ERROR: Data directory not found: $DATA_DIR"
    exit 1
fi

# Create backup
echo "[BACKUP] Source: $DATA_DIR"
echo "[BACKUP] Target: $BACKUP_DIR/$BACKUP_NAME.tar.gz"

tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"

# Verify backup
if [[ -f "$BACKUP_DIR/$BACKUP_NAME.tar.gz" ]]; then
    SIZE=$(du -h "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | cut -f1)
    echo "[BACKUP] SUCCESS: Created $BACKUP_NAME.tar.gz ($SIZE)"

    # List backup contents
    echo ""
    echo "[BACKUP] Contents:"
    tar -tzf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" | head -20

    # Cleanup old backups (keep last 10)
    echo ""
    echo "[BACKUP] Cleaning old backups (keeping last 10)..."
    ls -t "$BACKUP_DIR"/texas-holdem-backup-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -v
else
    echo "[BACKUP] ERROR: Backup creation failed"
    exit 1
fi

echo "========================================"
