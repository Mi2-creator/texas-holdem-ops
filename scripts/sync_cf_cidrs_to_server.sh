#!/bin/bash
# =============================================================================
# Regenerate the server's cloudflareCIDRs slice from this ops repo's
# canonical config/cf_cidrs.txt. The Go source file carries matching
# CF_CIDR_LIST_BEGIN / CF_CIDR_LIST_END markers; everything between them
# is rewritten. Idempotent: exit 0 if no diff, exit 0 with note if
# rewritten.
#
# Called by:
#   make cf-cidrs-sync           (manual)
#   scripts/deploy_backend_safe  (pre-rsync, so prod always carries the current list)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPS_DIR="$(dirname "$SCRIPT_DIR")"
CLIENT_DIR="${CLIENT_DIR:-$(cd "$OPS_DIR/../texas-holdem-client" && pwd)}"

CONFIG_FILE="${OPS_DIR}/config/cf_cidrs.txt"
GO_FILE="${CLIENT_DIR}/server/go/api/cloudflare_cidr.go"

if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "[cf-sync] ERROR: $CONFIG_FILE not found" >&2
    exit 2
fi
if [[ ! -f "$GO_FILE" ]]; then
    echo "[cf-sync] ERROR: $GO_FILE not found" >&2
    exit 2
fi

# Build the replacement block. Preserve the existing banner comment
# "// IPv4" / "// IPv6" style so reviewing a diff stays readable.
TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

{
    echo "// CF_CIDR_LIST_BEGIN"
    echo "var cloudflareCIDRs = []string{"

    section=""
    while IFS= read -r raw; do
        # Skip blank + comment lines from config, but emit section banners.
        line="${raw%%#*}"
        line="${line## }"
        line="${line%% }"

        case "$raw" in
            *"IPv4"*"IPv6"*) ;; # ignore composite header comments (unlikely)
            \#*IPv4*)  echo "	// IPv4"; section="v4" ;;
            \#*IPv6*)  echo "	// IPv6"; section="v6" ;;
        esac

        if [[ -z "$line" ]]; then continue; fi

        # Basic shape sanity: must contain a slash and look like a CIDR-ish token.
        if [[ ! "$line" =~ ^[0-9a-fA-F:.]+/[0-9]+$ ]]; then
            echo "[cf-sync] ERROR: bad CIDR line in $CONFIG_FILE: $raw" >&2
            exit 3
        fi

        printf '\t"%s",\n' "$line"
    done < "$CONFIG_FILE"

    echo "}"
    # Blank line before the END marker matches what gofmt produces
    # (it wants a blank between the closing brace of a var block and
    # a floating comment). Without this, every sync would re-rewrite
    # the file because gofmt adds the blank and the next run's cmp -s
    # sees a spurious diff.
    echo ""
    echo "// CF_CIDR_LIST_END"
} > "$TMP"

# awk replaces the marked block in-place. Robust against the markers
# not being exactly on column 0 and preserves surrounding comments.
awk -v block="$TMP" '
    BEGIN { while ((getline line < block) > 0) repl = repl line "\n" }
    /^\/\/ CF_CIDR_LIST_BEGIN/ { in_block = 1; printf "%s", repl; next }
    /^\/\/ CF_CIDR_LIST_END/   { in_block = 0; next }
    !in_block { print }
' "$GO_FILE" > "${GO_FILE}.new"

if cmp -s "$GO_FILE" "${GO_FILE}.new"; then
    rm -f "${GO_FILE}.new"
    echo "[cf-sync] no change — Go source already matches config/cf_cidrs.txt"
    exit 0
fi

mv "${GO_FILE}.new" "$GO_FILE"
echo "[cf-sync] rewrote $GO_FILE from $CONFIG_FILE"

# Format (gofmt is bundled with the go toolchain; fall back to no-op if absent).
if command -v gofmt >/dev/null 2>&1; then
    gofmt -w "$GO_FILE"
fi

echo "[cf-sync] done"
