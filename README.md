# Agora

macOS-class ops chat for infrastructure programs (Zyvor). Dark desktop chrome, traffic lights, Dock, war rooms, huddles, threads, ⌘K. Mattermost is the tape — this is the product.

## Run

```bash
npm install
npm run dev
```

The app binds `0.0.0.0:8080`.

## Product files

| Path | What |
| --- | --- |
| `src/components/macos/` | Menu bar, Dock, window frame, command palette |
| `src/components/agora/` | Channels, messages, threads, cutover rail |
| `src/store/use-agora.ts` | Client store (hydrates from server API) |
| `src/lib/agora/` | Neon messaging API + optional Mattermost probe |
| `migrations/0002_agora_messaging.sql` | Channels, messages, reactions, waves |
| `src/data/` | Seed users, channels, Wave 3 runbook |
| `src/styles.css` | Tokens (graphite + system blue) |

Reset demo data via **Agora → Reset demo data** in the menu bar (reseeds the database).
