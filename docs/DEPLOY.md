# Remote deploy (advanced)

> **Most organizations should start with Docker Compose** — [CUSTOMER.md](CUSTOMER.md).  
> **Kubernetes:** [HELM.md](HELM.md).  
> This page: SSH → rsync → **podman** image build → **systemd** (app + HTTPS proxy) on one Linux host.

## Prerequisites (remote host)

- SSH key auth for the deploy user
- Passwordless `sudo`
- `podman` (or `BUILDER=docker`)

## Deploy

```bash
git clone https://github.com/zyvorai/zoreon.git
cd zoreon

./scripts/deploy-remote.sh <host> [user] [--port 30591]
make deploy-remote H=<host> U=<user> PORT=30591

# Optional Mattermost tape (token from remote tls/mm.token or MATTERMOST_TOKEN)
MATTERMOST_URL=https://mattermost.example.com ./scripts/deploy-remote.sh <host> <user>
```

| Artifact | Value |
| --- | --- |
| Staging | `~/.deployments/zoreon` (TLS carried once from `~/.deployments/agora` if present) |
| Image | `zoreon:latest` |
| Units | `zoreon.service` + `zoreon-https.service` |
| Public port | `30591` (HTTPS proxy, default) → loopback upstream → container `8080` |
| State file | `.deploy-remote-last` (local, gitignored) |
| Postgres | `zoreon-db` / `zoreon-pgdata` / `zoreon-net` |

### Volume migration

Defaults are **`zoreon-*`**. If a legacy `agora-db` container or `agora-pgdata` volume exists and the new names do not, deploy renames/reuses them and keeps the in-volume `agora` DB user so existing data stays intact. Greenfield hosts use the `zoreon` DB user.

## Secrets on the host

| File | Purpose |
| --- | --- |
| `~/.deployments/zoreon/tls/auth.secret` | `BETTER_AUTH_SECRET` |
| `~/.deployments/zoreon/tls/db.secret` | Postgres password |
| `~/.deployments/zoreon/tls/mm.token` | Mattermost admin PAT |
| `~/.deployments/zoreon/tls/smtp.env` | SMTP (mode 600) |
| `~/.deployments/zoreon/tls/cert.pem` + `key.pem` | Self-signed HTTPS for the proxy |

Full env reference: [ENV.md](ENV.md).

### SMTP

Prefer Compose `.env` for greenfield. For this script:

```bash
ZOREON_SMTP_ENV=/path/to/smtp.env ./scripts/deploy-remote.sh <host> <user>
```

| Env | Notes |
| --- | --- |
| `SMTP_HOST` | Provider host |
| `SMTP_PORT` | `587` or `465` |
| `SMTP_FROM` | From address |
| `SMTP_USERNAME` / `SMTP_USER` | Auth user |
| `SMTP_PASSWORD` / `SMTP_PASS` | App password |
| `SMTP_USE_TLS` | `true` for STARTTLS on 587 |

Without SMTP, **Invite people** still offers copy-link and mailto.

### Web Push

Set `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` on the container when you want push (SW always registers).

## Uninstall

```bash
./scripts/deploy-remote.sh <host> <user> --uninstall
./scripts/deploy-remote.sh --uninstall   # reuse .deploy-remote-last
```

Keeps the Postgres volume unless you remove it manually.

## Verify

```bash
curl -kfsS -o /dev/null -w "%{http_code}\n" https://<host>:30591/
curl -kfsS -o /dev/null -w "%{http_code}\n" https://<host>:30591/login
curl -kfsS -o /dev/null -w "%{http_code}\n" https://<host>:30591/sw.js
curl -sk -o /dev/null -w "%{http_code}\n" "https://<host>:30591/api/rtc?room=t&peer=p1&name=t&since=0"
ssh <user>@<host> 'sudo systemctl is-active zoreon zoreon-https && sudo podman ps | grep zoreon'
```

Or: `BASE_URL=https://<host>:30591 CURL_OPTS=-k ./scripts/customer-smoke.sh`

Day-2: [OPERATIONS.md](OPERATIONS.md).
