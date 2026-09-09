# Environment variables

See also [DEPLOY.md](DEPLOY.md) for how the lab deploy script injects these.

## Required (production)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing + AES-GCM for MM user tokens |
| `BETTER_AUTH_URL` | Public origin (e.g. `https://host:30591`) |
| `HOST` / `PORT` | Bind address (container: `0.0.0.0` / `8080`) |

## Mattermost tape (optional)

| Variable | Purpose |
| --- | --- |
| `MATTERMOST_URL` | Base URL of Mattermost TE |
| `MATTERMOST_TOKEN` | Admin personal access token (lab: `tls/mm.token`) |

Without both, Zoreon uses local SQL messaging.

## SMTP (invite email)

| Variable | Aliases | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | | e.g. `smtp.zoho.in` |
| `SMTP_PORT` | | `587` (STARTTLS) or `465` |
| `SMTP_FROM` | | From address |
| `SMTP_USER` | `SMTP_USERNAME` | Auth user |
| `SMTP_PASS` | `SMTP_PASSWORD` | App password |
| `SMTP_USE_TLS` | | `true` for STARTTLS on 587 |

Deploy default source: `~/tt/zyvor-web/contact-mailer.env` (override with `ZOREON_SMTP_ENV`). Only `SMTP_*` keys are imported.

## Web Push (optional)

| Variable | Purpose |
| --- | --- |
| `VAPID_PUBLIC_KEY` | Web Push public key |
| `VAPID_PRIVATE_KEY` | Web Push private key |

Service worker registers regardless; push subscriptions no-op without VAPID.

## Auth UI flags

| Variable | Purpose |
| --- | --- |
| `VITE_AUTH_ENABLED` | Must be on for real sign-in in production builds |

## Deploy-time (host script)

| Variable | Purpose |
| --- | --- |
| `ZOREON_SMTP_ENV` | Path to SMTP env file for `deploy-remote.sh` |
| `MATTERMOST_TOKEN` | Fallback if remote `tls/mm.token` missing |
| `BUILDER` | `podman` (default) or `docker` |
| `--port` / `ZOREN_PORT` | Public HTTPS port via deploy CLI (default `30591`) |
