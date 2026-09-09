import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addBookmark as apiAddBookmark,
  addReminder as apiAddReminder,
  completeReminder as apiCompleteReminder,
  createChannel as apiCreateChannel,
  createDirect as apiCreateDirect,
  deleteMessage as apiDeleteMessage,
  editMessage as apiEditMessage,
  fetchWorkspace,
  getNotifPrefs as apiGetNotifPrefs,
  listBookmarks as apiListBookmarks,
  listReminders as apiListReminders,
  listTeams as apiListTeams,
  postMessage,
  reactToMessage,
  removeBookmark as apiRemoveBookmark,
  resetWorkspaceData,
  selectChannel,
  sendTyping as apiSendTyping,
  setMyStatus as apiSetMyStatus,
  setNotifPrefs as apiSetNotifPrefs,
  setPreferredTeam as apiSetPreferredTeam,
  toggleChecklistItem,
  togglePin as apiTogglePin,
  toggleStarChannel as apiToggleStarChannel,
  updateChannelTopic as apiUpdateChannelTopic,
  uploadFile as apiUploadFile,
  type WorkspaceSnapshot,
} from "@/lib/zoreon/api";
import { channels as seedChannels, currentUserId, messages as seedMessages, users, waves } from "@/data/seed";
import type { Channel, Message, MessagingBackend, User, Wave } from "@/data/types";
import type { BookmarkRow, NotifPrefs, ReminderRow } from "@/lib/zoreon/extras.server";

function draftKey(channelId: string, parentId?: string) {
  return parentId ? `${channelId}:${parentId}` : channelId;
}

export type TypingPeer = { userId: string; userName: string; at: number };

export type TeamOption = { id: string; name: string; displayName: string };

