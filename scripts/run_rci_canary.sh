#!/bin/bash
# =============================================================================
# Cron wrapper for check_rci_canary.sh.
#
# Logs full output to /var/log/hlci_canary.log (same file as HLCI
# canary — ops watches one place). Calls alert.sh on non-zero exit.
# =============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

LOG="${HLCI_ALERT_LOG:-/var/log/hlci_canary.log}"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if ! mkdir -p "$(dirname "$LOG")" 2>/dev/null || ! : >> "$LOG" 2>/dev/null; then
    LOG="/tmp/hlci_canary.log"
fi

{
    echo "========================================"
    echo "[$TS] run_rci_canary.sh"
    echo "========================================"
} >> "$LOG"

OUTPUT="$(./scripts/check_rci_canary.sh 2>&1)"
RC=$?

printf '%s\n' "$OUTPUT" >> "$LOG"

if [[ $RC -ne 0 ]]; then
    SUMMARY="$(printf '%s\n' "$OUTPUT" | grep -E '^\[(FAIL|ALERT)\] ' | tr '\n' ' | ' | sed 's/ | $//')"
    if [[ -z "$SUMMARY" ]]; then
        SUMMARY="rci canary exit=${RC}"
    fi
    "${PROJECT_DIR}/scripts/alert.sh" "check_rci_canary exit=${RC} | ${SUMMARY}"
fi

exit "$RC"
