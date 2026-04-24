# Texas Hold'em Server - Operations Runbook

## Product Architecture

This project is a **mobile App (iOS/Android) + remote backend API** architecture:

- **Mobile App** (`client/player-app`): Native mobile app, distributed via TestFlight / App Store / APK sideload. NOT deployed to server.
- **Backend API** (`server/go`): Go HTTP/WebSocket server, deployed to Vultr via Docker.
- **PostgreSQL**: Wallet, ledger, topup, audit. Runs on Vultr alongside the API.
- **Caddy**: Reverse proxy with auto-TLS. Exposes API on 80/443.
- **Admin**: Built into the Go backend (`/v1/admin/*` endpoints), protected by ADMIN_TOKEN. No separate frontend.

**This ops repo only deploys the backend stack (API + PostgreSQL + Caddy). The mobile app is built and distributed separately.**

---

## Quick Reference

### Local Development

| Action | Command |
|--------|---------|
| Start (local) | `make up` |
| Stop (local) | `make down` |
| Health | `make health` |
| Logs | `make logs` |
| Backup PG | `make backup-pg` |
| Restore PG | `make restore-pg` |
| psql | `make psql` |
| Smoke test | `make smoke` |
| Full drill | `make drill` |

### Production (Remote)

| Action | Command |
|--------|---------|
| Validate prod env | `make prod-env-check` |
| Preview prod config | `make prod-config` |
| Deploy | `make deploy-prod` |
| Check health | `make check-prod` |
| View logs | `make logs-prod` |
| Backup PG | `make backup-prod` |
| Restore PG | `make restore-prod` |
| Restart | `make restart-prod` |
| Rollback | `make rollback-prod` |

### Read-only Production Probes

| Scope | Command | Fails when |
|---|---|---|
| Full stack (one-shot) | `make check-prod-stack` | any sub-step below fails |
| Exposure boundary | `make check-exposure` | compose ports / domain split / UFW / probe mismatch |
| External PG readiness | `make check-db-external-ready` | env template / compose overlay / backup-restore scripts / docs misaligned |
| Backup freshness | `make check-backup-freshness` | no backup / empty / older than 24h / bad naming / restore script missing |
| Ledger audit only | `make check-ledger-audit` | `real_invariant_break_count > 0`, auth, or schema mismatch |
| Raw app health | `curl -sf https://$API_DOMAIN/health` | `status != "ok"` |

**When to run what:**
- **Before switching to external PG / after editing compose overlays or backup scripts** → `make check-db-external-ready` — confirms the env template has `DB_EXTERNAL`/`DB_DSN`, compose overlay parks postgres and resets `app.depends_on`, backup/restore scripts have both bundled and external paths, and docs are aligned. Also snapshots the live `/health` to show the current `db_driver` / `data_store`. Use `SKIP_PROBE=1` when network is unavailable.
- **After compose / infra / UFW / domain changes** → `make check-exposure` — verifies compose port lockdown, three-domain split, UFW whitelist (22/80/443/2222 only), and live endpoint reachability. Fails with the first mismatch. Use `SKIP_UFW=1` when SSH is unavailable; use `SKIP_PROBE=1` when network is unavailable.
- **Daily / after `make backup-pg`** → `make check-backup-freshness` — checks that `./backups/` has at least one `pg-*.sql.gz`, the latest is non-zero and younger than 24h (override with `BACKUP_MAX_AGE_HOURS`), filename matches `pg-<name>-YYYYMMDD_HHMMSS.sql.gz`, and `restore_postgres.sh` is present and executable. Fails = someone forgot to run the backup or the cron silently died.
- **Daily / before any deploy / after any deploy** → `make check-prod-stack` — covers app health, ledger invariants, play admin routes, and one admin-only read. Any red = investigate before proceeding.
- **After a ledger-shape change or suspicious wallet report** → `make check-ledger-audit` alone, possibly with `AUDIT_PERIOD=week`.
- **Just asking "is the server up?"** → hit `/health` directly. Look for `status`, `version`, `git_commit`, `build_time`, `storage_mode`, `db_driver`, `data_store`. If `status` is anything other than `ok`, go straight to `make logs-prod`.
- **Ready to cut over to external PG** → read `docs/DB_CUTOVER.md` end-to-end first, then `make print-db-cutover` to get the command cheatsheet. Run section F checklist before touching anything. Rollback steps are in section D.

