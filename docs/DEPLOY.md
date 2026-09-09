# Remote deploy

Lab pattern: SSH → rsync → **podman** image build → **systemd** units (app + HTTPS proxy).

## Prerequisites (remote host)

- SSH key auth for the deploy user (default `sus`)
- Passwordless `sudo`
- `podman` (or set `BUILDER=docker`)

## Deploy

```bash
./scripts/deploy-remote.sh <host> [user] [--port 30591]
make deploy-remote H=<host> U=sus PORT=30591

# Optional Mattermost tape URL (token from remote tls/mm.token or MATTERMOST_TOKEN)
MATTERMOST_URL=http://zoreon.example.com:31722 ./scripts/deploy-remote.sh zoreon.example.com sus
```

| Artifact | Value |
| --- | --- |
| Staging | `~/.deployments/zoreon` (TLS carried from `~/.deployments/agora` once) |
| Image | `zoreon:latest` |
| Units | `zoreon.service` + `zoreon-https.service` |
| Public port | `30591` (HTTPS proxy) → upstream `127.0.0.1:13091` → container `8080` |
| State file | `.deploy-remote-last` (local, gitignored) |
| Postgres | legacy `agora-db` / `agora-pgdata` on `agora-net` |

## Secrets on the lab host

| File | Purpose |
| --- | --- |
| `~/.deployments/zoreon/tls/auth.secret` | `BETTER_AUTH_SECRET` |
| `~/.deployments/zoreon/tls/db.secret` | Postgres password |
| `~/.deployments/zoreon/tls/mm.token` | Mattermost admin PAT (tape) |
| `~/.deployments/zoreon/tls/smtp.env` | SMTP (written by deploy; mode 600) |
| `~/.deployments/zoreon/tls/cert.pem` + `key.pem` | Self-signed HTTPS for the proxy |

### SMTP (invite email)

Deploy reads Zoho settings from zyvor-web by default:

```bash
# Default path
~/tt/zyvor-web/contact-mailer.env

# Or override
ZOREON_SMTP_ENV=/path/to/smtp.env ./scripts/deploy-remote.sh zoreon.example.com sus
```

Accepted keys (zyvor-web or Zoreon names):

| Env | Notes |
| --- | --- |
| `SMTP_HOST` | e.g. `smtp.zoho.in` |
| `SMTP_PORT` | `587` (STARTTLS) or `465` |
| `SMTP_FROM` | From address |
| `SMTP_USERNAME` / `SMTP_USER` | Auth user |
| `SMTP_PASSWORD` / `SMTP_PASS` | App password |
| `SMTP_USE_TLS` | `true` for STARTTLS on 587 |

Only `SMTP_*` lines are imported (Razorpay / Slack / etc. in the same file are ignored). The container gets `SMTP_USER` / `SMTP_PASS`; `src/lib/zoreon/mail.server.ts` also accepts the zyvor-web aliases.

Without SMTP, **Invite people** still offers copy-link and mailto.

### Optional: Web Push

Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` on the container if you want push subscriptions (PWA service worker is always registered).

## Uninstall

```bash
./scripts/deploy-remote.sh <host> <user> --uninstall
# or reuse last host
./scripts/deploy-remote.sh --uninstall
```

## Verify

```bash
curl -kfsS -o /dev/null -w "%{http_code}\n" https://<host>:30591/
curl -kfsS -o /dev/null -w "%{http_code}\n" https://<host>:30591/login
curl -kfsS -o /dev/null -w "%{http_code}\n" https://<host>:30591/sw.js
curl -sk -o /dev/null -w "%{http_code}\n" "https://<host>:30591/api/rtc?room=t&peer=p1&name=t&since=0"
ssh <user>@<host> 'sudo systemctl is-active zoreon zoreon-https && sudo podman ps | grep zoreon'
ssh <user>@<host> 'sudo podman exec $(sudo podman ps -q -f name=zoreon) sh -c "echo SMTP_HOST=\$SMTP_HOST"'
```

## Current lab

| Service | URL |
| --- | --- |
| Zoreon | https://zoreon.example.com:30591/ |
| Mattermost | http://zoreon.example.com:31722/ (`/opt/mattermost-docker/`) |

Login (lab): use your Zyvor account or an invite from **Zoreon → Invite people**.
