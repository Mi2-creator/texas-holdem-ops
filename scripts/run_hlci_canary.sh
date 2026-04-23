#!/bin/bash
# =============================================================================
# Cron wrapper for check_hlci_canary.sh.
#
# Runs the canary, appends its full output to the shared log file
# (human-readable history), and invokes alert.sh with a compact
# summary on non-zero exit.
#
# Kept thin on purpose — check_hlci_canary.sh does all the real work
# (network, parsing, thresholds). This wrapper is the boring glue.
# =============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

LOG="${HLCI_ALERT_LOG:-/var/log/hlci_canary.log}"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

# Best-effort log-dir setup — same fallback as alert.sh so cron runs
# don't silently drop output if /var/log is root-owned.
if ! mkdir -p "$(dirname "$LOG")" 2>/dev/null || ! : >> "$LOG" 2>/dev/null; then
    LOG="/tmp/hlci_canary.log"
fi

{
    echo "========================================"
    echo "[$TS] run_hlci_canary.sh"
    echo "========================================"
} >> "$LOG"

OUTPUT="$(./scripts/check_hlci_canary.sh 2>&1)"
RC=$?

printf '%s\n' "$OUTPUT" >> "$LOG"

if [[ $RC -ne 0 ]]; then
    # Compact summary: strip blank lines, grab the last FAIL / ALERT lines
    # so the alert payload stays short enough for SMS / Telegram.
    SUMMARY="$(printf '%s\n' "$OUTPUT" | grep -E '^\[(FAIL|ALERT)\] ' | tr '\n' ' | ' | sed 's/ | $//')"
    if [[ -z "$SUMMARY" ]]; then
        SUMMARY="canary exit=${RC} (no explicit FAIL/ALERT line)"
    fi
    "${PROJECT_DIR}/scripts/alert.sh" "check_hlci_canary exit=${RC} | ${SUMMARY}"
fi

exit "$RC"
