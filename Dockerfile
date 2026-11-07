# ==============================================================================
# Stage 1: Build React Frontend
# ==============================================================================
FROM node:22-alpine AS frontend-builder
WORKDIR /app/web

# Install dependencies first for better caching
COPY web/package*.json ./
RUN npm ci --prefer-offline

# Copy source code and build production assets
COPY web/ ./
RUN npm run build

# ==============================================================================
# Stage 2: Build Pure-Go Static Single Binary
# ==============================================================================
FROM golang:alpine AS backend-builder
WORKDIR /app
ENV GOTOOLCHAIN=auto

RUN apk add --no-cache ca-certificates git

# Cache Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy backend source
COPY . .

# Copy compiled frontend from Stage 1 into Go embed directory
COPY --from=frontend-builder /app/web/dist ./cmd/server/dist

WORKDIR /app/cmd/server
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-s -w -extldflags '-static'" \
    -o /app/my-perfect-pm .

# ==============================================================================
# Stage 3: Minimal Production Container (~25MB)
# ==============================================================================
FROM alpine:3.21

# Install runtime dependencies, tzdata, and su-exec for safe privilege dropping
RUN apk --no-cache add ca-certificates tzdata su-exec \
    && addgroup -g 1000 -S appgroup && adduser -u 1000 -S appuser -G appgroup \
    && mkdir -p /app/data && chown -R appuser:appgroup /app

WORKDIR /app

# Copy binary from builder
COPY --from=backend-builder --chown=appuser:appgroup /app/my-perfect-pm .
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080

VOLUME ["/app/data"]

ENV DB_PATH=/app/data/pm.db \
    PORT=8080 \
    GIN_MODE=release \
    ENV=production

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
