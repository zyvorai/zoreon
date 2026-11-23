# Incident timeline export and abuse limits

## Export

The channel header has an **Export** button. It calls the `exportTimeline` server function (`src/lib/zoreon/api.ts`):

```ts
exportTimeline({ data: { channelId, format?: "markdown" | "json", since?: ms, until?: ms } })
// -> { filename, mime, content, entries, truncated }
```

- Requires a signed-in session. In SQL mode, DM channels are limited to their members. In Mattermost mode the export reads the latest 60 posts as the signed-in user (a user token when one is stored).
- `channelId` must match `[A-Za-z0-9_-]{1,64}`; `since`/`until` must be finite millisecond timestamps with `since <= until`. Anything else is rejected before any query. The SQL path binds all values as parameters.
- Message text is untrusted. Every string is stripped of control, zero-width and bidi-override characters, then secret-redacted (private keys, AWS/GitHub/Slack/`sk-` tokens, JWTs, `Bearer`/`Basic` credentials, URL passwords, `password|secret|token|api_key = value` assignments). Redaction is best effort, not a guarantee: review before sharing outside the team.
- Markdown output escapes `& < >` and Markdown punctuation, and keeps every body line inside a blockquote, so messages cannot inject HTML, links, images, headings or tables.
- Limits: 5000 messages, 8000 characters per message (marked `[truncated]`).
- Every export writes `timeline.export` to the audit log (`agora_audit_log`, visible in the admin panel) with channel, format and entry count. Message text is not stored in the audit row.
- JSON schema `zoreon.timeline.v1`: `channel`, `generatedAt`, `truncated`, `omitted`, `entries[]` (`id`, `at` ISO-8601, `author`, `body`, `edited`, `parentId`, `system`, `files`, `truncated`).

## Rate limits

Message sends/edits, and exports, are limited per user with an in-memory sliding window; see [ENV.md](ENV.md). Limits are per app replica. Empty, NUL-containing or oversized (default 16000 characters) bodies are rejected with a clear error.

Code: `rate-limit.ts`, `limits.server.ts`, `timeline-export.ts`, `timeline-request.ts`, `timeline.server.ts` in `src/lib/zoreon/`; tests alongside (`*.test.ts`, run by `npm test`).
