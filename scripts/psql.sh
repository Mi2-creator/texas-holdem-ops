#!/bin/bash
# Open interactive psql session to the database
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then set -a; source .env; set +a; fi

DB_USER="${DB_USER:-texasholdem}"
DB_NAME="${DB_NAME:-texasholdem}"

# Use -it only if stdin is a terminal
TTY_FLAG=""
if [ -t 0 ]; then TTY_FLAG="-it"; fi
exec docker exec $TTY_FLAG texas-holdem-postgres psql -U "$DB_USER" -d "$DB_NAME" "$@"
