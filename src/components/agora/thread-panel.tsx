import { X } from "lucide-react";
import { Avatar } from "@/components/desktop/avatar";
import { Composer, TimeLabel } from "@/components/agora/message-pane";
import { useAgora } from "@/store/use-agora";

export function ThreadPanel() {
  const threadParentId = useAgora((s) => s.threadParentId);
  const messages = useAgora((s) => s.messages);
  const users = useAgora((s) => s.users);
  const setThread = useAgora((s) => s.setThread);
  const setMobileView = useAgora((s) => s.setMobileView);

  if (!threadParentId) return null;
  const parent = messages.find((m) => m.id === threadParentId);
  if (!parent) return null;
  const author = users.find((u) => u.id === parent.authorId);
  const replies = messages.filter((m) => m.parentId === parent.id).sort((a, b) => a.createdAt - b.createdAt);

  return (
    <aside className="flex h-full min-h-0 w-full shrink-0 flex-col border-l border-border bg-sidebar md:w-80">
      <header className="flex h-12 items-center justify-between border-b border-border px-3">
        <p className="text-sm font-semibold">Thread</p>
        <button
          type="button"
          aria-label="Close thread"
          className="rounded-sm p-1 text-fg-muted hover:bg-fg/10"
          onClick={() => {
            setThread(null);
            setMobileView("chat");
          }}
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="agora-scroll min-h-0 flex-1 px-3 py-3">
        <div className="mb-4 flex gap-2 border-b border-border pb-3">
          {author ? <Avatar user={author} size="sm" /> : null}
          <div>
            <p className="text-sm font-semibold">{author?.name}</p>
            <p className="text-sm leading-normal text-fg">{parent.body}</p>
            <TimeLabel ts={parent.createdAt} />
          </div>
        </div>
        {replies.map((m) => {
          const u = users.find((x) => x.id === m.authorId);
          return (
            <div key={m.id} className="mb-3 flex gap-2">
              {u ? <Avatar user={u} size="sm" /> : null}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{u?.name}</span>
                  <TimeLabel ts={m.createdAt} />
                </div>
                <p className="text-sm leading-normal">{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <Composer parentId={parent.id} />
    </aside>
  );
}
