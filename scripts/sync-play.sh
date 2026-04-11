#!/bin/bash
# =============================================================================
# Sync player-app web build (dist/) to ops play/ directory
# Then optionally deploy to remote server
#
# Usage:
#   ./scripts/sync-play.sh              # sync locally only
#   ./scripts/sync-play.sh --deploy     # sync + deploy to remote
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="$(dirname "$SCRIPT_DIR")"
CLIENT_DIST="${OPS_DIR}/../texas-holdem-client/client/player-app/dist"
PLAY_DIR="${OPS_DIR}/play"

# Check dist exists
if [[ ! -d "$CLIENT_DIST" ]]; then
    echo "[SYNC-PLAY] ERROR: $CLIENT_DIST not found."
    echo "[SYNC-PLAY] Run 'cd ../texas-holdem-client/client/player-app && npm run web:build' first."
    exit 1
fi

if [[ ! -f "$CLIENT_DIST/index.html" ]]; then
    echo "[SYNC-PLAY] ERROR: $CLIENT_DIST/index.html not found. Build may have failed."
    exit 1
fi

# Sync to local play/
echo "[SYNC-PLAY] Syncing dist/ -> play/..."
rsync -av --delete "$CLIENT_DIST/" "$PLAY_DIR/"
echo "[SYNC-PLAY] Local sync done. $(find "$PLAY_DIR" -type f | wc -l | tr -d ' ') files."

# Optional: deploy to remote
if [[ "${1:-}" == "--deploy" ]]; then
    ENV_FILE="${OPS_DIR}/.env.prod"
    if [[ ! -f "$ENV_FILE" ]]; then
        echo "[SYNC-PLAY] ERROR: .env.prod not found. Cannot deploy."
        exit 1
    fi
    set -a; source "$ENV_FILE"; set +a

    SSH_PORT="${SSH_PORT:-22}"
    REMOTE="${SERVER_USER}@${SERVER_HOST}"
    REMOTE_DIR="${SERVER_DIR}"

    echo "[SYNC-PLAY] Deploying play/ to ${REMOTE}:${REMOTE_DIR}/play/..."
    rsync -avz --delete \
        -e "ssh -p ${SSH_PORT}" \
        "$PLAY_DIR/" "${REMOTE}:${REMOTE_DIR}/play/"

    echo "[SYNC-PLAY] Remote deploy done."
fi

echo "[SYNC-PLAY] Complete."
