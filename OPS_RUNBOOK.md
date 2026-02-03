# Texas Hold'em Server - Operations Runbook

## Table of Contents
- [Quick Reference](#quick-reference)
- [Prerequisites](#prerequisites)
- [Deployment](#deployment)
- [Server Lifecycle](#server-lifecycle)
- [Monitoring](#monitoring)
- [Operational Modes](#operational-modes)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)
- [Configuration Reference](#configuration-reference)

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start server | `make up` |
| Stop server | `make down` |
| View status | `make status` |
| Follow logs | `make logs` |
| Run smoke test | `make smoke` |
| Run full e2e | `make e2e` |
| Production drill | `make drill` |
| Backup data | `make backup` |
| Enable soft-launch | `make soft-launch` |
| Enable read-only | `make readonly` |
| Graceful shutdown | `make shutdown` |
| Return to normal | `make mode-normal` |

---

## Prerequisites

### Required Software
- Docker Engine 20.10+
- Docker Compose v2+
- bash 4.0+
- curl
- make

### Initial Setup
```bash
# Clone ops repository
git clone <ops-repo-url> texas-holdem-ops
cd texas-holdem-ops

# Ensure server source is available
ls ../texas-holdem-client/server/go  # Should exist

# Create environment file
cp .env.example .env

# Review and customize .env
vim .env

# Validate environment
make env-check

# Create data directory
mkdir -p data
```

---

## Deployment

### Docker Deployment (Recommended)

```bash
# Build and start
make build
make up

# Verify deployment
make status
make smoke
```

### systemd Deployment (Alternative)

```bash
# Build binary
make build-local

# Install as service (requires root)
sudo cp bin/texas-holdem-server /usr/local/bin/
sudo cp systemd/texas-holdem.service /etc/systemd/system/
sudo mkdir -p /etc/texas-holdem /var/lib/texas-holdem
sudo cp .env /etc/texas-holdem/env
sudo useradd -r -s /sbin/nologin texas-holdem
sudo chown -R texas-holdem:texas-holdem /var/lib/texas-holdem

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable texas-holdem
sudo systemctl start texas-holdem
sudo systemctl status texas-holdem
```

---

## Server Lifecycle

### Starting the Server
```bash
make up
# or with explicit options:
SOFT_LAUNCH=false make up
```

### Stopping the Server
```bash
make down
```
The server handles SIGTERM gracefully:
1. Sets mode to SHUTDOWN
2. Waits for active hands to complete (up to SHUTDOWN_TIMEOUT)
3. Closes HTTP server

### Restarting
```bash
make restart
# Equivalent to: make down && make up
```

### Viewing Logs
```bash
# Follow logs in real-time
make logs

# View last 100 lines
make logs-tail

# View all logs
./scripts/logs.sh all
```

---

## Monitoring

### Health Check Endpoint
```bash
curl http://localhost:8080/health
```

Response:
```json
{
  "status": "ok",
  "mode": "NORMAL",
  "uptime_seconds": 3600,
  "table_count": 1,
  "player_count": 2,
  "hand_count": 10,
  "started_at": "2024-01-01T00:00:00Z",
  "version": "1.0.0",
  "commit": "abc1234",
  "storage": "file"
}
```

### Mode Endpoint
```bash
curl http://localhost:8080/mode
```

Response:
```json
{"mode": "NORMAL"}
```

### Status Script
```bash
make status
# Shows: container status, health check, mode
```

---

## Operational Modes

The server supports three operational modes:

| Mode | Environment | Behavior |
|------|-------------|----------|
| NORMAL | Default | Full operations |
| READ_ONLY | `SOFT_LAUNCH=true` or `READ_ONLY=true` | Reconnects only, no new games/actions |
| SHUTDOWN | `SHUTDOWN=true` | Drain connections, reject new joins |

### Soft Launch Mode
Use for controlled rollouts. Allows reconnections but prevents new games.

```bash
make soft-launch
# Server restarts in READ_ONLY mode

# Verify mode
curl http://localhost:8080/mode
# {"mode": "READ_ONLY"}
```

### Read-Only Mode
Same as soft-launch. Use for maintenance windows.

```bash
make readonly
```

### Graceful Shutdown Mode
Use before server shutdown. Drains active connections.

```bash
make shutdown
# Server enters SHUTDOWN mode, drains connections

# Monitor drain progress
make status

# When table_count=0 and player_count=0, safe to stop
make down
```

### Return to Normal
```bash
make mode-normal
```

---

## Backup & Recovery

### Creating Backups
```bash
make backup
# Creates: backups/texas-holdem-backup-YYYYMMDD_HHMMSS.tar.gz
```

Backup includes:
- `data/hands/` - Completed hand exports
- `data/rake/` - Daily rake records
- `data/audit/` - Audit logs

### Listing Backups
```bash
./scripts/restore.sh
# Lists available backups
```

### Restoring from Backup
```bash
./scripts/restore.sh backups/texas-holdem-backup-20240101_120000.tar.gz
# Interactive: confirms before overwriting
# Automatically stops/restarts server if running
```

### Backup Best Practices
1. Run `make backup` before any upgrade
2. Keep off-site copies of production backups
3. Test restore procedure periodically
4. Backups auto-rotate (keeps last 10)

---

## Troubleshooting

### Server Won't Start

1. **Check logs**:
   ```bash
   docker compose -f docker/docker-compose.yml logs
   ```

2. **Check port availability**:
   ```bash
   lsof -i :8080
   ```

3. **Check environment**:
   ```bash
   make env-check
   ```

4. **Check data directory permissions**:
   ```bash
   ls -la data/
   ```

### Health Check Failing

1. **Check if server is listening**:
   ```bash
   curl -v http://localhost:8080/health
   ```

2. **Check container status**:
   ```bash
   docker ps -a | grep texas-holdem
   docker logs texas-holdem-server
   ```

3. **Check resource limits**:
   ```bash
   docker stats texas-holdem-server
   ```

### High Memory Usage

The server has a 512MB limit. If approaching limit:

1. Check for connection leaks
2. Review rate limiting settings
3. Consider `STORAGE_MODE=memory` for testing only

### Connection Refused

1. Verify server is running: `make status`
2. Check firewall rules
3. Verify `HTTP_ADDR` and `HOST_PORT` in `.env`

### Data Corruption

1. Stop server: `make down`
2. Restore from backup: `./scripts/restore.sh <backup-file>`
3. Verify data: `ls -la data/`
4. Restart: `make up`

---

## Configuration Reference

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HTTP_ADDR` | `:8080` | Server bind address |
| `HOST_PORT` | `8080` | Host port mapping |
| `LOG_LEVEL` | `info` | Log level: debug, info, warn, error |
| `STORAGE_MODE` | `file` | Storage: file or memory |
| `DATA_DIR` | `./data` | Data directory path |
| `SHUTDOWN_TIMEOUT` | `30` | Graceful shutdown timeout (seconds) |
| `SOFT_LAUNCH` | `false` | Enable soft-launch mode |
| `READ_ONLY` | `false` | Enable read-only mode |
| `SHUTDOWN` | `false` | Enable shutdown/drain mode |
| `RATE_LIMIT_ENABLED` | `true` | Enable rate limiting |
| `RATE_LIMIT_RPS` | `10.0` | Requests per second |
| `RATE_LIMIT_BURST` | `20` | Burst size |

### HTTP Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health status and metrics |
| `/mode` | GET | Current server mode |
| `/export/history` | GET | List recorded hands |
| `/export/hand/{id}` | GET | Export specific hand |

### Server Timeouts (Hardcoded)

| Timeout | Value |
|---------|-------|
| Read | 15s |
| Write | 15s |
| Idle | 60s |

### Resource Limits (Docker)

| Resource | Limit |
|----------|-------|
| CPU | 2.0 cores |
| Memory | 512MB |
| File descriptors | 65535 |

---

## Upgrade Procedure

### Standard Upgrade

```bash
# 1. Create backup
make backup

# 2. Pull latest code
cd ../texas-holdem-client && git pull
cd ../texas-holdem-ops

# 3. Enable soft-launch
make soft-launch

# 4. Wait for active games to finish (monitor table_count)
make status

# 5. Stop server
make down

# 6. Rebuild with new version
make build

# 7. Start server
make up

# 8. Verify
make smoke
make e2e

# 9. Return to normal
make mode-normal
```

### Rollback Procedure

```bash
# 1. Stop current version
make down

# 2. Restore backup
./scripts/restore.sh <backup-file>

# 3. Checkout previous version
cd ../texas-holdem-client && git checkout <previous-tag>
cd ../texas-holdem-ops

# 4. Rebuild
make build

# 5. Start
make up

# 6. Verify
make smoke
```

---

## Production Drill

Run before production deployment to verify entire setup:

```bash
make drill
```

This executes:
1. Build Docker image
2. Start server
3. Wait for ready state
4. Run smoke tests
5. Run e2e tests
6. Test mode transitions
7. Test backup
8. Stop server

All steps must pass for drill success.

---

## Security Checklist

- [ ] `.env` file not committed to git
- [ ] Data directory has restricted permissions
- [ ] Rate limiting enabled (`RATE_LIMIT_ENABLED=true`)
- [ ] Server runs as non-root user
- [ ] Resource limits configured
- [ ] Logging enabled for audit trail
- [ ] Backups stored securely off-site
- [ ] HTTPS termination configured (via reverse proxy)

---

## Support

For issues with this ops setup:
1. Check this runbook's troubleshooting section
2. Review logs: `make logs`
3. Run drill: `make drill` to isolate issues

For server bugs:
1. Check server README in `../texas-holdem-client/server/go/README.md`
2. File issues in the appropriate repository
