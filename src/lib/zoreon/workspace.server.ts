import {
  buildSeed,
  currentUserId as seedCurrentUserId,
  SEED_VERSION,
  users as seedUsers,
} from "@/data/seed";
import type { Channel, Message, Reaction, User, Wave, MessagingBackend } from "@/data/types";
import { getSql } from "@/lib/db";

export type WorkspaceSnapshot = {
  users: User[];
  channels: Channel[];
  messages: Message[];
  waves: Wave[];
  currentUserId: string;
  backend: MessagingBackend;
  /** Mattermost username when backend is mattermost */
  tapeUsername?: string;
  /** Session/tape email mismatch or other soft warning */
  identityWarning?: string;
  isAdmin?: boolean;
  teamId?: string;
};

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

async function isSeeded(): Promise<boolean> {
  const sql = await getSql();
  const rows = await sql<{ value: string }>`
    select value from agora_meta where key = ${"seed_version"}
  `;
  return rows[0]?.value === SEED_VERSION;
}

async function clearWorkspace() {
  const sql = await getSql();
  await sql`delete from agora_reactions`;
  await sql`delete from agora_messages`;
  await sql`delete from agora_wave_items`;
  await sql`delete from agora_waves`;
  await sql`delete from agora_channels`;
  await sql`delete from agora_profiles`;
  await sql`delete from agora_meta`;
}

export async function seedWorkspace() {
  const sql = await getSql();
  await clearWorkspace();
  const { channels: seedChannels, messages: seedMessages, waves: seedWaves } = buildSeed();

  for (const u of seedUsers) {
    await sql`
      insert into agora_profiles (id, name, handle, role, presence, initials, tone)
      values (${u.id}, ${u.name}, ${u.handle}, ${u.role}, ${u.presence}, ${u.initials}, ${u.tone})
    `;
  }

  for (const w of seedWaves) {
    await sql`
      insert into agora_waves (id, name, cluster, window_start, window_end, first_boot, vms)
      values (${w.id}, ${w.name}, ${w.cluster}, ${w.windowStart}, ${w.windowEnd}, ${w.firstBoot}, ${w.vms})
    `;
    for (let i = 0; i < w.items.length; i += 1) {
      const item = w.items[i]!;
      await sql`
        insert into agora_wave_items (id, wave_id, label, done, owner, sort_order)
        values (${item.id}, ${w.id}, ${item.label}, ${item.done}, ${item.owner}, ${i})
      `;
    }
  }

  for (const c of seedChannels) {
    await sql`
      insert into agora_channels (id, kind, name, topic, unread, mention, pinned, wave_id, member_ids)
      values (
        ${c.id},
        ${c.kind},
        ${c.name},
        ${c.topic},
        ${c.unread},
        ${Boolean(c.mention)},
        ${Boolean(c.pinned)},
        ${c.waveId ?? null},
        ${JSON.stringify(c.members)}
      )
    `;
  }

  for (const m of seedMessages) {
    await sql`
      insert into agora_messages (id, channel_id, author_id, body, created_at, parent_id, system, reply_count)
      values (
        ${m.id},
        ${m.channelId},
        ${m.authorId},
        ${m.body},
        ${m.createdAt},
        ${m.parentId ?? null},
        ${Boolean(m.system)},
        ${m.replyCount ?? 0}
      )
    `;

    const channel = seedChannels.find((c) => c.id === m.channelId);
    const memberPool = channel?.members.filter((id) => id !== "u-zoreon") ?? [seedCurrentUserId];
    for (const r of m.reactions) {
      for (let i = 0; i < r.count; i += 1) {
        let userId: string;
        if (r.mine && i === 0) userId = seedCurrentUserId;
        else userId = memberPool[(i + (r.mine ? 1 : 0)) % memberPool.length] ?? seedCurrentUserId;
        await sql`
          insert into agora_reactions (message_id, reaction_id, label, user_id)
          values (${m.id}, ${r.id}, ${r.label}, ${userId})
          on conflict do nothing
        `;
      }
    }
  }

  await sql`insert into agora_meta (key, value) values (${"seed_version"}, ${SEED_VERSION})`;
}

export async function ensureWorkspaceSeeded() {
  if (!(await isSeeded())) await seedWorkspace();
}

