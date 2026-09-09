import { cn } from "@/lib/utils";
import { ChannelNav } from "@/components/zoreon/channel-nav";
import { InboxPanel } from "@/components/zoreon/inbox-panel";
import { MessagePane } from "@/components/zoreon/message-pane";
import { ThreadPanel } from "@/components/zoreon/thread-panel";
import { WarRoomRail } from "@/components/zoreon/war-room";
import { useZoreon } from "@/store/use-zoreon";

export function Workspace() {
  const threadParentId = useZoreon((s) => s.threadParentId);
  const mobileView = useZoreon((s) => s.mobileView);
  const inboxMode = useZoreon((s) => s.inboxMode);
  const active = useZoreon((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const showWar = active?.kind === "war-room" && !threadParentId && inboxMode === "none";

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className={cn("min-h-0 w-full md:flex md:w-60 md:shrink-0", mobileView === "list" ? "flex" : "hidden md:flex")}>
        <ChannelNav />
      </div>
      <div className={cn("min-h-0 min-w-0 flex-1", mobileView === "chat" ? "flex" : "hidden md:flex")}>
        {inboxMode !== "none" ? <InboxPanel /> : <MessagePane />}
      </div>
      {inboxMode !== "none" ? null : threadParentId ? (
        <div className={cn("min-h-0", mobileView === "thread" ? "flex w-full" : "hidden md:flex")}>
          <ThreadPanel />
        </div>
      ) : showWar ? (
        <WarRoomRail />
      ) : null}
    </div>
  );
}
