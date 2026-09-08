# Agora

macOS-class ops chat (demo). Dark desktop chrome, traffic lights, Dock, war rooms, huddles, threads, ⌘K.

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
| `src/components/relay/` | Channels, messages, threads, cutover rail |
| `src/store/use-relay.ts` | Zustand + localStorage |
| `src/data/` | Seed users, channels, Wave 3 runbook |
| `src/styles.css` | Tokens (graphite + system blue) |

Reset demo data via Relay → Reset demo data in the menu bar.
