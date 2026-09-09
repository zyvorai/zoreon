# Agora

Zyvor ops chat for infrastructure programs — war rooms, threads, huddles, and cutover runbooks. Mattermost is the tape; this is the product.

## Run

```bash
npm install
npm run dev
```

Binds `0.0.0.0:8080`. Sign-in is on at `/login` (also `/signin`). Use **Continue with Google** or **X**, then the workspace loads.

## Lab URLs

| Service | URL |
| --- | --- |
| Agora | http://zoreon.example.com:30591/ |
| Mattermost TE 11.7 (reference / optional API) | http://zoreon.example.com:31722/ |

Mattermost lives under `/opt/mattermost-docker/` on that host (PostgreSQL-backed Team Edition). Agora uses its own messaging API by default; set `MATTERMOST_URL` / `MATTERMOST_TOKEN` on the server for the optional Mattermost probe.

## Sign-in

| Path | What |
| --- | --- |
| `/login` · `/signin` | Hero → credentials (Google / X) |
| `src/components/login/` | Sign-in shell |
| `src/styles/zyvor-premium-login.css` | Sign-in layout |
| `/api/auth/*` | Better Auth |
| `migrations/0001_auth.sql` | Auth schema |

## Remote deploy

See [docs/DEPLOY.md](docs/DEPLOY.md). Short form:

```bash
./scripts/deploy-remote.sh zoreon.example.com sus --port 30591
make deploy-remote H=zoreon.example.com U=sus PORT=30591
```

## Layout

| Path | What |
| --- | --- |
| `src/components/desktop/` | Menu bar, launcher, window frame, command palette |
| `src/components/agora/` | Channels, messages, threads, cutover rail |
| `src/store/use-agora.ts` | Client store (hydrates from server API) |
| `src/lib/agora/` | Messaging API + optional Mattermost probe |
| `migrations/0002_agora_messaging.sql` | Channels, messages, reactions, waves |
| `scripts/deploy-remote.sh` | Remote deploy (podman + systemd) |
| `Dockerfile` | Self-hosted Node image |
| `src/data/` | Seed users, channels, Wave 3 runbook |

Reset demo data via **Agora → Reset demo data** in the menu bar.
