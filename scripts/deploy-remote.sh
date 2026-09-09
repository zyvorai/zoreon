#!/usr/bin/env bash
# Copyright 2026 Zyvor AI Labs · https://zyvor.dev
# SPDX-License-Identifier: Apache-2.0
# ============================================================================
# deploy-remote.sh — Ship Agora to a lab host (rsync → podman build → systemd)
# ============================================================================
# Mirrors GuestKit / zyvor-web remote deploy conventions:
#   SSH key auth, staging under ~/.deployments/agora, podman image, systemd unit.
#
# Usage:
#   ./scripts/deploy-remote.sh <host> [user] [options]
#   ./scripts/deploy-remote.sh zoreon.example.com sus --port 30591
#   ./scripts/deploy-remote.sh --user sus --host zoreon.example.com
#   make deploy-remote H=zoreon.example.com U=sus
#   ./scripts/deploy-remote.sh --uninstall
#
# Options:
#   --port N        Host TCP port (maps to container :8080). Default: 30591 or .deploy-remote-last
#   --uninstall     Stop/remove systemd unit + podman container/image workdir
#   --dry-run       Print plan only
#   --skip-smoke    Skip curl health check
#   -u/--user NAME  SSH user (default: sus)
#   -H/--host ADDR  SSH host
#
# Env:
#   DEPLOY_HOST / DEPLOY_USER / AGORA_PORT / BUILDER (podman|docker, default podman)
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib/deploy-remote-lib.sh
source "$SCRIPT_DIR/lib/deploy-remote-lib.sh"

SERVICE_NAME="${SERVICE_NAME:-agora}"
CONTAINER_NAME="${CONTAINER_NAME:-agora}"
IMAGE_NAME="${IMAGE_NAME:-agora:latest}"
REMOTE_DIR_NAME="${REMOTE_DIR_NAME:-.deployments/agora}"
STATE_FILE=".deploy-remote-last"
DEFAULT_PORT=30591
BUILDER="${BUILDER:-podman}"

UNINSTALL_MODE=false
DRY_RUN=false
SKIP_SMOKE=false
PORT_FROM_CLI=""
EXPLICIT_USER=""
EXPLICIT_HOST=""
POSITIONAL=()

while [ $# -gt 0 ]; do
  case "$1" in
    --port)
      [ $# -ge 2 ] || agora_error "--port requires a value"
      PORT_FROM_CLI="$2"
      shift 2
      ;;
    --port=*)
      PORT_FROM_CLI="${1#*=}"
      shift
      ;;
    -u|--user)
      [ $# -ge 2 ] || agora_error "$1 requires a value"
      EXPLICIT_USER="$2"
      shift 2
      ;;
    -H|--host)
      [ $# -ge 2 ] || agora_error "$1 requires a value"
      EXPLICIT_HOST="$2"
      shift 2
      ;;
    --uninstall) UNINSTALL_MODE=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --skip-smoke) SKIP_SMOKE=true; shift ;;
    --help|-h)
      sed -n '2,40p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    --)
      shift
      POSITIONAL+=("$@")
      break
      ;;
    -*)
      agora_error "Unknown option: $1 (see --help)"
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

HOST="${EXPLICIT_HOST:-${POSITIONAL[0]:-${DEPLOY_HOST:-}}}"
USER="${EXPLICIT_USER:-${POSITIONAL[1]:-${DEPLOY_USER:-sus}}}"
LAST_PORT=""

if [ -z "$HOST" ] && agora_load_deploy_last "$REPO_DIR"; then
  agora_info "Using $STATE_FILE → ${USER}@${HOST} :${PORT}"
  LAST_PORT="${PORT:-}"
elif [ -f "$REPO_DIR/$STATE_FILE" ]; then
  LAST_PORT="$(awk -F= '/^PORT=/ {print substr($0,6); exit}' "$REPO_DIR/$STATE_FILE")"
fi

