# Zoreon

Zyvor ops chat for infrastructure programs — war rooms, threads, huddles, and cutover runbooks.

**Mattermost is the tape; Zoreon is the product.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Repo:** https://github.com/zyvorai/zoreon

Better Auth owns login. Mattermost (when wired) stores channel history; Zoreon adds invites, admin, search, notifications, PWA, and A/V huddles on its own Postgres.

## Docs

| Doc | Contents |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Product model, data planes, realtime, huddles |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Self-host deploy (podman + systemd) |
| [docs/ENV.md](docs/ENV.md) | Environment variables |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Day-2 ops, smoke checks, secrets layout |

## Quick start

```bash
git clone https://github.com/zyvorai/zoreon.git
cd zoreon
npm install
npm run dev
```

Binds all interfaces on port `8080`. Open `/login` (also `/signin`).

## Sign-in & invites

| Path | What |
| --- | --- |
| `/login` · `/signin` | Email/password or Google / X |
| `/join?token=…` | Create account from invite |
| **Zoreon → Invite people** | Multi-use link, SMTP send, or mailto |
| `/api/auth/*` | Better Auth |

Admins generate invites from the menu. SMTP Send uses Zoho (or any SMTP) when configured — see [docs/DEPLOY.md](docs/DEPLOY.md) and [docs/ENV.md](docs/ENV.md).

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

## Remote deploy

```bash
./scripts/deploy-remote.sh <host> <user> --port 30591
make deploy-remote H=<host> U=<user> PORT=30591
```

Full guide: [docs/DEPLOY.md](docs/DEPLOY.md). SMTP can be loaded from an env file (`ZOREON_SMTP_ENV`); see [docs/ENV.md](docs/ENV.md).

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
| `scripts/deploy-remote.sh` | Remote deploy (podman + systemd + TLS proxy) |
| `public/sw.js` | Service worker |

## License

MIT — see [LICENSE](LICENSE).
