#!/bin/bash
# =============================================================================
# Fetch the current Cloudflare edge CIDR lists and rewrite
# config/cf_cidrs.txt iff anything changed. Exit codes:
#
#   0  — no diff; file is up to date.
#   1  — diff; file was rewritten. Caller (CI) opens a PR.
#   2+ — operational error (network, parse failure). Caller must NOT
#        interpret as "list is clean" — treat as "try again later".
#
# CF publishes two plain-text feeds, one IP per line. We do light
# validation (CIDR-ish regex) and sort for diff-stable output. The
# banner comments + format preamble are re-emitted so reviewers see
# only the actual list diff, not whitespace churn.
#
# Called by:
#   make cf-cidrs-refresh                         (manual)
#   .github/workflows/cf-cidrs-refresh.yml        (weekly)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="$(dirname "$SCRIPT_DIR")"
CONFIG_FILE="${OPS_DIR}/config/cf_cidrs.txt"

IPS_V4_URL="${CF_IPS_V4_URL:-https://www.cloudflare.com/ips-v4}"
IPS_V6_URL="${CF_IPS_V6_URL:-https://www.cloudflare.com/ips-v6}"

TMP_V4="$(mktemp)"
TMP_V6="$(mktemp)"
TMP_OUT="$(mktemp)"
trap 'rm -f "$TMP_V4" "$TMP_V6" "$TMP_OUT"' EXIT

echo "[cf-refresh] fetching $IPS_V4_URL"
if ! curl -fsS --max-time 15 --retry 2 "$IPS_V4_URL" > "$TMP_V4"; then
    echo "[cf-refresh] ERROR: failed to fetch IPv4 list" >&2
    exit 2
fi
echo "[cf-refresh] fetching $IPS_V6_URL"
if ! curl -fsS --max-time 15 --retry 2 "$IPS_V6_URL" > "$TMP_V6"; then
    echo "[cf-refresh] ERROR: failed to fetch IPv6 list" >&2
    exit 2
fi

# Validate + filter each line. Accept anything matching a tight
# CIDR regex. Upstream sometimes emits a trailing newline only —
# both files have ≥ 5 lines under normal operation; anything below
# that is almost certainly a mangled response.
validate() {
    awk '
        /^[0-9a-fA-F:.]+\/[0-9]+$/ { print; count++ }
        END { if (count < 5) exit 1 }
    ' "$1" | sort -u
}

V4="$(validate "$TMP_V4")" || { echo "[cf-refresh] ERROR: IPv4 feed looks mangled (< 5 lines)" >&2; exit 2; }
V6="$(validate "$TMP_V6")" || { echo "[cf-refresh] ERROR: IPv6 feed looks mangled (< 5 lines)" >&2; exit 2; }

# Emit the canonical file shape. Must round-trip identically through
# sync_cf_cidrs_to_server.sh so a no-op refresh leaves no cosmetic diff.
{
    cat <<'EOF'
# Cloudflare edge CIDR ranges — canonical source of truth.
#
# Used by the server's `extractIP()` gate (see
# client/server/go/api/cloudflare_cidr.go): a CF-Connecting-IP header
# is only trusted when the TCP peer falls in one of these ranges.
#
# Pipeline:
#   scripts/refresh_cf_cidrs.sh  (cron/CI)  — fetches from CF, rewrites this file.
#   scripts/sync_cf_cidrs_to_server.sh      — regenerates the Go source slice.
#   scripts/deploy_backend_safe.sh          — runs sync pre-rsync, so deploys always carry the current list.
#
# Format: one CIDR per line. Lines starting with '#' and blank lines ignored.
#         IPv4 and IPv6 ok; order doesn't matter but we keep IPv4 block first.
# Source: https://www.cloudflare.com/ips-v4  +  https://www.cloudflare.com/ips-v6

# IPv4
EOF
    printf '%s\n' "$V4"
    echo
    echo "# IPv6"
    printf '%s\n' "$V6"
} > "$TMP_OUT"

if [[ -f "$CONFIG_FILE" ]] && cmp -s "$CONFIG_FILE" "$TMP_OUT"; then
    echo "[cf-refresh] no change — CF list is up to date"
    exit 0
fi

mv "$TMP_OUT" "$CONFIG_FILE"
# The trap would try to rm the now-moved tempfile; clear it.
trap 'rm -f "$TMP_V4" "$TMP_V6"' EXIT
echo "[cf-refresh] rewrote $CONFIG_FILE — diff:"
if command -v diff >/dev/null 2>&1; then
    # Show short summary; full diff is visible in the PR review.
    diff <(grep -vE '^(#|$)' "$CONFIG_FILE" | sort) \
         <(echo "$V4"; echo "$V6" | sort) >/dev/null || true
fi
exit 1