[ -n "$HOST" ] || agora_error "Usage: $0 <host> [user] [options]  (see --help)"

if [[ "$HOST" == *@* ]]; then
  agora_parse_target "$HOST" "$USER"
fi

if [ -n "$PORT_FROM_CLI" ]; then
  AGORA_PORT="$PORT_FROM_CLI"
elif [ -n "${AGORA_PORT:-}" ]; then
  :
elif [ -n "$LAST_PORT" ]; then
  AGORA_PORT="$LAST_PORT"
  agora_info "Reusing port ${AGORA_PORT} from $STATE_FILE"
else
  AGORA_PORT="$DEFAULT_PORT"
fi

case "$AGORA_PORT" in
  ''|*[!0-9]*) agora_error "Invalid port: ${AGORA_PORT}" ;;
esac
if [ "$AGORA_PORT" -lt 1 ] || [ "$AGORA_PORT" -gt 65535 ]; then
  agora_error "Port out of range: ${AGORA_PORT}"
fi

SUDO=""
[ "$USER" != "root" ] && SUDO="sudo -n"

DEPLOY_SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ConnectTimeout=15
  -o ServerAliveInterval=15
  -o ServerAliveCountMax=8
  -o BatchMode=yes
)

_ssh() {
  ssh "${DEPLOY_SSH_OPTS[@]}" "${USER}@${HOST}" "$@"
}

_rsync() {
  rsync -az --delete \
    -e "ssh ${DEPLOY_SSH_OPTS[*]}" \
    "$@"
}

GIT_VERSION="$(git -C "$REPO_DIR" describe --tags --always --dirty 2>/dev/null || echo dev)"
GIT_COMMIT="$(git -C "$REPO_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)"

if $DRY_RUN; then
  agora_banner "Agora dry run" "no changes"
  agora_kv "Target" "${USER}@${HOST}"
  agora_kv "Port" "$AGORA_PORT"
  agora_kv "Builder" "$BUILDER"
  agora_kv "Unit" "$SERVICE_NAME.service"
  agora_kv "Image" "$IMAGE_NAME"
  echo ""
  agora_info "Would: rsync → ${BUILDER} build → systemd ${SERVICE_NAME} on :${AGORA_PORT}"
  exit 0
fi

agora_banner "Agora remote deploy" "${GIT_VERSION} (${GIT_COMMIT}) → ${USER}@${HOST}"
agora_kv "Target" "${USER}@${HOST}"
agora_kv "Port" "$AGORA_PORT"
agora_kv "Builder" "$BUILDER"
echo ""

REMOTE_HOME="$(_ssh 'printf %s "$HOME"')"
REMOTE_DIR="${REMOTE_HOME}/${REMOTE_DIR_NAME}"

if $UNINSTALL_MODE; then
  agora_banner "Agora uninstall" "${USER}@${HOST}"
  agora_step "Removing ${SERVICE_NAME} / ${CONTAINER_NAME}"
  _ssh "
    set -euo pipefail
    $SUDO systemctl stop ${SERVICE_NAME} 2>/dev/null || true
    $SUDO systemctl disable ${SERVICE_NAME} 2>/dev/null || true
    $SUDO rm -f /etc/systemd/system/${SERVICE_NAME}.service
    $SUDO systemctl daemon-reload 2>/dev/null || true
    $SUDO ${BUILDER} rm -f ${CONTAINER_NAME} 2>/dev/null || true
    $SUDO ${BUILDER} rmi ${IMAGE_NAME} 2>/dev/null || true
    rm -rf '${REMOTE_DIR}'
  "
  agora_info "Agora removed from ${HOST}"
  exit 0
fi

agora_step "SSH preflight"
_ssh "command -v ${BUILDER} >/dev/null" \
  || agora_error "${BUILDER} not found on ${HOST} (install podman or set BUILDER=docker)"