/** Upsert an agora_profiles row for the signed-in Better Auth user. */
export async function ensureProfileForSession(
  session: {
    id: string;
    email: string | null;
    name?: string | null;
  },
  opts?: { isAdmin?: boolean },
): Promise<string> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  const email = session.email?.trim().toLowerCase() ?? "";
  const handle = email.includes("@") ? email.split("@")[0]! : session.id.slice(0, 12);
  const name =
    session.name?.trim() ||
    (handle === "ssahani" ? "S Sahani" : handle) ||
    "User";
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("") || "U";
  const role = opts?.isAdmin ? "Admin" : "Zyvor";

  const existing = await sql<{ id: string }>`
    select id from agora_profiles where id = ${session.id} limit 1
  `;
  if (existing.length === 0) {
    await sql`
      insert into agora_profiles (id, name, handle, role, presence, initials, tone)
      values (${session.id}, ${name}, ${handle}, ${role}, ${"active"}, ${initials}, ${"accent"})
    `;
  } else {
    await sql`
      update agora_profiles
      set name = ${name}, handle = ${handle}, initials = ${initials}, role = ${role}
      where id = ${session.id}
    `;
  }

  // Ensure the signed-in user is a member of every channel.
  const channels = await sql<{ id: string; member_ids: string }>`select id, member_ids from agora_channels`;
  for (const c of channels) {
    const members = JSON.parse(c.member_ids) as string[];
    if (!members.includes(session.id)) {
      members.push(session.id);
      await sql`
        update agora_channels set member_ids = ${JSON.stringify(members)} where id = ${c.id}
      `;
    }
  }

  return session.id;
}

function aggregateReactions(
  rows: { message_id: string; reaction_id: string; label: string; user_id: string }[],
  currentUserId: string,
): Map<string, Reaction[]> {
  const byMessage = new Map<string, Map<string, Reaction>>();
  for (const row of rows) {
    let map = byMessage.get(row.message_id);
    if (!map) {
      map = new Map();
      byMessage.set(row.message_id, map);
    }
    const existing = map.get(row.reaction_id);
    if (!existing) {
      map.set(row.reaction_id, {
        id: row.reaction_id,
        label: row.label,
        count: 1,
        mine: row.user_id === currentUserId,
      });
    } else {
      existing.count += 1;
      if (row.user_id === currentUserId) existing.mine = true;
    }
  }
  const out = new Map<string, Reaction[]>();
  for (const [mid, map] of byMessage) out.set(mid, [...map.values()]);
  return out;
}

export async function loadWorkspace(currentUserId = seedCurrentUserId): Promise<WorkspaceSnapshot> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();

  const users = await sql<User>`
    select id, name, handle, role, presence, initials, tone from agora_profiles order by name
  `;

  const channelRows = await sql<{
    id: string;
    kind: Channel["kind"];
    name: string;
    topic: string;
    unread: number;
    mention: boolean;
    pinned: boolean;
    wave_id: string | null;
    member_ids: string;
  }>`select * from agora_channels order by pinned desc, name`;

  const channels: Channel[] = channelRows.map((c) => ({
    id: c.id,
    kind: c.kind,
    name: c.name,
    topic: c.topic,
    unread: Number(c.unread),
    mention: Boolean(c.mention),
    pinned: Boolean(c.pinned) || undefined,
    waveId: c.wave_id ?? undefined,
    members: JSON.parse(c.member_ids) as string[],
  }));

  const messageRows = await sql<{
    id: string;
    channel_id: string;
    author_id: string;
    body: string;
    created_at: number;
    updated_at: number | null;
    parent_id: string | null;
    system: boolean;
    reply_count: number;
    pinned_at: number | null;
  }>`select * from agora_messages order by created_at asc`;

  const reactionRows = await sql<{
    message_id: string;
    reaction_id: string;
    label: string;
    user_id: string;
  }>`select message_id, reaction_id, label, user_id from agora_reactions`;

  const reactionsByMessage = aggregateReactions(reactionRows, currentUserId);

  const messages: Message[] = messageRows.map((m) => ({
    id: m.id,
    channelId: m.channel_id,
    authorId: m.author_id,
    body: m.body,
    createdAt: Number(m.created_at),
    updatedAt: m.updated_at ? Number(m.updated_at) : undefined,
    parentId: m.parent_id ?? undefined,
    replyCount: Number(m.reply_count) || undefined,
    system: m.system || undefined,
    pinnedAt: m.pinned_at ? Number(m.pinned_at) : undefined,
    reactions: reactionsByMessage.get(m.id) ?? [],
  }));

  const waveRows = await sql<{
    id: string;
    name: string;
    cluster: string;
    window_start: number;
    window_end: number;
    first_boot: number;
    vms: number;
  }>`select * from agora_waves`;

  const itemRows = await sql<{
    id: string;
    wave_id: string;
    label: string;
    done: boolean;
    owner: string;
    sort_order: number;
  }>`select * from agora_wave_items order by sort_order asc`;

  const waves: Wave[] = waveRows.map((w) => ({
    id: w.id,
    name: w.name,
    cluster: w.cluster,
    windowStart: Number(w.window_start),
    windowEnd: Number(w.window_end),
    firstBoot: Number(w.first_boot),
    vms: Number(w.vms),
    items: itemRows
      .filter((i) => i.wave_id === w.id)
      .map((i) => ({
        id: i.id,
        label: i.label,
        done: Boolean(i.done),
        owner: i.owner,
      })),
  }));

  return { users, channels, messages, waves, currentUserId, backend: "sql" };
}

