# =============================================================================
# Texas Hold'em Server - Ops Makefile
# =============================================================================

.PHONY: help build up down restart status logs smoke e2e drill backup restore \
        clean build-local env-check soft-launch readonly shutdown mode-normal

# Default target
help:
	@echo "Texas Hold'em Server - Ops Commands"
	@echo "===================================="
	@echo ""
	@echo "Lifecycle:"
	@echo "  make up           - Start server (Docker)"
	@echo "  make down         - Stop server (Docker)"
	@echo "  make restart      - Restart server"
	@echo "  make status       - Show server status"
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
	@echo "  make backup       - Backup data"
	@echo "  make restore      - Restore from backup (interactive)"
	@echo "  make soft-launch  - Enable soft-launch mode"
	@echo "  make readonly     - Enable read-only mode"
	@echo "  make shutdown     - Enable shutdown mode (drain)"
	@echo "  make mode-normal  - Return to normal mode"
	@echo ""
	@echo "Utilities:"
	@echo "  make env-check    - Validate .env file"
	@echo "  make clean        - Remove build artifacts"

# -----------------------------------------------------------------------------
# Configuration
# -----------------------------------------------------------------------------
SHELL := /bin/bash
SERVER_SRC ?= ../texas-holdem-client
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

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
		echo "LOG_LEVEL=$$LOG_LEVEL"; \
		echo "STORAGE_MODE=$$STORAGE_MODE"; \
		echo "DATA_DIR=$$DATA_DIR"; \
		echo "SERVER_SRC=$$SERVER_SRC"'
	@echo "[OPS] Environment OK"

# -----------------------------------------------------------------------------
# Build
# -----------------------------------------------------------------------------
build: .env
	@echo "[OPS] Building Docker image..."
	@docker compose -f docker/docker-compose.yml build \
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
	@echo "[OPS] Starting server..."
	@mkdir -p data
	@docker compose -f docker/docker-compose.yml up -d
	@echo "[OPS] Waiting for health check..."
	@sleep 3
	@./scripts/status.sh

down:
	@echo "[OPS] Stopping server..."
	@docker compose -f docker/docker-compose.yml down
	@echo "[OPS] Server stopped"

restart: down up

status:
	@./scripts/status.sh

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
	@echo "[DRILL] Step 2: Start server..."
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
	@echo "[DRILL] Step 7: Test backup..."
	@$(MAKE) backup
	@echo ""
	@echo "[DRILL] Step 8: Stop server..."
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
	@docker compose -f docker/docker-compose.yml down
	@SOFT_LAUNCH=true docker compose -f docker/docker-compose.yml up -d
	@echo "[OPS] Server restarted in SOFT_LAUNCH (READ_ONLY) mode"

readonly:
	@echo "[OPS] Enabling READ_ONLY mode..."
	@docker compose -f docker/docker-compose.yml down
	@READ_ONLY=true docker compose -f docker/docker-compose.yml up -d
	@echo "[OPS] Server restarted in READ_ONLY mode"

shutdown:
	@echo "[OPS] Enabling SHUTDOWN mode (drain connections)..."
	@docker compose -f docker/docker-compose.yml down
	@SHUTDOWN=true docker compose -f docker/docker-compose.yml up -d
	@echo "[OPS] Server restarted in SHUTDOWN mode"

mode-normal:
	@echo "[OPS] Returning to NORMAL mode..."
	@docker compose -f docker/docker-compose.yml down
	@SOFT_LAUNCH=false READ_ONLY=false SHUTDOWN=false docker compose -f docker/docker-compose.yml up -d
	@echo "[OPS] Server restarted in NORMAL mode"

# -----------------------------------------------------------------------------
# Data Management
# -----------------------------------------------------------------------------
backup:
	@./scripts/backup.sh

restore:
	@./scripts/restore.sh

# -----------------------------------------------------------------------------
# Cleanup
# -----------------------------------------------------------------------------
clean:
	@echo "[OPS] Cleaning up..."
	@rm -rf bin/
	@docker compose -f docker/docker-compose.yml down -v --remove-orphans 2>/dev/null || true
	@docker rmi texas-holdem-server:latest 2>/dev/null || true
	@echo "[OPS] Cleanup complete"
