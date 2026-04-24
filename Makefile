# =============================================================================
# Texas Hold'em Server - Ops Makefile
# =============================================================================

.PHONY: help build up down restart status logs smoke e2e drill backup restore \
        clean build-local env-check soft-launch readonly shutdown mode-normal \
        ps health backup-pg restore-pg psql \
        prod-env-check prod-config deploy-prod check-prod backup-prod \
        restore-prod logs-prod restart-prod rollback-prod \
        deploy-backend-safe check-ledger-audit check-prod-stack check-exposure \
        check-db-external-ready check-backup-freshness print-db-cutover \
        cf-purge-play cf-cidrs-sync cf-cidrs-refresh

# Default target
help:
	@echo "Texas Hold'em Server - Ops Commands"
	@echo "===================================="
	@echo ""
	@echo "Lifecycle:"
	@echo "  make up           - Start all services (postgres + app)"
	@echo "  make down         - Stop all services"
	@echo "  make restart      - Restart all services"
	@echo "  make ps           - Show container status"
	@echo "  make status       - Show server status + health"
	@echo "  make health       - Health check all services"
	@echo "  make logs         - Follow server logs"
	@echo ""
	@echo "Build:"
	@echo "  make build        - Build Docker image"
	@echo "  make build-local  - Build Go binary locally"
	@echo ""
	@echo "Testing:"
	@echo "  make smoke        - Run smoke tests"
	@echo "  make e2e          - Run end-to-end tests"
	@echo "  make drill        - Full production drill"
	@echo ""
	@echo "Operations:"
	@echo "  make backup       - Backup data directory (tar.gz)"
	@echo "  make backup-pg    - Backup PostgreSQL (pg_dump)"
	@echo "  make restore      - Restore data from backup"
	@echo "  make restore-pg   - Restore PostgreSQL from dump"
	@echo "  make psql         - Open psql shell"
	@echo "  make soft-launch  - Enable soft-launch mode"
	@echo "  make readonly     - Enable read-only mode"
	@echo "  make shutdown     - Enable shutdown mode (drain)"
	@echo "  make mode-normal  - Return to normal mode"
	@echo ""
	@echo "Utilities:"
	@echo "  make env-check    - Validate .env file"
	@echo "  make clean        - Remove build artifacts"
	@echo ""
	@echo "Production (remote):"
	@echo "  make prod-env-check - Validate .env.prod"
	@echo "  make prod-config    - Show resolved prod compose config"
	@echo "  make deploy-prod        - Deploy to production server (full: ops+server+.env)"
	@echo "  make deploy-backend-safe - Deploy ONLY server/go + rebuild app with VERSION/GIT_COMMIT/BUILD_TIME injected (no .env overwrite)"
	@echo "  make check-prod     - Check production health"
	@echo "  make backup-prod    - Backup production PostgreSQL"
	@echo "  make restore-prod   - Restore production PostgreSQL"
	@echo "  make logs-prod      - View production logs"
	@echo "  make restart-prod   - Restart production services"
	@echo "  make rollback-prod  - Rollback production deployment"
	@echo ""
	@echo "Audit:"
	@echo "  make check-ledger-audit - Read-only ledger audit probe (exit 1 if real_invariant_break_count>0)"
	@echo "  make check-prod-stack   - Full read-only prod probe (/health + ledger audit + play admin routes + funding-overview)"
	@echo "  make check-exposure     - Exposure boundary audit (compose ports + domain split + UFW + probes)"
	@echo "  make check-db-external-ready - External PG readiness audit (env + compose + backup/restore + docs + /health)"
	@echo "  make check-backup-freshness  - Backup freshness audit (dir + file + age + naming + restore script)"
	@echo "  make print-db-cutover        - Print external PG cutover/rollback command cheatsheet (read-only)"
	@echo ""
	@echo "Frontend cache:"
	@echo "  make cf-purge-play           - Purge play.pokeryapp.com entry URLs from Cloudflare (requires CF_ZONE_ID + CF_API_TOKEN in .env.prod)"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SHELL := /bin/bash
