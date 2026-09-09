/**
 * Mattermost → Zoreon WorkspaceSnapshot adapter.
 * Waves / cutover checklist stay on Zoreon SQL; channels + messages + users from MM.
 */
import type { Channel, Message, Reaction, User, Wave } from "@/data/types";
import { buildSeed } from "@/data/seed";
import type { VerifiedUser } from "@/lib/auth/verify.server";
import {
  EMOJI_REACTION,
  REACTION_EMOJI,
  getMattermostConfig,
  mattermostAddReaction,
  mattermostChannelPosts,
  mattermostCreatePost,
  mattermostMe,
  mattermostMyChannelMembers,
  mattermostMyChannels,
  mattermostMyTeams,
  mattermostPostReactions,
  mattermostRemoveReaction,
  mattermostStatusesByIds,
  mattermostUsersByIds,
  mattermostViewChannel,
  type MattermostConfig,
  type MmChannel,
  type MmPost,
  type MmReaction,
  type MmUser,
} from "./mattermost.server";
import type { WorkspaceSnapshot } from "./workspace.server";
import {
  ensureWorkspaceSeeded,
  loadWorkspace as loadSqlWorkspace,
  toggleCheckDb,
} from "./workspace.server";

const TONES = ["accent", "navy", "steel", "fog", "slate"] as const;

function displayName(u: MmUser): string {
  const full = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim();
  if (full) return full;
  if (u.nickname) return u.nickname;
  return u.username;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function mapUser(u: MmUser, index: number): User {
  return {
    id: u.id,
    name: displayName(u),
    handle: u.username,
    role: u.position?.trim() || "Zyvor",
    presence: "active",
    initials: initials(displayName(u)),
    tone: TONES[index % TONES.length]!,
  };
}

function mapChannelKind(ch: MmChannel): Channel["kind"] {
  if (ch.type === "D" || ch.type === "G") return "dm";
  if (ch.name === "cutover" || ch.display_name.toLowerCase().includes("cutover")) return "war-room";
  return "channel";
}

function mapChannel(
  ch: MmChannel,
  memberIds: string[],
  unread: number,
  mention: boolean,
  waveId?: string,
  dmLabel?: string,
): Channel {
  const kind = mapChannelKind(ch);
  return {
    id: ch.id,
    kind,
    name: kind === "dm" ? dmLabel || ch.display_name || ch.name : ch.name,
    topic: ch.purpose || ch.header || (kind === "war-room" ? "Cutover war room" : ""),
    unread,
    mention: mention || undefined,
    members: memberIds,
    pinned: kind === "war-room" || undefined,
    waveId,
  };
}

function aggregateReactions(rows: MmReaction[], currentUserId: string): Reaction[] {
  const map = new Map<string, Reaction>();
  for (const row of rows) {
    const mapped = EMOJI_REACTION[row.emoji_name] ?? {
      id: `mm:${row.emoji_name}`,
      label: `:${row.emoji_name}:`,
    };
    const existing = map.get(mapped.id);
    if (!existing) {
      map.set(mapped.id, {
        id: mapped.id,
        label: mapped.label,
        count: 1,
        mine: row.user_id === currentUserId,
      });
    } else {
      existing.count += 1;
      if (row.user_id === currentUserId) existing.mine = true;
    }
  }
  return [...map.values()];
}

function mapPost(post: MmPost, currentUserId: string, config?: MattermostConfig): Message {
  const reactions = aggregateReactions(post.metadata?.reactions ?? [], currentUserId);
  const system = Boolean(post.type && post.type !== "");
  const files = (post.metadata?.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mime_type,
    size: f.size,
    url: config ? `${config.baseUrl}/api/v4/files/${f.id}` : undefined,
  }));
  const updatedAt = post.update_at && post.update_at > post.create_at ? post.update_at : undefined;
  return {
    id: post.id,
    channelId: post.channel_id,
    authorId: post.user_id,
    body: post.message,
    createdAt: post.create_at,
    updatedAt,
    parentId: post.root_id || undefined,
    replyCount: post.reply_count || undefined,
    reactions,
    system: system || undefined,
    files: files.length ? files : undefined,
    pinnedAt: post.is_pinned ? (updatedAt ?? post.create_at) : undefined,
  };
}

async function resolveTeamId(
  config: MattermostConfig,
  preferredTeamId?: string | null,
): Promise<string> {
  if (preferredTeamId) {
    const teams = await mattermostMyTeams(config);
    if (teams.some((t) => t.id === preferredTeamId)) return preferredTeamId;
  }
  if (config.teamId) return config.teamId;
  const teams = await mattermostMyTeams(config);
  if (teams.length === 0) throw new Error("Mattermost: token user has no teams");
  const zyvor = teams.find((t) => t.name === "zyvor");
  return (zyvor ?? teams[0]!).id;
}

