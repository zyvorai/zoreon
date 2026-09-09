# Zoreon agent notes

Ops-chat product (Mattermost = tape). Brand and share-card rules live in `.grok/skills/og/SKILL.md`.

## Parallel work

Dispatch long-running brand work early; keep shipping the product surface while assets generate.

## Execution loop

1. Read the user request and relevant skills.
2. Explore only what you need.
3. Implement the change.
4. Verify with typecheck / tests / smoke as appropriate.
5. Prefer small, reviewable commits when asked.
6. **Brand-asset pass** — dispatch as a subagent when the `task` tool exists. Never `wait_tasks` and never `get_task_output` on the brand task. While `/workspace/.grok/og-pending` is fresh (staleness bound **10 minutes**), brand-check silences in-flight card warnings.
7. Finish with a short status for the user.
