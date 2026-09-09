import { X } from "lucide-react";
import { Composer, MessageRow } from "@/components/zoreon/message-pane";
import { useZoreon } from "@/store/use-zoreon";

export function ThreadPanel() {
  const threadParentId = useZoreon((s) => s.threadParentId);
  const messages = useZoreon((s) => s.messages);
  const users = useZoreon((s) => s.users);
  const setThread = useZoreon((s) => s.setThread);
  const setMobileView = useZoreon((s) => s.setMobileView);

  if (!threadParentId) return null;
  const parent = messages.find((m) => m.id === threadParentId);
  if (!parent) return null;
  const author = users.find((u) => u.id === parent.authorId);
  const replies = messages
    .filter((m) => m.parentId === parent.id)
    .sort((a, b) => a.createdAt - b.createdAt);

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
      <div className="zoreon-scroll min-h-0 flex-1 px-2 py-3">
        <MessageRow message={parent} author={author} grouped={false} compact />
        <div className="my-2 border-t border-border" />
        {replies.map((m, i) => {
          const u = users.find((x) => x.id === m.authorId);
          const prev = replies[i - 1];
          const grouped =
            prev && prev.authorId === m.authorId && m.createdAt - prev.createdAt < 5 * 60 * 1000;
          return <MessageRow key={m.id} message={m} author={u} grouped={Boolean(grouped)} compact />;
        })}
      </div>
      <Composer parentId={parent.id} />
    </aside>
  );
}
