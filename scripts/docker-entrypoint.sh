#!/bin/sh
# Apply Postgres migrations when DATABASE_URL is set, then start Nitro.
set -eu
if [ -n "${DATABASE_URL:-}" ]; then
  node /app/scripts/migrate.mjs
fi
exec node /app/.output/server/index.mjs
