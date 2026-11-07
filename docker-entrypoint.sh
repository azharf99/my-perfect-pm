#!/bin/sh
set -e

# Auto-fix permissions for SQLite database directory
mkdir -p /app/data
chown -R appuser:appgroup /app/data 2>/dev/null || true
chmod 775 /app/data 2>/dev/null || true

# If running as root, drop privileges to appuser safely via su-exec
if [ "$(id -u)" = "0" ]; then
    exec su-exec appuser /app/my-perfect-pm "$@"
else
    exec /app/my-perfect-pm "$@"
fi
