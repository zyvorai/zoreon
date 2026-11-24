// Copyright 2026 Zyvor AI Labs · https://zyvor.dev
// SPDX-License-Identifier: LicenseRef-Zyvor-Production-2.0

/**
 * SQL for message search and reminders, taking an injected `Sql` client so the
 * exact statements run in `sql-queries.test.ts` against an in-memory PGlite
 * with the real migrations (no server, no Docker). Keep imports type-only.
 */
import type { Sql } from "@/lib/db";

export type SearchRowDb = {
  id: string;
  channel_id: string;
  body: string;
  created_at: number;
  author_id: string;
  kind: string;
  member_ids: string;
};

/** `pattern` is an ILIKE pattern already escaped with `escapeLike` and wrapped in %...%. */
export function searchMessageRows(sql: Sql, pattern: string): Promise<SearchRowDb[]> {
  return sql<SearchRowDb>`
    select m.id, m.channel_id, m.body, m.created_at, m.author_id, c.kind, c.member_ids
    from agora_messages m
    join agora_channels c on c.id = m.channel_id
    where m.body ilike ${pattern}
    order by m.created_at desc
    limit 400
  `;
}

export type ReminderDbRow = {
  id: string;
  message_id: string;
  channel_id: string;
  snippet: string;
  remind_at: number;
  done: boolean;
};

export function selectOpenReminders(sql: Sql, email: string): Promise<ReminderDbRow[]> {
  return sql<ReminderDbRow>`
    select id, message_id, channel_id, snippet, remind_at, done
    from agora_reminders where user_email = ${email} and done = false
    order by remind_at asc limit 50
  `;
}

export async function insertReminder(
  sql: Sql,
  r: { id: string; email: string; messageId: string; channelId: string; snippet: string; remindAt: number },
): Promise<void> {
  await sql`
    insert into agora_reminders (id, user_email, message_id, channel_id, snippet, remind_at)
    values (${r.id}, ${r.email}, ${r.messageId}, ${r.channelId}, ${r.snippet}, ${r.remindAt})
  `;
}

export function updateReminderTime(
  sql: Sql,
  email: string,
  reminderId: string,
  remindAt: number,
): Promise<ReminderDbRow[]> {
  return sql<ReminderDbRow>`
    update agora_reminders set remind_at = ${remindAt}
    where id = ${reminderId} and user_email = ${email} and done = false
    returning id, message_id, channel_id, snippet, remind_at, done
  `;
}

export type TimelineDbRow = {
  id: string;
  author_id: string;
  body: string;
  created_at: number;
  parent_id: string | null;
  system: boolean;
};

/** One extra row beyond the 5000 cap tells the caller the export was truncated. */
export function selectTimelineRows(
  sql: Sql,
  channelId: string,
  since: number | undefined,
  until: number | undefined,
): Promise<TimelineDbRow[]> {
  return sql<TimelineDbRow>`
    select id, author_id, body, created_at, parent_id, system
    from agora_messages
    where channel_id = ${channelId}
      and created_at >= ${since ?? 0}
      and created_at <= ${until ?? Number.MAX_SAFE_INTEGER}
    order by created_at asc
    limit 5001
  `;
}
