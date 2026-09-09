# Environment variables

Compose: copy [`.env.example`](../.env.example) → `.env`.  
Advanced host inject: [DEPLOY.md](DEPLOY.md).  
Helm: `charts/zoreon/values.yaml` (`env` + `secret` / `existingSecret`).

## Required (production)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing + AES-GCM for MM user tokens |
| `BETTER_AUTH_URL` | Public origin (e.g. `https://zoreon.example.com`) |
| `HOST` / `PORT` | Bind address (container: `0.0.0.0` / `8080`) |

## Bootstrap (Compose / greenfield)

| Variable | Purpose |
| --- | --- |
| `ZOREON_BOOTSTRAP_ADMIN_EMAIL` | Seeded into `agora_workspace_admins`; register this email via `/join` |
| `POSTGRES_PASSWORD` | Compose Postgres password |
| `ZOREON_PUBLISH_PORT` | Host port → app `:8080` (default `8080`) |

When the bootstrap email is set, migrate also ensures at least one active invite token exists.

## Mattermost tape (optional)

| Variable | Purpose |
| --- | --- |
| `MATTERMOST_URL` | Base URL of Mattermost TE |
| `MATTERMOST_TOKEN` | Admin personal access token |

Without both, Zoreon uses local SQL messaging. There is **no** baked-in Mattermost host.

## SMTP (invite email)

| Variable | Aliases | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | | e.g. `smtp.example.com` |
| `SMTP_PORT` | | `587` (STARTTLS) or `465` |
| `SMTP_FROM` | | From address |
| `SMTP_USER` | `SMTP_USERNAME` | Auth user |
| `SMTP_PASS` | `SMTP_PASSWORD` | App password |
| `SMTP_USE_TLS` | | `true` for STARTTLS on 587 |

Compose `.env` or `ZOREON_SMTP_ENV` for `deploy-remote.sh`. Only `SMTP_*` keys are imported from an env file.

## Web Push (optional)

| Variable | Purpose |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |

Service worker registers regardless; push subscriptions no-op without VAPID.

## Auth UI flags

| Variable | Purpose |
| --- | --- |
| `VITE_AUTH_ENABLED` | Set to `false` only to disable sign-in (dev/template). Production leaves unset → auth **on**. |

## Deploy-time (host script)

| Variable | Purpose |
| --- | --- |
| `ZOREON_SMTP_ENV` | Path to SMTP env file for `deploy-remote.sh` |
| `MATTERMOST_URL` / `MATTERMOST_TOKEN` | Passed into the container (token also from `tls/mm.token`) |
| `BUILDER` | `podman` (default) or `docker` |
| `--port` | Public HTTPS port (default `30591`) |

## CI

Smoke and Playwright jobs set `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL` against a Postgres service. Unit build intentionally has **no** `DATABASE_URL` so migrate skips. See [TESTING.md](TESTING.md).
