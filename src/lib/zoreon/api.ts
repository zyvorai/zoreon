import { createServerFn } from "@tanstack/react-start";
import type { Channel, Message, MessagingBackend, User, Wave } from "@/data/types";
import type { WorkspaceSnapshot } from "./workspace.server";

export type { WorkspaceSnapshot };

async function requireSession() {
  const { requireUserId, getSessionUser } = await import("@/lib/auth/verify.server");
  await requireUserId();
  return getSessionUser();
}

async function withAdmin(
  session: Awaited<ReturnType<typeof requireSession>>,
  snap: WorkspaceSnapshot,
): Promise<WorkspaceSnapshot> {
  const { isWorkspaceAdmin } = await import("./admins.server");
  return { ...snap, isAdmin: await isWorkspaceAdmin(session?.email) };
}

export const fetchWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const { isDeactivated } = await import("./admin.server");
    if (await isDeactivated(session?.email)) {
      throw new Error("Account deactivated — contact a workspace admin");
    }
    const { isWorkspaceAdmin } = await import("./admins.server");
    const isAdmin = await isWorkspaceAdmin(session?.email);
    const { isMattermostMessagingEnabled, loadWorkspaceFromMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (isMattermostMessagingEnabled()) {
      const snap = await loadWorkspaceFromMattermost(session);
      return withAdmin(session, await applyUnreadPrefs(session?.email, snap));
    }
    const { ensureProfileForSession, loadWorkspace } = await import("./workspace.server");
    if (session) await ensureProfileForSession(session, { isAdmin });
    const snap = await loadWorkspace(session?.id);
    if (session?.email) {
      try {
        const { getStarredChannelIds } = await import("./extras.server");
        const starred = new Set(await getStarredChannelIds(session.email));
        for (const ch of snap.channels) {
          if (starred.has(ch.id)) ch.starred = true;
        }
      } catch {
        /* extras optional */
      }
    }
    return withAdmin(session, await applyUnreadPrefs(session?.email, snap));
  },
);

async function applyUnreadPrefs(
  email: string | null | undefined,
  snap: WorkspaceSnapshot,
): Promise<WorkspaceSnapshot> {
  try {
    const {
      getNotifPrefs,
      getChannelPrefs,
      channelIsEffectivelyMuted,
    } = await import("./extras.server");
    const prefs = await getNotifPrefs(email);
    const channelPrefs = await getChannelPrefs(email);
    const byId = new Map(channelPrefs.map((p) => [p.channelId, p]));
    for (const ch of snap.channels) {
      const pref = byId.get(ch.id);
      if (channelIsEffectivelyMuted(pref)) {
        ch.unread = 0;
        ch.mention = false;
        continue;
      }
      if (prefs.muteDms && ch.kind === "dm") {
        ch.unread = 0;
        ch.mention = false;
        continue;
      }
      if (pref?.notifyLevel === "mentions" && !ch.mention) {
        ch.unread = 0;
      }
    }
  } catch {
    /* */
  }
  return snap;
}

export const postMessage = createServerFn({ method: "POST" })
  .validator(
    (input: {
      channelId: string;
      body: string;
      parentId?: string;
      fileIds?: string[];
    }) => input,
  )
  .handler(async ({ data }): Promise<Message> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, insertMessageMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (isMattermostMessagingEnabled()) {
      return insertMessageMattermost(
        {
          channelId: data.channelId,
          body: data.body,
          parentId: data.parentId,
          fileIds: data.fileIds,
        },
        session,
      );
    }
    const { ensureProfileForSession, insertMessage } = await import("./workspace.server");
    if (!session) throw new Error("Unauthorized");
    const authorId = await ensureProfileForSession(session);
    return insertMessage({
      channelId: data.channelId,
      authorId,
      body: data.body,
      parentId: data.parentId,
    });
  });

