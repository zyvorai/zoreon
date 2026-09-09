#!/usr/bin/env bash
# Copyright 2026 Zyvor AI Labs · https://zyvor.dev
# SPDX-License-Identifier: Apache-2.0
# ============================================================================
# customer-smoke.sh — HTTP smoke checks against a running Zoreon instance
#
# Usage:
#   BASE_URL=http://localhost:8080 ./scripts/customer-smoke.sh
#   BASE_URL=https://zoreon.example.com CURL_OPTS=-k ./scripts/customer-smoke.sh
# ============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
BASE_URL="${BASE_URL%/}"
# shellcheck disable=SC2206
CURL=(curl -sS -o /dev/null ${CURL_OPTS:-})

fail=0
check() {
  local name="$1" expect="$2" url="$3"
  local code
  code="$("${CURL[@]}" -w "%{http_code}" "$url" || true)"
  if [ "$code" = "$expect" ]; then
    printf '  OK   %-10s %s → %s\n' "$name" "$expect" "$url"
  else
    printf '  FAIL %-10s expected %s got %s  %s\n' "$name" "$expect" "$code" "$url"
    fail=1
  fi
}

echo "Zoreon smoke → ${BASE_URL}"
check home     200 "${BASE_URL}/"
check login    200 "${BASE_URL}/login"
check sw       200 "${BASE_URL}/sw.js"
check manifest 200 "${BASE_URL}/__grok/manifest.webmanifest"
check events   401 "${BASE_URL}/api/zoreon/events"
check rtc      200 "${BASE_URL}/api/rtc?room=smoke&peer=p1&name=t&since=0"

if [ "$fail" -ne 0 ]; then
  echo "Smoke FAILED"
  exit 1
fi
echo "Smoke OK"