async function loadWaves(): Promise<Wave[]> {
  try {
    await ensureWorkspaceSeeded();
    const sqlSnap = await loadSqlWorkspace();
    if (sqlSnap.waves.length > 0) return sqlSnap.waves;
  } catch {
    /* fall through */
  }
  return buildSeed().waves;
}

export function isMattermostMessagingEnabled(): boolean {
  return getMattermostConfig() !== null;
}

export async function loadWorkspaceFromMattermost(
  session?: VerifiedUser | null,
): Promise<WorkspaceSnapshot> {
  const config = getMattermostConfig();
  if (!config) throw new Error("Mattermost not configured");

  const me = await mattermostMe(config);
  const preferredTeamId = session?.email
    ? await (await import("./extras.server")).getPreferredTeamId(session.email)
    : null;
  const teamId = await resolveTeamId(config, preferredTeamId);
  const [mmChannels, members] = await Promise.all([
    mattermostMyChannels(config, teamId),
    mattermostMyChannelMembers(config, teamId).catch(() => []),
  ]);

  const memberByChannel = new Map(members.map((m) => [m.channel_id, m]));

  // Prefer open channels + DMs; drop stock Mattermost defaults from the product nav.
  const usable = mmChannels.filter(
    (c) =>
      (c.type === "O" || c.type === "P" || c.type === "D") &&
      c.name !== "town-square" &&
      c.name !== "off-topic",
  );
  const preferred = ["cutover", "zyvor", "axiom", "zoreon", "ragnarok"];
  usable.sort((a, b) => {
    const ai = preferred.indexOf(a.name);
    const bi = preferred.indexOf(b.name);
    if (ai === -1 && bi === -1) return a.name.localeCompare(b.name);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const waves = await loadWaves();
  const cutoverWave = waves.find((w) => w.id.includes("cutover") || w.id.includes("wave")) ?? waves[0];

  const postBundles = await Promise.all(
    usable.map(async (ch) => {
      try {
        const bundle = await mattermostChannelPosts(config, ch.id);
        return { channelId: ch.id, bundle };
      } catch {
        return { channelId: ch.id, bundle: { order: [] as string[], posts: {} as Record<string, MmPost> } };
      }
    }),
  );

  const userIds = new Set<string>([me.id]);
  const messages: Message[] = [];
  for (const { bundle } of postBundles) {
    for (const id of bundle.order) {
      const post = bundle.posts[id];
      if (!post || (post.delete_at != null && post.delete_at > 0)) continue;
      userIds.add(post.user_id);
      messages.push(mapPost(post, me.id, config));
    }
  }

  // Merge pin state from dedicated pinned endpoints (is_pinned not always on channel posts).
  await Promise.all(
    usable.map(async (ch) => {
      try {
        const { mattermostPinnedPosts } = await import("./mattermost.server");
        const pinned = await mattermostPinnedPosts(config, ch.id);
        for (const id of pinned.order) {
          const post = pinned.posts[id];
          if (!post) continue;
          const existing = messages.find((m) => m.id === id);
          if (existing) existing.pinnedAt = post.create_at;
          else {
            userIds.add(post.user_id);
            const mapped = mapPost({ ...post, is_pinned: true }, me.id, config);
            messages.push(mapped);
          }
        }
      } catch {
        /* pin list optional */
      }
    }),
  );

  messages.sort((a, b) => a.createdAt - b.createdAt);

  const mmUsers = await mattermostUsersByIds(config, [...userIds]);
  const statuses = await mattermostStatusesByIds(config, [...userIds]).catch(() => []);
  const statusMap = new Map(statuses.map((s) => [s.user_id, s.status]));
  const users = mmUsers.map((u, i) => {
    const mapped = mapUser(u, i);
    const st = statusMap.get(u.id);
    if (st === "online") mapped.presence = "active";
    else if (st === "dnd") mapped.presence = "dnd";
    else if (st === "away" || st === "offline") mapped.presence = "away";
    return mapped;
  });
  if (!users.some((u) => u.id === me.id)) {
    users.unshift(mapUser(me, 0));
  }

  const memberPool = users.map((u) => u.id);
  const channels: Channel[] = usable.map((ch) => {
    let dmLabel: string | undefined;
    if (ch.type === "D") {
      const otherId = ch.name.split("__").find((id) => id && id !== me.id);
      const other = users.find((u) => u.id === otherId);
      dmLabel = other?.name ?? ch.display_name;
    }
    const mem = memberByChannel.get(ch.id);
    const total = ch.total_msg_count ?? 0;
    const read = mem?.msg_count ?? total;
    const unread = Math.max(0, total - read);
    const mention = (mem?.mention_count ?? 0) > 0;
    return mapChannel(
      ch,
      memberPool,
      unread,
      mention,
      mapChannelKind(ch) === "war-room" ? cutoverWave?.id : undefined,
      dmLabel,
    );
  });

  // Author overlays: Better Auth users posting via PAT still show as themselves.
  try {
    const { loadPostOverlays } = await import("./extras.server");
    const overlays = await loadPostOverlays(messages.map((m) => m.id));
    for (const m of messages) {
      const o = overlays.get(m.id);
      if (!o) continue;
      const handle = o.email.split("@")[0] || "user";
      let author = users.find((u) => u.handle === handle || u.name === o.name);
      if (!author) {
        author = {
          id: `overlay:${o.email}`,
          name: o.name,
          handle,
          role: "Zyvor",
          presence: "active",
          initials: initials(o.name),
          tone: "accent",
        };
        users.push(author);
      }
      m.authorId = author.id;
    }
  } catch {
    /* overlays optional until migration */
  }

  // Linked identity: prefer session user's MM account / token.
  let currentUserId = me.id;
  let identityWarning: string | undefined;
  const sessionEmail = session?.email?.trim().toLowerCase() || null;
  let hasUserToken = false;
  if (session?.id) {
    try {
      const { getStoredMmToken } = await import("./mm-tokens.server");
      const { ensureMattermostUserToken } = await import("./mm-session.server");
      let stored = await getStoredMmToken(session.id);
      if (!stored) {
        const minted = await ensureMattermostUserToken(session);
        if (minted) stored = minted;
      }
      if (stored) {
        hasUserToken = true;
        currentUserId = stored.mmUserId;
        if (!users.some((u) => u.id === stored.mmUserId)) {
          try {
            const linkedUsers = await mattermostUsersByIds(config, [stored.mmUserId]);
            if (linkedUsers[0]) users.unshift(mapUser(linkedUsers[0], 0));
          } catch {
            /* */
          }
        }
      }
    } catch {
      /* */
    }
  }
  if (!hasUserToken && sessionEmail) {
    try {
      const { mattermostGetUserByEmail } = await import("./mattermost.server");
      const linked = await mattermostGetUserByEmail(config, sessionEmail);
      currentUserId = linked.id;
      if (!users.some((u) => u.id === linked.id)) users.unshift(mapUser(linked, 0));
      if (me.email && linked.email && me.email.toLowerCase() !== linked.email.toLowerCase()) {
        identityWarning = `Linked as @${linked.username}; tape writes via PAT (${me.username})`;
      }
    } catch {
      const overlayId = `overlay:${sessionEmail}`;
      if (!users.some((u) => u.id === overlayId)) {
        const name = session?.name?.trim() || sessionEmail.split("@")[0] || "You";
        users.unshift({
          id: overlayId,
          name,
          handle: sessionEmail.split("@")[0] || "you",
          role: "Zyvor",
          presence: "active",
          initials: initials(name),
          tone: "accent",
        });
      }
      currentUserId = overlayId;
      if (me.email && sessionEmail !== me.email.trim().toLowerCase()) {
        identityWarning = `Signed in as ${sessionEmail}; tape posts as ${me.username}`;
      }
    }
    for (const m of messages) {
      if (m.authorId === `overlay:${sessionEmail}`) m.authorId = currentUserId;
    }
  } else if (hasUserToken && sessionEmail) {
    for (const m of messages) {
      if (m.authorId === `overlay:${sessionEmail}`) m.authorId = currentUserId;
    }
  }

  // Stars
  let starred = new Set<string>();
  try {
    const { getStarredChannelIds } = await import("./extras.server");
    starred = new Set(await getStarredChannelIds(session?.email));
  } catch {
    /* */
  }
  for (const ch of channels) {
    if (starred.has(ch.id)) ch.starred = true;
  }
  channels.sort((a, b) => {
    const as = Number(Boolean(a.starred || a.pinned));
    const bs = Number(Boolean(b.starred || b.pinned));
    return bs - as || a.name.localeCompare(b.name);
  });

  return {
    users,
    channels,
    messages,
    waves,
    currentUserId,
    backend: "mattermost",
    tapeUsername: me.username,
    identityWarning,
    teamId,
  };
}

export async function insertMessageMattermost(
  input: {
    channelId: string;
    body: string;
    parentId?: string;
    fileIds?: string[];
  },
  session?: VerifiedUser | null,
): Promise<Message> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) throw new Error("Mattermost not configured");
  const { config, mmUserId, asUser } = resolved;
  const post = await mattermostCreatePost(config, {
    channel_id: input.channelId,
    message: input.body.trim(),
    root_id: input.parentId,
    file_ids: input.fileIds,
  });
  if (!asUser && session?.email) {
    try {
      const { savePostOverlay } = await import("./extras.server");
      await savePostOverlay({
        messageId: post.id,
        authorEmail: session.email,
        authorName: session.name?.trim() || session.email.split("@")[0] || "User",
      });
    } catch {
      /* */
    }
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
  const mapped = mapPost(post, mmUserId, config);
  if (!asUser && session?.email) {
    mapped.authorId = `overlay:${session.email.trim().toLowerCase()}`;
  }
  return mapped;
}

export async function toggleReactionMattermost(
  input: {
    messageId: string;
    reactionId: string;
  },
  session?: VerifiedUser | null,
): Promise<void> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) throw new Error("Mattermost not configured");
  const { config, mmUserId } = resolved;
  const emoji =
    REACTION_EMOJI[input.reactionId] ??
    (input.reactionId.startsWith("mm:") ? input.reactionId.slice(3) : undefined);
  if (!emoji) throw new Error(`Unsupported reaction: ${input.reactionId}`);

  const userId = mmUserId;
  const existing =
    (await mattermostPostReactions(config, input.messageId).catch(() => [] as MmReaction[])) ??
    [];
  const mine = existing.some((r) => r.user_id === userId && r.emoji_name === emoji);
  if (mine) {
    await mattermostRemoveReaction(config, userId, input.messageId, emoji);
  } else {
    await mattermostAddReaction(config, {
      user_id: userId,
      post_id: input.messageId,
      emoji_name: emoji,
    });
  }
}