export async function insertMessage(input: {
  channelId: string;
  authorId: string;
  body: string;
  parentId?: string;
}): Promise<Message> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  const text = input.body.trim();
  if (!text) throw new Error("Empty message");

  const msg: Message = {
    id: nid("m"),
    channelId: input.channelId,
    authorId: input.authorId,
    body: text,
    createdAt: Date.now(),
    parentId: input.parentId,
    reactions: [],
  };

  await sql`
    insert into agora_messages (id, channel_id, author_id, body, created_at, parent_id, system, reply_count)
    values (
      ${msg.id},
      ${msg.channelId},
      ${msg.authorId},
      ${msg.body},
      ${msg.createdAt},
      ${msg.parentId ?? null},
      ${false},
      ${0}
    )
  `;

  if (input.parentId) {
    await sql`
      update agora_messages
      set reply_count = reply_count + 1
      where id = ${input.parentId}
    `;
  }

  try {
    const { broadcastRealtime } = await import("./realtime.server");
    broadcastRealtime({
      type: "refresh",
      reason: "post",
      channelId: input.channelId,
      at: Date.now(),
    });
  } catch {
    /* */
  }

  return msg;
}

export async function toggleReactionDb(input: {
  messageId: string;
  reactionId: string;
  label: string;
  userId: string;
}): Promise<void> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  const existing = await sql<{ user_id: string }>`
    select user_id from agora_reactions
    where message_id = ${input.messageId}
      and reaction_id = ${input.reactionId}
      and user_id = ${input.userId}
  `;
  if (existing.length > 0) {
    await sql`
      delete from agora_reactions
      where message_id = ${input.messageId}
        and reaction_id = ${input.reactionId}
        and user_id = ${input.userId}
    `;
    return;
  }
  await sql`
    insert into agora_reactions (message_id, reaction_id, label, user_id)
    values (${input.messageId}, ${input.reactionId}, ${input.label}, ${input.userId})
  `;
}

export async function toggleCheckDb(input: { waveId: string; itemId: string }): Promise<void> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  await sql`
    update agora_wave_items
    set done = not done
    where wave_id = ${input.waveId} and id = ${input.itemId}
  `;
}

export async function markChannelRead(channelId: string): Promise<void> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  await sql`
    update agora_channels
    set unread = 0, mention = false
    where id = ${channelId}
  `;
}

export async function updateMessageDb(input: {
  messageId: string;
  body: string;
  authorId: string;
}): Promise<Message> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  const text = input.body.trim();
  if (!text) throw new Error("Empty message");
  const now = Date.now();
  const rows = await sql<{
    id: string;
    channel_id: string;
    author_id: string;
    body: string;
    created_at: number;
    updated_at: number | null;
    parent_id: string | null;
    system: boolean;
    reply_count: number;
    pinned_at: number | null;
  }>`
    update agora_messages
    set body = ${text}, updated_at = ${now}
    where id = ${input.messageId} and author_id = ${input.authorId}
    returning *
  `;
  const m = rows[0];
  if (!m) throw new Error("Message not found or not yours");
  return {
    id: m.id,
    channelId: m.channel_id,
    authorId: m.author_id,
    body: m.body,
    createdAt: Number(m.created_at),
    updatedAt: Number(m.updated_at ?? now),
    parentId: m.parent_id ?? undefined,
    replyCount: Number(m.reply_count) || undefined,
    system: m.system || undefined,
    pinnedAt: m.pinned_at ? Number(m.pinned_at) : undefined,
    reactions: [],
  };
}

export async function deleteMessageDb(input: {
  messageId: string;
  authorId: string;
}): Promise<void> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  await sql`delete from agora_reactions where message_id = ${input.messageId}`;
  await sql`
    delete from agora_messages
    where id = ${input.messageId} and author_id = ${input.authorId}
  `;
}

export async function setPresenceDb(input: {
  userId: string;
  presence: "active" | "away" | "dnd";
}): Promise<void> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  await sql`
    update agora_profiles set presence = ${input.presence} where id = ${input.userId}
  `;
}

export async function updateChannelTopicDb(input: {
  channelId: string;
  topic: string;
}): Promise<void> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  await sql`
    update agora_channels set topic = ${input.topic} where id = ${input.channelId}
  `;
}

export async function togglePinDb(input: {
  messageId: string;
  pin: boolean;
}): Promise<void> {
  await ensureWorkspaceSeeded();
  const sql = await getSql();
  if (input.pin) {
    await sql`
      update agora_messages set pinned_at = ${Date.now()} where id = ${input.messageId}
    `;
  } else {
    await sql`
      update agora_messages set pinned_at = null where id = ${input.messageId}
    `;
  }
}

export async function resetWorkspace(): Promise<WorkspaceSnapshot> {
  await seedWorkspace();
  return loadWorkspace();
}