export const reactToMessage = createServerFn({ method: "POST" })
  .validator((input: { messageId: string; reactionId: string; label: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, loadWorkspaceFromMattermost, toggleReactionMattermost } =
      await import("./mattermost-workspace.server");
    if (isMattermostMessagingEnabled()) {
      await toggleReactionMattermost(
        {
          messageId: data.messageId,
          reactionId: data.reactionId,
        },
        session,
      );
      return withAdmin(session, await loadWorkspaceFromMattermost(session));
    }
    const { ensureProfileForSession, toggleReactionDb, loadWorkspace } = await import(
      "./workspace.server"
    );
    if (!session) throw new Error("Unauthorized");
    const userId = await ensureProfileForSession(session);
    await toggleReactionDb({
      messageId: data.messageId,
      reactionId: data.reactionId,
      label: data.label,
      userId,
    });
    return withAdmin(session, await loadWorkspace(userId));
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .validator((input: { waveId: string; itemId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const { toggleCheckMattermostAware } = await import("./mattermost-workspace.server");
    return withAdmin(session, await toggleCheckMattermostAware(data, session));
  });

export const selectChannel = createServerFn({ method: "POST" })
  .validator((input: { channelId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const {
      isMattermostMessagingEnabled,
      loadWorkspaceFromMattermost,
      markChannelReadMattermost,
    } = await import("./mattermost-workspace.server");
    if (isMattermostMessagingEnabled()) {
      await markChannelReadMattermost(data.channelId, session);
      return withAdmin(session, await loadWorkspaceFromMattermost(session));
    }
    const { markChannelRead, loadWorkspace, ensureProfileForSession } = await import(
      "./workspace.server"
    );
    await markChannelRead(data.channelId);
    if (session) await ensureProfileForSession(session);
    return withAdmin(session, await loadWorkspace(session?.id));
  });

export const resetWorkspaceData = createServerFn({ method: "POST" }).handler(
  async (): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, loadWorkspaceFromMattermost } = await import(
      "./mattermost-workspace.server"
    );
    // Mattermost mode: refresh from tape (do not wipe MM).
    if (isMattermostMessagingEnabled()) return withAdmin(session, await loadWorkspaceFromMattermost(session));
    const { resetWorkspace, ensureProfileForSession, loadWorkspace } = await import(
      "./workspace.server"
    );
    await resetWorkspace();
    if (session) {
      await ensureProfileForSession(session);
      return withAdmin(session, await loadWorkspace(session.id));
    }
    return withAdmin(session, await loadWorkspace());
  },
);

/** Diagnostics: is an optional Mattermost server configured and reachable? */
export const probeMattermost = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { mattermostProbe } = await import("./mattermost.server");
  return mattermostProbe();
});

export const validateInvite = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => input)
  .handler(async ({ data }) => {
    const { ensureWorkspaceSeeded } = await import("./workspace.server");
    await ensureWorkspaceSeeded();
    const { validateInviteToken } = await import("./invites.server");
    return { ok: await validateInviteToken(data.token) };
  });

export const getInviteLink = createServerFn({ method: "POST" }).handler(async () => {
  const session = await requireSession();
  const { isWorkspaceAdmin } = await import("./admins.server");
  if (!(await isWorkspaceAdmin(session?.email))) {
    throw new Error("Only workspace admins can create invite links");
  }
  const { ensureWorkspaceSeeded } = await import("./workspace.server");
  await ensureWorkspaceSeeded();
  const { ensureActiveInvite } = await import("./invites.server");
  const token = await ensureActiveInvite(session?.id ?? "admin");
  return { token, path: `/join?token=${encodeURIComponent(token)}` };
});

export const regenerateInviteLink = createServerFn({ method: "POST" }).handler(async () => {
  const session = await requireSession();
  const { isWorkspaceAdmin } = await import("./admins.server");
  if (!(await isWorkspaceAdmin(session?.email))) {
    throw new Error("Only workspace admins can regenerate invite links");
  }
  const { ensureWorkspaceSeeded } = await import("./workspace.server");
  await ensureWorkspaceSeeded();
  const { regenerateInvite } = await import("./invites.server");
  const token = await regenerateInvite(session?.id ?? "admin");
  return { token, path: `/join?token=${encodeURIComponent(token)}` };
});

