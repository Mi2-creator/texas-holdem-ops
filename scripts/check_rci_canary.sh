#!/bin/bash
# =============================================================================
# Ops check: RCI (Rake Conservation Invariant) reconciliation probe.
#
# Calls GET /v1/admin/hlci/rci_check and fails non-zero when:
#   - mismatched_hand_count > 0 (one or more hands failed the invariant)
#   - overall discrepancy != 0 (aggregate sum drifted)
#
# Intended cadence: hourly (it's a heavier scan than HLCI canary — it
# walks all rake events in a time window and groups by handID).
#
# Env:
#   RCI_CANARY_SCHEME         default "https"
#   RCI_CANARY_WINDOW_HOURS   default 24 (how far back to look)
#   RCI_CANARY_MOCK_JSON      short-circuits network for self-test
#
# Required: API_DOMAIN, ADMIN_TOKEN
#
# Suggested crontab:
#   7 * * * * root /opt/texas-holdem-ops/scripts/run_rci_canary.sh
# =============================================================================
set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then
    set -a; source .env; set +a
fi
if [[ -f .env.prod ]]; then
    set -a; source .env.prod; set +a
fi

RCI_CANARY_SCHEME="${RCI_CANARY_SCHEME:-https}"
RCI_CANARY_WINDOW_HOURS="${RCI_CANARY_WINDOW_HOURS:-24}"

print_header() {
    echo "========================================"
    echo "[RCI-CANARY] rake conservation probe"
    echo "========================================"
    echo "host          : ${API_DOMAIN:-<unset>}"
    echo "window_hours  : ${RCI_CANARY_WINDOW_HOURS}"
    echo "time          : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "----------------------------------------"
}

fail() {
    print_header
    echo "[FAIL] $1"
    echo "========================================"
    exit 1
}

if [[ -z "${API_DOMAIN:-}" ]]; then
    fail "API_DOMAIN is not set (check .env.prod / .env)"
fi
if [[ -z "${ADMIN_TOKEN:-}" ]]; then
    fail "ADMIN_TOKEN is not set"
fi

SINCE="$(date -u -d "${RCI_CANARY_WINDOW_HOURS} hours ago" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || \
         date -u -v-${RCI_CANARY_WINDOW_HOURS}H +"%Y-%m-%dT%H:%M:%SZ")"
UNTIL="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
URL="${RCI_CANARY_SCHEME}://${API_DOMAIN}/v1/admin/hlci/rci_check?since=${SINCE}&until=${UNTIL}"

BODY=""
HTTP_CODE="000"
if [[ -n "${RCI_CANARY_MOCK_JSON:-}" ]]; then
    BODY="${RCI_CANARY_MOCK_JSON}"
    HTTP_CODE="200"
else
    TMP_BODY="$(mktemp -t rci_canary.XXXXXX)"
    trap 'rm -f "$TMP_BODY"' EXIT
    if ! HTTP_CODE=$(curl -sS -o "$TMP_BODY" -w '%{http_code}' \
            --max-time 30 \
            -H "X-Admin-Token: ${ADMIN_TOKEN}" \
            -H "Accept: application/json" \
            "$URL" 2>/dev/null); then
        fail "curl failed (network / DNS / TLS) for ${RCI_CANARY_SCHEME}://${API_DOMAIN}"
    fi
    BODY="$(cat "$TMP_BODY")"
fi

case "$HTTP_CODE" in
    200) : ;;
    401|403) fail "auth rejected (HTTP ${HTTP_CODE})" ;;
    404)     fail "endpoint not found (HTTP 404) — backend may predate HLCI Step 9" ;;
    5*)      fail "backend error (HTTP ${HTTP_CODE})" ;;
    *)       fail "unexpected HTTP ${HTTP_CODE}" ;;
esac

if ! command -v python3 >/dev/null 2>&1; then
    fail "python3 is required to parse metrics response"
fi

PARSED=$(
    RCI_BODY="$BODY" python3 - <<'PY' 2>/dev/null || true
import json, os, sys
raw = os.environ.get("RCI_BODY", "")
try:
    data = json.loads(raw)
except Exception:
    print("__PARSE_ERROR__")
    sys.exit(0)

def as_int(v):
    try: return int(v)
    except Exception: return -1

audited = as_int(data.get("hands_audited"))
charged = as_int(data.get("total_rake_charged"))
distributed = as_int(data.get("total_rake_distributed"))
jackpot = as_int(data.get("total_jackpot"))
discrepancy = as_int(data.get("discrepancy"))
mismatched_count = as_int(data.get("mismatched_hand_count"))
mismatched = data.get("mismatched_hands") or []

print(f"AUDITED:{audited}")
print(f"CHARGED:{charged}")
print(f"DISTRIBUTED:{distributed}")
print(f"JACKPOT:{jackpot}")
print(f"DISCREPANCY:{discrepancy}")
print(f"MISMATCHED:{mismatched_count}")

alerts = []
if discrepancy != 0:
    alerts.append(f"rake discrepancy={discrepancy} charged={charged} distributed={distributed} jackpot={jackpot}")
if mismatched_count > 0:
    sample = ",".join(m.get("hand_id","?") for m in mismatched[:5])
    alerts.append(f"mismatched_hands={mismatched_count} sample={sample}")
for a in alerts:
    print(f"ALERT:{a}")
PY
)

if [[ "$PARSED" == "__PARSE_ERROR__" || -z "$PARSED" ]]; then
    fail "response is not valid JSON (first 200 chars): $(printf '%s' "$BODY" | head -c 200)"
fi

print_header
AUDITED=$(     printf '%s\n' "$PARSED" | awk -F: '/^AUDITED:/    {print $2}')
CHARGED=$(     printf '%s\n' "$PARSED" | awk -F: '/^CHARGED:/    {print $2}')
DISTRIBUTED=$( printf '%s\n' "$PARSED" | awk -F: '/^DISTRIBUTED:/{print $2}')
JACKPOT=$(     printf '%s\n' "$PARSED" | awk -F: '/^JACKPOT:/    {print $2}')
DISCREPANCY=$( printf '%s\n' "$PARSED" | awk -F: '/^DISCREPANCY:/{print $2}')
MISMATCHED=$(  printf '%s\n' "$PARSED" | awk -F: '/^MISMATCHED:/ {print $2}')

printf "hands_audited         : %s\n" "$AUDITED"
printf "total_rake_charged    : %s\n" "$CHARGED"
printf "total_rake_distributed: %s\n" "$DISTRIBUTED"
printf "total_jackpot         : %s\n" "$JACKPOT"
printf "discrepancy           : %s\n" "$DISCREPANCY"
printf "mismatched_hand_count : %s\n" "$MISMATCHED"
echo "----------------------------------------"

mapfile -t ALERTS < <(printf '%s\n' "$PARSED" | awk -F: '/^ALERT:/{sub(/^ALERT:/, ""); print}')
if (( ${#ALERTS[@]} > 0 )); then
    for a in "${ALERTS[@]}"; do
        echo "[ALERT] $a"
    done
    echo "========================================"
    exit 1
fi

echo "[OK] rake fully reconciles across ${AUDITED} audited hand(s)"
echo "========================================"
exit 0
