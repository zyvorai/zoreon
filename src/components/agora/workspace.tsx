import { cn } from "@/lib/utils";
import { ChannelNav } from "@/components/agora/channel-nav";
import { MessagePane } from "@/components/agora/message-pane";
import { ThreadPanel } from "@/components/agora/thread-panel";
import { WarRoomRail } from "@/components/agora/war-room";
import { useAgora } from "@/store/use-agora";

export function Workspace() {
  const threadParentId = useAgora((s) => s.threadParentId);
  const mobileView = useAgora((s) => s.mobileView);
  const active = useAgora((s) => s.channels.find((c) => c.id === s.activeChannelId));
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