export const completeInviteSignup = createServerFn({ method: "POST" })
  .validator((input: { token: string; email: string; name?: string; password?: string }) => input)
  .handler(async ({ data }) => {
    const { ensureWorkspaceSeeded } = await import("./workspace.server");
    await ensureWorkspaceSeeded();
    const { validateInviteToken, consumeInvite } = await import("./invites.server");
    if (!(await validateInviteToken(data.token))) {
      throw new Error("Invalid or expired invite");
    }
    await consumeInvite(data.token);
    const { isMattermostMessagingEnabled, ensureMattermostTeamMemberForEmail } = await import(
      "./mattermost-workspace.server"
    );
    if (isMattermostMessagingEnabled()) {
      await ensureMattermostTeamMemberForEmail({
        email: data.email,
        name: data.name,
        password: data.password,
      });
    }
    return { ok: true as const };
  });

export const createChannel = createServerFn({ method: "POST" })
  .validator((input: { name: string; purpose?: string }) => input)
  .handler(async ({ data }): Promise<{ channelId: string }> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, createChannelMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (isMattermostMessagingEnabled()) {
      const channelId = await createChannelMattermost({ name: data.name, purpose: data.purpose });
      return { channelId };
    }
    const { ensureWorkspaceSeeded } = await import("./workspace.server");
    const { getSql } = await import("@/lib/db");
    await ensureWorkspaceSeeded();
    const sql = await getSql();
    const id = `ch-${data.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}-${Date.now().toString(36)}`;
    const uid = session?.id ?? "u-ssahani";
    await sql`
      insert into agora_channels (id, kind, name, topic, unread, mention, pinned, wave_id, member_ids)
      values (
        ${id},
        ${"channel"},
        ${data.name.replace(/^#/, "").slice(0, 64)},
        ${data.purpose ?? ""},
        ${0},
        ${false},
        ${false},
        ${null},
        ${JSON.stringify([uid])}
      )
    `;
    return { channelId: id };
  });

export const createDirect = createServerFn({ method: "POST" })
  .validator((input: { userId: string }) => input)
  .handler(async ({ data }): Promise<{ channelId: string }> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, createDirectMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (!isMattermostMessagingEnabled()) throw new Error("Direct messages require Mattermost");
    const channelId = await createDirectMattermost(data.userId, session);
    return { channelId };
  });

export const searchMessages = createServerFn({ method: "POST" })
  .validator((input: { terms: string }) => input)
  .handler(
    async ({
      data,
    }): Promise<{ id: string; channelId: string; body: string; createdAt: number; authorId: string }[]> => {
      await requireSession();
      const { parseSearchQuery } = await import("./search-parse");
      const parsed = parseSearchQuery(data.terms);
      const { isMattermostMessagingEnabled, searchPostsMattermost } = await import(
        "./mattermost-workspace.server"
      );
      if (isMattermostMessagingEnabled()) {
        return searchPostsMattermost(parsed.mmTerms || parsed.freeText || data.terms);
      }
      const { ensureWorkspaceSeeded } = await import("./workspace.server");
      const { getSql } = await import("@/lib/db");
      await ensureWorkspaceSeeded();
      const sql = await getSql();
      const q = `%${(parsed.freeText || data.terms).trim()}%`;
      let rows = await sql<{
        id: string;
        channel_id: string;
        body: string;
        created_at: number;
        author_id: string;
      }>`
        select id, channel_id, body, created_at, author_id
        from agora_messages
        where body ilike ${q}
        order by created_at desc
        limit 80
      `;
      if (parsed.inChannel) {
        const ch = parsed.inChannel.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.channel_id.toLowerCase().includes(ch) ||
            r.channel_id.toLowerCase() === ch,
        );
      }
      if (parsed.from) {
        const f = parsed.from.toLowerCase();
        rows = rows.filter((r) => r.author_id.toLowerCase().includes(f));
      }
      if (parsed.after) {
        const t = Date.parse(parsed.after);
        if (!Number.isNaN(t)) rows = rows.filter((r) => Number(r.created_at) >= t);
      }
      if (parsed.before) {
        const t = Date.parse(parsed.before);
        if (!Number.isNaN(t)) rows = rows.filter((r) => Number(r.created_at) <= t);
      }
      if (parsed.has === "link") {
        rows = rows.filter((r) => /https?:\/\//i.test(r.body));
      }
      return rows.slice(0, 40).map((r) => ({
        id: r.id,
        channelId: r.channel_id,
        body: r.body,
        createdAt: Number(r.created_at),
        authorId: r.author_id,
      }));
    },
  );