export async function markChannelReadMattermost(
  channelId: string,
  session?: VerifiedUser | null,
): Promise<void> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) return;
  try {
    await mattermostViewChannel(resolved.config, resolved.mmUserId, channelId);
  } catch {
    /* non-fatal */
  }
}

export async function toggleCheckMattermostAware(
  input: { waveId: string; itemId: string },
  session?: VerifiedUser | null,
): Promise<WorkspaceSnapshot> {
  await toggleCheckDb(input);
  if (isMattermostMessagingEnabled()) return loadWorkspaceFromMattermost(session);
  const uid = session?.id;
  return loadSqlWorkspace(uid);
}

export { resolveTeamId };

export async function createChannelMattermost(input: {
  name: string;
  displayName?: string;
  purpose?: string;
}): Promise<string> {
  const config = getMattermostConfig();
  if (!config) throw new Error("Mattermost not configured");
  const teamId = await resolveTeamId(config);
  const slug = input.name
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  if (!slug) throw new Error("Invalid channel name");
  const { mattermostCreateChannel } = await import("./mattermost.server");
  const ch = await mattermostCreateChannel(config, {
    team_id: teamId,
    name: slug,
    display_name: input.displayName?.trim() || slug,
    purpose: input.purpose,
    type: "O",
  });
  return ch.id;
}

