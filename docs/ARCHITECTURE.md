# Architecture

Zoreon is Zyvor’s ops-chat product. **Mattermost is the tape** (durable channel history when configured). **Zoreon is the product** (login, invites, search, prefs, admin, PWA, huddles, cutover waves).

## Planes

```
┌─────────────────────────────────────────────────────────┐
│  Browser (desktop shell + PWA SW)                       │
│  Better Auth session · SSE · WebRTC huddles             │
└───────────────┬───────────────────────────┬─────────────┘
                │                           │
                ▼                           ▼
┌───────────────────────────┐   ┌─────────────────────────┐
│  Zoreon (TanStack Start)  │   │  Mattermost (optional)  │
│  /api/auth · /api/zoreon  │   │  channels / posts / rxn │
│  /api/rtc · server fns    │   │  admin PAT + user tokens│
└─────────────┬─────────────┘   └─────────────────────────┘
              │
              ▼
┌───────────────────────────┐
│  Postgres (agora-db lab)  │
│  auth · invites · extras  │
│  LISTEN/NOTIFY realtime   │
└───────────────────────────┘
```

## Auth

- **Better Auth** at `/api/auth/*` — email/password + Google / X.
- New accounts require a valid **invite** (`/join?token=…`).
- Workspace admins live in `agora_workspace_admins` (table prefix is historical).

## Messaging

| Mode | Behavior |
| --- | --- |
| Mattermost wired (`MATTERMOST_URL` + admin `MATTERMOST_TOKEN`) | Channels/messages/send/reactions via MM. Per-user MM access tokens stored encrypted (`agora_mm_tokens`) so posts attribute to the signed-in user. |
| No MM token | Local SQL seed / `agora_messages` path. |

Cutover waves, bookmarks, reminders, stars, overlays, and admin audit stay on Zoreon Postgres either way.

## Realtime

- Clients open SSE to `/api/zoreon/events`.
- In-process hub plus Postgres `NOTIFY zoreon_realtime` so multiple app replicas fan out.

## Huddles

- UI: `HuddleBar` in the channel header.
- Signaling: `/api/rtc` (WebRTC peer discovery / SDP relay).
- Media: browser `getUserMedia` + peer connections (`P2PRoom`).

## PWA / push

- Service worker: `public/sw.js` (registered from the desktop shell).
- Manifest: `/__grok/manifest.webmanifest`.
- Offline draft outbox in client store.
- Web Push optional via `VAPID_*` + `agora_push_subscriptions`.

## Naming note

GitHub repo and product name are **zoreon**. Lab Postgres objects (`agora-db`, `agora_*` tables, `agora-pgdata`) keep the pre-rename names so existing volumes stay intact — do not rename them casually on a live lab.
