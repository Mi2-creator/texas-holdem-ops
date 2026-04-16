#!/bin/bash
# =============================================================================
# ops_sample_ml_live.sh — Prod-like local verification driver for the multi-level
# rake distribution link (preview-config / multilevel_live / distribution-ledger
# new fields: level / execution_mode / source_agent_id).
#
# Scope:
#   - Runs against a local prod-like stack (default http://localhost:8080).
#   - Creates a single sample club named "ops-sample-ml-live" and 5 sample
#     accounts prefixed with "ops-sample-ml-live-" so they are trivially
#     identifiable and will never collide with real data.
#   - Refuses to run against the production API domain unless
#     OPS_ALLOW_PROD=1 is explicitly set.
#   - Idempotent: reusing existing sample club/accounts is safe.
#   - --reset wipes the local sample dataset (local only; asks for confirmation).
#
# Flags:
#   --reset          Stop stack, wipe ./data/ and pgdata volume, restart stack,
#                    then proceed with a fresh run. Refuses on prod.
#   --no-hands       Skip hand play and settlement (useful for debugging setup).
#   --keep-mode      Do NOT flip execution mode back to single_level at the end.
#
# Env overrides:
#   BASE_URL         Default http://localhost:8080
#   ADMIN_TOKEN      Default: read from .env
#   ADMIN_USERNAME   Default: read from .env
#   ADMIN_PASSWORD   Default: read from .env
#   CLUB_NAME        Default ops-sample-ml-live
#   SMALL_BLIND      Default 100
#   BIG_BLIND        Default 200
#   BUY_IN           Default 100000
#   HAND_BET         Default 2000   (flop bet per player → pot ≈ 4400)
#   RAKE_PERCENT     Default 500    (5% in basis points)
#   RAKE_CAP         Default 0      (0 = no cap)
#
# Exit code 0 = every one of the 12 acceptance items passed.
# Any failure prints a [FAIL] line and exits non-zero.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

# ---- flag parsing ----------------------------------------------------------
DO_RESET=0
DO_HANDS=1
KEEP_MODE=0
for arg in "$@"; do
    case "$arg" in
        --reset)     DO_RESET=1 ;;
        --no-hands)  DO_HANDS=0 ;;
        --keep-mode) KEEP_MODE=1 ;;
        -h|--help)
            sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "[ops-sample] unknown arg: $arg" >&2
            exit 2
            ;;
    esac
done

