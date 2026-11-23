# Changelog

## Unreleased

### Added

- Incident timeline export: `exportTimeline` server function and an Export button in the channel header. Markdown or JSON; secrets redacted; control/bidi characters stripped; Markdown/HTML escaped; capped at 5000 messages and 8000 characters per message. Each export writes a `timeline.export` row to the audit log. See `docs/TIMELINE.md`.
- Message rate limiting and size guard on send/edit (`ZOREON_RATE_MESSAGES_PER_MIN`, `ZOREON_MAX_MESSAGE_CHARS`) and export limiting (`ZOREON_RATE_EXPORTS_PER_MIN`), with clear errors.
- Unit tests for all of the above (hostile Markdown/HTML, huge payloads, malformed input, SQL-shaped input).

### Dependencies (major bumps)

Root app (verified with lint, typecheck, unit tests and build on Node 22.23):

- eslint 9 -> 10, @eslint/js 9 -> 10, eslint-plugin-react-hooks 5 -> 7, eslint-plugin-react-refresh 0.4 -> 0.5. The new react-hooks compiler rules `set-state-in-effect` and `purity` are set to warn (18 warnings, 0 errors). Fixed the three newly flagged errors (`no-empty`, `preserve-caught-error`, `no-useless-assignment`).
- @vitejs/plugin-react 5 -> 6, globals 15 -> 17, @hookform/resolvers 5 -> 7, lucide-react 0.x -> 1.x, react-day-picker 9 -> 10, recharts 2 -> 3, @tanstack/react-table 8 -> 9. The last five are declared but not imported anywhere in `src/`, so the bump cannot break runtime code.
- @types/node 22 -> 24 (matches the new Node 24 pins).
- All other dependencies moved to the latest in-range release (react 19.3.1, vite 8.3.8, radix-ui, tanstack router/start/query, zod 4.6, playwright 1.65, prettier 3.10, typescript-eslint 8.73, ...).

Website (docs site): react / react-dom 19.3.1; build and typecheck pass.

### Held back

- typescript 7: typescript-eslint 8.73 refuses TS 7 at load time (peer range `<6.1.0`), and the website extends `@docusaurus/tsconfig`, which still sets the removed `baseUrl`. Root stays on 5.9, website on ~6.0.
- better-auth 1.6 -> 1.7, jose 6.2.9 (exact pin) -> 6.2.18, web-push 3 -> 4: auth, session and crypto code; no equivalence tests exist here, so kept.
- kysely 0.28 -> 0.29, @electric-sql/pglite 0.5 -> 0.6, pg, nodemailer: database/driver family; in-range updates only (pg 8.23.1, kysely 0.28.20, pglite 0.5.17).
- nitro 3.0.260610-beta (exact pin plus an `nf3` override): the only newer release is an rc; kept.
- postgres:16-alpine (docker-compose, Helm chart, CI service): database major held; tag verified to exist.

### CI / Docker

- Dockerfile base image node:22-bookworm-slim -> node:24-bookworm-slim (tag verified on Docker Hub). CI node-version 22 -> 24. NOT tested on Node 24: this host only has Node 22. The app, tests, build and image build were not run on 24.
- Actions: checkout v7, setup-node v7, upload-artifact v7, upload-pages-artifact v5, deploy-pages v5 (versions taken from sibling-repo verification; not re-verified against the Marketplace here).

### Fixed

- Message search: `%`, `_` and backslash typed by users are now escaped, so they match literally instead of acting as LIKE wildcards (values were always parameterised; no SQL injection).
- Lint gate: pre-existing `no-empty` error in `client.server.ts`.
