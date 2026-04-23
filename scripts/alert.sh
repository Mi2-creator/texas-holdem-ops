#!/bin/bash
# =============================================================================
# Alert sink — auto-detects external notification channels from env.
#
# Always writes a timestamped line to $HLCI_ALERT_LOG (default
# /var/log/hlci_canary.log) and stderr. In addition, fires ANY of the
# following channels whose env vars are set:
#
#   SLACK_WEBHOOK_URL          → POST JSON to Slack incoming-webhook
#   TG_BOT_TOKEN + TG_CHAT_ID  → POST to Telegram Bot sendMessage
#   ALERT_WEBHOOK_URL          → POST generic JSON to a custom endpoint
#
# None set → log-only, same as before. Setting any of them adds that
# channel on top; curl failures are swallowed (best-effort notify —
# the log line is the authoritative record).
#
# Usage:
#   ./scripts/alert.sh "message text"
#
# Enable Slack:
#   echo "SLACK_WEBHOOK_URL=https://hooks.slack.com/services/..." >> .env.prod
#
# Enable Telegram:
#   echo "TG_BOT_TOKEN=bot-token" >> .env.prod
#   echo "TG_CHAT_ID=-100..."     >> .env.prod
# =============================================================================
set -u

MSG="${1:-alert invoked with no message}"
TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
LOG="${HLCI_ALERT_LOG:-/var/log/hlci_canary.log}"

# Make sure the log file is writable. Fall back to /tmp if the
# target path is unwritable (e.g. script running outside root).
LOG_DIR="$(dirname "$LOG")"
if ! mkdir -p "$LOG_DIR" 2>/dev/null; then
    LOG="/tmp/hlci_canary.log"
fi
if ! : >> "$LOG" 2>/dev/null; then
    LOG="/tmp/hlci_canary.log"
fi

printf '[%s] ALERT: %s\n' "$TS" "$MSG" >> "$LOG"
printf '[%s] ALERT: %s\n' "$TS" "$MSG" >&2

# ---- Source .env.prod so env vars set there flow through to cron ---
# (cron usually has a minimal PATH and no inherited env; explicitly
# load the prod env file the deploy scripts use. Silent on absence.)
if [[ -z "${SLACK_WEBHOOK_URL:-}${TG_BOT_TOKEN:-}${ALERT_WEBHOOK_URL:-}" ]]; then
    for candidate in \
        "$(dirname "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")")/.env.prod" \
        "/opt/texas-holdem-ops/.env.prod" \
        "/opt/texas-holdem-ops/.env"; do
        if [[ -f "$candidate" ]]; then
            set -a; source "$candidate"; set +a
            break
        fi
    done
fi

# ---- External channel fan-out. Each block is independent. ----------

if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
    curl -sS --max-time 10 -X POST -H 'Content-Type: application/json' \
        --data "$(printf '{"text":"[HLCI] %s"}' "$MSG")" \
        "$SLACK_WEBHOOK_URL" >/dev/null 2>&1 || true
fi

if [[ -n "${TG_BOT_TOKEN:-}" && -n "${TG_CHAT_ID:-}" ]]; then
    curl -sS --max-time 10 "https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage" \
        --data-urlencode "chat_id=${TG_CHAT_ID}" \
        --data-urlencode "text=[HLCI] ${MSG}" >/dev/null 2>&1 || true
fi

if [[ -n "${ALERT_WEBHOOK_URL:-}" ]]; then
    curl -sS --max-time 10 -X POST -H 'Content-Type: application/json' \
        --data "$(printf '{"msg":"%s","ts":"%s"}' "$MSG" "$TS")" \
        "$ALERT_WEBHOOK_URL" >/dev/null 2>&1 || true
fi

exit 0