export const uploadFile = createServerFn({ method: "POST" })
  .validator((input: { channelId: string; name: string; type: string; base64: string }) => input)
  .handler(async ({ data }): Promise<{ fileId: string }> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, uploadFileMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (!isMattermostMessagingEnabled()) throw new Error("File upload requires Mattermost");
    const fileId = await uploadFileMattermost(data, session);
    return { fileId };
  });

export const editMessage = createServerFn({ method: "POST" })
  .validator((input: { messageId: string; body: string }) => input)
  .handler(async ({ data }): Promise<Message> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, updateMessageMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (isMattermostMessagingEnabled()) {
      return updateMessageMattermost({ messageId: data.messageId, body: data.body }, session);
    }
    const { ensureProfileForSession, updateMessageDb } = await import("./workspace.server");
    if (!session) throw new Error("Unauthorized");
    const authorId = await ensureProfileForSession(session);
    return updateMessageDb({ messageId: data.messageId, body: data.body, authorId });
  });

export const deleteMessage = createServerFn({ method: "POST" })
  .validator((input: { messageId: string }) => input)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, deleteMessageMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (isMattermostMessagingEnabled()) {
      await deleteMessageMattermost(data.messageId, session);
      return { ok: true };
    }
    const { ensureProfileForSession, deleteMessageDb } = await import("./workspace.server");
    if (!session) throw new Error("Unauthorized");
    const authorId = await ensureProfileForSession(session);
    await deleteMessageDb({ messageId: data.messageId, authorId });
    return { ok: true };
  });

export const setMyStatus = createServerFn({ method: "POST" })
  .validator((input: { status: "online" | "away" | "dnd" | "offline" }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, setStatusMattermost, loadWorkspaceFromMattermost } =
      await import("./mattermost-workspace.server");
    if (isMattermostMessagingEnabled()) {
      await setStatusMattermost(data.status, session);
      return withAdmin(session, await loadWorkspaceFromMattermost(session));
    }
    const { ensureProfileForSession, setPresenceDb, loadWorkspace } = await import(
      "./workspace.server"
    );
    if (!session) throw new Error("Unauthorized");
    const userId = await ensureProfileForSession(session);
    const presence =
      data.status === "online" ? "active" : data.status === "dnd" ? "dnd" : "away";
    await setPresenceDb({ userId, presence });
    return withAdmin(session, await loadWorkspace(userId));
  });

export const updateChannelTopic = createServerFn({ method: "POST" })
  .validator((input: { channelId: string; topic: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const {
      isMattermostMessagingEnabled,
      updateChannelTopicMattermost,
      loadWorkspaceFromMattermost,
    } = await import("./mattermost-workspace.server");
    if (isMattermostMessagingEnabled()) {
      await updateChannelTopicMattermost(data);
      return withAdmin(session, await loadWorkspaceFromMattermost(session));
    }
    const { updateChannelTopicDb, loadWorkspace, ensureProfileForSession } = await import(
      "./workspace.server"
    );
    await updateChannelTopicDb(data);
    if (session) await ensureProfileForSession(session);
    return withAdmin(session, await loadWorkspace(session?.id));
  });

export const togglePin = createServerFn({ method: "POST" })
  .validator((input: { messageId: string; pin: boolean }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    const { isMattermostMessagingEnabled, togglePinMattermost, loadWorkspaceFromMattermost } =
      await import("./mattermost-workspace.server");
    if (isMattermostMessagingEnabled()) {
      await togglePinMattermost(data);
      return withAdmin(session, await loadWorkspaceFromMattermost(session));
    }
    const { togglePinDb, loadWorkspace, ensureProfileForSession } = await import(
      "./workspace.server"
    );
    await togglePinDb(data);
    if (session) await ensureProfileForSession(session);
    return withAdmin(session, await loadWorkspace(session?.id));
  });

export const toggleStarChannel = createServerFn({ method: "POST" })
  .validator((input: { channelId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { toggleStarChannel: toggle } = await import("./extras.server");
    await toggle(session.email, data.channelId);
    const { isMattermostMessagingEnabled, loadWorkspaceFromMattermost } = await import(
      "./mattermost-workspace.server"
    );
    if (isMattermostMessagingEnabled()) {
      return withAdmin(session, await loadWorkspaceFromMattermost(session));
    }
    const { loadWorkspace, ensureProfileForSession } = await import("./workspace.server");
    await ensureProfileForSession(session);
    return withAdmin(session, await loadWorkspace(session.id));
  });

export const listBookmarks = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const { listBookmarks: list } = await import("./extras.server");
  return list(session?.email);
});

