#!/usr/bin/env bash
# Copyright 2026 Zyvor AI Labs · https://zyvor.dev
# SPDX-License-Identifier: Apache-2.0
# ============================================================================
# deploy-remote.sh — Ship Zoreon to a lab host (rsync → podman build → systemd)
# ============================================================================
# Mirrors GuestKit / zyvor-web remote deploy conventions:
#   SSH key auth, staging under ~/.deployments/zoreon, podman image, systemd unit.
#
# Usage:
#   ./scripts/deploy-remote.sh <host> [user] [options]
#   ./scripts/deploy-remote.sh zoreon.example.com deploy --port 30591
#   ./scripts/deploy-remote.sh --user deploy --host zoreon.example.com
#   make deploy-remote H=zoreon.example.com U=deploy
#   MATTERMOST_URL=https://mm.example.com ./scripts/deploy-remote.sh …
#   ./scripts/deploy-remote.sh --uninstall
#
# Options:
#   --port N        Host TCP port (maps to container :8080). Default: 30591 or .deploy-remote-last
#   --uninstall     Stop/remove systemd unit + podman container/image workdir
#   --dry-run       Print plan only
#   --skip-smoke    Skip curl health check
#   -u/--user NAME  SSH user (required unless DEPLOY_USER / .deploy-remote-last)
#   -H/--host ADDR  SSH host
#
# Env:
#   DEPLOY_HOST / DEPLOY_USER / ZOREON_PORT / BUILDER (podman|docker, default podman)
#   ZOREON_SMTP_ENV  Path to SMTP env file (default: ~/tt/zyvor-web/contact-mailer.env)
#                    Reads SMTP_HOST/PORT/FROM + USERNAME/PASSWORD (zyvor-web) or USER/PASS.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
# shellcheck source=lib/deploy-remote-lib.sh
source "$SCRIPT_DIR/lib/deploy-remote-lib.sh"

SERVICE_NAME="${SERVICE_NAME:-zoreon}"
PROXY_SERVICE_NAME="${PROXY_SERVICE_NAME:-zoreon-https}"
CONTAINER_NAME="${CONTAINER_NAME:-zoreon}"
# Postgres keeps zoreon-* names; agora-* is migrated on deploy when still present.
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-zoreon-db}"
IMAGE_NAME="${IMAGE_NAME:-zoreon:latest}"
DB_IMAGE="${DB_IMAGE:-docker.io/library/postgres:16-alpine}"
NETWORK_NAME="${NETWORK_NAME:-zoreon-net}"
PG_VOLUME_NAME="${PG_VOLUME_NAME:-zoreon-pgdata}"
LEGACY_DB_CONTAINER_NAME="${LEGACY_DB_CONTAINER_NAME:-agora-db}"
LEGACY_NETWORK_NAME="${LEGACY_NETWORK_NAME:-agora-net}"
LEGACY_PG_VOLUME_NAME="${LEGACY_PG_VOLUME_NAME:-agora-pgdata}"
REMOTE_DIR_NAME="${REMOTE_DIR_NAME:-.deployments/zoreon}"
LEGACY_REMOTE_DIR_NAME=".deployments/agora"
LEGACY_SERVICE_NAME="agora"
LEGACY_PROXY_SERVICE_NAME="agora-https"
LEGACY_CONTAINER_NAME="agora"
STATE_FILE=".deploy-remote-last"
DEFAULT_PORT=30591
UPSTREAM_PORT="${UPSTREAM_PORT:-13091}"
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
      [ $# -ge 2 ] || zoreon_error "--port requires a value"
      PORT_FROM_CLI="$2"
      shift 2
      ;;
    --port=*)
      PORT_FROM_CLI="${1#*=}"
      shift
      ;;
    -u|--user)
      [ $# -ge 2 ] || zoreon_error "$1 requires a value"
      EXPLICIT_USER="$2"
      shift 2
      ;;
    -H|--host)
      [ $# -ge 2 ] || zoreon_error "$1 requires a value"
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
      zoreon_error "Unknown option: $1 (see --help)"
      ;;
    *)
      POSITIONAL+=("$1")
      shift
      ;;
  esac
done

