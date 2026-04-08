#!/bin/sh
# Runs via nginx:alpine's /docker-entrypoint.sh which iterates /docker-entrypoint.d/*.sh
# before starting nginx. Writes the runtime config file from $GATEWAY_URL.
set -eu

: "${GATEWAY_URL:?GATEWAY_URL env var is required (the browser-reachable URL of the gateway)}"

# Escape backslashes and double quotes so we can safely inline into a JS string literal.
escaped=$(printf '%s' "$GATEWAY_URL" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')

cat > /usr/share/nginx/html/config.js <<EOF
window.__ENV__ = { GATEWAY_URL: "${escaped}" };
EOF

echo "[entrypoint] wrote /config.js with GATEWAY_URL=${GATEWAY_URL}"
