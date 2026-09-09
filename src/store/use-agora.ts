import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  fetchWorkspace,
  postMessage,
  reactToMessage,
  resetWorkspaceData,
  selectChannel,
  toggleChecklistItem,
} from "@/lib/agora/api";
import { channels as seedChannels, currentUserId, messages as seedMessages, users, waves } from "@/data/seed";
import type { Channel, Huddle, Message, User, Wave } from "@/data/types";

type AgoraState = {
  ready: boolean;
  syncing: boolean;
  error: string | null;
  users: User[];
  channels: Channel[];
  messages: Message[];
  waves: Wave[];
  currentUserId: string;
  activeChannelId: string;
  threadParentId: string | null;
  huddle: Huddle;
  windowMode: "normal" | "maximized" | "minimized";
  paletteOpen: boolean;
  mobileView: "list" | "chat" | "thread";
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  setActiveChannel: (id: string) => void;
  setThread: (id: string | null) => void;
  sendMessage: (body: string, parentId?: string) => void;
  toggleReaction: (messageId: string, reactionId: string, label: string) => void;
  toggleCheck: (waveId: string, itemId: string) => void;
  startHuddle: () => void;
  leaveHuddle: () => void;
  setWindowMode: (mode: AgoraState["windowMode"]) => void;
  setPaletteOpen: (open: boolean) => void;
  setMobileView: (view: AgoraState["mobileView"]) => void;
  resetDemo: () => void;
};

function applySnapshot(
  set: (partial: Partial<AgoraState> | ((s: AgoraState) => Partial<AgoraState>)) => void,
  snapshot: {
    users: User[];
    channels: Channel[];
    messages: Message[];
    waves: Wave[];
    currentUserId: string;
  },
  extras?: Partial<AgoraState>,
) {
  set({
    users: snapshot.users,
    channels: snapshot.channels,
    messages: snapshot.messages,
    waves: snapshot.waves,
    currentUserId: snapshot.currentUserId,
    ready: true,
    syncing: false,
    error: null,
    ...extras,
  });
}

const fallback = {
  ready: false,
  syncing: false,
  error: null as string | null,
  users,
  channels: seedChannels,
  messages: seedMessages,
  waves,
  currentUserId,
  activeChannelId: "ch-wave3",
  threadParentId: null as string | null,
  huddle: null as Huddle,
  windowMode: "maximized" as const,
  paletteOpen: false,
  mobileView: "chat" as const,
};

export const useAgora = create<AgoraState>()(
  persist(
    (set, get) => ({
      ...fallback,
      hydrate: async () => {
        if (get().syncing) return;
        set({ syncing: true, error: null });
        try {
          const snapshot = await fetchWorkspace();
          applySnapshot(set, snapshot);
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
      setActiveChannel: (id) => {
        set((s) => ({
          activeChannelId: id,
          threadParentId: null,
          mobileView: "chat",
          channels: s.channels.map((c) => (c.id === id ? { ...c, unread: 0, mention: false } : c)),
        }));
        void selectChannel({ data: { channelId: id } })
          .then((snapshot) => applySnapshot(set, snapshot, { activeChannelId: id, threadParentId: null, mobileView: "chat" }))
          .catch(() => undefined);
      },
      setThread: (id) =>
        set({
          threadParentId: id,
          mobileView: id ? "thread" : "chat",
        }),
      sendMessage: (body, parentId) => {
        const text = body.trim();
        if (!text) return;
        const { activeChannelId, currentUserId: uid } = get();
        const optimistic: Message = {
          id: `tmp-${Math.random().toString(36).slice(2, 9)}`,
          channelId: activeChannelId,
          authorId: uid,
          body: text,
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
          data: { channelId: activeChannelId, authorId: uid, body: text, parentId },
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
      toggleReaction: (messageId, reactionId, label) => {
        const { currentUserId: uid } = get();
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
        void reactToMessage({ data: { messageId, reactionId, label, userId: uid } })
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
      startHuddle: () => {
        const { activeChannelId, currentUserId: uid, huddle } = get();
        if (huddle?.channelId === activeChannelId) return;
        set({
          huddle: {
            channelId: activeChannelId,
            participants: [uid, "u-maya", "u-jordan"],
            startedAt: Date.now(),
          },
        });
      },
      leaveHuddle: () => set({ huddle: null }),
      setWindowMode: (mode) => set({ windowMode: mode }),
      setPaletteOpen: (open) => set({ paletteOpen: open }),
      setMobileView: (view) => set({ mobileView: view }),
      resetDemo: () => {
        set({ syncing: true });
        void resetWorkspaceData()
          .then((snapshot) =>
            applySnapshot(set, snapshot, {
              activeChannelId: "ch-wave3",
              threadParentId: null,
              huddle: null,
              mobileView: "chat",
            }),
          )
          .catch(() => set({ syncing: false, error: "Failed to reset workspace" }));
      },
    }),
    {
      name: "zyvor-agora-v2",
      partialize: (s) => ({
        windowMode: s.windowMode,
        activeChannelId: s.activeChannelId,
      }),
    },
  ),
);