### Cloudflare CIDR Refresh

The server's `extractIP()` gate only trusts `CF-Connecting-IP` when the
TCP peer is in a published Cloudflare range. Keeping that list current
is automated:

| Command | Purpose |
|---|---|
| `make cf-cidrs-refresh` | Pull CF feeds, rewrite `config/cf_cidrs.txt`. Exit 1 on drift. |
| `make cf-cidrs-sync` | Regenerate `client/server/go/api/cloudflare_cidr.go` from the config file. No-op when already in sync. |
| *(auto)* `deploy_backend_safe.sh` | Runs `cf-cidrs-sync` pre-rsync so every deploy ships the current list. |
| *(auto)* `.github/workflows/cf-cidrs-refresh.yml` | Weekly (Mon 06:00 UTC) — runs refresh, opens PR on drift. |

**Typical operator flow:**
1. GH Action opens a PR titled `cf-cidrs: refresh Cloudflare edge ranges (YYYY-MM-DD)`.
2. Review the diff (should be pure add/remove of CIDR lines).
3. Merge.
4. Next `make deploy-backend-safe` regenerates the Go source and ships it.

**Manual force refresh:** `make cf-cidrs-refresh` locally, commit if it rewrote, push, merge, redeploy.

**Failure modes:**
- GH Action fails (feed fetch error) → standard workflow-failure notification.
- Refresh says "no change" for months → CF simply hasn't published anything; that's expected (edits happen ~once a year).
- `cf-cidrs-sync` reports "rewrote" on a deploy that wasn't preceded by a refresh → someone edited the Go slice by hand; the generator reverts the hand edit next deploy. Edit `config/cf_cidrs.txt` instead.

### Ledger Audit (read-only)

Minimal daily probe against the live `R2` audit endpoint.

```bash
make check-ledger-audit
```

What it does:

1. Reads `API_DOMAIN` and `ADMIN_TOKEN` from `.env.prod` (falls back to `.env`). The token is never printed.
2. Calls `GET https://$API_DOMAIN/v1/admin/ledger/audit?period=today&limit=100` with `X-Admin-Token`.
3. Prints the four summary counters:
   - `consistent_count`
   - `audit_only_exempt_count`
   - `legacy_schema_row_count`
   - `real_invariant_break_count`
4. Exits `0` when `real_invariant_break_count == 0`; exits `1` (and prints `[ALERT]`) when it is positive, or when auth / network / schema errors occur.

Overrides (optional): `AUDIT_PERIOD`, `AUDIT_LIMIT`, `AUDIT_SCHEME`.

No cron, no external alerting is wired up — run it manually, or hook the exit code into whatever scheduler you already trust.

---

## Server Architecture (Vultr)

```
Mobile App (iOS/Android)
   |
   | HTTPS / WSS
   v
[Cloudflare DNS/Proxy] --> [Vultr Server]
                                |
                           [Caddy :80/:443] --auto HTTPS--> [App :8080] --> [PostgreSQL :5432]
                                |                                   |
                                |                            [data/ volume]
                                |
                           [caddy_data, caddy_config]          [pgdata volume]
```

