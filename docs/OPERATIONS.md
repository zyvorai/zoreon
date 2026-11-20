# Operations

Day-2 notes for self-hosted **[Zoreon](https://github.com/zyvorai/zoreon)** on the advanced podman/systemd path. Compose day-2 is in [CUSTOMER.md](CUSTOMER.md).

## Secrets layout

Under `~/.deployments/zoreon/tls/` on the app host:

| File | Purpose |
| --- | --- |
| `auth.secret` | `BETTER_AUTH_SECRET` |
| `db.secret` | Postgres password |
| `mm.token` | Mattermost admin PAT |
| `smtp.env` | SMTP (mode 600) |
| `cert.pem` / `key.pem` | HTTPS proxy |

Postgres defaults: **`zoreon-db` / `zoreon-net` / `zoreon-pgdata`**. Legacy `agora-*` is renamed or reused on deploy; in-volume `agora` user/db is kept when that volume is still mounted. Greenfield installs use the `zoreon` DB user.

## Units

```bash
sudo systemctl status zoreon zoreon-https
sudo journalctl -u zoreon -u zoreon-https -f
sudo podman ps --filter name=zoreon
```

## Smoke checklist

```bash
HOST=<host>
USER=<user>
PORT=<port>   # default HTTPS proxy port is 30591
BASE=https://${HOST}:${PORT}

curl -kfsS -o /dev/null -w "home:%{http_code}\n" "$BASE/"
curl -kfsS -o /dev/null -w "login:%{http_code}\n" "$BASE/login"
curl -kfsS -o /dev/null -w "sw:%{http_code}\n" "$BASE/sw.js"
curl -kfsS -o /dev/null -w "manifest:%{http_code}\n" "$BASE/__grok/manifest.webmanifest"
curl -sk -o /dev/null -w "events:%{http_code}\n" "$BASE/api/zoreon/events"   # expect 401
curl -sk -o /dev/null -w "rtc:%{http_code}\n" "$BASE/api/rtc?room=t&peer=p1&name=t&since=0"

# Or:
# BASE_URL=$BASE CURL_OPTS=-k ./scripts/customer-smoke.sh

ssh ${USER}@${HOST} 'sudo podman exec $(sudo podman ps -q -f name=zoreon) \
  sh -c "echo SMTP_HOST=\$SMTP_HOST FROM=\$SMTP_FROM USER=\${SMTP_USER:+set}"'
```

Browser (signed-in admin):

1. Send a message (authorship should match your tape user when MM tokens work).
2. **Invite people** → Send email (SMTP) or copy link.
3. **Workspace admin** → admins / retention / audit.
4. Search palette: `from:` / `in:` / saved searches.
5. Channel **Huddle** (allow mic/camera).
6. Console — no React max-update-depth errors.

Full product checklist: [TESTING.md](TESTING.md).

## Redeploy

```bash
git clone https://github.com/zyvorai/zoreon.git   # or pull
cd zoreon
./scripts/deploy-remote.sh <host> <user> --port 30591
```

## Uninstall app units (keeps Postgres volume)

```bash
./scripts/deploy-remote.sh <host> <user> --uninstall
```

## Related

- [ENV.md](ENV.md) — variables  
- [DEPLOY.md](DEPLOY.md) — deploy script  
- [ARCHITECTURE.md](ARCHITECTURE.md) — planes  
- [CUSTOMER.md](CUSTOMER.md) — Compose path  
- [HELM.md](HELM.md) — Kubernetes  
