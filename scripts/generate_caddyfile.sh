#!/bin/bash
# =============================================================================
# Generate Caddyfile from environment variables
# Supports:
#   1. Single domain: DOMAIN only (API + landing on same domain)
#   2. Split domains: DOMAIN + API_DOMAIN + optional PLAY_DOMAIN
#   3. CORS for API subdomain when PLAY_DOMAIN is set
# =============================================================================
set -euo pipefail

DOMAIN="${DOMAIN:-localhost}"
API_DOMAIN="${API_DOMAIN:-}"
PLAY_DOMAIN="${PLAY_DOMAIN:-}"
OUTPUT="${1:-docker/Caddyfile}"

is_ip_or_localhost() {
    [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] || [[ "$1" == "localhost" ]]
}

caddy_addr() {
    if is_ip_or_localhost "$1"; then echo "http://$1"; else echo "$1"; fi
}

CADDY_DOMAIN="$(caddy_addr "$DOMAIN")"
CADDY_API_DOMAIN=""
CADDY_PLAY_DOMAIN=""
[[ -n "$API_DOMAIN" ]] && CADDY_API_DOMAIN="$(caddy_addr "$API_DOMAIN")"
[[ -n "$PLAY_DOMAIN" ]] && CADDY_PLAY_DOMAIN="$(caddy_addr "$PLAY_DOMAIN")"

# Build CORS origin for API (the H5 client origin that needs cross-origin access)
CORS_ORIGIN=""
if [[ -n "$PLAY_DOMAIN" ]]; then
    if is_ip_or_localhost "$PLAY_DOMAIN"; then
        CORS_ORIGIN="http://${PLAY_DOMAIN}"
    else
        CORS_ORIGIN="https://${PLAY_DOMAIN}"
    fi
fi

SECURITY_HEADERS='    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        Referrer-Policy strict-origin-when-cross-origin
        -Server
    }'

WS_BLOCK='    @websocket {
        header Connection *Upgrade*
        header Upgrade websocket
    }
    reverse_proxy @websocket app:8080'

# CORS block for API subdomain — handles OPTIONS preflight + response headers
CORS_BLOCK=""
if [[ -n "$CORS_ORIGIN" ]]; then
    CORS_BLOCK="
    # CORS: allow H5 client at ${CORS_ORIGIN}
    @cors_preflight {
        method OPTIONS
        header Origin ${CORS_ORIGIN}
    }
    handle @cors_preflight {
        header Access-Control-Allow-Origin \"${CORS_ORIGIN}\"
        header Access-Control-Allow-Methods \"GET, POST, PUT, DELETE, OPTIONS\"
        header Access-Control-Allow-Headers \"Authorization, Content-Type, X-Request-ID, X-Admin-Token\"
        header Access-Control-Allow-Credentials \"true\"
        header Access-Control-Max-Age \"86400\"
        respond 204
    }

    @cors_request {
        header Origin ${CORS_ORIGIN}
        not method OPTIONS
    }
    header @cors_request Access-Control-Allow-Origin \"${CORS_ORIGIN}\"
    header @cors_request Access-Control-Allow-Credentials \"true\"
    header @cors_request Access-Control-Expose-Headers \"Content-Length, Content-Type\""
fi

cat > "$OUTPUT" << CADDYEOF
# Auto-generated — do not edit manually. See scripts/generate_caddyfile.sh
CADDYEOF

if [[ -n "$API_DOMAIN" && "$API_DOMAIN" != "$DOMAIN" ]]; then
    # --- Split domain mode ---
    cat >> "$OUTPUT" << CADDYEOF

# Root domain — landing / download page
${CADDY_DOMAIN} {
    root * /srv/landing
    file_server

${SECURITY_HEADERS}

    log {
        output file /data/caddy/landing-access.log {
            roll_size 10mb
            roll_keep 3
        }
    }
}

# API subdomain — reverse proxy to Go backend
${CADDY_API_DOMAIN} {
${CORS_BLOCK}

    reverse_proxy app:8080

${WS_BLOCK}

${SECURITY_HEADERS}

    log {
        output file /data/caddy/api-access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
CADDYEOF
else
    # --- Single domain mode ---
    cat >> "$OUTPUT" << CADDYEOF

# Single domain — landing page + API on same host
${CADDY_DOMAIN} {
    @api {
        path /health
        path /v1/*
        path /ws/*
    }
    reverse_proxy @api app:8080

${WS_BLOCK}

    root * /srv/landing
    file_server

${SECURITY_HEADERS}

    log {
        output file /data/caddy/access.log {
            roll_size 10mb
            roll_keep 5
        }
    }
}
CADDYEOF
fi

# --- Play subdomain (optional) ---
if [[ -n "$PLAY_DOMAIN" && "$PLAY_DOMAIN" != "$DOMAIN" ]]; then
    cat >> "$OUTPUT" << CADDYEOF

# Play subdomain — H5 web client (SPA)
${CADDY_PLAY_DOMAIN} {
    root * /srv/play
    try_files {path} /index.html
    file_server

${SECURITY_HEADERS}

    log {
        output file /data/caddy/play-access.log {
            roll_size 10mb
            roll_keep 3
        }
    }
}
CADDYEOF
fi

echo "[CADDY] Generated ${OUTPUT} (DOMAIN=${DOMAIN}, API_DOMAIN=${API_DOMAIN:-<same>}, PLAY_DOMAIN=${PLAY_DOMAIN:-<none>})"
