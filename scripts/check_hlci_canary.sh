#!/bin/bash
# =============================================================================
# Ops check: HLCI (Hand-Local Conservation Invariant) canary probe.
#
# Calls GET /v1/admin/hlci/metrics and evaluates three independent
# health signals:
#
#   ALERT (exit 1) when any of:
#     - violation_count > 0              ← a real money-conservation bug fired
#     - len(tables_in_recovery) > 0      ← strict-mode locked a table
#     - max age_ms in pending_hlci_windows > HLCI_CANARY_MAX_WINDOW_MS
#                                        ← settlement path stuck in flight
#
#   OK (exit 0) otherwise.
#
# Env resolution identical to scripts/check_ledger_audit.sh: .env is
# sourced first (base), then .env.prod overlays it.
#
# Required: API_DOMAIN, ADMIN_TOKEN
# Optional:
#   HLCI_CANARY_SCHEME          default "https"
#   HLCI_CANARY_MAX_WINDOW_MS   default 5000  (age threshold for pending)
#   HLCI_CANARY_MOCK_JSON       short-circuits network (debug / self-test)
#
# Intended wiring (ops decides concrete channel):
#   */5 * * * * cd /opt/texas-holdem-ops && ./scripts/check_hlci_canary.sh \
#     || /opt/texas-holdem-ops/scripts/alert.sh "HLCI canary failed"
# =============================================================================
set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ---- Load env (silently; do not echo token) --------------------------------
if [[ -f .env ]]; then
    set -a; source .env; set +a
fi
if [[ -f .env.prod ]]; then
    set -a; source .env.prod; set +a
fi

HLCI_CANARY_SCHEME="${HLCI_CANARY_SCHEME:-https}"
HLCI_CANARY_MAX_WINDOW_MS="${HLCI_CANARY_MAX_WINDOW_MS:-5000}"

# ---- Report header ---------------------------------------------------------
print_header() {
    echo "========================================"
    echo "[HLCI-CANARY] read-only HLCI health probe"
    echo "========================================"
    echo "host            : ${API_DOMAIN:-<unset>}"
    echo "max_window_ms   : ${HLCI_CANARY_MAX_WINDOW_MS}"
    echo "time            : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "----------------------------------------"
}

fail() {
    local msg="$1"
    print_header
    echo "[FAIL] ${msg}"
    echo "========================================"
    exit 1
}

# ---- Validate inputs -------------------------------------------------------
if [[ -z "${API_DOMAIN:-}" ]]; then
    fail "API_DOMAIN is not set (check .env.prod / .env)"
fi
if [[ -z "${ADMIN_TOKEN:-}" ]]; then
    fail "ADMIN_TOKEN is not set (check .env.prod / .env)"
fi

URL="${HLCI_CANARY_SCHEME}://${API_DOMAIN}/v1/admin/hlci/metrics"

# ---- Fetch ----------------------------------------------------------------
BODY=""
HTTP_CODE="000"
if [[ -n "${HLCI_CANARY_MOCK_JSON:-}" ]]; then
    BODY="${HLCI_CANARY_MOCK_JSON}"
    HTTP_CODE="200"
else
    TMP_BODY="$(mktemp -t hlci_canary.XXXXXX)"
    trap 'rm -f "$TMP_BODY"' EXIT
    if ! HTTP_CODE=$(curl -sS -o "$TMP_BODY" -w '%{http_code}' \
            --max-time 15 \
            -H "X-Admin-Token: ${ADMIN_TOKEN}" \
            -H "Accept: application/json" \
            "$URL" 2>/dev/null); then
        fail "curl failed (network / DNS / TLS) for ${HLCI_CANARY_SCHEME}://${API_DOMAIN}"
    fi
    BODY="$(cat "$TMP_BODY")"
fi

# ---- HTTP status ----------------------------------------------------------
case "$HTTP_CODE" in
    200) : ;;
    401|403) fail "auth rejected (HTTP ${HTTP_CODE}) — ADMIN_TOKEN invalid or missing" ;;
    404)     fail "endpoint not found (HTTP 404) — backend version may predate HLCI Step 4" ;;
    5*)      fail "backend error (HTTP ${HTTP_CODE})" ;;
    *)       fail "unexpected HTTP ${HTTP_CODE}" ;;
esac

# ---- Parse summary (python3 is already a dependency of other ops) ---------
if ! command -v python3 >/dev/null 2>&1; then
    fail "python3 is required to parse metrics response"
fi

