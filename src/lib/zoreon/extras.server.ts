import { getSql } from "@/lib/db";
import { randomBytes } from "node:crypto";

function nid(prefix: string) {
  return `${prefix}-${randomBytes(6).toString("hex")}`;
}

function emailKey(email: string | null | undefined) {
  return email?.trim().toLowerCase() || null;
}

export async function getStarredChannelIds(email: string | null | undefined): Promise<string[]> {
  const e = emailKey(email);
  if (!e) return [];
  const sql = await getSql();
  const rows = await sql<{ channel_id: string }>`
    select channel_id from agora_starred_channels where user_email = ${e}
  `;
  return rows.map((r) => r.channel_id);
}

export async function toggleStarChannel(email: string, channelId: string): Promise<boolean> {
  const e = emailKey(email);
  if (!e) throw new Error("No email");
  const sql = await getSql();
  const existing = await sql<{ channel_id: string }>`
    select channel_id from agora_starred_channels
    where user_email = ${e} and channel_id = ${channelId}
  `;
  if (existing[0]) {
    await sql`
      delete from agora_starred_channels where user_email = ${e} and channel_id = ${channelId}
    `;
    return false;
  }
  await sql`
    insert into agora_starred_channels (user_email, channel_id) values (${e}, ${channelId})
  `;
  return true;
}

export type BookmarkRow = {
  id: string;
  messageId: string;
  channelId: string;
  snippet: string;
  createdAt: number;
};

