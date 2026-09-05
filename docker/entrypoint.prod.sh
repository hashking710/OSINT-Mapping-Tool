#!/bin/sh

CONFIG=/app/dist/app.config.json

if [ -n "$GOOGLE_MAPS_API_KEY" ] || [ -n "$GOOGLE_MAPS_MAP_ID" ]; then
  CONFIG_PATH="$CONFIG" node /app/docker/write-config.cjs
  echo "[entrypoint] Wrote $CONFIG from environment (.env)."
else
  echo "[entrypoint] Google Maps credentials not set; OpenStreetMap mode remains available."
fi

exec node /app/docker/server.mjs