HOST="${EXPLICIT_HOST:-${POSITIONAL[0]:-${DEPLOY_HOST:-}}}"
USER="${EXPLICIT_USER:-${POSITIONAL[1]:-${DEPLOY_USER:-}}}"
LAST_PORT=""

if [ -z "$HOST" ] && zoreon_load_deploy_last "$REPO_DIR"; then
  zoreon_info "Using $STATE_FILE → ${USER}@${HOST} :${PORT}"
  LAST_PORT="${PORT:-}"
elif [ -f "$REPO_DIR/$STATE_FILE" ]; then
  LAST_PORT="$(awk -F= '/^PORT=/ {print substr($0,6); exit}' "$REPO_DIR/$STATE_FILE")"
fi

[ -n "$HOST" ] || zoreon_error "Usage: $0 <host> [user] [options]  (see --help)"
[ -n "$USER" ] || zoreon_error "SSH user required (positional [user], --user, or DEPLOY_USER)"

if [[ "$HOST" == *@* ]]; then
  zoreon_parse_target "$HOST" "$USER"
fi

if [ -n "$PORT_FROM_CLI" ]; then
  ZOREON_PORT="$PORT_FROM_CLI"
elif [ -n "${ZOREON_PORT:-}" ]; then
  :
elif [ -n "$LAST_PORT" ]; then
  ZOREON_PORT="$LAST_PORT"
  zoreon_info "Reusing port ${ZOREON_PORT} from $STATE_FILE"
else
  ZOREON_PORT="$DEFAULT_PORT"
fi

case "$ZOREON_PORT" in
  ''|*[!0-9]*) zoreon_error "Invalid port: ${ZOREON_PORT}" ;;
esac
if [ "$ZOREON_PORT" -lt 1 ] || [ "$ZOREON_PORT" -gt 65535 ]; then
  zoreon_error "Port out of range: ${ZOREON_PORT}"
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
  zoreon_banner "Zoreon dry run" "no changes"
  zoreon_kv "Target" "${USER}@${HOST}"
  zoreon_kv "Port" "$ZOREON_PORT"
  zoreon_kv "Builder" "$BUILDER"
  zoreon_kv "Unit" "$SERVICE_NAME.service"
  zoreon_kv "Image" "$IMAGE_NAME"
  echo ""
  zoreon_info "Would: rsync → ${BUILDER} build → systemd ${SERVICE_NAME} on :${ZOREON_PORT}"
  exit 0
fi

zoreon_banner "Zoreon remote deploy" "${GIT_VERSION} (${GIT_COMMIT}) → ${USER}@${HOST}"
zoreon_kv "Target" "${USER}@${HOST}"
zoreon_kv "Port" "$ZOREON_PORT"
zoreon_kv "Builder" "$BUILDER"
echo ""

REMOTE_HOME="$(_ssh 'printf %s "$HOME"')"
REMOTE_DIR="${REMOTE_HOME}/${REMOTE_DIR_NAME}"

if $UNINSTALL_MODE; then
  zoreon_banner "Zoreon uninstall" "${USER}@${HOST}"
  zoreon_step "Removing ${SERVICE_NAME} / ${PROXY_SERVICE_NAME} / ${CONTAINER_NAME} / ${DB_CONTAINER_NAME}"
  _ssh "
    set -euo pipefail
    $SUDO systemctl stop ${PROXY_SERVICE_NAME} 2>/dev/null || true
    $SUDO systemctl disable ${PROXY_SERVICE_NAME} 2>/dev/null || true
    $SUDO rm -f /etc/systemd/system/${PROXY_SERVICE_NAME}.service
    $SUDO systemctl stop ${SERVICE_NAME} 2>/dev/null || true
    $SUDO systemctl disable ${SERVICE_NAME} 2>/dev/null || true
    $SUDO rm -f /etc/systemd/system/${SERVICE_NAME}.service
    $SUDO systemctl daemon-reload 2>/dev/null || true
    $SUDO ${BUILDER} rm -f ${CONTAINER_NAME} 2>/dev/null || true
    $SUDO ${BUILDER} rm -f ${DB_CONTAINER_NAME} 2>/dev/null || true
    $SUDO ${BUILDER} network rm ${NETWORK_NAME} 2>/dev/null || true
    $SUDO ${BUILDER} rmi ${IMAGE_NAME} 2>/dev/null || true
    rm -rf '${REMOTE_DIR}'
  "
  zoreon_info "Zoreon removed from ${HOST} (Postgres volume ${PG_VOLUME_NAME} / legacy ${LEGACY_PG_VOLUME_NAME} kept if present)"
  exit 0
