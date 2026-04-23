# HLCI / Wallet-Layer Invariant — Operations Runbook

Single-source reference for responding to money-conservation alerts
produced by the HLCI / RCI / JCI / CWCI / TLCI / Orphan-Hands canaries.

If you're reading this **because you got paged**, jump straight to
[§4 Incident response](#4-incident-response).

---

## 1. What the alerts mean

| Alert source | What it means | Severity |
|---|---|---|
| **HLCI canary** (every 5 min) | Some hand's money conservation broke, OR a table is locked for recovery, OR a settlement panic left a stuck window. Implies real chip leak. | P1 — page ops |
| **RCI canary** (hourly :07) | Club rake's ledger distribution doesn't sum to what was charged. Chips leaked from the club-side accounting. | P1 |
| **JCI canary** (hourly :17, bundle) | Jackpot pool balance drifted from its ledger-event history. | P1 |
| **CWCI canary** (hourly :17, bundle) | Agent / owner / platform commission wallet balance doesn't match its earn/withdraw ledger. | P1 |
| **TLCI canary** (hourly :17, bundle) | `accounts.locked` column doesn't match the sum of active `account_table_locks`. Pre-condition for buyin safety. | P2 — investigate today |
| **Orphan hands** (hourly :17, bundle) | A hand entered IN_PROGRESS but never reached COMPLETE. Chips committed to pot never reconciled. | P1 |

All canary log lines land in `/var/log/hlci_canary.log` on prod. The
file rotates weekly, 4 copies retained.

---

## 2. Cron schedule

```
/etc/cron.d/hlci-canary   */5 * * * *    HLCI (realtime)
/etc/cron.d/rci-canary     7 * * * *     RCI (rake distribution)
/etc/cron.d/tlci-canary   17 * * * *     TLCI + JCI + CWCI + Orphan bundle
```

All invoke `run_*_canary.sh` → calls `check_*_canary.sh` → on non-zero
exit, fans out to `scripts/alert.sh`.

---

## 3. Configure alert channels

`alert.sh` auto-detects env vars. Set ANY of the following in
`.env.prod` (next to `SERVER_HOST` etc.) to fan out:

```bash
# Slack incoming webhook — one line:
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...

# Telegram bot (both vars required):
TG_BOT_TOKEN=123456:AAAA...
TG_CHAT_ID=-1001234567890

# Generic webhook (POSTs {"msg","ts"} JSON):
ALERT_WEBHOOK_URL=https://your-endpoint.example.com/alerts
```

None set → log-only (always on; file path set via `HLCI_ALERT_LOG`,
default `/var/log/hlci_canary.log`).

Multiple channels can be active simultaneously. Each channel is
best-effort — curl failures don't abort the alert flow, the log line
is the authoritative record.

### Test the channel without waiting for cron

```bash
cd /opt/texas-holdem-ops
./scripts/alert.sh "TEST: alert channel plumbing check — delete this"
```

Slack / TG should receive `[HLCI] TEST: alert channel plumbing check ...`.

---

## 4. Incident response

### 4.1 HLCI violation fires

Log shape:
```
[CRITICAL] HLCI violation map[type:... handId:... tableId:... rake:... ...]
```
optionally followed by:
```
[CRITICAL] HLCI strict recovery executed — table locked ...
```

**Response:**

1. **Capture evidence before state changes.** jsonl is append-only but can rotate later:
   ```bash
   ssh prod 'docker cp texas-holdem-server:/data/hlci_ledgers.jsonl /tmp/hlci_ledgers.jsonl'
   scp prod:/tmp/hlci_ledgers.jsonl ./evidence/$(date +%F)/
   ```

2. **Fetch metrics snapshot:**
   ```bash
   DOMAIN=$(grep '^API_DOMAIN=' /opt/texas-holdem-ops/.env.prod | cut -d= -f2)
   TOKEN=$(grep '^ADMIN_TOKEN=' /opt/texas-holdem-ops/.env.prod | cut -d= -f2)
   curl -sS -H "X-Admin-Token: $TOKEN" "https://$DOMAIN/v1/admin/hlci/metrics" | tee /tmp/hlci_metrics.json
   ```

3. **Inspect the offending hand:**
   ```bash
   jq 'select(.HandID == "HAND-ID-FROM-LOG")' /tmp/hlci_ledgers.jsonl
   ```
   Check `Contributions`, `Distributions`, `ChipsStart`, `ChipsEnd`,
   `Rake` — find which view broke (see
   `server/go/hand/ledger.go` for contract details).

4. **If strict mode locked a table** (`tables_in_recovery` non-empty):
   - Root-cause first. **DO NOT unlock blindly.**
   - Investigate chip state in the affected table via
     `/v1/admin/hlci/account_audit?account_id=X` for every
     participant.
   - When root cause is fixed (commit merged, deployed, verified):
     ```bash
     curl -sS -X POST \
       -H "X-Admin-Token: $TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"note":"root-caused in PR #123"}' \
       "https://$DOMAIN/v1/admin/tables/$TABLE_ID/unlock_hlci"
     ```
   - Verify `tables_in_recovery` now empty via metrics endpoint.

5. **Offline replay for deeper diagnosis:**
   ```bash
   ./bin/hlci-replay --since 2026-04-23T00:00:00Z /tmp/hlci_ledgers.jsonl
   ```
   (Build with `cd server/go && go build -o ../../bin/hlci-replay ./cmd/hlci-replay/`.)

### 4.2 RCI discrepancy

Log shape: `ALERT: check_rci_canary exit=1 | ... rake discrepancy=N`

1. Endpoint dump:
   ```bash
   curl -sS -H "X-Admin-Token: $TOKEN" \
     "https://$DOMAIN/v1/admin/hlci/rci_check?since=$(date -u -d '-24 hours' +%Y-%m-%dT%H:%M:%SZ)"
   ```
2. `mismatched_hands` array lists hand-IDs where RAKE_CHARGED ≠
   Σ RAKE_DISTRIBUTED. Inspect each hand's club ledger events
   (`jq '.events[] | select(.HandID=="...")' club_data.json`).
3. Root cause is usually in `storage/club_store.go:RecordRake` (past
   bugs: integer-division loss, owner key collision). Don't hack-fix
   the ledger rows — fix the emitter.

### 4.3 CWCI drift

Log shape: `ALERT ... CWCI aggregate_discrepancy=N mismatched_wallets=M`

1. Endpoint dump:
   ```bash
   curl -sS -H "X-Admin-Token: $TOKEN" "https://$DOMAIN/v1/admin/hlci/cwci_check" | jq
   ```
2. Each `mismatched_wallets[]` row shows balance vs expected. Negative
   discrepancy = wallet richer than ledger (chips minted outside audit
   trail); positive = wallet short (missing credit).
3. Common root cause: new commission code path credits wallet but
   doesn't emit the expected ledger event type. CWCI currently
   recognises `COMMISSION_EARNED`, `COMMISSION_ACCRUAL`, and
   `RAKE_DISTRIBUTED_{OWNER,AGENT,PLATFORM}`. Anything else → gap.

### 4.4 TLCI drift

Log shape: `ALERT ... TLCI inconsistent_accounts=N`

1. Endpoint dump:
   ```bash
   curl -sS -H "X-Admin-Token: $TOKEN" "https://$DOMAIN/v1/admin/hlci/tlci_check" | jq
   ```
2. `inconsistent_accounts[]` lists each account where
   `accounts.locked != SUM(active account_table_locks.locked_amount)`.
3. **Auto-reconcile** (resets stale locks, idempotent):
   ```bash
   curl -sS -X POST -H "X-Admin-Token: $TOKEN" \
     "https://$DOMAIN/v1/admin/table-locks/reconcile"
   ```
   Re-check. If still drifting: a live code path is creating a lock
   without updating `accounts.locked`, or vice-versa. Hunt the
   asymmetry in `pgstore/pg_repo.go`.

### 4.5 Orphan hands

Log shape: `ALERT ... ORPHAN hands=N sample=handA,handB,handC`

Means: one or more hands made it to IN_PROGRESS (chips committed via
blinds) but never to COMPLETE. Usually caused by server crash
mid-play + restart.

1. Endpoint dump:
   ```bash
   curl -sS -H "X-Admin-Token: $TOKEN" "https://$DOMAIN/v1/admin/hlci/orphan_hands" | jq
   ```
2. For each orphan, manually inspect the affected account's wallet
   (chips still committed to a ghost pot) and reconcile. If many
   orphans from the same restart event, consider a one-off script.

---

## 5. Strict mode rollout (promote from observe)

**Pre-flight:**
- Canary has logged `[OK]` for every run over the past week
- `violation_count == 0` on `/v1/admin/hlci/metrics`
- No `[CRITICAL]` log entries besides expected ops events

**Flip:**
```bash
ssh prod "grep -q '^HLCI_STRICT_MODE=' /opt/texas-holdem-ops/.env.prod \
  && sed -i 's/^HLCI_STRICT_MODE=.*/HLCI_STRICT_MODE=true/' /opt/texas-holdem-ops/.env.prod \
  || echo 'HLCI_STRICT_MODE=true' >> /opt/texas-holdem-ops/.env.prod"
```

**Redeploy to pick up env change** (deploy script does NOT push
.env — the app reads on restart, so a `docker compose up -d app` is
required):
```bash
cd /opt/texas-holdem-ops
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d app
```

Verify:
```bash
curl -sS -H "X-Admin-Token: $TOKEN" "https://$DOMAIN/v1/admin/hlci/metrics" | jq '.strict_mode'
# → true
```

From now on, any HLCI violation triggers the Table Recovery SOP:
chips roll back to `ChipsStart`, table flagged `InHLCIRecovery`, no
new hand accepted on that table until `unlock_hlci`.

---

## 6. Downgrade / disable

### Flip back to observe:
```bash
ssh prod "sed -i 's/^HLCI_STRICT_MODE=.*/HLCI_STRICT_MODE=false/' /opt/texas-holdem-ops/.env.prod"
cd /opt/texas-holdem-ops && docker compose ... up -d app
```

### Stop a specific canary (emergency noise mute):
```bash
ssh prod 'mv /etc/cron.d/hlci-canary /etc/cron.d/hlci-canary.off'
```
Re-enable with `mv ... .off hlci-canary`.

### Rollback app:
```bash
# List recent images
ssh prod 'docker images texas-holdem-server --format "{{.Tag}}\t{{.CreatedAt}}" | head -5'

# Pin to previous
ssh prod 'cd /opt/texas-holdem-ops && VERSION=manual-20260423-PREV docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml up -d app'
```

---

## 7. Endpoints reference

All require `X-Admin-Token` header.

| Endpoint | Use |
|---|---|
| `GET /v1/admin/hlci/metrics` | Overall health snapshot |
| `GET /v1/admin/hlci/rci_check[?since=&until=&club_id=]` | Rake distribution audit |
| `GET /v1/admin/hlci/jci_check[?club_id=]` | Jackpot pool balance audit |
| `GET /v1/admin/hlci/cwci_check[?club_id=]` | Commission wallet audit |
| `GET /v1/admin/hlci/tlci_check` | Table-lock consistency |
| `GET /v1/admin/hlci/orphan_hands` | Unclosed hand detection |
| `GET /v1/admin/hlci/account_delta?account_id=X` | Per-account chip flow |
| `GET /v1/admin/hlci/account_audit?account_id=X[&since=&until=]` | Hand-view + wallet-view diff |
| `GET /v1/admin/hlci/chips_continuity?account_id=X&table_id=Y` | Cross-hand chip continuity (per table) |
| `GET /v1/admin/hlci/global_player_chips?account_id=X` | Chips summed across all tables |
| `POST /v1/admin/tables/:id/unlock_hlci` | Clear recovery lock (body: `{"note":"..."}`) |
| `POST /v1/admin/table-locks/reconcile` | Reset stale table locks |

---

## 8. Files / paths cheat sheet

| Path | What |
|---|---|
| `/opt/texas-holdem-ops/.env.prod` | Server env (ADMIN_TOKEN, HLCI_STRICT_MODE, alert channels) |
| `/opt/texas-holdem-ops/scripts/` | Canary scripts + alert.sh |
| `/etc/cron.d/hlci-canary` `rci-canary` `tlci-canary` | Cron entries |
| `/var/log/hlci_canary.log` | All canary output + alerts (rotated weekly × 4) |
| `/etc/logrotate.d/hlci-canary` | Rotation config |
| *(container)* `/data/hlci_ledgers.jsonl` | Per-hand HLCI ledger, append+fsync |
| *(container)* `/data/hlci_hand_started.jsonl` | Hand-start tracking, for orphan detection |
| *(container)* `/data/club/club_data.json` | Wallets + club ledger events |
| `backups/prod/pg-prod-*.sql.gz` | Postgres backups (taken by deploy script) |

## 9. Contact / escalation

- Code owner: backend team (see `server/go/CODEOWNERS` if present)
- Incident channel: whatever is wired in `SLACK_WEBHOOK_URL` / `TG_CHAT_ID`
- For strict-mode rollback decisions: product + backend lead
- For RCI / CWCI drift: backend + finance (they need the drift amount for books)

---

## 10. Alert channel commissioning & observation

### 10.1 Commissioning status

| Channel | Status | Verified on | Evidence |
|---|---|---|---|
| Telegram (`TG_BOT_TOKEN` + `TG_CHAT_ID`) | **ACTIVE** | 2026-04-23 | 4 live messages confirmed end-to-end: (1) direct Bot API sendMessage, (2) `scripts/alert.sh` pipeline test, (3) simulated canary-violation alert x2 |
| Slack (`SLACK_WEBHOOK_URL`) | not configured | — | optional, leave unset unless a team channel is requested |
| Generic webhook (`ALERT_WEBHOOK_URL`) | not configured | — | optional |

TG secrets live only on prod at `/opt/texas-holdem-ops/.env.prod` —
NEVER commit them to this repo. `.env.prod.example` keeps the
commented template.

Do NOT re-run commissioning on every deploy. Re-verify only if:
bot token was rotated, chat id changed, `scripts/alert.sh` was edited,
or a real canary fires and no TG message arrives.

### 10.2 What should be true in steady state

From cron → canary → alert → Telegram, the final trigger paths are:

| Cron | Frequency | Script chain | TG fires when |
|---|---|---|---|
| `*/5 * * * *` hlci-canary | every 5 min | `run_hlci_canary.sh` → `check_hlci_canary.sh` → `alert.sh` | canary exits non-zero (HLCI violation OR strict-mode recovery lock) |
| `7 * * * *` rci-canary | hourly :07 | `run_rci_canary.sh` → `check_rci_canary.sh` → `alert.sh` | rake distribution discrepancy > 0 |
| `17 * * * *` tlci-canary | hourly :17 | `run_tlci_canary.sh` → (tlci + jci + cwci + orphan checks) → `alert.sh` | any of TLCI / JCI / CWCI / orphan-hands check fails |

In steady state `/var/log/hlci_canary.log` gets ~288 `[OK]` lines/day
from hlci-canary and ~48 `[OK]` lines/day from the hourly bundle. No
TG traffic is expected.

### 10.3 Observation windows

**First 24 hours (ends 2026-04-24 evening):**

- [ ] Zero unexpected TG alerts received (any that arrive — triage per §4)
- [ ] `tail -n 300 /var/log/hlci_canary.log` shows `[OK]` lines from all three crons, no `[CRITICAL]`
- [ ] No silent failures: `grep -c '^\[.*\] ALERT:' /var/log/hlci_canary.log` matches the count of TG messages received
- [ ] `curl -sS -H "X-Admin-Token: $TOKEN" https://$DOMAIN/v1/admin/hlci/metrics | jq '.violation_count'` = `0`

**First 7 days (ends 2026-04-30):**

- [ ] Full week of `[OK]` in the canary log — this is the §5 strict-mode rollout preflight gate
- [ ] TG inbox shows no canary alerts (test-ping messages from ops are fine, but nothing from the real `run_*_canary.sh` path)
- [ ] `violation_count == 0` remains true at day 7
- [ ] Logrotate worked once — `ls /var/log/hlci_canary.log*` shows a rotated copy

If all four week-boundary checks pass, §5 (promote HLCI to strict
mode) becomes eligible. Do **not** flip strict mode before that.