export const addBookmark = createServerFn({ method: "POST" })
  .validator((input: { messageId: string; channelId: string; snippet: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { addBookmark: add } = await import("./extras.server");
    return add({ email: session.email, ...data });
  });

export const removeBookmark = createServerFn({ method: "POST" })
  .validator((input: { bookmarkId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { removeBookmark: remove } = await import("./extras.server");
    await remove(session.email, data.bookmarkId);
    return { ok: true as const };
  });

export const listReminders = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const { listReminders: list } = await import("./extras.server");
  return list(session?.email);
});

export const addReminder = createServerFn({ method: "POST" })
  .validator(
    (input: { messageId: string; channelId: string; snippet: string; remindAt: number }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { addReminder: add } = await import("./extras.server");
    return add({ email: session.email, ...data });
  });

export const completeReminder = createServerFn({ method: "POST" })
  .validator((input: { reminderId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { completeReminder: complete } = await import("./extras.server");
    await complete(session.email, data.reminderId);
    return { ok: true as const };
  });

export const getNotifPrefs = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const { getNotifPrefs: get } = await import("./extras.server");
  return get(session?.email);
});

export const setNotifPrefs = createServerFn({ method: "POST" })
  .validator(
    (input: {
      desktop: boolean;
      mentionsOnly: boolean;
      muteDms: boolean;
      quietStart?: number | null;
      quietEnd?: number | null;
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { setNotifPrefs: set, getNotifPrefs: get } = await import("./extras.server");
    const cur = await get(session.email);
    const next = {
      desktop: data.desktop,
      mentionsOnly: data.mentionsOnly,
      muteDms: data.muteDms,
      quietStart: data.quietStart !== undefined ? data.quietStart : cur.quietStart,
      quietEnd: data.quietEnd !== undefined ? data.quietEnd : cur.quietEnd,
    };
    await set(session.email, next);
    return next;
  });

export const listTeams = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { getMattermostConfig, mattermostMyTeams } = await import("./mattermost.server");
  const config = getMattermostConfig();
  if (!config) return [] as { id: string; name: string; displayName: string }[];
  const teams = await mattermostMyTeams(config);
  return teams.map((t) => ({ id: t.id, name: t.name, displayName: t.display_name }));
});

export const setPreferredTeam = createServerFn({ method: "POST" })
  .validator((input: { teamId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { setPreferredTeamId } = await import("./extras.server");
    await setPreferredTeamId(session.email, data.teamId);
    const { loadWorkspaceFromMattermost } = await import("./mattermost-workspace.server");
    return withAdmin(session, await loadWorkspaceFromMattermost(session));
  });

export const sendTyping = createServerFn({ method: "POST" })
  .validator((input: { channelId: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { broadcastRealtime } = await import("./realtime.server");
    broadcastRealtime({
      type: "typing",
      channelId: data.channelId,
      userId: session?.id ?? "anon",
      userName: session?.name || session?.email?.split("@")[0] || "Someone",
      at: Date.now(),
    });
    return { ok: true as const };
  });

export const smtpStatus = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  const { isSmtpConfigured } = await import("./mail.server");
  return { configured: isSmtpConfigured() };
});

