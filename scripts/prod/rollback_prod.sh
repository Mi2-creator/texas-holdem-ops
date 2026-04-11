#!/bin/bash
# =============================================================================
# Rollback production deployment
# Strategy: re-deploy previous image tag + restore previous database backup
#
# Usage:
#   ./scripts/prod/rollback_prod.sh                    # list available options
#   ./scripts/prod/rollback_prod.sh image <tag>        # rollback app to specific image tag
#   ./scripts/prod/rollback_prod.sh db <dump.sql.gz>   # rollback database from backup
#   ./scripts/prod/rollback_prod.sh full <tag> <dump>  # rollback both
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
cd "$PROJECT_DIR"

ENV_FILE=".env.prod"
if [[ ! -f "$ENV_FILE" ]]; then echo "[ROLLBACK] ERROR: $ENV_FILE not found"; exit 1; fi
set -a; source "$ENV_FILE"; set +a

REMOTE="${SERVER_USER}@${SERVER_HOST}"
REMOTE_DIR="${SERVER_DIR}"
SSH_PORT="${SSH_PORT:-22}"
SSH="ssh -p ${SSH_PORT} ${REMOTE}"
COMPOSE_PROD="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"

ACTION="${1:-}"

show_help() {
    echo "========================================"
    echo "[ROLLBACK] Production Rollback"
    echo "========================================"
    echo ""
    echo "Usage:"
    echo "  $0 image <tag>         Rollback app to image tag"
    echo "  $0 db <dump.sql.gz>    Rollback database from backup"
    echo "  $0 full <tag> <dump>   Rollback both image and database"
    echo ""
    echo "Available image tags on server:"
    $SSH "docker images texas-holdem-server --format 'table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}'" 2>/dev/null || echo "  (could not list)"
    echo ""
    echo "Available database backups on server:"
    $SSH "ls -lht ${REMOTE_DIR}/backups/pg-prod-*.sql.gz 2>/dev/null" || echo "  (none)"
    echo ""
    echo "Available local backups:"
    ls -lht backups/prod/pg-prod-*.sql.gz 2>/dev/null || echo "  (none)"
}

rollback_image() {
    local TAG="$1"
    echo "[ROLLBACK] Rolling back app to image tag: $TAG"

    # Update VERSION in remote .env
    $SSH "cd ${REMOTE_DIR} && sed -i 's/^VERSION=.*/VERSION=${TAG}/' .env"

    # Restart app with the specified tag
    $SSH "cd ${REMOTE_DIR} && ${COMPOSE_PROD} up -d app"
    echo "[ROLLBACK] App rolled back to tag: $TAG"
}

rollback_db() {
    local DUMP="$1"
    echo "[ROLLBACK] Rolling back database from: $DUMP"
    "$SCRIPT_DIR/restore_prod.sh" "$DUMP"
}

case "${ACTION}" in
    image)
        TAG="${2:-}"
        if [[ -z "$TAG" ]]; then echo "ERROR: specify image tag"; show_help; exit 1; fi
        rollback_image "$TAG"
        ;;
    db)
        DUMP="${2:-}"
        if [[ -z "$DUMP" ]]; then echo "ERROR: specify dump file"; show_help; exit 1; fi
        rollback_db "$DUMP"
        ;;
    full)
        TAG="${2:-}"
        DUMP="${3:-}"
        if [[ -z "$TAG" || -z "$DUMP" ]]; then echo "ERROR: specify both tag and dump"; show_help; exit 1; fi

        echo "[ROLLBACK] Full rollback: image=$TAG, db=$DUMP"
        echo ""
        echo "WARNING: This will stop the app, restore database, and restart with old image."
        read -p "Continue? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then echo "[ROLLBACK] Aborted"; exit 0; fi

        # Backup current state first
        echo "[ROLLBACK] Backing up current state..."
        "$SCRIPT_DIR/backup_prod.sh" "$ENV_FILE" || echo "[ROLLBACK] WARNING: backup failed"

        rollback_db "$DUMP"
        rollback_image "$TAG"
        ;;
    *)
        show_help
        ;;
esac

echo ""
echo "[ROLLBACK] Run 'make check-prod' to verify."
