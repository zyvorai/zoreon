import { create } from "zustand";
import { persist } from "zustand/middleware";
import { channels as seedChannels, currentUserId, messages as seedMessages, users, waves } from "@/data/seed";
import type { Channel, Huddle, Message, Wave } from "@/data/types";

const SEED_VERSION = 3;

type RelayState = {
  seedVersion: number;
  users: typeof users;
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
  setActiveChannel: (id: string) => void;
  setThread: (id: string | null) => void;
  sendMessage: (body: string, parentId?: string) => void;
  toggleReaction: (messageId: string, reactionId: string, label: string) => void;
  toggleCheck: (waveId: string, itemId: string) => void;
  startHuddle: () => void;
  leaveHuddle: () => void;
  setWindowMode: (mode: RelayState["windowMode"]) => void;
  setPaletteOpen: (open: boolean) => void;
  setMobileView: (view: RelayState["mobileView"]) => void;
  resetDemo: () => void;
};

function nid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const initial = {
  seedVersion: SEED_VERSION,
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

export const useRelay = create<RelayState>()(
  persist(
    (set, get) => ({
      ...initial,
      setActiveChannel: (id) =>
        set((s) => ({
          activeChannelId: id,
          threadParentId: null,
          mobileView: "chat",
          channels: s.channels.map((c) => (c.id === id ? { ...c, unread: 0, mention: false } : c)),
        })),
      setThread: (id) =>
        set({
          threadParentId: id,
          mobileView: id ? "thread" : "chat",
        }),
      sendMessage: (body, parentId) => {
        const text = body.trim();
        if (!text) return;
        const { activeChannelId, currentUserId: uid } = get();
        const msg: Message = {
          id: nid("m"),
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
            msg,
          ],
        }));
      },
      toggleReaction: (messageId, reactionId, label) =>
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
        })),
      toggleCheck: (waveId, itemId) =>
        set((s) => ({
          waves: s.waves.map((w) =>
            w.id === waveId
              ? { ...w, items: w.items.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i)) }
              : w,
          ),
        })),
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
      resetDemo: () =>
        set({
          ...initial,
          windowMode: get().windowMode,
        }),
    }),
    {
      name: "zyvor-relay-v3",
      version: SEED_VERSION,
      migrate: () => initial,
      partialize: (s) => ({
        seedVersion: s.seedVersion,
        channels: s.channels,
        messages: s.messages,
        waves: s.waves,
        activeChannelId: s.activeChannelId,
        huddle: s.huddle,
        windowMode: s.windowMode,
      }),
    },
  ),
);