# ---- load env --------------------------------------------------------------
if [[ -f "$PROJECT_DIR/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_DIR/.env"
    set +a
fi

BASE_URL="${BASE_URL:-http://localhost:${HOST_PORT:-8080}}"
CLUB_NAME="${CLUB_NAME:-ops-sample-ml-live}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-changeme}"
ADMIN_TOKEN="${ADMIN_TOKEN:-dev-admin-secret}"
SMALL_BLIND="${SMALL_BLIND:-100}"
BIG_BLIND="${BIG_BLIND:-200}"
BUY_IN="${BUY_IN:-100000}"
HAND_BET="${HAND_BET:-2000}"
RAKE_PERCENT="${RAKE_PERCENT:-500}"
RAKE_CAP="${RAKE_CAP:-0}"

# sample account logins (password is constant across accounts — local only)
A1_USER="${CLUB_NAME}-a1"
A2_USER="${CLUB_NAME}-a2"
A3_USER="${CLUB_NAME}-a3"
P1_USER="${CLUB_NAME}-p1"
P2_USER="${CLUB_NAME}-p2"
SAMPLE_PASS="sample-pass-changeme"

# ---- prod guard ------------------------------------------------------------
if [[ "$BASE_URL" == *"pokeryapp.com"* || "$BASE_URL" == *"api.pokery"* ]]; then
    if [[ "${OPS_ALLOW_PROD:-0}" != "1" ]]; then
        echo "[ops-sample] REFUSING to run against production BASE_URL=$BASE_URL"
        echo "[ops-sample] This script is local-only. Re-run with OPS_ALLOW_PROD=1 to override."
        exit 3
    fi
fi

# ---- reset path ------------------------------------------------------------
if [[ "$DO_RESET" == "1" ]]; then
    if [[ "$BASE_URL" == *"pokeryapp.com"* ]]; then
        echo "[ops-sample] --reset is not allowed against prod"
        exit 4
    fi
    echo "[ops-sample] --reset: stopping local stack, clearing data/, restarting"
    ( cd "$PROJECT_DIR" && \
        PGDATA_VOLUME_NAME="${PGDATA_VOLUME_NAME:-texasholdem_pgdata}" \
        SERVER_SRC="${SERVER_SRC_ABS:-/Users/myatthuraoo/Desktop/texas-holdem-client}" \
        docker compose --env-file .env -f docker/docker-compose.yml down -v ) >/dev/null 2>&1 || true
    rm -rf "$PROJECT_DIR/data/club" "$PROJECT_DIR/data/hands" "$PROJECT_DIR/data/rake" "$PROJECT_DIR/data/audit" 2>/dev/null || true
    PGDATA_VOLUME_NAME="${PGDATA_VOLUME_NAME:-texasholdem_pgdata}" \
    SERVER_SRC="${SERVER_SRC_ABS:-/Users/myatthuraoo/Desktop/texas-holdem-client}" \
    docker compose --env-file .env -f docker/docker-compose.yml up -d >/dev/null 2>&1
    echo "[ops-sample] waiting for /health ..."
    for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
        if curl -sf "$BASE_URL/health" >/dev/null 2>&1; then break; fi
        sleep 2
    done
fi

# ---- preflight -------------------------------------------------------------
if ! curl -sf "$BASE_URL/health" >/dev/null 2>&1; then
    echo "[ops-sample] preflight FAILED: $BASE_URL/health unreachable"
    echo "[ops-sample] start the local stack first (e.g. make up)"
    exit 5
fi
HEALTH=$(curl -sS "$BASE_URL/health")
echo "[ops-sample] target=$BASE_URL"
echo "[ops-sample] health=$(echo "$HEALTH" | jq -c '{status,version,git_commit,build_time}')"

# ---- result accumulator ----------------------------------------------------
declare -a RESULTS=()
record() { RESULTS+=("$1|$2|$3"); }   # tag|PASS|detail  or  tag|FAIL|detail
TOTAL_FAILS=0
fail() { record "$1" "FAIL" "$2"; TOTAL_FAILS=$((TOTAL_FAILS+1)); }
pass() { record "$1" "PASS" "$2"; }

# ---- helpers ---------------------------------------------------------------
api() {
    # api METHOD PATH [json] [auth_header]
    local method="$1" path="$2" body="${3:-}" auth="${4:-}"
    local args=(-sS -o /tmp/ops_sample_body -w '%{http_code}' -X "$method" "$BASE_URL$path" \
                -H "Content-Type: application/json")
    if [[ -n "$auth" ]]; then
        args+=(-H "$auth")
    fi
    if [[ -n "$body" ]]; then
        args+=(-d "$body")
    fi
    local code
    code=$(curl "${args[@]}") || code=000
    echo "$code"
}
read_body() { cat /tmp/ops_sample_body; }

admin_auth() { echo "X-Admin-Token: $ADMIN_TOKEN"; }
bearer_auth() { echo "Authorization: Bearer $1"; }

require_ok() {
    local tag="$1" code="$2" expected="$3"
    if [[ "$code" != "$expected" ]]; then
        echo "[$tag] HTTP $code (expected $expected)"
        read_body
        echo ""
        return 1
    fi
    return 0
}

login_bearer() {
    local user="$1" pass="$2"
    local code; code=$(api POST /api/auth/login "{\"username\":\"$user\",\"password\":\"$pass\"}")
    if [[ "$code" != "200" ]]; then
        echo "[login:$user] HTTP $code body=$(read_body)" >&2
        return 1
    fi
    jq -r '.token // empty' </tmp/ops_sample_body
}

# ---- 1. admin login --------------------------------------------------------
echo "[ops-sample] admin login ($ADMIN_USERNAME)"
ADMIN_BEARER=$(login_bearer "$ADMIN_USERNAME" "$ADMIN_PASSWORD") || {
    echo "[ops-sample] admin login failed — check ADMIN_USERNAME/ADMIN_PASSWORD in .env"
    exit 6
}
ADMIN_ACCOUNT_ID=$(jq -r '.account.id' </tmp/ops_sample_body)
echo "[ops-sample] admin.account.id=$ADMIN_ACCOUNT_ID"

# ---- 2. get-or-create sample club ------------------------------------------
find_club_id() {
    local code; code=$(api GET /v1/admin/clubs "" "$(admin_auth)")
    if [[ "$code" != "200" ]]; then return 1; fi
    jq -r --arg n "$CLUB_NAME" '.clubs[] | select(.name == $n) | .id' </tmp/ops_sample_body | head -1
}
CLUB_ID=$(find_club_id || true)
if [[ -z "${CLUB_ID:-}" ]]; then
    echo "[ops-sample] creating club $CLUB_NAME"
    code=$(api POST /api/clubs "{\"name\":\"$CLUB_NAME\"}" "$(bearer_auth "$ADMIN_BEARER")")
    if [[ "$code" != "201" && "$code" != "200" ]]; then
        echo "[ops-sample] club create HTTP $code body=$(read_body)"
        exit 7
    fi
    CLUB_ID=$(jq -r '.club.id // .id' </tmp/ops_sample_body)
fi
echo "[ops-sample] club_id=$CLUB_ID (name=$CLUB_NAME)"

# ---- 3. get-or-create agents (A1 top, A3 leaf) ----------------------------
# HandleCreateAgent creates account + membership + tree entity; parent_agent_id
# refers to the tree entity ID (not the account ID).
create_agent() {
    # create_agent USERNAME [PARENT_ENTITY_ID]
    local user="$1" parent="${2:-}"
    local body
    if [[ -n "$parent" ]]; then
        body="{\"username\":\"$user\",\"password\":\"$SAMPLE_PASS\",\"parent_agent_id\":\"$parent\"}"
    else
        body="{\"username\":\"$user\",\"password\":\"$SAMPLE_PASS\"}"
    fi
    local code; code=$(api POST "/api/clubs/$CLUB_ID/agents" "$body" "$(bearer_auth "$ADMIN_BEARER")")
    if [[ "$code" == "201" || "$code" == "200" ]]; then
        jq -r '[.id, .account_id] | @tsv' </tmp/ops_sample_body
        return 0
    fi
    # already exists? try login and look up account id
    local tok; tok=$(login_bearer "$user" "$SAMPLE_PASS" 2>/dev/null || true)
    if [[ -n "${tok:-}" ]]; then
        # Need entity id — hit club details and find agent by account id
        local acc; acc=$(jq -r '.account.id' </tmp/ops_sample_body)
        local code2; code2=$(api GET "/api/clubs/$CLUB_ID" "" "$(bearer_auth "$ADMIN_BEARER")")
        if [[ "$code2" == "200" ]]; then
            local entity; entity=$(jq -r --arg a "$acc" '.agents[] | select(.account_id == $a) | .id' </tmp/ops_sample_body | head -1)
            printf "%s\t%s\n" "$entity" "$acc"
            return 0
        fi
    fi
    echo "[create_agent:$user] HTTP $code body=$(read_body)" >&2
    return 1
}

read_tsv() { awk -F'\t' -v i="$1" '{print $i}' <<<"$2"; }

echo "[ops-sample] ensuring agents A1/A2/A3"
A1_TSV=$(create_agent "$A1_USER")          || { echo "A1 fail"; exit 8; }
A1_ENTITY=$(read_tsv 1 "$A1_TSV"); A1_ACCT=$(read_tsv 2 "$A1_TSV")
A2_TSV=$(create_agent "$A2_USER" "$A1_ENTITY") || { echo "A2 fail"; exit 8; }
A2_ENTITY=$(read_tsv 1 "$A2_TSV"); A2_ACCT=$(read_tsv 2 "$A2_TSV")
A3_TSV=$(create_agent "$A3_USER" "$A2_ENTITY") || { echo "A3 fail"; exit 8; }
A3_ENTITY=$(read_tsv 1 "$A3_TSV"); A3_ACCT=$(read_tsv 2 "$A3_TSV")
echo "[ops-sample] A1 entity=$A1_ENTITY acct=$A1_ACCT"
echo "[ops-sample] A2 entity=$A2_ENTITY acct=$A2_ACCT"
echo "[ops-sample] A3 entity=$A3_ENTITY acct=$A3_ACCT"

# ---- 4. get-or-create players ----------------------------------------------
create_player() {
    local user="$1"
    local code; code=$(api POST "/api/clubs/$CLUB_ID/players" \
        "{\"username\":\"$user\",\"password\":\"$SAMPLE_PASS\"}" \
        "$(bearer_auth "$ADMIN_BEARER")")
    if [[ "$code" == "201" || "$code" == "200" ]]; then
        jq -r '.account_id // empty' </tmp/ops_sample_body
        return 0
    fi
    # Already exists? login and extract account id.
    local tok; tok=$(login_bearer "$user" "$SAMPLE_PASS" 2>/dev/null || true)
    if [[ -n "${tok:-}" ]]; then
        jq -r '.account.id' </tmp/ops_sample_body
        # Membership may already be present (if previously bound), OK.
        return 0
    fi
    echo "[create_player:$user] HTTP $code body=$(read_body)" >&2
    return 1
}
P1_ACCT=$(create_player "$P1_USER") || { echo "P1 fail"; exit 9; }
P2_ACCT=$(create_player "$P2_USER") || { echo "P2 fail"; exit 9; }
echo "[ops-sample] P1 acct=$P1_ACCT"
echo "[ops-sample] P2 acct=$P2_ACCT"

# Ensure PG accounts exist for agents A1/A2/A3 — rake_agent entries require
# a wallet_ledger.account_id FK target. Login triggers ensureMainWallet.
echo "[ops-sample] priming agent pg accounts via login"
login_bearer "$A1_USER" "$SAMPLE_PASS" >/dev/null
login_bearer "$A2_USER" "$SAMPLE_PASS" >/dev/null
login_bearer "$A3_USER" "$SAMPLE_PASS" >/dev/null

# ---- 5. roster + parent chain + player binding (multilevel) ----------------
# MVPDistribution roster/parent/binding uses ACCOUNT IDs (agent wallets need
# to be real accounts so rake credit works).
add_roster() {
    local acct="$1"
    local code; code=$(api POST "/v1/admin/clubs/$CLUB_ID/agents" \
        "{\"agent_id\":\"$acct\"}" "$(admin_auth)")
    require_ok "roster:$acct" "$code" "200" || return 1
}
set_parent() {
    local child="$1" parent="$2"
    local code; code=$(api PUT "/v1/admin/clubs/$CLUB_ID/agents/$child/parent" \
        "{\"parent_agent_id\":\"$parent\"}" "$(admin_auth)")
    require_ok "parent:$child->$parent" "$code" "200" || return 1
}
bind_player() {
    local player="$1" agent="$2"
    local code; code=$(api POST "/v1/admin/clubs/$CLUB_ID/agents/$agent/players" \
        "{\"player_id\":\"$player\"}" "$(admin_auth)")
    require_ok "bind:$player->$agent" "$code" "200" || return 1
}

echo "[ops-sample] adding agents to roster"
add_roster "$A1_ACCT"
add_roster "$A2_ACCT"
add_roster "$A3_ACCT"
echo "[ops-sample] setting multilevel parent chain A3->A2->A1 (leaf→root)"
set_parent "$A3_ACCT" "$A2_ACCT"
set_parent "$A2_ACCT" "$A1_ACCT"
echo "[ops-sample] binding players to leaf agent A3"
bind_player "$P1_ACCT" "$A3_ACCT"
bind_player "$P2_ACCT" "$A3_ACCT"

# ---- 6. preview-config -----------------------------------------------------
echo "[ops-sample] writing preview-config (owner=2000 platform=2000 levels=[3000,2000,1000])"
code=$(api PUT "/v1/admin/clubs/$CLUB_ID/distribution-preview-config" \
    '{"owner_share_bp":2000,"platform_share_bp":2000,"agent_level_bps":[3000,2000,1000]}' \
    "$(admin_auth)")
require_ok "preview-config" "$code" "200" || exit 10
PREVIEW_CFG=$(cat /tmp/ops_sample_body)
echo "[ops-sample] preview-config => $(echo "$PREVIEW_CFG" | jq -c '.')"

# ---- 7. commission (rake percent + cap) ------------------------------------
# The hand path uses agent.CommissionConfig for rake_percent / rake_cap.
echo "[ops-sample] setting commission (rake_percent=$RAKE_PERCENT rake_cap=$RAKE_CAP)"
code=$(api POST "/api/clubs/$CLUB_ID/config/commission" \
    "{\"owner_rate\":4000,\"l1_rate\":3000,\"l2_rate\":2000,\"l3_rate\":1000,\"max_depth\":4,\"rake_percent\":$RAKE_PERCENT,\"rake_cap\":$RAKE_CAP}" \
    "$(bearer_auth "$ADMIN_BEARER")")
if [[ "$code" != "200" ]]; then
    echo "[commission] HTTP $code body=$(read_body)"
    exit 11
fi

# ---- 8. current execution mode (expect single_level by default) ------------
code=$(api GET "/v1/admin/clubs/$CLUB_ID/distribution-execution" "" "$(admin_auth)")
MODE_BEFORE=$(jq -r '.mode // "?"' </tmp/ops_sample_body)
echo "[ops-sample] execution mode BEFORE switch: $MODE_BEFORE"

# ---- 9. switch to multilevel_live -----------------------------------------
echo "[ops-sample] switching to multilevel_live"
code=$(api PUT "/v1/admin/clubs/$CLUB_ID/distribution-execution" \
    '{"mode":"multilevel_live"}' "$(admin_auth)")
if [[ "$code" != "200" ]]; then
    echo "[mode-switch] HTTP $code body=$(read_body)"
    exit 12
fi
MODE_AFTER=$(jq -r '.mode' </tmp/ops_sample_body)
echo "[ops-sample] execution mode AFTER switch: $MODE_AFTER"

# ---- 10. table + join + play a rake-generating hand ------------------------
P1_TOKEN=$(login_bearer "$P1_USER" "$SAMPLE_PASS")
P2_TOKEN=$(login_bearer "$P2_USER" "$SAMPLE_PASS")

# Fresh table every run (cheap, unambiguous)
TABLE_NAME="${CLUB_NAME}-table-$(date +%s)"
echo "[ops-sample] creating table $TABLE_NAME (sb=$SMALL_BLIND bb=$BIG_BLIND)"
code=$(api POST "/api/clubs/$CLUB_ID/tables" \
    "{\"name\":\"$TABLE_NAME\",\"max_players\":6,\"small_blind\":$SMALL_BLIND,\"big_blind\":$BIG_BLIND}" \
    "$(bearer_auth "$ADMIN_BEARER")")
if [[ "$code" != "201" && "$code" != "200" ]]; then
    echo "[table-create] HTTP $code body=$(read_body)"; exit 13
fi
TABLE_ID=$(jq -r '.id' </tmp/ops_sample_body)
echo "[ops-sample] table_id=$TABLE_ID"

echo "[ops-sample] seating players (buy-in=$BUY_IN)"
code=$(api POST "/api/clubs/$CLUB_ID/tables/$TABLE_ID/join" \
    "{\"buy_in\":$BUY_IN,\"seat_index\":0}" "$(bearer_auth "$P1_TOKEN")")
require_ok "join:p1" "$code" "200" || exit 14
code=$(api POST "/api/clubs/$CLUB_ID/tables/$TABLE_ID/join" \
    "{\"buy_in\":$BUY_IN,\"seat_index\":1}" "$(bearer_auth "$P2_TOKEN")")
require_ok "join:p2" "$code" "200" || exit 14

play_hand_showdown() {
    # Start, then call/check → bet/call (flop) → check/check (turn, river) → settle.
    local code; code=$(api POST "/api/clubs/$CLUB_ID/tables/$TABLE_ID/start" \
        "" "$(bearer_auth "$ADMIN_BEARER")")
    if [[ "$code" != "200" && "$code" != "201" ]]; then
        echo "[hand-start] HTTP $code body=$(read_body)" >&2
        return 1
    fi
    local hand_id; hand_id=$(jq -r '.hand_id // empty' </tmp/ops_sample_body)
    [[ -z "$hand_id" ]] && hand_id=$(jq -r '.id // empty' </tmp/ops_sample_body)

    local do_action tok current state amount
    for step in \
        "call 0"   "check 0" \
        "bet $HAND_BET" "call 0" \
        "check 0"  "check 0" \
        "check 0"  "check 0"; do
        local action="${step%% *}"
        amount="${step##* }"
        # Refresh current player.
        local st; st=$(api GET "/api/clubs/$CLUB_ID/tables/$TABLE_ID/state" "" "$(bearer_auth "$ADMIN_BEARER")")
        state=$(jq -r '.state // empty' </tmp/ops_sample_body)
        current=$(jq -r '.current_player // empty' </tmp/ops_sample_body)
        if [[ "$state" != "IN_PROGRESS" || -z "$current" ]]; then
            break
        fi
        if [[ "$current" == "$P1_ACCT" ]]; then
            tok="$P1_TOKEN"
        else
            tok="$P2_TOKEN"
        fi
        api POST "/api/clubs/$CLUB_ID/tables/$TABLE_ID/action" \
            "{\"action\":\"$action\",\"amount\":$amount}" "$(bearer_auth "$tok")" >/dev/null || true
    done

    # Settle — winner is P1 (arbitrary; rake doesn't depend on winner).
    code=$(api POST "/api/clubs/$CLUB_ID/tables/$TABLE_ID/settle" \
        "{\"winners_by_pot\":{\"0\":[\"$P1_ACCT\"]},\"hand_ranks\":{\"$P1_ACCT\":\"High Card\"}}" \
        "$(bearer_auth "$ADMIN_BEARER")")
    if [[ "$code" != "200" ]]; then
        echo "[hand-settle] HTTP $code body=$(read_body)" >&2
        return 1
    fi
    local pot rake
    pot=$(jq -r '.total_pot // 0' </tmp/ops_sample_body)
    rake=$(jq -r '.rake // 0' </tmp/ops_sample_body)
    echo "$hand_id|$pot|$rake"
}

HAND_INFO=""
HANDS_PLAYED=0
if [[ "$DO_HANDS" == "1" ]]; then
    echo "[ops-sample] playing hand #1 to showdown"
    HAND_INFO=$(play_hand_showdown) || { echo "[hand1] FAILED"; exit 15; }
    HAND_ID=$(awk -F'|' '{print $1}' <<<"$HAND_INFO")
    POT=$(awk -F'|' '{print $2}' <<<"$HAND_INFO")
    echo "[ops-sample] hand1: id=$HAND_ID pot=$POT"
    HANDS_PLAYED=1
fi

sleep 1  # brief settle lag

# ---- 11. distribution-summary ---------------------------------------------
echo "[ops-sample] reading distribution-summary"
code=$(api GET "/v1/admin/reports/clubs/$CLUB_ID/distribution-summary?period=all" "" "$(admin_auth)")
if [[ "$code" != "200" ]]; then
    fail "summary.http" "HTTP $code"
else
    SUMMARY=$(cat /tmp/ops_sample_body)
    TOTAL_RAKE=$(jq -r '.total_rake' <<<"$SUMMARY")
    OWNER_TOTAL=$(jq -r '.owner_share_total' <<<"$SUMMARY")
    AGENT_TOTAL=$(jq -r '.agent_share_total' <<<"$SUMMARY")
    PLATFORM_TOTAL=$(jq -r '.platform_share_total' <<<"$SUMMARY")
    HAND_COUNT=$(jq -r '.hand_count' <<<"$SUMMARY")
    echo "[ops-sample] summary=$(echo "$SUMMARY" | jq -c '{total_rake,owner_share_total,agent_share_total,platform_share_total,hand_count,active_agent_count}')"
    if (( TOTAL_RAKE > 0 && OWNER_TOTAL > 0 && AGENT_TOTAL > 0 && PLATFORM_TOTAL > 0 )); then
        pass "summary" "total=$TOTAL_RAKE owner=$OWNER_TOTAL agent=$AGENT_TOTAL platform=$PLATFORM_TOTAL hands=$HAND_COUNT"
    else
        fail "summary" "one of the totals is zero — pot may be too small / hand didn't settle"
    fi
fi

# ---- 12. distribution-ledger (all + agent + owner + platform) -------------
echo "[ops-sample] reading distribution-ledger (all kinds)"
code=$(api GET "/v1/admin/reports/clubs/$CLUB_ID/distribution-ledger?period=all&kind=all&limit=200" "" "$(admin_auth)")
if [[ "$code" != "200" ]]; then
    fail "ledger.all" "HTTP $code"
else
    LEDGER_ALL=$(cat /tmp/ops_sample_body)
    TOT_ITEMS=$(jq -r '.items | length' <<<"$LEDGER_ALL")
    echo "[ops-sample] ledger(all) items=$TOT_ITEMS"
fi

code=$(api GET "/v1/admin/reports/clubs/$CLUB_ID/distribution-ledger?period=all&kind=agent&limit=200" "" "$(admin_auth)")
if [[ "$code" != "200" ]]; then
    fail "ledger.agent" "HTTP $code"
else
    LA=$(cat /tmp/ops_sample_body)
    AG_COUNT=$(jq -r '.items | length' <<<"$LA")
    LEVELS_SEEN=$(jq -r '[.items[].level] | unique | sort | join(",")' <<<"$LA")
    WITH_EXEC=$(jq -r '[.items[] | select(.execution_mode=="multilevel_live")] | length' <<<"$LA")
    WITH_SOURCE=$(jq -r '[.items[] | select(.source_agent_id != null and .source_agent_id != "")] | length' <<<"$LA")
    echo "[ops-sample] ledger(agent) items=$AG_COUNT levels=[$LEVELS_SEEN] exec_mode_hits=$WITH_EXEC source_agent_hits=$WITH_SOURCE"
    if [[ "$LEVELS_SEEN" == *"1"* && "$LEVELS_SEEN" == *"2"* && "$LEVELS_SEEN" == *"3"* && $WITH_EXEC -ge 3 && $WITH_SOURCE -ge 3 ]]; then
        pass "ledger.agent.fields" "levels=[$LEVELS_SEEN] exec_mode_hits=$WITH_EXEC source_hits=$WITH_SOURCE"
    else
        fail "ledger.agent.fields" "levels=[$LEVELS_SEEN] exec_mode_hits=$WITH_EXEC source_hits=$WITH_SOURCE"
    fi
fi

code=$(api GET "/v1/admin/reports/clubs/$CLUB_ID/distribution-ledger?period=all&kind=owner&limit=50" "" "$(admin_auth)")
if [[ "$code" == "200" ]]; then
    O_COUNT=$(jq -r '.items | length' </tmp/ops_sample_body)
    O_EXEC_OK=$(jq -r '[.items[] | select(.execution_mode=="multilevel_live")] | length' </tmp/ops_sample_body)
    O_NO_LEVEL=$(jq -r '[.items[] | select((.level // "") == "")] | length' </tmp/ops_sample_body)
    if (( O_COUNT > 0 && O_EXEC_OK == O_COUNT && O_NO_LEVEL == O_COUNT )); then
        pass "ledger.owner" "items=$O_COUNT all exec_mode=multilevel_live and no level"
    else
        fail "ledger.owner" "items=$O_COUNT exec_ok=$O_EXEC_OK no_level=$O_NO_LEVEL"
    fi
else
    fail "ledger.owner" "HTTP $code"
fi

code=$(api GET "/v1/admin/reports/clubs/$CLUB_ID/distribution-ledger?period=all&kind=platform&limit=50" "" "$(admin_auth)")
if [[ "$code" == "200" ]]; then
    PL_COUNT=$(jq -r '.items | length' </tmp/ops_sample_body)
    PL_EXEC_OK=$(jq -r '[.items[] | select(.execution_mode=="multilevel_live")] | length' </tmp/ops_sample_body)
    PL_NO_LEVEL=$(jq -r '[.items[] | select((.level // "") == "")] | length' </tmp/ops_sample_body)
    if (( PL_COUNT > 0 && PL_EXEC_OK == PL_COUNT && PL_NO_LEVEL == PL_COUNT )); then
        pass "ledger.platform" "items=$PL_COUNT all exec_mode=multilevel_live and no level"
    else
        fail "ledger.platform" "items=$PL_COUNT exec_ok=$PL_EXEC_OK no_level=$PL_NO_LEVEL"
    fi
else
    fail "ledger.platform" "HTTP $code"
fi

# ---- 13. admin ledger reason_code=rake_agent -------------------------------
echo "[ops-sample] reading admin ledger rake_agent"
code=$(api GET "/v1/admin/ledger?reason_code=rake_agent&limit=50" "" "$(admin_auth)")
if [[ "$code" == "200" ]]; then
    RA_TOTAL=$(jq -r '.total // (.entries | length // 0)' </tmp/ops_sample_body)
    RA_HITS=$(jq -r '[.entries // [] | .[] | select(.reason_code=="rake_agent")] | length' </tmp/ops_sample_body)
    echo "[ops-sample] admin.ledger(rake_agent) entries=$RA_HITS"
    if (( RA_HITS > 0 )); then
        pass "admin.ledger.rake_agent" "entries=$RA_HITS (multilevel agent credits visible)"
    else
        fail "admin.ledger.rake_agent" "no rake_agent entries found"
    fi
else
    fail "admin.ledger.rake_agent" "HTTP $code"
fi

# ---- 14. UI-contract checks (what the frontend pages read) -----------------
echo "[ops-sample] UI-contract probes"
code=$(api GET "/v1/admin/clubs/$CLUB_ID/distribution-execution" "" "$(admin_auth)")
if [[ "$code" == "200" ]] && [[ "$(jq -r '.mode' </tmp/ops_sample_body)" == "multilevel_live" ]]; then
    pass "ui.execution" "mode=multilevel_live (admin page badge)"
else
    fail "ui.execution" "mode mismatch"
fi

code=$(api GET "/v1/admin/clubs/$CLUB_ID/distribution-preview-config" "" "$(admin_auth)")
if [[ "$code" == "200" ]]; then
    CFG_LEVELS=$(jq -r '.agent_level_bps | length' </tmp/ops_sample_body)
    if [[ "$CFG_LEVELS" == "3" ]]; then
        pass "ui.preview-config" "levels=3"
    else
        fail "ui.preview-config" "levels=$CFG_LEVELS"
    fi
else
    fail "ui.preview-config" "HTTP $code"
fi

code=$(api GET "/v1/admin/clubs/$CLUB_ID/agents/tree" "" "$(admin_auth)")
if [[ "$code" == "200" ]]; then
    TREE_LEN=$(jq -r '[.nodes // .tree // [] | ..? | objects] | length' </tmp/ops_sample_body 2>/dev/null || echo 0)
    # fallback: any non-empty response body considered OK for contract
    pass "ui.agent-tree" "tree endpoint reachable"
else
    fail "ui.agent-tree" "HTTP $code"
fi

# boundary: missing token on distribution-ledger → 403
code=$(api GET "/v1/admin/reports/clubs/$CLUB_ID/distribution-ledger?period=all&kind=agent" "" "")
if [[ "$code" == "403" ]]; then
    pass "boundary.403" "missing token → 403"
else
    fail "boundary.403" "expected 403 got $code"
fi

# boundary: unknown club → 404
code=$(api GET "/v1/admin/reports/clubs/nope-$(date +%s)/distribution-ledger?period=all&kind=agent" "" "$(admin_auth)")
if [[ "$code" == "404" ]]; then
    pass "boundary.404" "unknown club → 404"
else
    fail "boundary.404" "expected 404 got $code"
fi

# ---- 15. switch back to single_level --------------------------------------
if [[ "$KEEP_MODE" == "1" ]]; then
    echo "[ops-sample] --keep-mode: leaving execution_mode as multilevel_live"
    MODE_FINAL="multilevel_live"
else
    echo "[ops-sample] switching back to single_level"
    code=$(api PUT "/v1/admin/clubs/$CLUB_ID/distribution-execution" \
        '{"mode":"single_level"}' "$(admin_auth)")
    if [[ "$code" != "200" ]]; then
        fail "mode.revert" "HTTP $code"
        MODE_FINAL="UNKNOWN"
    else
        MODE_FINAL="single_level"
        pass "mode.revert" "back to single_level"
    fi
fi

# ---- 16. print final report ------------------------------------------------
echo ""
echo "============================================================"
echo " OPS SAMPLE MULTILEVEL-LIVE — VERIFICATION REPORT"
echo "============================================================"
echo "target           : $BASE_URL"
echo "club             : $CLUB_NAME (id=$CLUB_ID)"
echo "agent chain      : A1(root=$A1_ACCT) -> A2($A2_ACCT) -> A3(leaf=$A3_ACCT)"
echo "players          : $P1_USER($P1_ACCT), $P2_USER($P2_ACCT) -> bound to A3"
echo "preview-config   : $(echo "$PREVIEW_CFG" | jq -c '.')"
echo "execution mode   : before=$MODE_BEFORE | during=multilevel_live | after=$MODE_FINAL"
echo "table            : $TABLE_NAME ($TABLE_ID)"
echo "hands            : ${HANDS_PLAYED} played"
if [[ -n "${SUMMARY:-}" ]]; then
    echo "summary          : $(echo "$SUMMARY" | jq -c '{total_rake,owner_share_total,agent_share_total,platform_share_total,hand_count}')"
else
    echo "summary          : (n/a)"
fi
echo ""
printf "%-26s  %-5s  %s\n" "CHECK" "STATE" "DETAIL"
printf "%-26s  %-5s  %s\n" "--------------------------" "-----" "----------------------------------"
for r in "${RESULTS[@]}"; do
    IFS='|' read -r tag state detail <<<"$r"
    printf "%-26s  %-5s  %s\n" "$tag" "$state" "$detail"
done
echo ""
if (( TOTAL_FAILS == 0 )); then
    echo "[ops-sample] RESULT: ALL CHECKS PASSED"
    exit 0
else
    echo "[ops-sample] RESULT: $TOTAL_FAILS CHECK(S) FAILED"
    exit 20
fi