export async function createDirectMattermost(
  otherUserId: string,
  session?: VerifiedUser | null,
): Promise<string> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) throw new Error("Mattermost not configured");
  const { mattermostCreateDirect } = await import("./mattermost.server");
  const ch = await mattermostCreateDirect(resolved.config, resolved.mmUserId, otherUserId);
  return ch.id;
}

export async function searchPostsMattermost(terms: string): Promise<
  { id: string; channelId: string; body: string; createdAt: number; authorId: string }[]
> {
  const config = getMattermostConfig();
  if (!config) throw new Error("Mattermost not configured");
  const teamId = await resolveTeamId(config);
  const { mattermostSearchPosts } = await import("./mattermost.server");
  const bundle = await mattermostSearchPosts(config, teamId, terms.trim());
  return bundle.order
    .map((id) => bundle.posts[id])
    .filter((p): p is MmPost => Boolean(p) && !(p.delete_at && p.delete_at > 0))
    .slice(0, 40)
    .map((p) => ({
      id: p.id,
      channelId: p.channel_id,
      body: p.message,
      createdAt: p.create_at,
      authorId: p.user_id,
    }));
}

export async function uploadFileMattermost(
  input: {
    channelId: string;
    name: string;
    type: string;
    base64: string;
  },
  session?: VerifiedUser | null,
): Promise<string> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) throw new Error("Mattermost not configured");
  const raw = Buffer.from(input.base64, "base64");
  if (raw.byteLength > 10 * 1024 * 1024) throw new Error("File too large (max 10MB)");
  const { mattermostUploadFile } = await import("./mattermost.server");
  const res = await mattermostUploadFile(resolved.config, input.channelId, {
    name: input.name,
    type: input.type,
    data: raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  });
  const id = res.file_infos[0]?.id;
  if (!id) throw new Error("Upload failed");
  return id;
}

