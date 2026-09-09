# Testing

How organizations verify Zoreon before and after deploy. No private hosts — set `BASE_URL` yourself.

## A. Developer checks (before ship)

```bash
npm install
npm run typecheck
npm test
npm run build
```

| Command | Intent |
| --- | --- |
| `typecheck` | TypeScript |
| `test` | Unit tests under `scripts/**/*.test.mjs` and selected `src/` tests |
| `build` | Production Nitro/Vite build (migrations skipped without `DATABASE_URL`) |

## B. HTTP smoke (Compose or any deploy)

With the app reachable:

```bash
export BASE_URL=http://localhost:8080   # or https://zoreon.example.com
./scripts/customer-smoke.sh
```

The script checks:

| Path | Expect |
| --- | --- |
| `/` | 200 |
| `/login` | 200 |
| `/sw.js` | 200 |
| `/__grok/manifest.webmanifest` | 200 |
| `/api/zoreon/events` | 401 (unauthenticated) |
| `/api/rtc?room=smoke&peer=p1&name=t&since=0` | 200 |

Exit code non-zero on failure — safe to call from CI.

### Copy-paste curl block

```bash
BASE_URL="${BASE_URL:-http://localhost:8080}"
curl -fsS -o /dev/null -w "home:%{http_code}\n" "$BASE_URL/"
curl -fsS -o /dev/null -w "login:%{http_code}\n" "$BASE_URL/login"
curl -fsS -o /dev/null -w "sw:%{http_code}\n" "$BASE_URL/sw.js"
curl -fsS -o /dev/null -w "manifest:%{http_code}\n" "$BASE_URL/__grok/manifest.webmanifest"
curl -sS -o /dev/null -w "events:%{http_code}\n" "$BASE_URL/api/zoreon/events"
curl -sS -o /dev/null -w "rtc:%{http_code}\n" \
  "$BASE_URL/api/rtc?room=smoke&peer=p1&name=t&since=0"
```

For HTTPS with a self-signed cert, use `curl -k` or set `CURL_OPTS=-k`.

## C. Browser acceptance (product)

Sign in as a workspace admin (see [CUSTOMER.md](CUSTOMER.md) bootstrap).

1. Login / join via invite  
2. Send a channel message + emoji reaction + thread reply  
3. Star channel; bookmark / remind / pin a message  
4. Command palette: search with `from:` / `in:` / `has:`; save a search  
5. Channel **Mute** / **Mentions**  
6. **Invite people** — copy link; **Send** if SMTP is configured  
7. **Workspace admin** — admins list, retention UI, audit  
8. **Huddle** — allow mic/camera; leave huddle  
9. DevTools console — no React max-update-depth / crash loops  

### Optional Mattermost tape

If `MATTERMOST_URL` + token are set:

- Message appears in Mattermost  
- Author shows as the signed-in user (user access token path), not only the admin PAT  

### Optional SMTP

- Invite dialog shows Send enabled (not “SMTP not configured”)  
- Test send to a mailbox you control  

## D. CI snippet

```yaml
# example — adapt to your runner
- run: npm ci && npm run typecheck && npm test && npm run build
- run: docker compose up -d --build
- run: |
    for i in $(seq 1 30); do
      curl -fsS "$BASE_URL/login" && break
      sleep 2
    done
  env:
    BASE_URL: http://localhost:8080
- run: ./scripts/customer-smoke.sh
  env:
    BASE_URL: http://localhost:8080
```

## Related

- [CUSTOMER.md](CUSTOMER.md) — full lifecycle  
- [OPERATIONS.md](OPERATIONS.md) — day-2 host ops (advanced deploy)  