export const sendInviteEmail = createServerFn({ method: "POST" })
  .validator((input: { emails: string[]; origin: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { isWorkspaceAdmin } = await import("./admins.server");
    if (!(await isWorkspaceAdmin(session?.email))) {
      throw new Error("Only workspace admins can send invites");
    }
    const { ensureActiveInvite } = await import("./invites.server");
    const { sendMail, SmtpNotConfigured } = await import("./mail.server");
    const { writeAudit } = await import("./admin.server");
    const token = await ensureActiveInvite(session?.id ?? "admin");
    const path = `/join?token=${encodeURIComponent(token)}`;
    const url = `${data.origin.replace(/\/$/, "")}${path}`;
    const emails = [...new Set(data.emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (emails.length === 0) throw new Error("Add at least one email");
    const sent: string[] = [];
    const failed: { email: string; error: string }[] = [];
    for (const to of emails) {
      try {
        await sendMail({
          to,
          subject: "Join Zyvor on Zoreon",
          text: `You're invited to the Zyvor workspace on Zoreon.\n\nJoin here:\n${url}\n`,
          html: `<p>You're invited to the Zyvor workspace on Zoreon.</p><p><a href="${url}">Join workspace</a></p>`,
        });
        sent.push(to);
      } catch (err) {
        if (err instanceof SmtpNotConfigured) throw err;
        failed.push({ email: to, error: err instanceof Error ? err.message : "send failed" });
      }
    }
    await writeAudit({
      actorEmail: session?.email,
      action: "invite.email",
      meta: { sent, failed },
    });
    return { sent, failed, path };
  });

export const getChannelPrefs = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const { getChannelPrefs: get } = await import("./extras.server");
  return get(session?.email);
});

export const setChannelPref = createServerFn({ method: "POST" })
  .validator(
    (input: {
      channelId: string;
      muted?: boolean;
      muteUntil?: number | null;
      notifyLevel?: "all" | "mentions" | "nothing";
    }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { setChannelPref: set } = await import("./extras.server");
    await set(session.email, data);
    return { ok: true as const };
  });

export const listKeywords = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const { listKeywords: list } = await import("./extras.server");
  return list(session?.email);
});

export const addKeyword = createServerFn({ method: "POST" })
  .validator((input: { keyword: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { addKeyword: add, listKeywords: list } = await import("./extras.server");
    await add(session.email, data.keyword);
    return list(session.email);
  });

export const removeKeyword = createServerFn({ method: "POST" })
  .validator((input: { keyword: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { removeKeyword: remove, listKeywords: list } = await import("./extras.server");
    await remove(session.email, data.keyword);
    return list(session.email);
  });

export const listSavedSearches = createServerFn({ method: "GET" }).handler(async () => {
  const session = await requireSession();
  const { listSavedSearches: list } = await import("./extras.server");
  return list(session?.email);
});

export const saveSearch = createServerFn({ method: "POST" })
  .validator((input: { name: string; query: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { saveSearch: save } = await import("./extras.server");
    return save(session.email, data.name, data.query);
  });

export const deleteSavedSearch = createServerFn({ method: "POST" })
  .validator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { deleteSavedSearch: del } = await import("./extras.server");
    await del(session.email, data.id);
    return { ok: true as const };
  });

export const adminList = createServerFn({ method: "GET" }).handler(
  async (): Promise<{
    admins: string[];
    deactivated: string[];
    audit: { id: string; at: number; actorEmail: string | null; action: string; meta: string }[];
    retentionDays: number | null;
  }> => {
    const session = await requireSession();
    const { isWorkspaceAdmin, listWorkspaceAdmins } = await import("./admins.server");
    if (!(await isWorkspaceAdmin(session?.email))) throw new Error("Admin only");
    const { listDeactivated, listAuditLog, getRetentionDays } = await import("./admin.server");
    const audit = (await listAuditLog(40)).map((a) => ({
      id: a.id,
      at: a.at,
      actorEmail: a.actorEmail,
      action: a.action,
      meta: JSON.stringify(a.meta ?? {}),
    }));
    return {
      admins: await listWorkspaceAdmins(),
      deactivated: await listDeactivated(),
      audit,
      retentionDays: await getRetentionDays(),
    };
  },
);

export const adminPromote = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { isWorkspaceAdmin, ensureWorkspaceAdmin, listWorkspaceAdmins } = await import(
      "./admins.server"
    );
    if (!(await isWorkspaceAdmin(session?.email))) throw new Error("Admin only");
    await ensureWorkspaceAdmin(data.email);
    const { writeAudit } = await import("./admin.server");
    await writeAudit({ actorEmail: session?.email, action: "admin.promote", meta: { email: data.email } });
    return listWorkspaceAdmins();
  });

