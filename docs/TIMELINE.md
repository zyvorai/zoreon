# Incident timeline export and abuse limits

## Export

The channel header has an **Export** button. It calls the `exportTimeline` server function (`src/lib/zoreon/api.ts`):

```ts
exportTimeline({ data: { channelId, format?: "markdown" | "json" | "csv" | "retro" | "digest", highlightsOnly?: boolean, since?: ms, until?: ms } })
// -> { filename, mime, content, entries, truncated }
```

- Requires a signed-in session. In SQL mode, DM channels are limited to their members. In Mattermost mode the export reads the latest 60 posts as the signed-in user (a user token when one is stored).
- `channelId` must match `[A-Za-z0-9_-]{1,64}`; `since`/`until` must be finite millisecond timestamps with `since <= until`. Anything else is rejected before any query. The SQL path binds all values as parameters.
- Message text is untrusted. Every string is stripped of control, zero-width and bidi-override characters, then secret-redacted (private keys, AWS/GitHub/Slack/`sk-` tokens, JWTs, `Bearer`/`Basic` credentials, URL passwords, `password|secret|token|api_key = value` assignments). Redaction is best effort, not a guarantee: review before sharing outside the team.
- Markdown output escapes `& < >` and Markdown punctuation, and keeps every body line inside a blockquote, so messages cannot inject HTML, links, images, headings or tables.
- Limits: 5000 messages, 8000 characters per message (marked `[truncated]`).
- Every export writes `timeline.export` to the audit log (`agora_audit_log`, visible in the admin panel) with channel, format and entry count. Message text is not stored in the audit row.
- JSON schema `zoreon.timeline.v1`: `channel`, `generatedAt`, `truncated`, `omitted`, `entries[]` (`id`, `at` ISO-8601, `author`, `body`, `edited`, `parentId`, `system`, `files`, `truncated`).

## Formats, markers and insights

The channel header Export menu offers every format. All go through the same redaction and escaping.

- `markdown` (default): the timeline. `highlightsOnly: true` keeps only messages that carry a marker.
- `json`: schema `zoreon.timeline.v1` plus an additive `insights` object (`decisions`, `followUps`, `notes`, `summary`, `omittedItems`).
- `csv`: one row per message (`at,id,author,parent_id,system,edited,files,body`), RFC 4180 quoting, CRLF, and cells starting with `= + - @` tab or CR are prefixed with `'` to stop spreadsheet formula injection.
- `retro`: incident review skeleton (summary, participants, decisions, follow-up checklist, notes, empty Root cause / What went well / What to improve sections).
- `digest`: short catch-up brief (activity, decisions, open follow-ups, notes).

Markers are recognised at the start of a line (optional bullet, case-insensitive): `DECISION:` / `DECIDED:`, `TODO:` / `ACTION:` / `FOLLOW-UP:`, `NOTE:`, and task checkboxes `- [ ] x` / `- [x] x`. The first `@handle` on a follow-up line becomes its owner. System messages are ignored; at most 200 marker items are kept (the rest are counted in `omittedItems`). Insights are computed from the redacted text, over the full exported range even with `highlightsOnly`.

Code: `timeline-insights.ts` (tests: `timeline-insights.test.ts`).

## Reminders

`addReminder` accepts either `remindAt` (epoch ms) or `when` plus the caller's `tzOffsetMinutes` (`new Date().getTimezoneOffset()`): `30m`, `in 2 hours`, `3pm`, `at 14:30`, `tomorrow`, `tomorrow 3pm`, `friday`, `next monday 10:00`. Times must be at least 1 second and at most 366 days ahead. Code: `remind-when.ts`.

## Search privacy

The SQL-mode `searchMessages` used to search every message including DMs the caller is not in. It now joins channels and drops DMs unless the caller is a member (`search-filter.ts`), applies `from:/in:/before:/after:/has:link` before the result cap, and scans the 400 newest matches (was 80) so filters are less likely to empty the result.

## Rate limits

Message sends/edits, and exports, are limited per user with an in-memory sliding window; see [ENV.md](ENV.md). Limits are per app replica. Empty, NUL-containing or oversized (default 16000 characters) bodies are rejected with a clear error.

Code: `rate-limit.ts`, `limits.server.ts`, `timeline-export.ts`, `timeline-request.ts`, `timeline.server.ts` in `src/lib/zoreon/`; tests alongside (`*.test.ts`, run by `npm test`).
