# Operations

Day-2 notes for the public **[zyvorai/zoreon](https://github.com/zyvorai/zoreon)** lab / self-host.

## Lab endpoints

| Service | URL |
| --- | --- |
| Zoreon | https://zoreon.example.com:30591/ |
| Mattermost tape | http://zoreon.example.com:31722/ |

Accept the self-signed cert warning once in the browser.

## Secrets layout (lab host)

Under `~/.deployments/zoreon/tls/`:

| File | Purpose |
| --- | --- |
| `auth.secret` | `BETTER_AUTH_SECRET` |
| `db.secret` | Postgres password |
| `mm.token` | Mattermost admin PAT |
| `smtp.env` | SMTP (written by deploy; mode 600) |
| `cert.pem` / `key.pem` | HTTPS proxy |

Postgres container/volume names remain `agora-db` / `agora-pgdata` / network `agora-net` (pre-rename). Do not rename on a live lab without a migration plan.

## Units

```bash
sudo systemctl status zoreon zoreon-https
sudo journalctl -u zoreon -u zoreon-https -f
sudo podman ps --filter name=zoreon
```

## Smoke checklist

```bash
HOST=zoreon.example.com
PORT=30591
BASE=https://${HOST}:${PORT}

curl -kfsS -o /dev/null -w "home:%{http_code}\n" "$BASE/"
curl -kfsS -o /dev/null -w "login:%{http_code}\n" "$BASE/login"
curl -kfsS -o /dev/null -w "sw:%{http_code}\n" "$BASE/sw.js"
curl -kfsS -o /dev/null -w "manifest:%{http_code}\n" "$BASE/__grok/manifest.webmanifest"
curl -sk -o /dev/null -w "events:%{http_code}\n" "$BASE/api/zoreon/events"   # expect 401 unauth
curl -sk -o /dev/null -w "rtc:%{http_code}\n" "$BASE/api/rtc?room=t&peer=p1&name=t&since=0"

ssh sus@${HOST} 'sudo podman exec $(sudo podman ps -q -f name=zoreon) \
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
./scripts/deploy-remote.sh zoreon.example.com sus --port 30591
```

## Uninstall app units (keeps Postgres volume)

```bash
./scripts/deploy-remote.sh zoreon.example.com sus --uninstall
```

## Related

- [ENV.md](ENV.md) — variable reference
- [DEPLOY.md](DEPLOY.md) — deploy script details
- [ARCHITECTURE.md](ARCHITECTURE.md) — product planes