_ssh "$SUDO true" || agora_error "passwordless sudo required for ${USER} on ${HOST}"
agora_info "ssh + ${BUILDER} + sudo OK"

agora_step "Sync sources → ${REMOTE_DIR}"
_ssh "mkdir -p '${REMOTE_DIR}'"
_rsync \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude '.vercel/' \
  --exclude '.tanstack/' \
  --exclude '.output/' \
  --exclude '.nitro/' \
  --exclude 'screenshots/' \
  --exclude 'artifacts/' \
  --exclude '.deploy-remote-last' \
  --exclude '.DS_Store' \
  "${REPO_DIR}/" "${USER}@${HOST}:${REMOTE_DIR}/"
agora_info "sources synced"

agora_step "Build image ${IMAGE_NAME}"
_ssh "
  set -euo pipefail
  cd '${REMOTE_DIR}'
  $SUDO ${BUILDER} build -t ${IMAGE_NAME} .
"
agora_info "image built"

agora_step "Install systemd ${SERVICE_NAME}"
UNIT_TMP="$(mktemp)"
trap 'rm -f "$UNIT_TMP"' EXIT
cat >"$UNIT_TMP" <<EOF
[Unit]
Description=Zyvor Agora (podman)
Documentation=https://github.com/zyvorai/agora
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=3
TimeoutStartSec=120
ExecStartPre=-/usr/bin/${BUILDER} rm -f ${CONTAINER_NAME}
ExecStart=/usr/bin/${BUILDER} run --name ${CONTAINER_NAME} --publish ${AGORA_PORT}:8080 --env HOST=0.0.0.0 --env PORT=8080 --env MATTERMOST_URL=${MATTERMOST_URL:-http://zoreon.example.com:31722} ${IMAGE_NAME}
ExecStop=/usr/bin/${BUILDER} stop -t 15 ${CONTAINER_NAME}

[Install]
WantedBy=multi-user.target
EOF

scp "${DEPLOY_SSH_OPTS[@]}" "$UNIT_TMP" "${USER}@${HOST}:/tmp/${SERVICE_NAME}.service"
_ssh "
  set -euo pipefail
  $SUDO mv /tmp/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable ${SERVICE_NAME}
  $SUDO systemctl restart ${SERVICE_NAME}
  if command -v firewall-cmd >/dev/null 2>&1; then
    $SUDO firewall-cmd --permanent --add-port=${AGORA_PORT}/tcp 2>/dev/null || true
    $SUDO firewall-cmd --reload 2>/dev/null || true
  elif command -v ufw >/dev/null 2>&1; then
    $SUDO ufw allow ${AGORA_PORT}/tcp 2>/dev/null || true
  fi
  sleep 2
  $SUDO systemctl is-active ${SERVICE_NAME}
"
agora_info "${SERVICE_NAME} active on :${AGORA_PORT}"

agora_save_deploy_last "$REPO_DIR" "$HOST" "$USER" "$AGORA_PORT"

if $SKIP_SMOKE; then
  agora_warn "Skipped smoke (--skip-smoke)"
else
  agora_step "Smoke http://${HOST}:${AGORA_PORT}/"
  ok=0
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if _ssh "curl -fsS -o /dev/null --max-time 5 http://127.0.0.1:${AGORA_PORT}/"; then
      ok=1
      break
    fi
    sleep 2
  done
  [ "$ok" = 1 ] || agora_error "health check failed (is ${SERVICE_NAME} logging errors? journalctl -u ${SERVICE_NAME})"
  agora_info "UI OK on-host"
fi

echo ""
agora_banner "Deployed" "http://${HOST}:${AGORA_PORT}/"
agora_kv "Service" "$SERVICE_NAME"
agora_kv "Logs" "ssh ${USER}@${HOST} '${SUDO} journalctl -u ${SERVICE_NAME} -f'"
agora_kv "Uninstall" "./scripts/deploy-remote.sh ${HOST} ${USER} --uninstall"
echo ""