- **Mobile App**: Connects to `https://api.yourdomain.com` — NOT hosted on this server
- **Cloudflare**: DNS resolution + proxy (optional SSL termination, DDoS protection)
- **Caddy**: Reverse proxy, automatic Let's Encrypt TLS, ports 80/443
- **App**: Go API server, internal port 8080 (not exposed to public)
- **PostgreSQL**: Wallet/ledger/topup/audit, internal port 5432 (not exposed to public)
- **Admin**: Same Go server, `/v1/admin/*` endpoints, protected by ADMIN_TOKEN header
- **data/**: File-based hand exports, rake, club JSON state
- **backups/**: pg_dump archives

**Not on this server**: player-app source code, mobile build artifacts, app store assets

---

## Server Prerequisites

- Ubuntu 22.04 or 24.04, x86_64
- 1+ vCPU, 1+ GB RAM, 20+ GB disk
- Root or sudo access for initial setup
- Public IP with ports 80, 443 reachable
- Domain DNS pointing to the server IP

### DNS Configuration

Create an A record:

```
poker.example.com  A  <server-ip>
```

If using a subdomain for admin (optional, same domain works):

```
admin.poker.example.com  A  <server-ip>
```

Caddy handles TLS automatically once DNS resolves.

---

## First-Time Server Setup

### 1. Bootstrap the server

```bash
# From your local machine:
ssh root@your-server-ip 'bash -s' < scripts/prod/bootstrap_server.sh
```

This installs: Docker, Docker Compose, curl, rsync, ufw (firewall: 22/80/443).

Creates:
- Deploy user: `deploy`
- Deploy dir: `/opt/texas-holdem-ops`

### 2. Configure SSH access for deploy user

```bash
# Copy your SSH key to the deploy user
ssh-copy-id deploy@your-server-ip
```

### 3. Create production environment file

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` and set:

| Variable | What to set |
|----------|-------------|
| `SERVER_HOST` | Your server IP or hostname |
| `SERVER_USER` | `deploy` |
| `SERVER_DIR` | `/opt/texas-holdem-ops` |
| `SSH_PORT` | `22` (or your server's SSH port) |
| `DOMAIN` | `poker.example.com` |
| `DB_PASSWORD` | `openssl rand -base64 32` |
| `ADMIN_TOKEN` | `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | Strong password |

### 4. Validate configuration

```bash
make prod-env-check
```

### 5. Deploy

```bash
make deploy-prod
```

This will:
1. rsync ops files to the server (Makefile, docker/, scripts/, etc.)
2. rsync Go server source only (`server/go/`) — player-app is NOT deployed
3. Upload `.env.prod` as `.env` on server
4. Build Docker image on server
5. Start postgres + app + caddy
6. Wait and check health

### 6. Verify

```bash
make check-prod
```

Then test: `curl https://poker.example.com/health`

Mobile app should be configured to connect to `https://poker.example.com` as its API base URL.

---

## Update Deployment

```bash
# 1. Backup production database
make backup-prod

# 2. Pull latest source code
cd ../texas-holdem-client && git pull && cd ../texas-holdem-ops

# 3. Deploy (rsync + rebuild + restart)
make deploy-prod

# 4. Verify
make check-prod
```

For zero-downtime updates with soft-launch:

```bash
# On server via SSH:
cd /opt/texas-holdem-ops
docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml exec app curl -sf http://localhost:8080/health
# Check table_count=0 before proceeding
```

---

## Health Check

```bash
# Remote check (all services + HTTPS)
make check-prod

# Manual check
curl https://poker.example.com/health
```

Expected response:
```json
{
  "status": "ok",
  "mode": "NORMAL",
  "version": "...",
  "storage": "file"
}
```

---

## Backup

### Production PostgreSQL

```bash
# Backup and download to local backups/prod/
make backup-prod
```

Backup files: `backups/prod/pg-prod-texasholdem-YYYYMMDD_HHMMSS.sql.gz`

Remote backups also kept at `SERVER_DIR/backups/` (last 10 auto-rotated).

### Local PostgreSQL

```bash
make backup-pg
```

### Data directory

```bash
make backup
```

---

## Restore

### Production

```bash
# List available backups
./scripts/prod/restore_prod.sh

# Restore specific backup (interactive confirmation required)
./scripts/prod/restore_prod.sh backups/prod/pg-prod-texasholdem-20260326_120000.sql.gz
```

This will:
1. Take a pre-restore backup automatically
2. Upload dump to server
3. Stop app
4. Restore database
5. Restart app

### Local

```bash
make restore-pg
```

---

## Rollback

### App image rollback

```bash
# List available image tags on server
make rollback-prod

# Rollback to specific tag
./scripts/prod/rollback_prod.sh image v1.2.3
```

### Database rollback

```bash
./scripts/prod/rollback_prod.sh db backups/prod/pg-prod-texasholdem-20260326_120000.sql.gz
```

### Full rollback (image + database)

```bash
./scripts/prod/rollback_prod.sh full v1.2.3 backups/prod/pg-prod-texasholdem-20260326_120000.sql.gz
```

---

## Changing ADMIN_TOKEN

```bash
# 1. Edit .env.prod
vim .env.prod  # change ADMIN_TOKEN

# 2. Re-deploy (or SSH and update .env on server)
make deploy-prod

# 3. Or just restart app on server
make restart-prod app
```

---

## Viewing Logs

```bash
# All services
make logs-prod

# Specific service (app, postgres, caddy)
./scripts/prod/logs_prod.sh app 200

# Follow live (SSH into server)
ssh deploy@server "cd /opt/texas-holdem-ops && docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml logs -f app"
```

---

## Troubleshooting

### Caddy not getting TLS certificate

- Verify DNS: `dig poker.example.com` should return server IP
- Check Caddy logs: `./scripts/prod/logs_prod.sh caddy`
- Port 80 must be reachable for ACME challenge
- Check firewall: `ssh server "sudo ufw status"`

### App keeps restarting

```bash
./scripts/prod/logs_prod.sh app 50
```

Common causes:
- PostgreSQL not ready (check `depends_on: condition: service_healthy`)
- DB_DSN wrong (check .env on server)
- Port conflict

### PostgreSQL connection refused

```bash
# Check postgres health
ssh deploy@server "docker inspect --format='{{.State.Health.Status}}' texas-holdem-postgres"

# Check postgres logs
./scripts/prod/logs_prod.sh postgres
```

### Cannot reach server on HTTPS

1. Check DNS resolves: `nslookup poker.example.com`
2. Check ports open: `nc -zv server-ip 443`
3. Check Caddy running: `make check-prod`
4. Check firewall: `ssh server "sudo ufw status"`

### Disk space issues

```bash
ssh deploy@server "df -h && docker system df"
```

Clean up:
```bash
ssh deploy@server "docker system prune -f"
```

### Server rebooted — services not running

Docker restart policy is `unless-stopped`, so containers auto-start on boot. If not:

```bash
make restart-prod
```

---

## Operational Modes

| Mode | Command | Behavior |
|------|---------|----------|
| NORMAL | `make mode-normal` | Full operations |
| READ_ONLY | `make soft-launch` | Reconnects only |
| SHUTDOWN | `make shutdown` | Drain connections |

For production, SSH in and run:
```bash
cd /opt/texas-holdem-ops
COMPOSE="docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml"
$COMPOSE down && SOFT_LAUNCH=true $COMPOSE up -d
```

---

## Pre-Launch Checklist

### Server (Vultr)
- [ ] Server bootstrapped (`scripts/prod/bootstrap_server.sh`)
- [ ] DNS A record pointing to server IP (via Cloudflare)
- [ ] `.env.prod` configured with real passwords/tokens (no `CHANGE_ME`)
- [ ] `make prod-env-check` passes
- [ ] `make deploy-prod` completes successfully
- [ ] `make check-prod` shows all healthy
- [ ] `https://DOMAIN/health` returns 200
- [ ] TLS certificate valid (`make check-prod`)
- [ ] `make backup-prod` produces valid dump
- [ ] Admin API works: `curl -H "X-Admin-Token: ..." https://DOMAIN/v1/admin/accounts`
- [ ] Rate limiting active (`RATE_LIMIT_ENABLED=true`)
- [ ] DB_PASSWORD, ADMIN_TOKEN, ADMIN_PASSWORD are strong random values
- [ ] `.env.prod` NOT committed to git

### Mobile App (separate from this repo)
- [ ] App configured with production API base URL (`https://DOMAIN`)
- [ ] WebSocket connects to `wss://DOMAIN/...`
- [ ] TestFlight / APK distribution channel ready

---

## Security Checklist

- [ ] `.env` and `.env.prod` in `.gitignore`
- [ ] PostgreSQL not exposed to public (no `ports` in prod compose)
- [ ] App not exposed to public directly (Caddy proxies)
- [ ] Firewall only allows 22, 80, 443
- [ ] `DB_PASSWORD` is strong random
- [ ] `ADMIN_TOKEN` is strong random
- [ ] `ADMIN_PASSWORD` is strong random
- [ ] Server runs as non-root (deploy user + appuser in container)
- [ ] `no-new-privileges` security option on app container
- [ ] Resource limits configured
- [ ] Backups scheduled and stored off-site