SERVER_SRC ?= ../texas-holdem-client
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
COMPOSE := docker compose --env-file .env -f docker/docker-compose.yml

# Export for docker-compose
export SERVER_SRC VERSION GIT_COMMIT BUILD_TIME

# -----------------------------------------------------------------------------
# Environment Setup
# -----------------------------------------------------------------------------
.env:
	@if [ ! -f .env ]; then \
		echo "[OPS] Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo "[OPS] Please review and customize .env"; \
	fi

env-check: .env
	@echo "[OPS] Validating .env file..."
	@if [ ! -f .env ]; then echo "ERROR: .env not found"; exit 1; fi
	@bash -c 'set -a; source .env; set +a; \
		echo "HTTP_ADDR=$$HTTP_ADDR"; \
		echo "HOST_PORT=$$HOST_PORT"; \
		echo "LOG_LEVEL=$$LOG_LEVEL"; \
		echo "STORAGE_MODE=$$STORAGE_MODE"; \
		echo "DATA_DIR=$$DATA_DIR"; \
		echo "DB_DRIVER=$$DB_DRIVER"; \
		echo "DB_NAME=$$DB_NAME"; \
		echo "DB_USER=$$DB_USER"; \
		echo "DB_SSLMODE=$$DB_SSLMODE"; \
		echo "ADMIN_TOKEN=$${ADMIN_TOKEN:+(set)}"; \
		echo "ADMIN_USERNAME=$$ADMIN_USERNAME"; \
		echo "SERVER_SRC=$$SERVER_SRC"'
	@echo "[OPS] Environment OK"

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
build: .env
	@echo "[OPS] Building Docker image..."
	@$(COMPOSE) build \
		--build-arg VERSION=$(VERSION) \
		--build-arg GIT_COMMIT=$(GIT_COMMIT) \
		--build-arg BUILD_TIME=$(BUILD_TIME)
	@echo "[OPS] Build complete: texas-holdem-server:$(VERSION)"

build-local:
	@echo "[OPS] Building Go binary locally..."
	@cd $(SERVER_SRC)/server/go && go build \
		-ldflags="-w -s -X main.Version=$(VERSION) -X main.GitCommit=$(GIT_COMMIT) -X main.BuildTime=$(BUILD_TIME)" \
		-o $(PWD)/bin/texas-holdem-server \
		./cmd/server/main.go
	@echo "[OPS] Binary: bin/texas-holdem-server"

# -----------------------------------------------------------------------------
# Lifecycle
# -----------------------------------------------------------------------------
up: .env
	@./scripts/up.sh

down:
	@./scripts/down.sh

restart: down up

ps:
	@./scripts/ps.sh

status:
	@./scripts/status.sh

health:
	@./scripts/health.sh

logs:
	@./scripts/logs.sh follow

logs-tail:
	@./scripts/logs.sh tail 100

# -----------------------------------------------------------------------------
# Testing
# -----------------------------------------------------------------------------
smoke:
	@./scripts/smoke.sh

e2e:
	@./scripts/e2e.sh

# -----------------------------------------------------------------------------
# Production Drill (Docker)
# -----------------------------------------------------------------------------
drill: .env
	@echo "========================================"
	@echo "[DRILL] Texas Hold'em Production Drill"
	@echo "========================================"
	@echo ""
	@echo "[DRILL] Step 1: Build Docker image..."
	@$(MAKE) build
	@echo ""
	@echo "[DRILL] Step 2: Start services..."
	@$(MAKE) up
	@echo ""
	@echo "[DRILL] Step 3: Wait for ready state..."
	@sleep 5
	@echo ""
	@echo "[DRILL] Step 4: Run smoke tests..."
	@./scripts/smoke.sh || { $(MAKE) down; echo "[DRILL] FAILED at smoke tests"; exit 1; }
	@echo ""
	@echo "[DRILL] Step 5: Run e2e tests..."
	@./scripts/e2e.sh || { $(MAKE) down; echo "[DRILL] FAILED at e2e tests"; exit 1; }
	@echo ""
	@echo "[DRILL] Step 6: Test mode transitions..."
	@$(MAKE) soft-launch
	@sleep 2
	@./scripts/status.sh | grep -q "READ_ONLY" || { $(MAKE) down; echo "[DRILL] FAILED: soft-launch mode not active"; exit 1; }
	@$(MAKE) mode-normal
	@sleep 2
	@echo ""
	@echo "[DRILL] Step 7: Test postgres backup..."
	@$(MAKE) backup-pg
	@echo ""
	@echo "[DRILL] Step 8: Test data backup..."
	@$(MAKE) backup
	@echo ""
	@echo "[DRILL] Step 9: Stop services..."
	@$(MAKE) down
	@echo ""
	@echo "========================================"
	@echo "[DRILL] SUCCESS! All checks passed."
	@echo "========================================"

