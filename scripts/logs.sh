#!/bin/bash
# =============================================================================
# Texas Hold'em Server - Logs Script
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

MODE="${1:-follow}"
LINES="${2:-100}"

case "$MODE" in
    follow|-f)
        echo "[OPS] Following logs (Ctrl+C to exit)..."
        docker compose -f docker/docker-compose.yml logs -f --tail="$LINES"
        ;;
    tail|-n)
        echo "[OPS] Last $LINES log lines:"
        docker compose -f docker/docker-compose.yml logs --tail="$LINES"
        ;;
    all)
        echo "[OPS] All logs:"
        docker compose -f docker/docker-compose.yml logs
        ;;
    *)
        echo "Usage: $0 [follow|tail|all] [lines]"
        echo "  follow, -f  : Follow logs in real-time (default)"
        echo "  tail, -n    : Show last N lines"
        echo "  all         : Show all logs"
        exit 1
        ;;
esac