export async function listBookmarks(email: string | null | undefined): Promise<BookmarkRow[]> {
  const e = emailKey(email);
  if (!e) return [];
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    message_id: string;
    channel_id: string;
    snippet: string;
    created_at: Date;
  }>`
    select id, message_id, channel_id, snippet, created_at
    from agora_bookmarks where user_email = ${e}
    order by created_at desc limit 100
  `;
  return rows.map((r) => ({
    id: r.id,
    messageId: r.message_id,
    channelId: r.channel_id,
    snippet: r.snippet,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function addBookmark(input: {
  email: string;
  messageId: string;
  channelId: string;
  snippet: string;
}): Promise<BookmarkRow> {
  const e = emailKey(input.email);
  if (!e) throw new Error("No email");
  const sql = await getSql();
  const id = nid("bm");
  await sql`
    insert into agora_bookmarks (id, user_email, message_id, channel_id, snippet)
    values (${id}, ${e}, ${input.messageId}, ${input.channelId}, ${input.snippet.slice(0, 200)})
  `;
  return {
    id,
    messageId: input.messageId,
    channelId: input.channelId,
    snippet: input.snippet.slice(0, 200),
    createdAt: Date.now(),
  };
}

export async function removeBookmark(email: string, bookmarkId: string): Promise<void> {
  const e = emailKey(email);
  if (!e) return;
  const sql = await getSql();
  await sql`delete from agora_bookmarks where id = ${bookmarkId} and user_email = ${e}`;
}

export type ReminderRow = {
  id: string;
  messageId: string;
  channelId: string;
  snippet: string;
  remindAt: number;
  done: boolean;
};

export async function listReminders(email: string | null | undefined): Promise<ReminderRow[]> {
  const e = emailKey(email);
  if (!e) return [];
  const sql = await getSql();
  const rows = await sql<{
    id: string;
    message_id: string;
    channel_id: string;
    snippet: string;
    remind_at: number;
    done: boolean;
  }>`
    select id, message_id, channel_id, snippet, remind_at, done
    from agora_reminders where user_email = ${e} and done = false
    order by remind_at asc limit 50
  `;
  return rows.map((r) => ({
    id: r.id,
    messageId: r.message_id,
    channelId: r.channel_id,
    snippet: r.snippet,
    remindAt: Number(r.remind_at),
    done: Boolean(r.done),
  }));
}

export async function addReminder(input: {
  email: string;
  messageId: string;
  channelId: string;
  snippet: string;
  remindAt: number;
}): Promise<ReminderRow> {
  const e = emailKey(input.email);
  if (!e) throw new Error("No email");
  const sql = await getSql();
  const id = nid("rm");
  await sql`
    insert into agora_reminders (id, user_email, message_id, channel_id, snippet, remind_at)
    values (${id}, ${e}, ${input.messageId}, ${input.channelId}, ${input.snippet.slice(0, 200)}, ${input.remindAt})
  `;
  return {
    id,
    messageId: input.messageId,
    channelId: input.channelId,
    snippet: input.snippet.slice(0, 200),
    remindAt: input.remindAt,
    done: false,
  };
}

export async function completeReminder(email: string, reminderId: string): Promise<void> {
  const e = emailKey(email);
  if (!e) return;
  const sql = await getSql();
  await sql`
    update agora_reminders set done = true where id = ${reminderId} and user_email = ${e}
  `;
}

export type NotifPrefs = {
  desktop: boolean;
  mentionsOnly: boolean;
  muteDms: boolean;
  quietStart: number | null;
  quietEnd: number | null;
};

export async function getNotifPrefs(email: string | null | undefined): Promise<NotifPrefs> {
  const e = emailKey(email);
  const defaults: NotifPrefs = {
    desktop: true,
    mentionsOnly: false,
    muteDms: false,
    quietStart: null,
    quietEnd: null,
  };
  if (!e) return defaults;
  const sql = await getSql();
  const rows = await sql<{
    desktop: boolean;
    mentions_only: boolean;
    mute_dms: boolean;
    quiet_start: number | null;
    quiet_end: number | null;
  }>`select desktop, mentions_only, mute_dms, quiet_start, quiet_end from agora_notif_prefs where user_email = ${e}`;
  const r = rows[0];
  if (!r) return defaults;
  return {
    desktop: Boolean(r.desktop),
    mentionsOnly: Boolean(r.mentions_only),
    muteDms: Boolean(r.mute_dms),
    quietStart: r.quiet_start == null ? null : Number(r.quiet_start),
    quietEnd: r.quiet_end == null ? null : Number(r.quiet_end),
  };
}

export async function setNotifPrefs(email: string, prefs: NotifPrefs): Promise<void> {
  const e = emailKey(email);
  if (!e) throw new Error("No email");
  const sql = await getSql();
  await sql`
    insert into agora_notif_prefs (user_email, desktop, mentions_only, mute_dms, quiet_start, quiet_end, updated_at)
    values (${e}, ${prefs.desktop}, ${prefs.mentionsOnly}, ${prefs.muteDms}, ${prefs.quietStart}, ${prefs.quietEnd}, now())
    on conflict (user_email) do update set
      desktop = excluded.desktop,
      mentions_only = excluded.mentions_only,
      mute_dms = excluded.mute_dms,
      quiet_start = excluded.quiet_start,
      quiet_end = excluded.quiet_end,
      updated_at = now()
  `;
}

export type ChannelNotifyLevel = "all" | "mentions" | "nothing";

export type ChannelPref = {
  channelId: string;
  muted: boolean;
  muteUntil: number | null;
  notifyLevel: ChannelNotifyLevel;
};

export async function getChannelPrefs(email: string | null | undefined): Promise<ChannelPref[]> {
  const e = emailKey(email);
  if (!e) return [];
  const sql = await getSql();
  const rows = await sql<{
    channel_id: string;
    muted: boolean;
    mute_until: number | null;
    notify_level: string;
  }>`
    select channel_id, muted, mute_until, notify_level from agora_channel_prefs where user_email = ${e}
  `;
  return rows.map((r) => ({
    channelId: r.channel_id,
    muted: Boolean(r.muted),
    muteUntil: r.mute_until == null ? null : Number(r.mute_until),
    notifyLevel: (r.notify_level as ChannelNotifyLevel) || "all",
  }));
}

export async function setChannelPref(
  email: string,
  input: {
    channelId: string;
    muted?: boolean;
    muteUntil?: number | null;
    notifyLevel?: ChannelNotifyLevel;
  },
): Promise<void> {
  const e = emailKey(email);
  if (!e) throw new Error("No email");
  const sql = await getSql();
  const existing = await sql<{
    muted: boolean;
    mute_until: number | null;
    notify_level: string;
  }>`
    select muted, mute_until, notify_level from agora_channel_prefs
    where user_email = ${e} and channel_id = ${input.channelId}
  `;
  const cur = existing[0];
  const muted = input.muted ?? Boolean(cur?.muted);
  const muteUntil =
    input.muteUntil !== undefined ? input.muteUntil : (cur?.mute_until ?? null);
  const notifyLevel = input.notifyLevel ?? (cur?.notify_level as ChannelNotifyLevel) ?? "all";
  await sql`
    insert into agora_channel_prefs (user_email, channel_id, muted, mute_until, notify_level, updated_at)
    values (${e}, ${input.channelId}, ${muted}, ${muteUntil}, ${notifyLevel}, now())
    on conflict (user_email, channel_id) do update set
      muted = excluded.muted,
      mute_until = excluded.mute_until,
      notify_level = excluded.notify_level,
      updated_at = now()
  `;
}

export async function listKeywords(email: string | null | undefined): Promise<string[]> {
  const e = emailKey(email);
  if (!e) return [];
  const sql = await getSql();
  const rows = await sql<{ keyword: string }>`
    select keyword from agora_keyword_alerts where user_email = ${e} order by keyword
  `;
  return rows.map((r) => r.keyword);
}

export async function addKeyword(email: string, keyword: string): Promise<void> {
  const e = emailKey(email);
  const k = keyword.trim().toLowerCase();
  if (!e || !k) return;
  const sql = await getSql();
  await sql`
    insert into agora_keyword_alerts (user_email, keyword) values (${e}, ${k})
    on conflict do nothing
  `;
}

export async function removeKeyword(email: string, keyword: string): Promise<void> {
  const e = emailKey(email);
  if (!e) return;
  const sql = await getSql();
  await sql`
    delete from agora_keyword_alerts where user_email = ${e} and keyword = ${keyword.trim().toLowerCase()}
  `;
}

export type SavedSearch = { id: string; name: string; query: string; createdAt: number };

export async function listSavedSearches(email: string | null | undefined): Promise<SavedSearch[]> {
  const e = emailKey(email);
  if (!e) return [];
  const sql = await getSql();
  const rows = await sql<{ id: string; name: string; query: string; created_at: Date }>`
    select id, name, query, created_at from agora_saved_searches
    where user_email = ${e} order by created_at desc limit 30
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    query: r.query,
    createdAt: new Date(r.created_at).getTime(),
  }));
}

export async function saveSearch(email: string, name: string, query: string): Promise<SavedSearch> {
  const e = emailKey(email);
  if (!e) throw new Error("No email");
  const sql = await getSql();
  const id = nid("ss");
  await sql`
    insert into agora_saved_searches (id, user_email, name, query)
    values (${id}, ${e}, ${name.slice(0, 80)}, ${query.slice(0, 400)})
  `;
  return { id, name: name.slice(0, 80), query: query.slice(0, 400), createdAt: Date.now() };
}

export async function deleteSavedSearch(email: string, id: string): Promise<void> {
  const e = emailKey(email);
  if (!e) return;
  const sql = await getSql();
  await sql`delete from agora_saved_searches where id = ${id} and user_email = ${e}`;
}

export function channelIsEffectivelyMuted(pref: ChannelPref | undefined, now = Date.now()): boolean {
  if (!pref) return false;
  if (pref.notifyLevel === "nothing") return true;
  if (pref.muted && (!pref.muteUntil || pref.muteUntil > now)) return true;
  if (pref.muteUntil && pref.muteUntil > now) return true;
  return false;
}

export function inQuietHours(prefs: NotifPrefs, now = new Date()): boolean {
  if (prefs.quietStart == null || prefs.quietEnd == null) return false;
  const h = now.getUTCHours();
  const a = prefs.quietStart;
  const b = prefs.quietEnd;
  if (a === b) return false;
  if (a < b) return h >= a && h < b;
  return h >= a || h < b;
}

export async function getPreferredTeamId(email: string | null | undefined): Promise<string | null> {
  const e = emailKey(email);
  if (!e) return null;
  const sql = await getSql();
  const rows = await sql<{ preferred_team_id: string | null }>`
    select preferred_team_id from agora_user_prefs where user_email = ${e}
  `;
  return rows[0]?.preferred_team_id ?? null;
}

export async function setPreferredTeamId(email: string, teamId: string | null): Promise<void> {
  const e = emailKey(email);
  if (!e) throw new Error("No email");
  const sql = await getSql();
  await sql`
    insert into agora_user_prefs (user_email, preferred_team_id, updated_at)
    values (${e}, ${teamId}, now())
    on conflict (user_email) do update set
      preferred_team_id = excluded.preferred_team_id,
      updated_at = now()
  `;
}

export async function savePostOverlay(input: {
  messageId: string;
  authorEmail: string;
  authorName: string;
}): Promise<void> {
  const e = emailKey(input.authorEmail);
  if (!e) return;
  const sql = await getSql();
  await sql`
    insert into agora_post_overlays (message_id, author_email, author_name)
    values (${input.messageId}, ${e}, ${input.authorName})
    on conflict (message_id) do update set
      author_email = excluded.author_email,
      author_name = excluded.author_name
  `;
}

export async function loadPostOverlays(
  messageIds: string[],
): Promise<Map<string, { email: string; name: string }>> {
  const map = new Map<string, { email: string; name: string }>();
  if (messageIds.length === 0) return map;
  const sql = await getSql();
  for (let i = 0; i < messageIds.length; i += 80) {
    const chunk = messageIds.slice(i, i + 80);
    const rows = await sql.query<{
      message_id: string;
      author_email: string;
      author_name: string;
    }>("select message_id, author_email, author_name from agora_post_overlays where message_id = any($1::text[])", [
      chunk,
    ]);
    for (const r of rows) map.set(r.message_id, { email: r.author_email, name: r.author_name });
  }
  return map;
}
