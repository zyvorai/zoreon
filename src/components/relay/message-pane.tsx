import { useEffect, useMemo, useRef, useState } from "react";
import { Hash, Headphones, MessageSquare, PhoneOff, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/macos/avatar";
import type { Message, User } from "@/data/types";
import { useRelay } from "@/store/use-relay";

export function MessagePane() {
  const channels = useRelay((s) => s.channels);
  const messages = useRelay((s) => s.messages);
  const users = useRelay((s) => s.users);
  const activeId = useRelay((s) => s.activeChannelId);
  const huddle = useRelay((s) => s.huddle);
  const startHuddle = useRelay((s) => s.startHuddle);
  const leaveHuddle = useRelay((s) => s.leaveHuddle);
  const setMobileView = useRelay((s) => s.setMobileView);
  const channel = channels.find((c) => c.id === activeId);
  const roots = useMemo(
    () => messages.filter((m) => m.channelId === activeId && !m.parentId).sort((a, b) => a.createdAt - b.createdAt),
    [messages, activeId],
  );
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [roots.length, activeId]);

  if (!channel) return null;
  const inHuddle = huddle?.channelId === channel.id;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col bg-window">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <button
          type="button"
          className="mr-1 min-h-11 rounded-sm px-2 py-1 text-xs font-medium text-fg-muted md:hidden md:min-h-0"
          onClick={() => setMobileView("list")}
          aria-label="Back to channels"
        >
          Channels
        </button>
        {channel.kind === "war-room" ? <Radio className="size-4 text-accent" /> : <Hash className="size-4 text-fg-muted" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{channel.name}</p>
          <p className="truncate text-xs text-fg-subtle">{channel.topic}</p>
        </div>
        <button
          type="button"
          onClick={inHuddle ? leaveHuddle : startHuddle}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium",
            inHuddle ? "bg-danger/20 text-danger" : "bg-elevated text-fg",
          )}
        >
          {inHuddle ? <PhoneOff className="size-3.5" /> : <Headphones className="size-3.5" />}
          {inHuddle ? "Leave" : "Huddle"}
        </button>
      </header>

      {inHuddle && huddle ? (
        <div className="flex items-center gap-2 border-b border-border bg-accent-soft px-3 py-2 text-xs text-fg">
          <span className="size-1.5 animate-pulse rounded-full bg-success" />
          Huddle live · {huddle.participants.length} in call
          <span className="hidden text-fg-subtle sm:inline">Wave audio stays on-estate</span>
        </div>
      ) : null}

      <div className="relay-scroll min-h-0 flex-1 px-3 py-4">
        {roots.map((m, i) => {
          const author = users.find((u) => u.id === m.authorId);
          const prev = roots[i - 1];
          const grouped = prev && prev.authorId === m.authorId && m.createdAt - prev.createdAt < 5 * 60 * 1000 && !m.system;
          return <MessageRow key={m.id} message={m} author={author} grouped={Boolean(grouped)} />;
        })}
        <div ref={bottom} />
      </div>
      <Composer />
    </section>
  );
}

function MessageRow({
  message,
  author,
  grouped,
}: {
  message: Message;
  author?: User;
  grouped: boolean;
}) {
  const setThread = useRelay((s) => s.setThread);
  const toggleReaction = useRelay((s) => s.toggleReaction);
  const replies = useRelay((s) => s.messages.filter((m) => m.parentId === message.id).length);

  if (message.system) {
    return <p className="mx-auto my-3 max-w-lg text-center text-xs text-fg-subtle">{message.body}</p>;
  }

  return (
    <article className={cn("group relative rounded-sm px-1 hover:bg-fg/4", grouped ? "py-0.5 pl-12" : "py-2")}>
      <div className="flex gap-3">
        {grouped ? null : author ? <Avatar user={author} /> : <span className="size-8" />}
        <div className="min-w-0 flex-1">
          {grouped ? null : (
            <div className="mb-0.5 flex items-baseline gap-2">
              <span className="text-sm font-semibold">{author?.name ?? "Unknown"}</span>
              <span className="hidden text-xs text-fg-subtle sm:inline">{author?.role}</span>
              <TimeLabel ts={message.createdAt} />
            </div>
          )}
          <p className="text-sm leading-normal text-fg">{message.body}</p>
          {message.reactions.length > 0 ? (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {message.reactions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleReaction(message.id, r.id, r.label)}
                  className={cn(
                    "rounded-pill border px-2 py-0.5 text-xs tabular-nums",
                    r.mine ? "border-accent bg-accent-soft text-fg" : "border-border bg-panel text-fg-muted",
                  )}
                >
                  {r.label} {r.count}
                </button>
              ))}
            </div>
          ) : null}
          {replies > 0 || message.replyCount ? (
            <button
              type="button"
              onClick={() => setThread(message.id)}
              className="mt-1 inline-flex min-h-11 items-center gap-1 text-xs font-medium text-accent md:min-h-0"
            >
              <MessageSquare className="size-3" />
              {replies || message.replyCount} {replies === 1 ? "reply" : "replies"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setThread(message.id)}
              className="mt-1 inline-flex min-h-11 items-center text-xs text-fg-subtle md:min-h-0 md:hidden md:group-hover:inline"
            >
              Reply in thread
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function TimeLabel({ ts }: { ts: number }) {
  return (
    <time className="text-xs tabular-nums text-fg-subtle" suppressHydrationWarning>
      {new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
    </time>
  );
}

export function Composer({ parentId }: { parentId?: string }) {
  const send = useRelay((s) => s.sendMessage);
  const [value, setValue] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    send(value, parentId);
    setValue("");
  };

  return (
    <form
      className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="rounded-md border border-border-strong bg-composer px-3 py-2">
        <textarea
          ref={ref}
          value={value}
          rows={2}
          placeholder={parentId ? "Reply in thread" : "Message this space"}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className="w-full resize-none bg-transparent text-sm leading-normal text-fg outline-none placeholder:text-fg-subtle"
        />
        <div className="flex items-center justify-between pt-1">
          <p className="hidden text-xs text-fg-subtle sm:block">Return to send · Shift+Return for a line</p>
          <button
            type="submit"
            disabled={!value.trim()}
            className="ml-auto h-9 rounded-sm bg-accent px-3 text-xs font-medium text-accent-fg disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </form>
  );
}