type ZoreonState = {
  ready: boolean;
  syncing: boolean;
  error: string | null;
  backend: MessagingBackend;
  tapeUsername: string | null;
  isAdmin: boolean;
  teamId: string | null;
  teams: TeamOption[];
  users: User[];
  channels: Channel[];
  messages: Message[];
  waves: Wave[];
  currentUserId: string;
  activeChannelId: string;
  focusMessageId: string | null;
  threadParentId: string | null;
  windowMode: "normal" | "maximized" | "minimized";
  paletteOpen: boolean;
  mobileView: "list" | "chat" | "thread";
  drafts: Record<string, string>;
  inboxMode: "none" | "unreads" | "bookmarks" | "reminders";
  bookmarks: BookmarkRow[];
  reminders: ReminderRow[];
  notifPrefs: NotifPrefs;
  typingByChannel: Record<string, TypingPeer[]>;
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveChannel: (id: string) => void;
  jumpToMessage: (channelId: string, messageId: string) => void;
  clearFocusMessage: () => void;
  setThread: (id: string | null) => void;
  setDraft: (channelId: string, parentId: string | undefined, body: string) => void;
  clearDraft: (channelId: string, parentId?: string) => void;
  getDraft: (channelId: string, parentId?: string) => string;
  sendMessage: (body: string, parentId?: string, fileIds?: string[]) => void;
  uploadAndSend: (file: File, body?: string, parentId?: string) => Promise<void>;
  editMessage: (messageId: string, body: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  togglePin: (messageId: string, pin: boolean) => Promise<void>;
  toggleStarChannel: (channelId: string) => Promise<void>;
  addBookmark: (messageId: string, channelId: string, snippet: string) => Promise<void>;
  removeBookmark: (bookmarkId: string) => Promise<void>;
  addReminder: (
    messageId: string,
    channelId: string,
    snippet: string,
    remindAt: number,
  ) => Promise<void>;
  completeReminder: (reminderId: string) => Promise<void>;
  loadExtras: () => Promise<void>;
  setNotifPrefs: (prefs: NotifPrefs) => Promise<void>;
  setPreferredTeam: (teamId: string) => Promise<void>;
  loadTeams: () => Promise<void>;
  setInboxMode: (mode: ZoreonState["inboxMode"]) => void;
  noteTyping: (channelId: string, peer: TypingPeer) => void;
  sendTyping: (channelId: string) => void;
  updateChannelTopic: (channelId: string, topic: string) => Promise<void>;
  setMyStatus: (status: "online" | "away" | "dnd" | "offline") => Promise<void>;
  createChannel: (name: string, purpose?: string) => Promise<string>;
  createDirect: (userId: string) => Promise<string>;
  toggleReaction: (messageId: string, reactionId: string, label: string) => void;
  toggleCheck: (waveId: string, itemId: string) => void;
  setWindowMode: (mode: ZoreonState["windowMode"]) => void;
  setPaletteOpen: (open: boolean) => void;
  setMobileView: (view: ZoreonState["mobileView"]) => void;
  resetDemo: () => void;
};

function applySnapshot(
  set: (partial: Partial<ZoreonState> | ((s: ZoreonState) => Partial<ZoreonState>)) => void,
  snapshot: WorkspaceSnapshot,
  extras?: Partial<ZoreonState>,
) {
  set((s) => {
    const preferred = extras?.activeChannelId ?? s.activeChannelId;
    const activeChannelId = snapshot.channels.some((c) => c.id === preferred)
      ? preferred
      : (snapshot.channels[0]?.id ?? preferred);
    return {
      users: snapshot.users,
      channels: snapshot.channels,
      messages: snapshot.messages,
      waves: snapshot.waves,
      currentUserId: snapshot.currentUserId,
      backend: snapshot.backend,
      tapeUsername: snapshot.tapeUsername ?? null,
      isAdmin: Boolean(snapshot.isAdmin),
      teamId: snapshot.teamId ?? null,
      ready: true,
      syncing: false,
      error: snapshot.identityWarning ?? null,
      activeChannelId,
      ...extras,
    };
  });
}

const fallback = {
  ready: false,
  syncing: false,
  error: null as string | null,
  backend: "sql" as MessagingBackend,
  tapeUsername: null as string | null,
  isAdmin: false,
  teamId: null as string | null,
  teams: [] as TeamOption[],
  users,
  channels: seedChannels,
  messages: seedMessages,
  waves,
  currentUserId,
  activeChannelId: "ch-zyvor",
  focusMessageId: null as string | null,
  threadParentId: null as string | null,
  windowMode: "maximized" as const,
  paletteOpen: false,
  mobileView: "chat" as const,
  drafts: {} as Record<string, string>,
  inboxMode: "none" as const,
  bookmarks: [] as BookmarkRow[],
  reminders: [] as ReminderRow[],
  notifPrefs: { desktop: true, mentionsOnly: false, muteDms: false, quietStart: null, quietEnd: null } as NotifPrefs,
  typingByChannel: {} as Record<string, TypingPeer[]>,
};

export const useZoreon = create<ZoreonState>()(
  persist(
    (set, get) => ({
      ...fallback,
      hydrate: async () => {
        if (get().syncing) return;
        set({ syncing: true, error: null });
        try {
          const snapshot = await fetchWorkspace();
          applySnapshot(set, snapshot);
          void get().loadExtras();
          void get().loadTeams();
          try {
            const raw = sessionStorage.getItem("zoreon-outbox");
            if (raw && navigator.onLine) {
              const box = JSON.parse(raw) as { body: string; parentId?: string; channelId: string }[];
              sessionStorage.removeItem("zoreon-outbox");
              for (const item of box) {
                if (item.channelId) get().setActiveChannel(item.channelId);
                get().sendMessage(item.body, item.parentId);
              }
            }
          } catch {
            /* */
          }
        } catch (err) {
          set({
            syncing: false,
            ready: true,
            error: err instanceof Error ? err.message : "Failed to load workspace",
          });
        }
      },
      refresh: async () => {
        try {
          const snapshot = await fetchWorkspace();
          applySnapshot(set, snapshot);
        } catch {
          /* keep last good snapshot */
        }
      },
      loadExtras: async () => {
        try {
          const [bookmarks, reminders, notifPrefs] = await Promise.all([
            apiListBookmarks(),
            apiListReminders(),
            apiGetNotifPrefs(),
          ]);
          set({ bookmarks, reminders, notifPrefs });
        } catch {
          /* extras optional until migration */
        }
      },
      loadTeams: async () => {
        try {
          const teams = await apiListTeams();
          set({ teams });
        } catch {
          set({ teams: [] });
        }
      },
      setInboxMode: (mode) => set({ inboxMode: mode }),
      noteTyping: (channelId, peer) => {
        set((s) => {
          const prev = (s.typingByChannel[channelId] ?? []).filter(
            (p) => p.userId !== peer.userId && Date.now() - p.at < 5000,
          );
          return {
            typingByChannel: {
              ...s.typingByChannel,
              [channelId]: [...prev, peer].slice(-6),
            },
          };
        });
        globalThis.setTimeout(() => {
          set((s) => ({
            typingByChannel: {
              ...s.typingByChannel,
              [channelId]: (s.typingByChannel[channelId] ?? []).filter(
                (p) => p.userId !== peer.userId || Date.now() - p.at < 4500,
              ),
            },
          }));
        }, 5000);
      },
      sendTyping: (channelId) => {
        void apiSendTyping({ data: { channelId } }).catch(() => undefined);
      },
      setActiveChannel: (id) => {
        set((s) => ({
          activeChannelId: id,
          threadParentId: null,
          focusMessageId: null,
          mobileView: "chat",
          inboxMode: "none",
          channels: s.channels.map((c) => (c.id === id ? { ...c, unread: 0, mention: false } : c)),
        }));
        void selectChannel({ data: { channelId: id } })
          .then((snapshot) =>
            applySnapshot(set, snapshot, {
              activeChannelId: id,
              threadParentId: null,
              focusMessageId: null,
              mobileView: "chat",
              inboxMode: "none",
            }),
          )
          .catch(() => undefined);
      },
      jumpToMessage: (channelId, messageId) => {
        set((s) => ({
          activeChannelId: channelId,
          focusMessageId: messageId,
          threadParentId: null,
          mobileView: "chat",
          inboxMode: "none",
          channels: s.channels.map((c) =>
            c.id === channelId ? { ...c, unread: 0, mention: false } : c,
          ),
        }));
        void selectChannel({ data: { channelId } })
          .then((snapshot) =>
            applySnapshot(set, snapshot, {
              activeChannelId: channelId,
              focusMessageId: messageId,
              threadParentId: null,
              mobileView: "chat",
              inboxMode: "none",
            }),
          )
          .catch(() => undefined);
      },
      clearFocusMessage: () => set({ focusMessageId: null }),
      setThread: (id) =>
        set({
          threadParentId: id,
          mobileView: id ? "thread" : "chat",
        }),
      setDraft: (channelId, parentId, body) => {
        const key = draftKey(channelId, parentId);
        set((s) => {
          const drafts = { ...s.drafts };
          if (!body.trim()) delete drafts[key];
          else drafts[key] = body;
          return { drafts };
        });
      },
      clearDraft: (channelId, parentId) => {
        const key = draftKey(channelId, parentId);
        set((s) => {
          const drafts = { ...s.drafts };
          delete drafts[key];
          return { drafts };
        });
      },
      getDraft: (channelId, parentId) => get().drafts[draftKey(channelId, parentId)] ?? "",
      sendMessage: (body, parentId, fileIds) => {
        const text = body.trim();
        if (!text && !(fileIds && fileIds.length)) return;
        if (typeof navigator !== "undefined" && !navigator.onLine && !fileIds?.length) {
          try {
            const raw = sessionStorage.getItem("zoreon-outbox");
            const box = raw ? (JSON.parse(raw) as { body: string; parentId?: string; channelId: string }[]) : [];
            box.push({ body: text, parentId, channelId: get().activeChannelId });
            sessionStorage.setItem("zoreon-outbox", JSON.stringify(box));
            set({ error: "Offline — message queued" });
          } catch {
            set({ error: "Offline — could not queue" });
          }
          return;
        }
        const { activeChannelId, currentUserId: uid } = get();
        get().clearDraft(activeChannelId, parentId);
        const optimistic: Message = {
          id: `tmp-${Math.random().toString(36).slice(2, 9)}`,
          channelId: activeChannelId,
          authorId: uid,
          body: text || "(file)",
          createdAt: Date.now(),
          parentId,
          reactions: [],
        };
        set((s) => ({
          messages: [
            ...s.messages.map((m) =>
              parentId && m.id === parentId ? { ...m, replyCount: (m.replyCount ?? 0) + 1 } : m,
            ),
            optimistic,
          ],
        }));
        void postMessage({
          data: { channelId: activeChannelId, body: text || " ", parentId, fileIds },
        })
          .then(async () => {
            const snapshot = await fetchWorkspace();
            applySnapshot(set, snapshot);
          })
          .catch(() => {
            set((s) => ({
              messages: s.messages.filter((m) => m.id !== optimistic.id),
              error: "Failed to send message",
            }));
          });
      },
      uploadAndSend: async (file, body, parentId) => {
        const { activeChannelId } = get();
        if (file.size > 10 * 1024 * 1024) {
          set({ error: "File too large (max 10MB)" });
          return;
        }
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
        const base64 = btoa(binary);
        const { fileId } = await apiUploadFile({
          data: {
            channelId: activeChannelId,
            name: file.name,
            type: file.type || "application/octet-stream",
            base64,
          },
        });
        get().sendMessage(body ?? "", parentId, [fileId]);
      },
      editMessage: async (messageId, body) => {
        const updated = await apiEditMessage({ data: { messageId, body } });
        set((s) => ({
          messages: s.messages.map((m) => (m.id === messageId ? { ...m, ...updated } : m)),
        }));
        try {
          const snapshot = await fetchWorkspace();
          applySnapshot(set, snapshot);
        } catch {
          /* keep optimistic edit */
        }
      },
      deleteMessage: async (messageId) => {
        await apiDeleteMessage({ data: { messageId } });
        set((s) => ({ messages: s.messages.filter((m) => m.id !== messageId) }));
        try {
          const snapshot = await fetchWorkspace();
          applySnapshot(set, snapshot);
        } catch {
          /* keep local delete */
        }
      },
      togglePin: async (messageId, pin) => {
        const snapshot = await apiTogglePin({ data: { messageId, pin } });
        applySnapshot(set, snapshot);
      },
      toggleStarChannel: async (channelId) => {
        const snapshot = await apiToggleStarChannel({ data: { channelId } });
        applySnapshot(set, snapshot);
      },
      addBookmark: async (messageId, channelId, snippet) => {
        await apiAddBookmark({ data: { messageId, channelId, snippet } });
        await get().loadExtras();
      },
      removeBookmark: async (bookmarkId) => {
        await apiRemoveBookmark({ data: { bookmarkId } });
        await get().loadExtras();
      },
      addReminder: async (messageId, channelId, snippet, remindAt) => {
        await apiAddReminder({ data: { messageId, channelId, snippet, remindAt } });
        await get().loadExtras();
      },
      completeReminder: async (reminderId) => {
        await apiCompleteReminder({ data: { reminderId } });
        await get().loadExtras();
      },
      setNotifPrefs: async (prefs) => {
        await apiSetNotifPrefs({ data: prefs });
        set({ notifPrefs: prefs });
      },
      setPreferredTeam: async (teamId) => {
        const snapshot = await apiSetPreferredTeam({ data: { teamId } });
        applySnapshot(set, snapshot);
      },
      updateChannelTopic: async (channelId, topic) => {
        const snapshot = await apiUpdateChannelTopic({ data: { channelId, topic } });
        applySnapshot(set, snapshot);
      },
      setMyStatus: async (status) => {
        const snapshot = await apiSetMyStatus({ data: { status } });
        applySnapshot(set, snapshot);
      },
      createChannel: async (name, purpose) => {
        const { channelId } = await apiCreateChannel({ data: { name, purpose } });
        const snapshot = await fetchWorkspace();
        applySnapshot(set, snapshot, { activeChannelId: channelId, mobileView: "chat" });
        return channelId;
      },
      createDirect: async (userId) => {
        const { channelId } = await apiCreateDirect({ data: { userId } });
        const snapshot = await fetchWorkspace();
        applySnapshot(set, snapshot, { activeChannelId: channelId, mobileView: "chat" });
        return channelId;
      },
      toggleReaction: (messageId, reactionId, label) => {
        set((s) => ({
          messages: s.messages.map((m) => {
            if (m.id !== messageId) return m;
            const existing = m.reactions.find((r) => r.id === reactionId);
            if (!existing) {
              return { ...m, reactions: [...m.reactions, { id: reactionId, label, count: 1, mine: true }] };
            }
            if (existing.mine) {
              const count = existing.count - 1;
              return {
                ...m,
                reactions:
                  count <= 0
                    ? m.reactions.filter((r) => r.id !== reactionId)
                    : m.reactions.map((r) => (r.id === reactionId ? { ...r, count, mine: false } : r)),
              };
            }
            return {
              ...m,
              reactions: m.reactions.map((r) =>
                r.id === reactionId ? { ...r, count: r.count + 1, mine: true } : r,
              ),
            };
          }),
        }));
        void reactToMessage({ data: { messageId, reactionId, label } })
          .then((snapshot) => applySnapshot(set, snapshot))
          .catch(() => undefined);
      },
      toggleCheck: (waveId, itemId) => {
        set((s) => ({
          waves: s.waves.map((w) =>
            w.id === waveId
              ? { ...w, items: w.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
              : w,
          ),
        }));
        void toggleChecklistItem({ data: { waveId, itemId } })
          .then((snapshot) => applySnapshot(set, snapshot))
          .catch(() => undefined);
      },
      setWindowMode: (mode) => set({ windowMode: mode }),
      setPaletteOpen: (open) => set({ paletteOpen: open }),
      setMobileView: (view) => set({ mobileView: view }),
      resetDemo: () => {
        set({ syncing: true });
        void resetWorkspaceData()
          .then((snapshot) =>
            applySnapshot(set, snapshot, {
              threadParentId: null,
              focusMessageId: null,
              mobileView: "chat",
            }),
          )
          .catch(() => set({ syncing: false, error: "Failed to refresh workspace" }));
      },
    }),
    {
      name: "zoreon-v2",
      partialize: (s) => ({
        windowMode: s.windowMode,
        activeChannelId: s.activeChannelId,
        drafts: s.drafts,
      }),
    },
  ),
);
