# =============================================================================
# Texas Hold'em Server - Production Dockerfile
# Multi-stage build for minimal production image
# =============================================================================

# Build stage
FROM golang:1.22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set build arguments
ARG VERSION=dev
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown

WORKDIR /build

# Copy source code (expects SERVER_SRC to be mounted or copied)
COPY server/go/ .

# Download dependencies
RUN go mod download

# Build with optimizations and version info
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.Version=${VERSION} -X main.GitCommit=${GIT_COMMIT} -X main.BuildTime=${BUILD_TIME}" \
    -o /build/texas-holdem-server \
    ./cmd/server/main.go

# =============================================================================
# Production stage - minimal image
# =============================================================================
FROM alpine:3.19 AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ca-certificates \
    tzdata \
    curl \
    && addgroup -g 1000 -S appgroup \
    && adduser -u 1000 -S appuser -G appgroup

# Copy binary from builder
COPY --from=builder /build/texas-holdem-server /usr/local/bin/texas-holdem-server

# Create data directory with proper permissions
RUN mkdir -p /data && chown -R appuser:appgroup /data

# Set environment defaults
ENV HTTP_ADDR=:8080 \
    LOG_LEVEL=info \
    STORAGE_MODE=file \
    DATA_DIR=/data \
    SHUTDOWN_TIMEOUT=30 \
    RATE_LIMIT_ENABLED=true \
    RATE_LIMIT_RPS=10.0 \
    RATE_LIMIT_BURST=20

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run server
ENTRYPOINT ["/usr/local/bin/texas-holdem-server"]
