/**
 * Optional Mattermost API bridge.
 *
 * When MATTERMOST_URL + MATTERMOST_TOKEN are set on the server, callers can
 * exercise Mattermost REST as a migration/compat backend. The live Agora app
 * uses the Neon workspace API (`./api.ts`) as the product messaging plane —
 * Mattermost is the tape; Agora is the product.
 *
 * Env (server-only, never VITE_):
 *   MATTERMOST_URL   e.g. https://chat.example.com
 *   MATTERMOST_TOKEN Personal Access Token or session token
 */

export type MattermostConfig = {
  baseUrl: string;
  token: string;
};

export function getMattermostConfig(): MattermostConfig | null {
  const baseUrl = process.env.MATTERMOST_URL?.replace(/\/$/, "").trim();
  const token = process.env.MATTERMOST_TOKEN?.trim();
  if (!baseUrl || !token) return null;
  return { baseUrl, token };
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
      "Content-Type": "application/json",
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
  first_name: string;
  last_name: string;
  nickname: string;
};

export type MmChannel = {
  id: string;
  team_id: string;
  type: string;
  display_name: string;
  name: string;
  header: string;
  purpose: string;
};

export type MmPost = {
  id: string;
  create_at: number;
  user_id: string;
  channel_id: string;
  root_id: string;
  message: string;
};

export async function mattermostMe(config: MattermostConfig) {
  return mmFetch<MmUser>(config, "/users/me");
}

export async function mattermostMyChannels(config: MattermostConfig, teamId: string) {
  return mmFetch<MmChannel[]>(config, `/users/me/teams/${teamId}/channels`);
}

export async function mattermostChannelPosts(config: MattermostConfig, channelId: string) {
  return mmFetch<{ order: string[]; posts: Record<string, MmPost> }>(
    config,
    `/channels/${channelId}/posts?per_page=60`,
  );
}

export async function mattermostCreatePost(
  config: MattermostConfig,
  input: { channel_id: string; message: string; root_id?: string },
) {
  return mmFetch<MmPost>(config, "/posts", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