/** Best-effort: ensure a Zoreon signup email exists on the MM team (+ token when userId given). */
export async function ensureMattermostTeamMemberForEmail(input: {
  email: string;
  name?: string | null;
  password?: string;
  userId?: string;
}): Promise<void> {
  const config = getMattermostConfig();
  if (!config) return;
  const {
    mattermostGetUserByEmail,
    mattermostCreateUser,
    mattermostAddTeamMember,
  } = await import("./mattermost.server");
  const teamId = await resolveTeamId(config);
  const email = input.email.trim().toLowerCase();
  let mmUserId: string | undefined;
  try {
    const existing = await mattermostGetUserByEmail(config, email);
    mmUserId = existing.id;
  } catch {
    const handle = email.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "") || "user";
    const username = `${handle}${Math.floor(Math.random() * 900 + 100)}`.slice(0, 22);
    const parts = (input.name ?? "").trim().split(/\s+/);
    try {
      const created = await mattermostCreateUser(config, {
        email,
        username,
        password: input.password || `Zoreon${randomSuffix()}!`,
        first_name: parts[0] || handle,
        last_name: parts.slice(1).join(" ") || "",
      });
      mmUserId = created.id;
    } catch {
      return;
    }
  }
  if (!mmUserId) return;
  try {
    await mattermostAddTeamMember(config, teamId, mmUserId);
  } catch {
    /* already a member */
  }
  if (input.userId) {
    try {
      const { mattermostCreateUserAccessToken } = await import("./mattermost.server");
      const { saveMmToken } = await import("./mm-tokens.server");
      const tok = await mattermostCreateUserAccessToken(config, mmUserId, "Zoreon workspace");
      if (tok.token) {
        await saveMmToken({ userId: input.userId, mmUserId, token: tok.token });
      }
    } catch {
      /* PAT may lack token permissions */
    }
  }
}

export async function updateMessageMattermost(
  input: {
    messageId: string;
    body: string;
  },
  session?: VerifiedUser | null,
): Promise<Message> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) throw new Error("Mattermost not configured");
  const { mattermostUpdatePost } = await import("./mattermost.server");
  const post = await mattermostUpdatePost(resolved.config, {
    id: input.messageId,
    message: input.body.trim(),
  });
  return mapPost(post, resolved.mmUserId, resolved.config);
}

export async function deleteMessageMattermost(
  messageId: string,
  session?: VerifiedUser | null,
): Promise<void> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) throw new Error("Mattermost not configured");
  const { mattermostDeletePost } = await import("./mattermost.server");
  await mattermostDeletePost(resolved.config, messageId);
}

export async function setStatusMattermost(
  status: "online" | "away" | "dnd" | "offline",
  session?: VerifiedUser | null,
): Promise<void> {
  const { configForSession } = await import("./mm-session.server");
  const resolved = await configForSession(session);
  if (!resolved) throw new Error("Mattermost not configured");
  const { mattermostSetStatus } = await import("./mattermost.server");
  await mattermostSetStatus(resolved.config, resolved.mmUserId, status);
}

export async function updateChannelTopicMattermost(input: {
  channelId: string;
  topic: string;
}): Promise<void> {
  const config = getMattermostConfig();
  if (!config) throw new Error("Mattermost not configured");
  const { mattermostUpdateChannel } = await import("./mattermost.server");
  await mattermostUpdateChannel(config, input.channelId, {
    purpose: input.topic,
    header: input.topic,
  });
}

export async function togglePinMattermost(input: {
  messageId: string;
  pin: boolean;
}): Promise<void> {
  const config = getMattermostConfig();
  if (!config) throw new Error("Mattermost not configured");
  const { mattermostPinPost, mattermostUnpinPost } = await import("./mattermost.server");
  if (input.pin) await mattermostPinPost(config, input.messageId);
  else await mattermostUnpinPost(config, input.messageId);
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 10);
}
