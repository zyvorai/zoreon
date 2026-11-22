#!/bin/sh
# Copyright 2026 Zyvor AI Labs · https://zyvor.dev
# SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

# Apply Postgres migrations when DATABASE_URL is set, then start Nitro.
set -eu
if [ -n "${DATABASE_URL:-}" ]; then
  node /app/scripts/migrate.mjs
fi
exec node /app/.output/server/index.mjs