PARSED=$(
    HLCI_BODY="$BODY" HLCI_MAX_MS="$HLCI_CANARY_MAX_WINDOW_MS" python3 - <<'PY' 2>/dev/null || true
import json, os, sys
raw = os.environ.get("HLCI_BODY", "")
max_ms = int(os.environ.get("HLCI_MAX_MS", "5000"))
try:
    data = json.loads(raw)
except Exception:
    print("__PARSE_ERROR__")
    sys.exit(0)

def as_int(v):
    try:
        return int(v)
    except Exception:
        return -1

strict = "true" if data.get("strict_mode") else "false"
ledger_count = as_int(data.get("ledger_count"))
violation_count = as_int(data.get("violation_count"))
by_type = data.get("violations_by_type") or {}
recovering = data.get("tables_in_recovery") or []
pending = data.get("pending_hlci_windows") or []

# Format violations_by_type as inline k=v pairs (alphabetized) for the report.
by_type_str = ",".join(f"{k}={v}" for k, v in sorted(by_type.items())) or "{}"

# Find the oldest pending window.
max_age = 0
max_age_desc = ""
for w in pending:
    age = as_int((w or {}).get("age_ms"))
    if age > max_age:
        max_age = age
        max_age_desc = f"{(w or {}).get('table_id','?')}:{(w or {}).get('hand_id','?')}:{(w or {}).get('path_tag','?')}"

# Build alert bucket.
alerts = []
if violation_count > 0:
    alerts.append(f"violation_count={violation_count} by_type={by_type_str}")
if recovering:
    alerts.append(f"tables_in_recovery={len(recovering)} ids={','.join(recovering[:5])}")
if max_age > max_ms:
    alerts.append(f"pending_hlci_window_stuck age_ms={max_age} > {max_ms} entry={max_age_desc}")

print(f"STRICT:{strict}")
print(f"LEDGER_COUNT:{ledger_count}")
print(f"VIOLATION_COUNT:{violation_count}")
print(f"BY_TYPE:{by_type_str}")
print(f"RECOVERING:{len(recovering)}")
print(f"PENDING:{len(pending)}")
print(f"MAX_AGE_MS:{max_age}")
print(f"MAX_AGE_ENTRY:{max_age_desc}")
for a in alerts:
    print(f"ALERT:{a}")
PY
)

if [[ "$PARSED" == "__PARSE_ERROR__" || -z "$PARSED" ]]; then
    fail "response is not valid JSON (first 200 chars): $(printf '%s' "$BODY" | head -c 200)"
fi

# ---- Report ---------------------------------------------------------------
print_header
STRICT=$(      printf '%s\n' "$PARSED" | awk -F: '/^STRICT:/         {print $2}')
LEDGER=$(      printf '%s\n' "$PARSED" | awk -F: '/^LEDGER_COUNT:/   {print $2}')
VIOLATIONS=$(  printf '%s\n' "$PARSED" | awk -F: '/^VIOLATION_COUNT:/{print $2}')
BY_TYPE=$(     printf '%s\n' "$PARSED" | awk -F: '/^BY_TYPE:/        {sub(/^BY_TYPE:/, ""); print}')
RECOVERING=$(  printf '%s\n' "$PARSED" | awk -F: '/^RECOVERING:/     {print $2}')
PENDING=$(     printf '%s\n' "$PARSED" | awk -F: '/^PENDING:/        {print $2}')
MAX_AGE=$(     printf '%s\n' "$PARSED" | awk -F: '/^MAX_AGE_MS:/     {print $2}')
MAX_AGE_ENTRY=$(printf '%s\n' "$PARSED" | awk -F: '/^MAX_AGE_ENTRY:/ {sub(/^MAX_AGE_ENTRY:/, ""); print}')

printf "strict_mode           : %s\n" "$STRICT"
printf "ledger_count          : %s\n" "$LEDGER"
printf "violation_count       : %s\n" "$VIOLATIONS"
printf "violations_by_type    : %s\n" "$BY_TYPE"
printf "tables_in_recovery    : %s\n" "$RECOVERING"
printf "pending_hlci_windows  : %s (oldest age_ms=%s %s)\n" "$PENDING" "$MAX_AGE" "$MAX_AGE_ENTRY"
echo "----------------------------------------"

# ---- Decide OK / ALERT ----------------------------------------------------
mapfile -t ALERTS < <(printf '%s\n' "$PARSED" | awk -F: '/^ALERT:/{sub(/^ALERT:/, ""); print}')

if (( ${#ALERTS[@]} > 0 )); then
    for a in "${ALERTS[@]}"; do
        echo "[ALERT] $a"
    done
    echo "========================================"
    exit 1
fi

echo "[OK] no HLCI violations, no recovery locks, no stuck settlements"
echo "========================================"
exit 0
