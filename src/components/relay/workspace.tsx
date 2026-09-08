import { cn } from "@/lib/utils";
import { ChannelNav } from "@/components/relay/channel-nav";
import { MessagePane } from "@/components/relay/message-pane";
import { ThreadPanel } from "@/components/relay/thread-panel";
import { WarRoomRail } from "@/components/relay/war-room";
import { useRelay } from "@/store/use-relay";

export function Workspace() {
  const threadParentId = useRelay((s) => s.threadParentId);
  const mobileView = useRelay((s) => s.mobileView);
  const active = useRelay((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const showWar = active?.kind === "war-room" && !threadParentId;

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className={cn("min-h-0 w-full md:flex md:w-60 md:shrink-0", mobileView === "list" ? "flex" : "hidden md:flex")}>
        <ChannelNav />
      </div>
      <div className={cn("min-h-0 min-w-0 flex-1", mobileView === "chat" ? "flex" : "hidden md:flex")}>
        <MessagePane />
      </div>
      {threadParentId ? (
        <div className={cn("min-h-0", mobileView === "thread" ? "flex w-full" : "hidden md:flex")}>
          <ThreadPanel />
        </div>
      ) : showWar ? (
        <WarRoomRail />
      ) : null}
    </div>
  );
}