export const adminDemote = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { isWorkspaceAdmin, removeWorkspaceAdmin, listWorkspaceAdmins } = await import(
      "./admins.server"
    );
    if (!(await isWorkspaceAdmin(session?.email))) throw new Error("Admin only");
    if (session?.email?.toLowerCase() === data.email.trim().toLowerCase()) {
      throw new Error("Cannot demote yourself");
    }
    await removeWorkspaceAdmin(data.email);
    const { writeAudit } = await import("./admin.server");
    await writeAudit({ actorEmail: session?.email, action: "admin.demote", meta: { email: data.email } });
    return listWorkspaceAdmins();
  });

export const adminDeactivate = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { isWorkspaceAdmin } = await import("./admins.server");
    if (!(await isWorkspaceAdmin(session?.email))) throw new Error("Admin only");
    const { deactivateUser, listDeactivated, writeAudit } = await import("./admin.server");
    await deactivateUser(data.email, session?.email ?? null);
    await writeAudit({
      actorEmail: session?.email,
      action: "user.deactivate",
      meta: { email: data.email },
    });
    return listDeactivated();
  });

export const adminReactivate = createServerFn({ method: "POST" })
  .validator((input: { email: string }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { isWorkspaceAdmin } = await import("./admins.server");
    if (!(await isWorkspaceAdmin(session?.email))) throw new Error("Admin only");
    const { reactivateUser, listDeactivated, writeAudit } = await import("./admin.server");
    await reactivateUser(data.email);
    await writeAudit({
      actorEmail: session?.email,
      action: "user.reactivate",
      meta: { email: data.email },
    });
    return listDeactivated();
  });

export const adminSetRetention = createServerFn({ method: "POST" })
  .validator((input: { days: number | null }) => input)
  .handler(async ({ data }) => {
    const session = await requireSession();
    const { isWorkspaceAdmin } = await import("./admins.server");
    if (!(await isWorkspaceAdmin(session?.email))) throw new Error("Admin only");
    const { setRetentionDays, runRetentionPurge, writeAudit, getRetentionDays } = await import(
      "./admin.server"
    );
    await setRetentionDays(data.days, session?.email ?? null);
    const purged = await runRetentionPurge();
    await writeAudit({
      actorEmail: session?.email,
      action: "retention.set",
      meta: { days: data.days, purged },
    });
    return { retentionDays: await getRetentionDays(), purged };
  });

export const registerPushSubscription = createServerFn({ method: "POST" })
  .validator(
    (input: { endpoint: string; keys: { p256dh: string; auth: string } }) => input,
  )
  .handler(async ({ data }) => {
    const session = await requireSession();
    if (!session?.email) throw new Error("Email required");
    const { getSql } = await import("@/lib/db");
    const { randomBytes } = await import("node:crypto");
    const sql = await getSql();
    const id = `ps-${randomBytes(6).toString("hex")}`;
    const email = session.email.trim().toLowerCase();
    await sql`
      insert into agora_push_subscriptions (id, user_email, endpoint, p256dh, auth)
      values (${id}, ${email}, ${data.endpoint}, ${data.keys.p256dh}, ${data.keys.auth})
      on conflict (endpoint) do update set
        user_email = excluded.user_email,
        p256dh = excluded.p256dh,
        auth = excluded.auth
    `;
    return { ok: true as const };
  });

export const pushPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  await requireSession();
  return { key: process.env.VAPID_PUBLIC_KEY?.trim() || null };
});

export const broadcastHuddle = createServerFn({ method: "POST" })
  .validator(
    (input: {
      channelId: string;
      participants: { id: string; name: string }[];
    }) => input,
  )
  .handler(async ({ data }) => {
    await requireSession();
    const { broadcastRealtime } = await import("./realtime.server");
    broadcastRealtime({
      type: "huddle",
      channelId: data.channelId,
      participants: data.participants.slice(0, 8),
      at: Date.now(),
    });
    return { ok: true as const };
  });
