# ChatOps / incident-chat research

Method: only pages actually fetched are cited as read. Everything marked **[U]** is from general knowledge and was not read from a fetched page during this pass; verify before relying on it. Several fetches failed (Mattermost Playbooks docs URL and incident.io blog URL returned 404; the OWASP project page had no detail), so the product comparisons below are mostly **[U]**.

## Read from fetched pages

- Mattermost compliance export ([docs](https://docs.mattermost.com/administration-guide/comply/compliance-export.html)): CSV, Smarsh/Actiance XML, Global Relay EML, Proofpoint formats; daily scheduled job; includes bot/webhook posts; records edits and deletions (`EditedNewMsg`, `EditedOriginalMsg`, `Deleted`) keyed by message id; records channel membership history at post time; batches into zips; job status in System Console. Playbooks and Boards data are excluded. Retention and legal hold are separate pages (not read).
- OWASP LLM01 prompt injection ([page](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)): constrain model behaviour; validate output formats deterministically; filter inputs and outputs; least privilege with the app's own tokens and functions handled in code; human approval for privileged actions and clear separation of untrusted content. The page states no method is foolproof.
- Hubot docs ([page](https://hubot.github.com/docs/)): scripts load from `scripts/` and NPM; the fetched page said nothing about authorization (roles are a per-script concern) **[U]** for how.

## The field (all **[U]** unless noted)

| Tool | What it does | Relevance |
| --- | --- | --- |
| Mattermost Playbooks | Checklists, run timelines, retrospectives, status updates inside Mattermost | Zoreon already has cutover waves/checklists; timelines are the missing output |
| Slack workflows / incident bots | Slash-command incident creation, channel-per-incident, automatic timeline pins | Export of the channel as a record |
| PagerDuty / Opsgenie ChatOps | Ack/resolve/escalate from chat, with the actor recorded | Command audit trail |
| incident.io, FireHydrant, Rootly | Auto-built incident timelines, role assignment, post-mortem export (Markdown/Docs/Confluence), status-page updates | Timeline export, retros |
| Hubot / Errbot | Scriptable command bots; ACLs are per-plugin | Command approval is left to the integrator |
| Status-page tooling (Statuspage, Cachet) | Public incident communications | Out of scope; export feeds it |
| Runbook automation (Rundeck, StackStorm) | Approval steps, audited execution | Two-person rule for risky commands |

## What Zoreon lacked

1. No way to take a channel out as an incident record (no export at all).
2. No limit on message sends or edits, no body size check beyond the database/Mattermost limits.
3. No audit rows for data leaving the system.
4. No command surface at all (no slash commands, no webhooks, no LLM assistant), so command approval and prompt-injection controls have nothing to attach to yet.

## Ranked ideas

1. **Incident timeline export with redaction** (built). Biggest gap versus incident.io/Rootly/Playbooks; fits "Mattermost is the tape" because it renders the tape on demand; no schema change; pure code, fully unit-testable. Untrusted text handling follows the OWASP guidance on filtering and separating untrusted content (OWASP page, read).
2. **Rate limiting and body guard** (built). Cheap, protects Mattermost and the database from a single abusive session; clear error messages are the product surface. Limiter is in-memory per replica, a stated limitation.
3. **Audit rows for exports** (built with idea 1, using the existing `agora_audit_log`). Compliance export in Mattermost records changes to messages (read); Zoreon records who exported.
4. **Command audit log with an approval gate (two-person rule) for risky commands** (rejected for now). Needs a command surface that does not exist, a new table (migrations policy is "do not rename casually"; new tables need a migration), and UI for approvers. Design when slash commands land: `pending_commands(id, actor, command_hash, args_redacted, approver, state)`, approver != actor, expiry.
5. **Inbound webhook endpoint with signature verification and size/rate caps** (rejected for now). Needs a secret-management design (secrets live encrypted via `crypto.server.ts`); no consumer yet.
6. **Retention/legal hold** (deferred). Zoreon has `retention_days` purge; a legal-hold flag that suspends purge for matching channels is the natural extension. Note: `runRetentionPurge` currently always reports `deleted: 1` and does not count rows (see CHANGELOG, not changed in this pass).
7. **LLM ops assistant guardrails** (deferred). Only relevant if an assistant is added: treat chat text as untrusted data, no tool use without human approval, output schema validation (OWASP LLM01, read).
8. **Search filter hardening** (noted). `searchMessages` binds `ILIKE` as a parameter (no SQL injection), but `%` and `_` typed by users act as wildcards; escaping them is a small follow-up.
