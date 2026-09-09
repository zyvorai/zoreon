# Zoreon

Zyvor ops chat for infrastructure programs — war rooms, threads, huddles, and cutover runbooks. **Mattermost is the tape; Zoreon is the product.**

Better Auth owns login. Mattermost (when wired) stores channel history; Zoreon adds invites, admin, search, notifications, PWA, and A/V huddles on its own Postgres.

## Run

```bash
npm install
npm run dev
```

Binds `0.0.0.0:8080`. Open `/login` (also `/signin`).

## Lab URLs

| Service | URL |
| --- | --- |
| Zoreon (HTTPS, self-signed) | https://zoreon.example.com:30591/ |
| Mattermost TE 11.7 (tape) | http://zoreon.example.com:31722/ |

Mattermost lives under `/opt/mattermost-docker/` on that host. With `MATTERMOST_URL` + `MATTERMOST_TOKEN` (lab: `~/.deployments/zoreon/tls/mm.token`), channels/messages/send/reactions go through Mattermost; per-user MM access tokens (AES-GCM via `BETTER_AUTH_SECRET`) keep authorship as the signed-in user. Cutover waves and product extras stay on Zoreon Postgres. Without a token, messaging uses the local SQL seed.

## Sign-in & invites

| Path | What |
| --- | --- |
| `/login` · `/signin` | Email/password or Google / X |
| `/join?token=…` | Create account from invite |
| **Zoreon → Invite people** | Multi-use link, SMTP send, or mailto |
| `/api/auth/*` | Better Auth |
| `migrations/0001_auth.sql` | Auth schema |
| `migrations/0003_agora_invites.sql` | Invite tokens |

Admins generate invites from the menu. SMTP Send uses the same Zoho mailer as zyvor-web when configured (see [docs/DEPLOY.md](docs/DEPLOY.md)).

## Product surface

| Area | Notes |
| --- | --- |
| Channels / DMs / threads | Mattermost tape or local SQL |
| Stars, pins, bookmarks, reminders | Postgres extras |
| Search | Palette modifiers `from:` `in:` `has:` `before:` `after:` + saved searches |
| Notifications | Mute / mentions-only, desktop prefs, quiet hours |
| Workspace admin | Roles, deactivate, retention purge (local extras), audit log |
| Realtime | SSE `/api/zoreon/events` + Postgres `LISTEN`/`NOTIFY` across replicas |
| Huddles | Channel A/V via WebRTC + `/api/rtc` signaling |
| PWA | `public/sw.js`, manifest, offline outbox; Web Push when `VAPID_*` set |

## Remote deploy

See [docs/DEPLOY.md](docs/DEPLOY.md). Short form:

```bash
./scripts/deploy-remote.sh zoreon.example.com sus --port 30591
make deploy-remote H=zoreon.example.com U=sus PORT=30591
```

SMTP is pulled automatically from `~/tt/zyvor-web/contact-mailer.env` (override with `ZOREON_SMTP_ENV`).

## Layout

| Path | What |
| --- | --- |
| `src/components/desktop/` | Menu bar, invite/admin dialogs, palette, window frame |
| `src/components/zoreon/` | Channels, messages, threads, huddle bar, cutover rail |
| `src/store/use-zoreon.ts` | Client store |
| `src/lib/zoreon/` | Server API, Mattermost bridge, mail, realtime, admin |
| `src/routes/api/zoreon/events.ts` | SSE fan-out |
| `src/routes/api/rtc.ts` | Huddle signaling |
| `migrations/0002`–`0010_*.sql` | Messaging + invites + tokens + prefs + push |
| `scripts/deploy-remote.sh` | Remote deploy (podman + systemd + TLS proxy) |
| `Dockerfile` | Self-hosted Node image |
| `public/sw.js` | Service worker |

Reset demo data via **Zoreon → Reset demo data** in the menu bar (when available on the build).
