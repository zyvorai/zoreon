# Operations

Day-2 notes for self-hosted **[Zoreon](https://github.com/zyvorai/zoreon)**.

## Secrets layout

Under `~/.deployments/zoreon/tls/` on the app host:

| File | Purpose |
| --- | --- |
| `auth.secret` | `BETTER_AUTH_SECRET` |
| `db.secret` | Postgres password |
| `mm.token` | Mattermost admin PAT |
| `smtp.env` | SMTP (written by deploy; mode 600) |
| `cert.pem` / `key.pem` | HTTPS proxy |

Postgres defaults to **`zoreon-db` / `zoreon-net` / `zoreon-pgdata`**. If a legacy `agora-db` container or `agora-pgdata` volume is present, deploy renames/reuses them and keeps the in-volume `agora` DB user so existing data stays intact. Greenfield installs use the `zoreon` DB user.

## Units

```bash
sudo systemctl status zoreon zoreon-https
sudo journalctl -u zoreon -u zoreon-https -f
sudo podman ps --filter name=zoreon
```

## Smoke checklist

Replace `<host>`, `<user>`, and `<port>` with your deployment values.

```bash
HOST=<host>
USER=<user>
PORT=<port>   # default HTTPS proxy port is 30591
BASE=https://${HOST}:${PORT}

curl -kfsS -o /dev/null -w "home:%{http_code}\n" "$BASE/"
curl -kfsS -o /dev/null -w "login:%{http_code}\n" "$BASE/login"
curl -kfsS -o /dev/null -w "sw:%{http_code}\n" "$BASE/sw.js"
curl -kfsS -o /dev/null -w "manifest:%{http_code}\n" "$BASE/__grok/manifest.webmanifest"
curl -sk -o /dev/null -w "events:%{http_code}\n" "$BASE/api/zoreon/events"   # expect 401 unauth
curl -sk -o /dev/null -w "rtc:%{http_code}\n" "$BASE/api/rtc?room=t&peer=p1&name=t&since=0"

ssh ${USER}@${HOST} 'sudo podman exec $(sudo podman ps -q -f name=zoreon) \
  sh -c "echo SMTP_HOST=\$SMTP_HOST FROM=\$SMTP_FROM USER=\${SMTP_USER:+set}"'
```

Browser (signed-in admin):

1. Send a message (authorship should show your tape user when MM tokens work).
2. **Invite people** → Send email (SMTP) or copy link.
3. **Workspace admin** → admins / retention / audit.
4. Search palette: `from:` / `in:` / saved searches.
5. Channel **Huddle** (allow mic/camera).
6. Confirm no React max-update-depth errors in the console.

## Redeploy

```bash
git clone https://github.com/zyvorai/zoreon.git   # or pull in an existing checkout
cd zoreon
./scripts/deploy-remote.sh <host> <user> --port 30591
```

## Uninstall app units (keeps Postgres volume)

```bash
./scripts/deploy-remote.sh <host> <user> --uninstall
```

## Related

- [ENV.md](ENV.md) — variable reference
- [DEPLOY.md](DEPLOY.md) — deploy script details
- [ARCHITECTURE.md](ARCHITECTURE.md) — product planes
