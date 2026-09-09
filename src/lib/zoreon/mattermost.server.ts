/**
 * Optional Mattermost API bridge.
 *
 * When MATTERMOST_URL + MATTERMOST_TOKEN are set, Zoreon messaging reads/writes
 * Mattermost REST. Better Auth stays the product login; Mattermost is the tape.
 */

export type MattermostConfig = {
  baseUrl: string;
  token: string;
  teamId?: string;
};

export function getMattermostConfig(): MattermostConfig | null {
  const baseUrl = process.env.MATTERMOST_URL?.replace(/\/$/, "").trim();
  const token = process.env.MATTERMOST_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  const teamId = process.env.MATTERMOST_TEAM_ID?.trim() || undefined;
  return { baseUrl, token, teamId };
}

async function mmFetch<T>(
  config: MattermostConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${config.baseUrl}/api/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.token}`,
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mattermost ${path} → ${res.status} ${text.slice(0, 200)}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type MmUser = {
  id: string;
  username: string;
  email?: string;
  first_name: string;
  last_name: string;
  nickname: string;
  position?: string;
};

export type MmTeam = {
  id: string;
  name: string;
  display_name: string;
};

export type MmChannel = {
  id: string;
  team_id: string;
  type: string;
  display_name: string;
  name: string;
  header: string;
  purpose: string;
  total_msg_count?: number;
};

export type MmChannelMember = {
  channel_id: string;
  user_id: string;
  msg_count: number;
  mention_count: number;
  msg_count_root?: number;
};

export type MmReaction = {
  user_id: string;
  post_id: string;
  emoji_name: string;
  create_at: number;
};

export type MmFileInfo = {
  id: string;
  name: string;
  extension: string;
  size: number;
  mime_type: string;
  has_preview_image?: boolean;
};

export type MmPost = {
  id: string;
  create_at: number;
  update_at?: number;
  delete_at?: number;
  user_id: string;
  channel_id: string;
  root_id: string;
  message: string;
  type?: string;
  reply_count?: number;
  is_pinned?: boolean;
  file_ids?: string[];
  metadata?: {
    reactions?: MmReaction[];
    files?: MmFileInfo[];
  };
};

export type MmStatus = {
  user_id: string;
  status: string;
  manual?: boolean;
};

export async function mattermostMe(config: MattermostConfig) {
  return mmFetch<MmUser>(config, "/users/me");
}

export async function mattermostMyTeams(config: MattermostConfig) {
  return mmFetch<MmTeam[]>(config, "/users/me/teams");
}

export async function mattermostMyChannels(config: MattermostConfig, teamId: string) {
  return mmFetch<MmChannel[]>(config, `/users/me/teams/${teamId}/channels`);
}

export async function mattermostMyChannelMembers(config: MattermostConfig, teamId: string) {
  return mmFetch<MmChannelMember[]>(config, `/users/me/teams/${teamId}/channels/members`);
}

export async function mattermostChannelPosts(config: MattermostConfig, channelId: string) {
  return mmFetch<{ order: string[]; posts: Record<string, MmPost> }>(
    config,
    `/channels/${channelId}/posts?per_page=60`,
  );
}

export async function mattermostUsersByIds(config: MattermostConfig, ids: string[]) {
  if (ids.length === 0) return [] as MmUser[];
  return mmFetch<MmUser[]>(config, "/users/ids", {
    method: "POST",
    body: JSON.stringify(ids),
  });
}

export async function mattermostCreatePost(
  config: MattermostConfig,
  input: { channel_id: string; message: string; root_id?: string; file_ids?: string[] },
) {
  return mmFetch<MmPost>(config, "/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function mattermostUpdatePost(
  config: MattermostConfig,
  input: { id: string; message: string },
) {
  return mmFetch<MmPost>(config, `/posts/${input.id}`, {
    method: "PUT",
    body: JSON.stringify({ id: input.id, message: input.message }),
  });
}

export async function mattermostDeletePost(config: MattermostConfig, postId: string) {
  return mmFetch<void>(config, `/posts/${postId}`, { method: "DELETE" });
}

export async function mattermostUpdateChannel(
  config: MattermostConfig,
  channelId: string,
  input: { purpose?: string; header?: string },
) {
  return mmFetch<MmChannel>(config, `/channels/${channelId}/patch`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function mattermostPinPost(config: MattermostConfig, postId: string) {
  return mmFetch<void>(config, `/posts/${postId}/pin`, { method: "POST" });
}

export async function mattermostUnpinPost(config: MattermostConfig, postId: string) {
  return mmFetch<void>(config, `/posts/${postId}/unpin`, { method: "POST" });
}

export async function mattermostPinnedPosts(config: MattermostConfig, channelId: string) {
  return mmFetch<{ order: string[]; posts: Record<string, MmPost> }>(
    config,
    `/channels/${channelId}/pinned`,
  );
}

export async function mattermostAddReaction(
  config: MattermostConfig,
  input: { user_id: string; post_id: string; emoji_name: string },
) {
  return mmFetch<MmReaction>(config, "/reactions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function mattermostRemoveReaction(
  config: MattermostConfig,
  userId: string,
  postId: string,
  emojiName: string,
) {
  return mmFetch<void>(
    config,
    `/users/${userId}/posts/${postId}/reactions/${encodeURIComponent(emojiName)}`,
    { method: "DELETE" },
  );
}

export async function mattermostPostReactions(config: MattermostConfig, postId: string) {
  return mmFetch<MmReaction[]>(config, `/posts/${postId}/reactions`);
}

export async function mattermostGetPost(config: MattermostConfig, postId: string) {
  return mmFetch<MmPost>(config, `/posts/${postId}`);
}

export async function mattermostViewChannel(
  config: MattermostConfig,
  userId: string,
  channelId: string,
) {
  return mmFetch<unknown>(config, `/channels/members/${userId}/view`, {
    method: "POST",
    body: JSON.stringify({ channel_id: channelId, prev_channel_id: "" }),
  });
}

export async function mattermostCreateChannel(
  config: MattermostConfig,
  input: { team_id: string; name: string; display_name: string; type?: "O" | "P"; purpose?: string },
) {
  return mmFetch<MmChannel>(config, "/channels", {
    method: "POST",
    body: JSON.stringify({
      team_id: input.team_id,
      name: input.name,
      display_name: input.display_name,
      type: input.type ?? "O",
      purpose: input.purpose ?? "",
    }),
  });
}

export async function mattermostCreateDirect(
  config: MattermostConfig,
  userIdA: string,
  userIdB: string,
) {
  return mmFetch<MmChannel>(config, "/channels/direct", {
    method: "POST",
    body: JSON.stringify([userIdA, userIdB]),
  });
}

export async function mattermostSearchPosts(
  config: MattermostConfig,
  teamId: string,
  terms: string,
) {
  return mmFetch<{ order: string[]; posts: Record<string, MmPost> }>(
    config,
    `/teams/${teamId}/posts/search`,
    {
      method: "POST",
      body: JSON.stringify({ terms, is_or_search: false }),
    },
  );
}

export async function mattermostStatusesByIds(config: MattermostConfig, ids: string[]) {
  if (ids.length === 0) return [] as MmStatus[];
  return mmFetch<MmStatus[]>(config, "/users/status/ids", {
    method: "POST",
    body: JSON.stringify(ids),
  });
}

export async function mattermostSetStatus(
  config: MattermostConfig,
  userId: string,
  status: "online" | "away" | "dnd" | "offline",
) {
  return mmFetch<MmStatus>(config, `/users/${userId}/status`, {
    method: "PUT",
    body: JSON.stringify({ user_id: userId, status }),
  });
}

export async function mattermostGetUserByEmail(config: MattermostConfig, email: string) {
  return mmFetch<MmUser>(config, `/users/email/${encodeURIComponent(email)}`);
}

export async function mattermostCreateUser(
  config: MattermostConfig,
  input: { email: string; username: string; password: string; first_name?: string; last_name?: string },
) {
  return mmFetch<MmUser>(config, "/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function mattermostAddTeamMember(
  config: MattermostConfig,
  teamId: string,
  userId: string,
) {
  return mmFetch<unknown>(config, `/teams/${teamId}/members`, {
    method: "POST",
    body: JSON.stringify({ team_id: teamId, user_id: userId }),
  });
}

/** Requires system_admin (or manage tokens) on the PAT. Returns the raw token once. */
export async function mattermostCreateUserAccessToken(
  config: MattermostConfig,
  userId: string,
  description = "Zoreon",
) {
  return mmFetch<{ token: string; id: string; user_id: string; description: string }>(
    config,
    `/users/${userId}/tokens`,
    {
      method: "POST",
      body: JSON.stringify({ description }),
    },
  );
}

export async function mattermostUploadFile(
  config: MattermostConfig,
  channelId: string,
  file: { name: string; type: string; data: ArrayBuffer },
) {
  const form = new FormData();
  form.append("channel_id", channelId);
  form.append("files", new Blob([file.data], { type: file.type || "application/octet-stream" }), file.name);
  return mmFetch<{ file_infos: MmFileInfo[] }>(config, "/files", {
    method: "POST",
    body: form,
  });
}

export function mattermostFileUrl(config: MattermostConfig, fileId: string) {
  return `${config.baseUrl}/api/v4/files/${fileId}`;
}

export async function mattermostProbe(): Promise<
  { ok: true; username: string } | { ok: false; reason: string }
> {
  const config = getMattermostConfig();
  if (!config) return { ok: false, reason: "MATTERMOST_URL / MATTERMOST_TOKEN not set" };
  try {
    const me = await mattermostMe(config);
    return { ok: true, username: me.username };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Mattermost unreachable" };
  }
}

/** Zoreon reaction id ↔ Mattermost emoji_name */
export const REACTION_EMOJI: Record<string, string> = {
  ack: "+1",
  ship: "rocket",
  watch: "eyes",
  heart: "heart",
  laugh: "laughing",
  fire: "fire",
  tada: "tada",
  thinking: "thinking_face",
  clap: "clap",
  pray: "pray",
  check: "white_check_mark",
  x: "x",
  wave: "wave",
  hundred: "100",
  eyes2: "eyes",
  rocket2: "rocket",
};

export const EMOJI_REACTION: Record<string, { id: string; label: string }> = {
  "+1": { id: "ack", label: "👍" },
  thumbsup: { id: "ack", label: "👍" },
  rocket: { id: "ship", label: "🚀" },
  eyes: { id: "watch", label: "👀" },
  heart: { id: "heart", label: "❤️" },
  laughing: { id: "laugh", label: "😂" },
  fire: { id: "fire", label: "🔥" },
  tada: { id: "tada", label: "🎉" },
  thinking_face: { id: "thinking", label: "🤔" },
  clap: { id: "clap", label: "👏" },
  pray: { id: "pray", label: "🙏" },
  white_check_mark: { id: "check", label: "✅" },
  x: { id: "x", label: "❌" },
  wave: { id: "wave", label: "👋" },
  "100": { id: "hundred", label: "💯" },
};
