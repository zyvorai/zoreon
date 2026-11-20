# Testing

How to verify Zoreon before and after deploy. Set `BASE_URL` yourself — no private hosts in this tree.

## A. Developer checks

```bash
npm install
npm run typecheck
npm test
npm run build
```

| Command | Intent |
| --- | --- |
| `typecheck` | TypeScript |
| `test` | Unit tests (`scripts/**/*.test.mjs` + selected `src/` tests) |
| `build` | Production Nitro/Vite build (migrations skip without `DATABASE_URL`) |

## B. HTTP smoke

```bash
export BASE_URL=http://localhost:8080   # or https://zoreon.example.com
./scripts/customer-smoke.sh
```

| Path | Expect |
| --- | --- |
| `/` | 200 |
| `/login` | 200 |
| `/sw.js` | 200 |
| `/__grok/manifest.webmanifest` | 200 |
| `/api/zoreon/events` | 401 (unauthenticated) |
| `/api/rtc?room=smoke&peer=p1&name=t&since=0` | 200 |

Non-zero exit on failure — safe for CI. HTTPS with self-signed certs: `CURL_OPTS=-k`.

### Playwright E2E

Needs a reachable app with Postgres (preview without `DATABASE_URL` falls back to PGLite and can fail in CI).

```bash
export DATABASE_URL=postgres://zoreon:…@127.0.0.1:5432/zoreon
export BETTER_AUTH_SECRET=…
export BETTER_AUTH_URL=http://127.0.0.1:8081
npm run build
node scripts/migrate.mjs
npx playwright install chromium   # once
npm run test:e2e                  # starts vite preview on :8081
```

### GitHub Actions

On every push/PR to `main` (`.github/workflows/ci.yml`):

1. **Unit** — typecheck, test, build (no DB)
2. **Smoke** — Postgres service → migrate → preview → `customer-smoke.sh`
3. **E2E** — Postgres service → migrate → Playwright (5 smoke specs)

## C. Browser acceptance

Sign in as a workspace admin ([CUSTOMER.md](CUSTOMER.md) bootstrap).

1. Login / join via invite  
2. Channel message + reaction + thread reply  
3. Star channel; bookmark / remind / pin  
4. Palette search: `from:` / `in:` / `has:`; save a search  
5. Channel **Mute** / **Mentions**  
6. **Invite people** — copy link; **Send** if SMTP configured  
7. **Workspace admin** — admins, retention, audit  
8. **Huddle** — mic/camera; leave  
9. Console — no React max-update-depth loops  

### Optional Mattermost

With `MATTERMOST_URL` + token: post appears on the tape; author matches the signed-in user (user access token path).

### Optional SMTP

Invite dialog **Send** enabled; deliver to a mailbox you control.

## D. Curl block

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

## Related

- [CUSTOMER.md](CUSTOMER.md) — deploy lifecycle  
- [OPERATIONS.md](OPERATIONS.md) — day-2 host smoke  
- [HELM.md](HELM.md) — cluster verify  
