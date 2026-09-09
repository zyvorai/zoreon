# Copyright 2026 Zyvor AI Labs · https://zyvor.dev
# SPDX-License-Identifier: Apache-2.0
# shellcheck shell=bash
# Compact remote-deploy helpers for Zoreon (guestkit-style, no cross-repo imports).

if [ -t 1 ] && command -v tput &>/dev/null && [ "$(tput colors 2>/dev/null || echo 0)" -ge 8 ]; then
  _C_RESET=$'\033[0m' _C_BOLD=$'\033[1m' _C_DIM=$'\033[2m'
  _C_CYAN=$'\033[36m' _C_GREEN=$'\033[32m' _C_YELLOW=$'\033[33m'
  _C_RED=$'\033[31m' _C_MAGENTA=$'\033[35m'
else
  _C_RESET='' _C_BOLD='' _C_DIM='' _C_CYAN='' _C_GREEN='' _C_YELLOW='' _C_RED='' _C_MAGENTA=''
fi

zoreon_info()  { printf '  %sOK%s  %s\n' "$_C_GREEN" "$_C_RESET" "$*"; }
zoreon_warn()  { printf '  %sWARN%s %s\n' "$_C_YELLOW" "$_C_RESET" "$*"; }
zoreon_error() { printf '  %sERR%s  %s\n' "$_C_RED" "$_C_RESET" "$*"; exit 1; }
zoreon_step()  { printf '\n  %s==>%s %s%s%s\n' "$_C_CYAN" "$_C_RESET" "$_C_BOLD" "$*" "$_C_RESET"; }
zoreon_kv()    { printf '  %s%-12s%s %s\n' "$_C_DIM" "$1" "$_C_RESET" "$2"; }

zoreon_banner() {
  local title="$1" subtitle="${2:-}"
  printf '\n'
  printf '  %s╔══════════════════════════════════════════════════════════╗%s\n' "$_C_MAGENTA" "$_C_RESET"
  printf '  %s║%s  %-54s %s║%s\n' "$_C_MAGENTA" "$_C_RESET" "$title" "$_C_MAGENTA" "$_C_RESET"
  if [ -n "$subtitle" ]; then
    printf '  %s║%s  %-54s %s║%s\n' "$_C_MAGENTA" "$_C_RESET" "$subtitle" "$_C_MAGENTA" "$_C_RESET"
  fi
  printf '  %s╚══════════════════════════════════════════════════════════╝%s\n' "$_C_MAGENTA" "$_C_RESET"
  printf '\n'
}

zoreon_parse_target() {
  # nameref-style: sets HOST / USER from scp-style user@host if needed
  local _host="$1" _user="$2"
  if [[ "$_host" == *@* ]]; then
    USER="${_host%%@*}"
    HOST="${_host#*@}"
  else
    HOST="$_host"
    USER="${_user:-}"
  fi
}

zoreon_save_deploy_last() {
  local repo_dir="$1" host="$2" user="$3" port="$4"
  local path="$repo_dir/.deploy-remote-last"
  umask 077
  cat >"$path" <<EOF
HOST=$host
USER=$user
PORT=$port
UPDATED=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
  chmod 600 "$path" 2>/dev/null || true
}

zoreon_load_deploy_last() {
  local repo_dir="$1"
  local path="$repo_dir/.deploy-remote-last"
  [ -f "$path" ] || return 1
  # shellcheck disable=SC1090
  HOST="$(awk -F= '/^HOST=/ {print substr($0,6); exit}' "$path")"
  USER="$(awk -F= '/^USER=/ {print substr($0,6); exit}' "$path")"
  PORT="$(awk -F= '/^PORT=/ {print substr($0,6); exit}' "$path")"
  [ -n "$HOST" ] && [ -n "$USER" ]
}
