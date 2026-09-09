# Zoreon

Zyvor ops chat for infrastructure programs — war rooms, threads, huddles, and cutover runbooks.

**Mattermost is the tape; Zoreon is the product.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Repo:** https://github.com/zyvorai/zoreon

Better Auth owns login. Mattermost (when wired) stores channel history; Zoreon adds invites, admin, search, notifications, PWA, and A/V huddles on its own Postgres.

## Docs

| Doc | Contents |
| --- | --- |
| [docs/CUSTOMER.md](docs/CUSTOMER.md) | **Organizations** — code, Compose deploy, bootstrap, TLS |
| [docs/HELM.md](docs/HELM.md) | Kubernetes Helm chart |
| [docs/TESTING.md](docs/TESTING.md) | Unit / HTTP smoke / Playwright / browser acceptance |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Product model, data planes, realtime, huddles |
| [docs/ENV.md](docs/ENV.md) | Environment variables |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Advanced — podman/systemd single-host script |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Advanced — day-2 host ops |

## Quick start

```bash
git clone https://github.com/zyvorai/zoreon.git
cd zoreon
npm install
npm run dev
```

Binds all interfaces on port `8080`. Open `/login` (also `/signin`).

**Self-host (recommended for customers):** copy `.env.example` → `.env`, set secrets + `ZOREON_BOOTSTRAP_ADMIN_EMAIL`, then `docker compose up -d --build`. Full path: [docs/CUSTOMER.md](docs/CUSTOMER.md).

## Sign-in & invites

| Path | What |
| --- | --- |
| `/login` · `/signin` | Email/password or Google / X |
| `/join?token=…` | Create account from invite |
| **Zoreon → Invite people** | Multi-use link, SMTP send, or mailto |
| `/api/auth/*` | Better Auth |

Admins generate invites from the menu. SMTP Send works when `SMTP_*` is set — see [docs/CUSTOMER.md](docs/CUSTOMER.md) and [docs/ENV.md](docs/ENV.md).

## Product surface

| Area | Notes |
| --- | --- |
| Channels / DMs / threads | Mattermost tape or local SQL |
| Stars, pins, bookmarks, reminders | Postgres extras |
| Search | Palette modifiers `from:` `in:` `has:` `before:` `after:` + saved searches |
| Notifications | Mute / mentions-only, desktop prefs, quiet hours |
| Workspace admin | Roles, deactivate, retention purge (local extras), audit log |
| Realtime | SSE `/api/zoreon/events` + Postgres `LISTEN`/`NOTIFY` |
| Huddles | Channel A/V via WebRTC + `/api/rtc` |
| PWA | `public/sw.js`, manifest, offline outbox; Web Push when `VAPID_*` set |

## Deploy

| Path | Doc |
| --- | --- |
| Docker Compose (greenfield) | [docs/CUSTOMER.md](docs/CUSTOMER.md) |
| Kubernetes Helm | [docs/HELM.md](docs/HELM.md) |
| Advanced podman/systemd | [docs/DEPLOY.md](docs/DEPLOY.md) |

```bash
cp .env.example .env   # edit secrets
docker compose up -d --build
BASE_URL=http://localhost:8080 ./scripts/customer-smoke.sh
```

## Layout

| Path | What |
| --- | --- |
| `src/components/desktop/` | Menu bar, invite/admin dialogs, palette, window frame |
| `src/components/zoreon/` | Channels, messages, threads, huddle bar, cutover rail |
| `src/store/use-zoreon.ts` | Client store |
| `src/lib/zoreon/` | Server API, Mattermost bridge, mail, realtime, admin |
| `src/routes/api/zoreon/events.ts` | SSE fan-out |
| `src/routes/api/rtc.ts` | Huddle signaling |
| `migrations/` | Auth + messaging + invites + tokens + prefs + push |
| `scripts/deploy-remote.sh` | Advanced remote deploy (podman + systemd) |
| `docker-compose.yml` | Greenfield self-host (Postgres + app) |
| `scripts/customer-smoke.sh` | HTTP smoke against `BASE_URL` |
| `public/sw.js` | Service worker |

## License

MIT — see [LICENSE](LICENSE).
