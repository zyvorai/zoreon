import { useZoreon } from "@/store/use-zoreon";

export function InboxPanel() {
  const inboxMode = useZoreon((s) => s.inboxMode);
  const channels = useZoreon((s) => s.channels);
  const bookmarks = useZoreon((s) => s.bookmarks);
  const reminders = useZoreon((s) => s.reminders);
  const setActive = useZoreon((s) => s.setActiveChannel);
  const jumpToMessage = useZoreon((s) => s.jumpToMessage);
  const removeBookmark = useZoreon((s) => s.removeBookmark);
  const completeReminder = useZoreon((s) => s.completeReminder);
  const setInboxMode = useZoreon((s) => s.setInboxMode);

  if (inboxMode === "none") return null;

  const unreads = channels.filter((c) => c.unread > 0 || c.mention);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-panel">
      <div className="flex h-12 items-center justify-between border-b border-border px-4">
        <p className="text-sm font-semibold capitalize">
          {inboxMode === "unreads" ? "All unreads" : inboxMode}
        </p>
        <button
          type="button"
          className="text-xs text-fg-subtle hover:text-fg"
          onClick={() => setInboxMode("none")}
        >
          Close
        </button>
      </div>
      <div className="zoreon-scroll min-h-0 flex-1 p-3">
        {inboxMode === "unreads" ? (
          unreads.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-fg-subtle">You&apos;re caught up</p>
          ) : (
            <ul className="space-y-1">
              {unreads.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-sm px-3 py-2 text-left text-sm hover:bg-accent-soft"
                    onClick={() => setActive(c.id)}
                  >
                    <span className="font-medium">{c.kind === "channel" ? `#${c.name}` : c.name}</span>
                    <span className="text-xs tabular-nums text-fg-subtle">
                      {c.mention ? "@ · " : ""}
                      {c.unread}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {inboxMode === "bookmarks" ? (
          bookmarks.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-fg-subtle">No bookmarks yet</p>
          ) : (
            <ul className="space-y-2">
              {bookmarks.map((b) => (
                <li key={b.id} className="rounded-sm border border-border px-3 py-2">
                  <button
                    type="button"
                    className="w-full text-left text-sm hover:underline"
                    onClick={() => jumpToMessage(b.channelId, b.messageId)}
                  >
                    {b.snippet || "(empty)"}
                  </button>
                  <div className="mt-1 flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-fg-subtle hover:text-danger"
                      onClick={() => void removeBookmark(b.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {inboxMode === "reminders" ? (
          reminders.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-fg-subtle">No reminders</p>
          ) : (
            <ul className="space-y-2">
              {reminders.map((r) => (
                <li key={r.id} className="rounded-sm border border-border px-3 py-2">
                  <p className="text-xs text-fg-subtle">
                    {new Date(r.remindAt).toLocaleString()}
                  </p>
                  <button
                    type="button"
                    className="mt-0.5 w-full text-left text-sm hover:underline"
                    onClick={() => jumpToMessage(r.channelId, r.messageId)}
                  >
                    {r.snippet || "(empty)"}
                  </button>
                  <div className="mt-1 flex justify-end">
                    <button
                      type="button"
                      className="text-xs text-accent hover:underline"
                      onClick={() => void completeReminder(r.id)}
                    >
                      Done
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </div>
  );
}
