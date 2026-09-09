import type { VerifiedUser } from "@/lib/auth/verify.server";
import {
  getMattermostConfig,
  mattermostAddTeamMember,
  mattermostCreateUser,
  mattermostCreateUserAccessToken,
  mattermostGetUserByEmail,
  mattermostMe,
  type MattermostConfig,
} from "./mattermost.server";
import { getStoredMmToken, saveMmToken } from "./mm-tokens.server";

export type SessionMmConfig = {
  config: MattermostConfig;
  mmUserId: string;
  /** True when writing as the Better Auth user (not admin PAT). */
  asUser: boolean;
};

async function resolveTeamId(admin: MattermostConfig, preferred?: string | null): Promise<string> {
  if (preferred) return preferred;
  if (admin.teamId) return admin.teamId;
  const { mattermostMyTeams } = await import("./mattermost.server");
  const teams = await mattermostMyTeams(admin);
  if (!teams[0]) throw new Error("No Mattermost teams for tape user");
  return teams[0].id;
}

/** Ensure MM user exists, is on team, and we have a stored user access token. */
export async function ensureMattermostUserToken(
  session: VerifiedUser,
): Promise<{ mmUserId: string; token: string } | null> {
  const admin = getMattermostConfig();
  if (!admin || !session.email) return null;

  const existing = await getStoredMmToken(session.id);
  if (existing) return existing;

  const email = session.email.trim().toLowerCase();
  let mmUserId: string | undefined;
  try {
    const u = await mattermostGetUserByEmail(admin, email);
    mmUserId = u.id;
  } catch {
    const handle = email.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "") || "user";
    const username = `${handle}${Math.floor(Math.random() * 900 + 100)}`.slice(0, 22);
    const parts = (session.name ?? "").trim().split(/\s+/);
    try {
      const created = await mattermostCreateUser(admin, {
        email,
        username,
        password: `Zoreon${Math.random().toString(36).slice(2, 10)}!`,
        first_name: parts[0] || handle,
        last_name: parts.slice(1).join(" ") || "",
      });
      mmUserId = created.id;
    } catch {
      return null;
    }
  }
  if (!mmUserId) return null;

  try {
    const preferred = session.email
      ? await (await import("./extras.server")).getPreferredTeamId(session.email)
      : null;
    const teamId = await resolveTeamId(admin, preferred);
    await mattermostAddTeamMember(admin, teamId, mmUserId);
  } catch {
    /* already member */
  }

  try {
    const tok = await mattermostCreateUserAccessToken(admin, mmUserId, "Zoreon workspace");
    if (!tok.token) return null;
    await saveMmToken({ userId: session.id, mmUserId, token: tok.token });
    return { mmUserId, token: tok.token };
  } catch {
    return null;
  }
}

/**
 * Resolve Mattermost config for writes: prefer stored per-user access token.
 * Falls back to admin PAT (asUser=false) when mint/lookup fails.
 */
export async function configForSession(
  session?: VerifiedUser | null,
): Promise<SessionMmConfig | null> {
  const admin = getMattermostConfig();
  if (!admin) return null;

  if (!session?.id || !session.email) {
    const me = await mattermostMe(admin);
    return { config: admin, mmUserId: me.id, asUser: false };
  }

  const stored = await getStoredMmToken(session.id);
  if (stored) {
    return {
      config: { ...admin, token: stored.token },
      mmUserId: stored.mmUserId,
      asUser: true,
    };
  }

  const minted = await ensureMattermostUserToken(session);
  if (minted) {
    return {
      config: { ...admin, token: minted.token },
      mmUserId: minted.mmUserId,
      asUser: true,
    };
  }

  const me = await mattermostMe(admin);
  return { config: admin, mmUserId: me.id, asUser: false };
}
