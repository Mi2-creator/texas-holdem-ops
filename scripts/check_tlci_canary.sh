#!/bin/bash
# =============================================================================
# Ops check: TableLock Consistency Invariant (TLCI) probe.
#
# Calls GET /v1/admin/hlci/tlci_check and fails non-zero when any
# account's locked-column drifts from the sum of its active table
# locks. Hourly cadence is fine — this is a post-hand cleanup
# invariant, not a hot-path check.
#
# Also audits JCI + CWCI as part of the same sweep (they're cheap and
# it's simpler to have one ops hook than three).
#
# Required: API_DOMAIN, ADMIN_TOKEN
# =============================================================================
set -u
set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [[ -f .env ]]; then set -a; source .env; set +a; fi
if [[ -f .env.prod ]]; then set -a; source .env.prod; set +a; fi

SCHEME="${TLCI_CANARY_SCHEME:-https}"

print_header() {
    echo "========================================"
    echo "[TLCI-CANARY] wallet-layer invariant sweep (TLCI + JCI + CWCI + ORPHAN)"
    echo "========================================"
    echo "host : ${API_DOMAIN:-<unset>}"
    echo "time : $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "----------------------------------------"
}

fail() {
    print_header
    echo "[FAIL] $1"
    echo "========================================"
    exit 1
}

if [[ -z "${API_DOMAIN:-}" ]]; then fail "API_DOMAIN not set"; fi
if [[ -z "${ADMIN_TOKEN:-}" ]]; then fail "ADMIN_TOKEN not set"; fi
if ! command -v python3 >/dev/null 2>&1; then fail "python3 required"; fi

probe() {
    local url="$1"
    curl -sS --max-time 30 \
        -H "X-Admin-Token: ${ADMIN_TOKEN}" \
        -H "Accept: application/json" \
        -w '\n__HTTP_CODE__%{http_code}' \
        "$url"
}

# Fetch all three endpoints into one JSON payload for python to
# aggregate.
JCI_RAW="$(probe "${SCHEME}://${API_DOMAIN}/v1/admin/hlci/jci_check")"
CWCI_RAW="$(probe "${SCHEME}://${API_DOMAIN}/v1/admin/hlci/cwci_check")"
TLCI_RAW="$(probe "${SCHEME}://${API_DOMAIN}/v1/admin/hlci/tlci_check")"
ORPHAN_RAW="$(probe "${SCHEME}://${API_DOMAIN}/v1/admin/hlci/orphan_hands")"

PARSED=$(
    JCI="$JCI_RAW" CWCI="$CWCI_RAW" TLCI="$TLCI_RAW" ORPHAN="$ORPHAN_RAW" python3 - <<'PY' 2>/dev/null || true
import json, os
def split(raw):
    # strip trailing "\n__HTTP_CODE__NNN"
    if "__HTTP_CODE__" in raw:
        body, code = raw.rsplit("__HTTP_CODE__", 1)
        body = body.rstrip("\n")
        return body, code.strip()
    return raw, "000"

alerts = []
results = {}
for name in ["JCI", "CWCI", "TLCI", "ORPHAN"]:
    body, code = split(os.environ.get(name, ""))
    if code != "200":
        alerts.append(f"{name} HTTP={code}")
        continue
    try:
        data = json.loads(body)
    except Exception:
        alerts.append(f"{name} non-JSON body")
        continue
    results[name] = data

jci = results.get("JCI", {})
cwci = results.get("CWCI", {})
tlci = results.get("TLCI", {})
orphan = results.get("ORPHAN", {})

# JCI thresholds
if jci:
    if int(jci.get("discrepancy", 0) or 0) != 0:
        alerts.append(f"JCI aggregate_discrepancy={jci['discrepancy']}")
    if int(jci.get("mismatched_count", 0) or 0) > 0:
        alerts.append(f"JCI mismatched_pools={jci['mismatched_count']}")

if cwci:
    if int(cwci.get("aggregate_discrepancy", 0) or 0) != 0:
        alerts.append(f"CWCI aggregate_discrepancy={cwci['aggregate_discrepancy']}")
    if int(cwci.get("mismatched_count", 0) or 0) > 0:
        alerts.append(f"CWCI mismatched_wallets={cwci['mismatched_count']}")

if tlci:
    if int(tlci.get("inconsistent_count", 0) or 0) > 0:
        alerts.append(f"TLCI inconsistent_accounts={tlci['inconsistent_count']}")

if orphan:
    if int(orphan.get("orphan_count", 0) or 0) > 0:
        # Include the first 3 orphan hand IDs so ops has a lead.
        sample = ",".join(o.get("hand_id", "?") for o in (orphan.get("orphans") or [])[:3])
        alerts.append(f"ORPHAN hands={orphan['orphan_count']} sample={sample}")

print(f"JCI_POOLS:{jci.get('pools_audited','?')}")
print(f"JCI_DISC:{jci.get('discrepancy','?')}")
print(f"CWCI_WALLETS:{cwci.get('wallets_audited','?')}")
print(f"CWCI_DISC:{cwci.get('aggregate_discrepancy','?')}")
print(f"TLCI_ACCTS:{tlci.get('accounts_scanned','?')}")
print(f"TLCI_INC:{tlci.get('inconsistent_count','?')}")
print(f"ORPHAN_STARTED:{orphan.get('started_count','?')}")
print(f"ORPHAN_COUNT:{orphan.get('orphan_count','?')}")
for a in alerts:
    print(f"ALERT:{a}")
PY
)

if [[ -z "$PARSED" ]]; then
    fail "all three endpoints failed to produce parseable output"
fi

print_header
printf "JCI  pools_audited=%s  discrepancy=%s\n" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^JCI_POOLS:/{print $2}')" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^JCI_DISC:/{print $2}')"
printf "CWCI wallets_audited=%s  discrepancy=%s\n" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^CWCI_WALLETS:/{print $2}')" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^CWCI_DISC:/{print $2}')"
printf "TLCI accts=%s  inconsistent=%s\n" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^TLCI_ACCTS:/{print $2}')" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^TLCI_INC:/{print $2}')"
printf "ORPHAN started=%s  orphans=%s\n" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^ORPHAN_STARTED:/{print $2}')" \
    "$(printf '%s\n' "$PARSED" | awk -F: '/^ORPHAN_COUNT:/{print $2}')"
echo "----------------------------------------"

mapfile -t ALERTS < <(printf '%s\n' "$PARSED" | awk -F: '/^ALERT:/{sub(/^ALERT:/, ""); print}')
if (( ${#ALERTS[@]} > 0 )); then
    for a in "${ALERTS[@]}"; do
        echo "[ALERT] $a"
    done
    echo "========================================"
    exit 1
fi

echo "[OK] wallet-layer invariants clean"
echo "========================================"
exit 0