# -----------------------------------------------------------------------------
# Native Production Drill (no Docker required)
# -----------------------------------------------------------------------------
drill-native: .env
	@echo "========================================"
	@echo "[DRILL-NATIVE] Texas Hold'em Production Drill (Native)"
	@echo "========================================"
	@echo ""
	@echo "[DRILL] Step 1: Build Go binary..."
	@$(MAKE) build-local
	@echo ""
	@echo "[DRILL] Step 2: Start server..."
	@./scripts/start-native.sh
	@echo ""
	@echo "[DRILL] Step 3: Wait for ready state..."
	@sleep 3
	@echo ""
	@echo "[DRILL] Step 4: Run smoke tests..."
	@./scripts/smoke.sh || { ./scripts/stop-native.sh; echo "[DRILL] FAILED at smoke tests"; exit 1; }
	@echo ""
	@echo "[DRILL] Step 5: Run e2e tests..."
	@./scripts/e2e.sh || { ./scripts/stop-native.sh; echo "[DRILL] FAILED at e2e tests"; exit 1; }
	@echo ""
	@echo "[DRILL] Step 6: Stop server..."
	@./scripts/stop-native.sh
	@echo ""
	@echo "========================================"
	@echo "[DRILL-NATIVE] SUCCESS! All checks passed."
	@echo "========================================"

# -----------------------------------------------------------------------------
# Server Modes
# -----------------------------------------------------------------------------
soft-launch:
	@echo "[OPS] Enabling SOFT_LAUNCH mode..."
	@$(COMPOSE) down
	@SOFT_LAUNCH=true $(COMPOSE) up -d
	@echo "[OPS] Server restarted in SOFT_LAUNCH (READ_ONLY) mode"

readonly:
	@echo "[OPS] Enabling READ_ONLY mode..."
	@$(COMPOSE) down
	@READ_ONLY=true $(COMPOSE) up -d
	@echo "[OPS] Server restarted in READ_ONLY mode"

shutdown:
	@echo "[OPS] Enabling SHUTDOWN mode (drain connections)..."
	@$(COMPOSE) down
	@SHUTDOWN=true $(COMPOSE) up -d
	@echo "[OPS] Server restarted in SHUTDOWN mode"

mode-normal:
	@echo "[OPS] Returning to NORMAL mode..."
	@$(COMPOSE) down
	@SOFT_LAUNCH=false READ_ONLY=false SHUTDOWN=false $(COMPOSE) up -d
	@echo "[OPS] Server restarted in NORMAL mode"

# -----------------------------------------------------------------------------
# Data Management
# -----------------------------------------------------------------------------
backup:
	@./scripts/backup.sh

restore:
	@./scripts/restore.sh

backup-pg:
	@./scripts/backup_postgres.sh

restore-pg:
	@./scripts/restore_postgres.sh

psql:
	@./scripts/psql.sh

# -----------------------------------------------------------------------------
# Production (Remote Server)
# -----------------------------------------------------------------------------
COMPOSE_PROD := docker compose --env-file .env -f docker/docker-compose.yml -f docker/docker-compose.prod.yml