fi

zoreon_step "SSH preflight"
_ssh "command -v ${BUILDER} >/dev/null" \
  || zoreon_error "${BUILDER} not found on ${HOST} (install podman or set BUILDER=docker)"
_ssh "$SUDO true" || zoreon_error "passwordless sudo required for ${USER} on ${HOST}"
zoreon_info "ssh + ${BUILDER} + sudo OK"

LEGACY_REMOTE_DIR="${REMOTE_HOME}/${LEGACY_REMOTE_DIR_NAME}"
zoreon_step "Migrate legacy Agora units/secrets if present"
_ssh "
  set -euo pipefail
  # Stop old agora app units so :${ZOREON_PORT} / upstream can be claimed by zoreon.
  $SUDO systemctl stop ${LEGACY_PROXY_SERVICE_NAME} 2>/dev/null || true
  $SUDO systemctl disable ${LEGACY_PROXY_SERVICE_NAME} 2>/dev/null || true
  $SUDO rm -f /etc/systemd/system/${LEGACY_PROXY_SERVICE_NAME}.service
  $SUDO systemctl stop ${LEGACY_SERVICE_NAME} 2>/dev/null || true
  $SUDO systemctl disable ${LEGACY_SERVICE_NAME} 2>/dev/null || true
  $SUDO rm -f /etc/systemd/system/${LEGACY_SERVICE_NAME}.service
  $SUDO ${BUILDER} rm -f ${LEGACY_CONTAINER_NAME} 2>/dev/null || true
  $SUDO systemctl daemon-reload 2>/dev/null || true
  mkdir -p '${REMOTE_DIR}/tls'
  if [ -d '${LEGACY_REMOTE_DIR}/tls' ]; then
    for f in cert.pem key.pem auth.secret db.secret mm.token; do
      if [ -f '${LEGACY_REMOTE_DIR}/tls/'\"\$f\" ] && [ ! -f '${REMOTE_DIR}/tls/'\"\$f\" ]; then
        cp -a '${LEGACY_REMOTE_DIR}/tls/'\"\$f\" '${REMOTE_DIR}/tls/'\"\$f\"
      fi
    done
  fi
"
zoreon_info "legacy cleanup + tls carry-forward done"

zoreon_step "Sync sources → ${REMOTE_DIR}"
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
  --exclude 'tls/' \
  "${REPO_DIR}/" "${USER}@${HOST}:${REMOTE_DIR}/"
zoreon_info "sources synced"

zoreon_step "Build image ${IMAGE_NAME}"
_ssh "
  set -euo pipefail
  cd '${REMOTE_DIR}'
  $SUDO ${BUILDER} build -t ${IMAGE_NAME} .
"
zoreon_info "image built"

zoreon_step "TLS cert + auth/db secrets"
PUBLIC_ORIGIN="https://${HOST}:${ZOREON_PORT}"
_ssh "
  set -euo pipefail
  mkdir -p '${REMOTE_DIR}/tls'
  if [ ! -f '${REMOTE_DIR}/tls/cert.pem' ] || [ ! -f '${REMOTE_DIR}/tls/key.pem' ]; then
    openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
      -keyout '${REMOTE_DIR}/tls/key.pem' \
      -out '${REMOTE_DIR}/tls/cert.pem' \
      -subj '/CN=${HOST}' \
      -addext 'subjectAltName=IP:${HOST},DNS:${HOST}' 2>/dev/null \
    || openssl req -x509 -newkey rsa:2048 -sha256 -days 825 -nodes \
      -keyout '${REMOTE_DIR}/tls/key.pem' \
      -out '${REMOTE_DIR}/tls/cert.pem' \
      -subj '/CN=${HOST}'
  fi
  if [ ! -f '${REMOTE_DIR}/tls/auth.secret' ]; then
    openssl rand -hex 32 > '${REMOTE_DIR}/tls/auth.secret'
  fi
  if [ ! -f '${REMOTE_DIR}/tls/db.secret' ]; then
    openssl rand -hex 24 > '${REMOTE_DIR}/tls/db.secret'
  fi
  chmod 600 '${REMOTE_DIR}/tls/key.pem' '${REMOTE_DIR}/tls/auth.secret' '${REMOTE_DIR}/tls/db.secret'
  chmod +x '${REMOTE_DIR}/scripts/zoreon-https-proxy.py' '${REMOTE_DIR}/scripts/docker-entrypoint.sh'
  if [ -f '${REMOTE_DIR}/tls/mm.token' ]; then chmod 600 '${REMOTE_DIR}/tls/mm.token'; fi
"
AUTH_SECRET="$(_ssh "tr -d '\n' < '${REMOTE_DIR}/tls/auth.secret'")"
DB_PASS="$(_ssh "tr -d '\n' < '${REMOTE_DIR}/tls/db.secret'")"
# URL-encode is unnecessary: secret is hex only.
# Detect whether we still run on a legacy agora volume (user/db = agora).
PG_META="$(_ssh "
  set -euo pipefail
  VOL='${PG_VOLUME_NAME}'
  USERNAME=zoreon
  DBNAME=zoreon
  if $SUDO ${BUILDER} volume inspect '${LEGACY_PG_VOLUME_NAME}' >/dev/null 2>&1; then
    if ! $SUDO ${BUILDER} volume inspect '${PG_VOLUME_NAME}' >/dev/null 2>&1; then
      VOL='${LEGACY_PG_VOLUME_NAME}'
      USERNAME=agora
      DBNAME=agora
    fi
  fi
  # Rename legacy DB container if needed
  if $SUDO ${BUILDER} inspect '${LEGACY_DB_CONTAINER_NAME}' >/dev/null 2>&1 \
     && ! $SUDO ${BUILDER} inspect '${DB_CONTAINER_NAME}' >/dev/null 2>&1; then
    $SUDO ${BUILDER} rename '${LEGACY_DB_CONTAINER_NAME}' '${DB_CONTAINER_NAME}' || true
  fi
  # Prefer zoreon-net; create if missing
  $SUDO ${BUILDER} network inspect '${NETWORK_NAME}' >/dev/null 2>&1 \
    || $SUDO ${BUILDER} network create '${NETWORK_NAME}'
  printf '%s %s %s' \"\$VOL\" \"\$USERNAME\" \"\$DBNAME\"
")"
PG_VOL="$(printf '%s' "$PG_META" | awk '{print $1}')"
PG_USER="$(printf '%s' "$PG_META" | awk '{print $2}')"
PG_DB="$(printf '%s' "$PG_META" | awk '{print $3}')"
DATABASE_URL="postgres://${PG_USER}:${DB_PASS}@${DB_CONTAINER_NAME}:5432/${PG_DB}"
if [ "$PG_VOL" = "$LEGACY_PG_VOLUME_NAME" ]; then
  zoreon_warn "Using legacy volume ${LEGACY_PG_VOLUME_NAME} (user/db ${PG_USER}). New installs use ${PG_VOLUME_NAME}."
fi
MM_TOKEN="$(_ssh "if [ -f '${REMOTE_DIR}/tls/mm.token' ]; then tr -d '\n' < '${REMOTE_DIR}/tls/mm.token'; fi")"
if [ -z "$MM_TOKEN" ] && [ -n "${MATTERMOST_TOKEN:-}" ]; then
  MM_TOKEN="$MATTERMOST_TOKEN"
fi
zoreon_info "TLS + secrets ready (${PUBLIC_ORIGIN})"

zoreon_step "Postgres ${DB_CONTAINER_NAME} on ${NETWORK_NAME} (volume ${PG_VOL})"
_ssh "
  set -euo pipefail
  $SUDO ${BUILDER} network inspect ${NETWORK_NAME} >/dev/null 2>&1 \
    || $SUDO ${BUILDER} network create ${NETWORK_NAME}
  if $SUDO ${BUILDER} inspect ${LEGACY_DB_CONTAINER_NAME} >/dev/null 2>&1 \
     && ! $SUDO ${BUILDER} inspect ${DB_CONTAINER_NAME} >/dev/null 2>&1; then
    $SUDO ${BUILDER} rename ${LEGACY_DB_CONTAINER_NAME} ${DB_CONTAINER_NAME} || true
  fi
  if ! $SUDO ${BUILDER} inspect ${DB_CONTAINER_NAME} >/dev/null 2>&1; then
    $SUDO ${BUILDER} run -d --name ${DB_CONTAINER_NAME} --network ${NETWORK_NAME} \
      --restart=always \
      -e POSTGRES_USER=${PG_USER} \
      -e POSTGRES_PASSWORD='${DB_PASS}' \
      -e POSTGRES_DB=${PG_DB} \
      -v ${PG_VOL}:/var/lib/postgresql/data \
      ${DB_IMAGE}
  else
    $SUDO ${BUILDER} start ${DB_CONTAINER_NAME} >/dev/null 2>&1 || true
    # Ensure DB is on the zoreon network
    $SUDO ${BUILDER} network connect ${NETWORK_NAME} ${DB_CONTAINER_NAME} 2>/dev/null || true
  fi
  for _ in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    if $SUDO ${BUILDER} exec ${DB_CONTAINER_NAME} pg_isready -U ${PG_USER} -d ${PG_DB} >/dev/null 2>&1; then
      exit 0
    fi
    sleep 1
  done
  echo '${DB_CONTAINER_NAME} not ready' >&2
  exit 1
"
zoreon_info "${DB_CONTAINER_NAME} ready"

zoreon_step "Install systemd ${SERVICE_NAME} + ${PROXY_SERVICE_NAME}"
UNIT_TMP="$(mktemp)"
PROXY_TMP="$(mktemp)"
trap 'rm -f "$UNIT_TMP" "$PROXY_TMP"' EXIT

MM_URL="${MATTERMOST_URL:-}"
MM_ENV_ARGS=""
if [ -n "$MM_URL" ]; then
  MM_ENV_ARGS="--env MATTERMOST_URL=${MM_URL}"
  zoreon_info "Mattermost URL wired (${MM_URL})"
else
  zoreon_warn "MATTERMOST_URL unset — set it to point at your Mattermost tape"
fi
if [ -n "${MM_TOKEN:-}" ]; then
  MM_ENV_ARGS="${MM_ENV_ARGS} --env MATTERMOST_TOKEN=${MM_TOKEN}"
  zoreon_info "Mattermost token wired (messaging via tape)"
else
  zoreon_warn "No tls/mm.token — Zoreon keeps local SQL messaging (probe only)"
fi

# --- SMTP (zyvor-web contact-mailer.env) --------------------------------------
SMTP_ENV_ARGS=""
SMTP_ENV_FILE="${ZOREON_SMTP_ENV:-$HOME/tt/zyvor-web/contact-mailer.env}"
SMTP_HOST_V="" SMTP_PORT_V="587" SMTP_FROM_V="" SMTP_USER_V="" SMTP_PASS_V="" SMTP_TLS_V="true"
if [ -f "$SMTP_ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a
  # Only pull SMTP_* keys (ignore Razorpay / Slack / etc.)
  # shellcheck disable=SC1091
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      SMTP_*=*) eval "$line" ;;
    esac
  done < <(grep -E '^SMTP_[A-Z0-9_]+=' "$SMTP_ENV_FILE" || true)
  set +a
  SMTP_HOST_V="${SMTP_HOST:-}"
  SMTP_PORT_V="${SMTP_PORT:-587}"
  SMTP_FROM_V="${SMTP_FROM:-}"
  SMTP_USER_V="${SMTP_USER:-${SMTP_USERNAME:-}}"
  SMTP_PASS_V="${SMTP_PASS:-${SMTP_PASSWORD:-}}"
  SMTP_TLS_V="${SMTP_USE_TLS:-true}"
fi
if [ -n "$SMTP_HOST_V" ] && [ -n "$SMTP_FROM_V" ] && [ -n "$SMTP_USER_V" ] && [ -n "$SMTP_PASS_V" ]; then
  # Persist on lab (mode 600) for restarts without local file
  SMTP_REMOTE_TMP="$(mktemp)"
  cat >"$SMTP_REMOTE_TMP" <<SMTPEOF
SMTP_HOST=${SMTP_HOST_V}
SMTP_PORT=${SMTP_PORT_V}
SMTP_FROM=${SMTP_FROM_V}
SMTP_USER=${SMTP_USER_V}
SMTP_PASS=${SMTP_PASS_V}
SMTP_USE_TLS=${SMTP_TLS_V}
SMTPEOF
  scp "${DEPLOY_SSH_OPTS[@]}" "$SMTP_REMOTE_TMP" "${USER}@${HOST}:/tmp/zoreon-smtp.env"
  rm -f "$SMTP_REMOTE_TMP"
  _ssh "
    set -euo pipefail
    $SUDO mv /tmp/zoreon-smtp.env '${REMOTE_DIR}/tls/smtp.env'
    $SUDO chmod 600 '${REMOTE_DIR}/tls/smtp.env'
    $SUDO chown ${USER}:${USER} '${REMOTE_DIR}/tls/smtp.env' 2>/dev/null || true
  "
  SMTP_ENV_ARGS="--env SMTP_HOST=${SMTP_HOST_V} --env SMTP_PORT=${SMTP_PORT_V} --env SMTP_FROM=${SMTP_FROM_V} --env SMTP_USER=${SMTP_USER_V} --env SMTP_PASS=${SMTP_PASS_V} --env SMTP_USE_TLS=${SMTP_TLS_V}"
  zoreon_info "SMTP wired from ${SMTP_ENV_FILE} (host=${SMTP_HOST_V} from=${SMTP_FROM_V})"
else
  # Fall back to previously deployed remote secret
  REMOTE_SMTP="$(_ssh "if [ -f '${REMOTE_DIR}/tls/smtp.env' ]; then cat '${REMOTE_DIR}/tls/smtp.env'; fi" || true)"
  if [ -n "$REMOTE_SMTP" ]; then
    SMTP_HOST_V="$(printf '%s\n' "$REMOTE_SMTP" | sed -n 's/^SMTP_HOST=//p' | head -1)"
    SMTP_PORT_V="$(printf '%s\n' "$REMOTE_SMTP" | sed -n 's/^SMTP_PORT=//p' | head -1)"
    SMTP_FROM_V="$(printf '%s\n' "$REMOTE_SMTP" | sed -n 's/^SMTP_FROM=//p' | head -1)"
    SMTP_USER_V="$(printf '%s\n' "$REMOTE_SMTP" | sed -n 's/^SMTP_USER=//p' | head -1)"
    SMTP_PASS_V="$(printf '%s\n' "$REMOTE_SMTP" | sed -n 's/^SMTP_PASS=//p' | head -1)"
    SMTP_TLS_V="$(printf '%s\n' "$REMOTE_SMTP" | sed -n 's/^SMTP_USE_TLS=//p' | head -1)"
    SMTP_PORT_V="${SMTP_PORT_V:-587}"
    SMTP_TLS_V="${SMTP_TLS_V:-true}"
    if [ -n "$SMTP_HOST_V" ] && [ -n "$SMTP_FROM_V" ] && [ -n "$SMTP_USER_V" ] && [ -n "$SMTP_PASS_V" ]; then
      SMTP_ENV_ARGS="--env SMTP_HOST=${SMTP_HOST_V} --env SMTP_PORT=${SMTP_PORT_V} --env SMTP_FROM=${SMTP_FROM_V} --env SMTP_USER=${SMTP_USER_V} --env SMTP_PASS=${SMTP_PASS_V} --env SMTP_USE_TLS=${SMTP_TLS_V}"
      zoreon_info "SMTP wired from remote tls/smtp.env (host=${SMTP_HOST_V})"
    fi
  fi
  if [ -z "$SMTP_ENV_ARGS" ]; then
    zoreon_warn "No SMTP — invite Send stays mailto-only (set ZOREON_SMTP_ENV or ${HOME}/tt/zyvor-web/contact-mailer.env)"
  fi
fi

cat >"$UNIT_TMP" <<EOF
[Unit]
Description=Zoreon (podman)
Documentation=https://zyvor.dev/
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
Restart=always
RestartSec=3
TimeoutStartSec=180
ExecStartPre=-/usr/bin/${BUILDER} rm -f ${CONTAINER_NAME}
ExecStart=/usr/bin/${BUILDER} run --name ${CONTAINER_NAME} --network ${NETWORK_NAME} --publish 127.0.0.1:${UPSTREAM_PORT}:8080 --env HOST=0.0.0.0 --env PORT=8080 --env BETTER_AUTH_URL=${PUBLIC_ORIGIN} --env BETTER_AUTH_SECRET=${AUTH_SECRET} --env DATABASE_URL=${DATABASE_URL} ${MM_ENV_ARGS} ${SMTP_ENV_ARGS} ${IMAGE_NAME}
ExecStop=/usr/bin/${BUILDER} stop -t 15 ${CONTAINER_NAME}

[Install]
WantedBy=multi-user.target
EOF

cat >"$PROXY_TMP" <<EOF
[Unit]
Description=Zoreon HTTPS proxy
After=network-online.target ${SERVICE_NAME}.service
Wants=network-online.target
Requires=${SERVICE_NAME}.service

[Service]
Type=simple
Restart=always
RestartSec=2
WorkingDirectory=${REMOTE_DIR}
ExecStart=/usr/bin/python3 ${REMOTE_DIR}/scripts/zoreon-https-proxy.py --port ${ZOREON_PORT} --upstream-port ${UPSTREAM_PORT} --cert ${REMOTE_DIR}/tls/cert.pem --key ${REMOTE_DIR}/tls/key.pem

[Install]
WantedBy=multi-user.target
EOF

scp "${DEPLOY_SSH_OPTS[@]}" "$UNIT_TMP" "${USER}@${HOST}:/tmp/${SERVICE_NAME}.service"
scp "${DEPLOY_SSH_OPTS[@]}" "$PROXY_TMP" "${USER}@${HOST}:/tmp/${PROXY_SERVICE_NAME}.service"
_ssh "
  set -euo pipefail
  command -v python3 >/dev/null
  command -v openssl >/dev/null
  $SUDO mv /tmp/${SERVICE_NAME}.service /etc/systemd/system/${SERVICE_NAME}.service
  $SUDO mv /tmp/${PROXY_SERVICE_NAME}.service /etc/systemd/system/${PROXY_SERVICE_NAME}.service
  $SUDO systemctl daemon-reload
  $SUDO systemctl enable ${SERVICE_NAME} ${PROXY_SERVICE_NAME}
  $SUDO systemctl restart ${SERVICE_NAME}
  sleep 2
  $SUDO systemctl restart ${PROXY_SERVICE_NAME}
  if command -v firewall-cmd >/dev/null 2>&1; then
    $SUDO firewall-cmd --permanent --add-port=${ZOREON_PORT}/tcp 2>/dev/null || true
    $SUDO firewall-cmd --reload 2>/dev/null || true
  elif command -v ufw >/dev/null 2>&1; then
    $SUDO ufw allow ${ZOREON_PORT}/tcp 2>/dev/null || true
  fi
  sleep 1
  $SUDO systemctl is-active ${SERVICE_NAME}
  $SUDO systemctl is-active ${PROXY_SERVICE_NAME}
"
zoreon_info "${SERVICE_NAME} + TLS proxy active on :${ZOREON_PORT}"

zoreon_save_deploy_last "$REPO_DIR" "$HOST" "$USER" "$ZOREON_PORT"

if $SKIP_SMOKE; then
  zoreon_warn "Skipped smoke (--skip-smoke)"
else
  zoreon_step "Smoke ${PUBLIC_ORIGIN}/"
  ok=0
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if _ssh "curl -kfsS -o /dev/null --max-time 5 https://127.0.0.1:${ZOREON_PORT}/"; then
      ok=1
      break
    fi
    sleep 2
  done
  [ "$ok" = 1 ] || zoreon_error "health check failed (journalctl -u ${SERVICE_NAME} -u ${PROXY_SERVICE_NAME})"
  zoreon_info "UI OK on-host (HTTPS, self-signed)"
fi

echo ""
zoreon_banner "Deployed" "${PUBLIC_ORIGIN}/"
zoreon_kv "Login" "${PUBLIC_ORIGIN}/login"
zoreon_kv "Note" "Accept the self-signed cert warning once"
zoreon_kv "Service" "$SERVICE_NAME + $PROXY_SERVICE_NAME"
zoreon_kv "Logs" "ssh ${USER}@${HOST} '${SUDO} journalctl -u ${SERVICE_NAME} -u ${PROXY_SERVICE_NAME} -f'"
zoreon_kv "Uninstall" "./scripts/deploy-remote.sh ${HOST} ${USER} --uninstall"
echo ""
