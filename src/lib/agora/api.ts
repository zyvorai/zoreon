import { createServerFn } from "@tanstack/react-start";
import type { Channel, Message, User, Wave } from "@/data/types";

export type WorkspaceSnapshot = {
  users: User[];
  channels: Channel[];
  messages: Message[];
  waves: Wave[];
  currentUserId: string;
};

export const fetchWorkspace = createServerFn({ method: "GET" }).handler(
  async (): Promise<WorkspaceSnapshot> => {
    const { loadWorkspace } = await import("./workspace.server");
    return loadWorkspace();
  },
);

export const postMessage = createServerFn({ method: "POST" })
  .validator((input: { channelId: string; authorId: string; body: string; parentId?: string }) => input)
  .handler(async ({ data }): Promise<Message> => {
    const { insertMessage } = await import("./workspace.server");
    return insertMessage(data);
  });

export const reactToMessage = createServerFn({ method: "POST" })
  .validator((input: { messageId: string; reactionId: string; label: string; userId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const { toggleReactionDb, loadWorkspace } = await import("./workspace.server");
    await toggleReactionDb(data);
    return loadWorkspace(data.userId);
  });

export const toggleChecklistItem = createServerFn({ method: "POST" })
  .validator((input: { waveId: string; itemId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const { toggleCheckDb, loadWorkspace } = await import("./workspace.server");
    await toggleCheckDb(data);
    return loadWorkspace();
  });

export const selectChannel = createServerFn({ method: "POST" })
  .validator((input: { channelId: string }) => input)
  .handler(async ({ data }): Promise<WorkspaceSnapshot> => {
    const { markChannelRead, loadWorkspace } = await import("./workspace.server");
    await markChannelRead(data.channelId);
    return loadWorkspace();
  });

export const resetWorkspaceData = createServerFn({ method: "POST" }).handler(
  async (): Promise<WorkspaceSnapshot> => {
    const { resetWorkspace } = await import("./workspace.server");
    return resetWorkspace();
  },
);

/** Diagnostics: is an optional Mattermost server configured and reachable? */
export const probeMattermost = createServerFn({ method: "GET" }).handler(async () => {
  const { mattermostProbe } = await import("./mattermost.server");
  return mattermostProbe();
});