prod-env-check:
	@echo "[OPS] Validating .env.prod..."
	@if [ ! -f .env.prod ]; then echo "ERROR: .env.prod not found. Copy .env.prod.example to .env.prod"; exit 1; fi
	@bash -c 'set -a; source .env.prod; set +a; \
		ok=true; \
		for var in SERVER_HOST SERVER_USER SERVER_DIR DOMAIN DB_DRIVER DB_NAME DB_USER DB_PASSWORD ADMIN_TOKEN ADMIN_USERNAME ADMIN_PASSWORD; do \
			val=$${!var:-}; \
			if [ -z "$$val" ] || echo "$$val" | grep -q "CHANGE_ME"; then \
				echo "FAIL: $$var is not set or has placeholder"; ok=false; \
			else \
				case $$var in DB_PASSWORD|ADMIN_TOKEN|ADMIN_PASSWORD) echo "$$var=(set)";; *) echo "$$var=$$val";; esac; \
			fi; \
		done; \
		if [ "$$ok" != "true" ]; then echo ""; echo "ERROR: Fix the above before deploying"; exit 1; fi'
	@echo "[OPS] Production environment OK"

prod-config:
	@echo "[OPS] Resolved production compose config:"
	@if [ -f .env.prod ]; then \
		docker compose --env-file .env.prod -f docker/docker-compose.yml -f docker/docker-compose.prod.yml config; \
	else \
		echo "ERROR: .env.prod not found"; exit 1; \
	fi

deploy-prod:
	@./scripts/prod/deploy_prod.sh

deploy-backend-safe:
	@./scripts/deploy_backend_safe.sh

check-prod:
	@./scripts/prod/check_prod.sh

backup-prod:
	@./scripts/prod/backup_prod.sh

restore-prod:
	@./scripts/prod/restore_prod.sh

logs-prod:
	@./scripts/prod/logs_prod.sh

restart-prod:
	@./scripts/prod/restart_prod.sh

rollback-prod:
	@./scripts/prod/rollback_prod.sh

# -----------------------------------------------------------------------------
# Audit
# -----------------------------------------------------------------------------
check-ledger-audit:
	@./scripts/check_ledger_audit.sh

check-prod-stack:
	@./scripts/check_prod_stack.sh

check-exposure:
	@./scripts/check_exposure_boundary.sh

check-db-external-ready:
	@./scripts/check_db_external_ready.sh

check-backup-freshness:
	@./scripts/check_backup_freshness.sh

print-db-cutover:
	@echo "========================================"
	@echo "[DB-CUTOVER] Command Cheatsheet"
	@echo "========================================"
	@echo "Full runbook: docs/DB_CUTOVER.md"
	@echo ""
	@sed -n '/^## B\. Cutover/,/^## C\./{ /^## C\./d; p; }' docs/DB_CUTOVER.md
	@echo "----------------------------------------"
	@sed -n '/^## D\. Rollback/,/^## E\./{ /^## E\./d; p; }' docs/DB_CUTOVER.md
	@echo "----------------------------------------"
	@sed -n '/^## F\. Final/,$$p' docs/DB_CUTOVER.md
	@echo "========================================"

cf-purge-play:
	@./scripts/cf_purge_play.sh

# Regenerate client/server/go/api/cloudflare_cidr.go from
# config/cf_cidrs.txt. No-op when already in sync. Also runs as part
# of deploy_backend_safe.sh so prod always ships the current list.
cf-cidrs-sync:
	@./scripts/sync_cf_cidrs_to_server.sh

# Pull the latest CF edge ranges and rewrite config/cf_cidrs.txt.
# Exits 1 on drift (config was rewritten) — CI opens a PR on that
# signal. Exits 0 when the list is unchanged. Run manually to force a
# fresh pull; otherwise the weekly GH Action keeps it up to date.
cf-cidrs-refresh:
	@./scripts/refresh_cf_cidrs.sh

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
clean:
	@echo "[OPS] Cleaning up..."
	@rm -rf bin/
	@$(COMPOSE) down -v --remove-orphans 2>/dev/null || true
	@docker rmi texas-holdem-server:latest 2>/dev/null || true
	@echo "[OPS] Cleanup complete"
