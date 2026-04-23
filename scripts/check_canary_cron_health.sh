#!/bin/bash
# =============================================================================
# Meta-canary — verifies the HLCI canary log itself is still being written.
#
# The real canaries (HLCI / RCI / TLCI) all report business-layer violations,
# but none of them notice when cron itself stops firing. This script fills
# that gap: if /var/log/hlci_canary.log has not been touched within
# HLCI_CANARY_MAX_AGE_MIN minutes (default 10 — two hlci-canary intervals),
# it fans out a "cron silent" alert via scripts/alert.sh.
#
# Exit codes:
#   0  log is fresh
#   1  log is stale, missing, or unreadable — alert already fired
#
# Intended cron wiring (on prod):
#   */15 * * * * /opt/texas-holdem-ops/scripts/check_canary_cron_health.sh
#
# Tuning via env:
#   HLCI_ALERT_LOG             path to the canary log (default /var/log/hlci_canary.log)
#   HLCI_CANARY_MAX_AGE_MIN    staleness threshold in minutes (default 10)
# =============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

LOG="${HLCI_ALERT_LOG:-/var/log/hlci_canary.log}"
MAX_AGE_MIN="${HLCI_CANARY_MAX_AGE_MIN:-10}"

# If the primary path is unreadable, fall back to the /tmp mirror that
# run_*_canary.sh + alert.sh drop to when /var/log is not writable.
if [[ ! -f "$LOG" ]]; then
    if [[ -f "/tmp/hlci_canary.log" ]]; then
        LOG="/tmp/hlci_canary.log"
    else
        "${SCRIPT_DIR}/alert.sh" "canary cron health: log file missing (${LOG})"
        exit 1
    fi
fi

# stat(1) flags differ between GNU (Linux) and BSD (macOS).
if MTIME="$(stat -c %Y "$LOG" 2>/dev/null)"; then
    :
elif MTIME="$(stat -f %m "$LOG" 2>/dev/null)"; then
    :
else
    "${SCRIPT_DIR}/alert.sh" "canary cron health: stat failed on ${LOG}"
    exit 1
fi

NOW="$(date +%s)"
AGE_SEC=$(( NOW - MTIME ))
MAX_SEC=$(( MAX_AGE_MIN * 60 ))

if (( AGE_SEC > MAX_SEC )); then
    "${SCRIPT_DIR}/alert.sh" "canary cron health: ${LOG} stale (${AGE_SEC}s old, threshold ${MAX_SEC}s) — HLCI cron may not be firing"
    exit 1
fi

exit 0
