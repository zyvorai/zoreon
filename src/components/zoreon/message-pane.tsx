import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileIcon,
  Hash,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Pin,
  Plus,
  Radio,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/desktop/avatar";
import type { Message, MessageFile, User } from "@/data/types";
import { useZoreon } from "@/store/use-zoreon";
import { getInviteLink } from "@/lib/zoreon/api";
import { MessageBody } from "@/components/zoreon/message-body";
import { ProfilePopover } from "@/components/zoreon/profile-popover";
import { HuddleBar } from "@/components/zoreon/huddle-bar";
import { setChannelPref } from "@/lib/zoreon/api";

const QUICK_REACTIONS = [
  { id: "ack", label: "👍" },
  { id: "ship", label: "🚀" },
  { id: "watch", label: "👀" },
  { id: "heart", label: "❤️" },
  { id: "laugh", label: "😂" },
  { id: "fire", label: "🔥" },
  { id: "tada", label: "🎉" },
  { id: "thinking", label: "🤔" },
  { id: "clap", label: "👏" },
  { id: "pray", label: "🙏" },
  { id: "check", label: "✅" },
  { id: "x", label: "❌" },
  { id: "wave", label: "👋" },
  { id: "hundred", label: "💯" },
] as const;

const COMPOSER_EMOJI = [
  "👍", "👎", "❤️", "😂", "🎉", "🔥", "👀", "🤔", "🙏", "✅", "❌", "🚀", "😅", "😮", "👏", "💯",
] as const;

export function MessagePane() {
  const channels = useZoreon((s) => s.channels);
  const messages = useZoreon((s) => s.messages);
  const users = useZoreon((s) => s.users);
  const activeId = useZoreon((s) => s.activeChannelId);
  const focusMessageId = useZoreon((s) => s.focusMessageId);
  const clearFocusMessage = useZoreon((s) => s.clearFocusMessage);
  const setMobileView = useZoreon((s) => s.setMobileView);
  const updateChannelTopic = useZoreon((s) => s.updateChannelTopic);
  const jumpToMessage = useZoreon((s) => s.jumpToMessage);
  const channel = channels.find((c) => c.id === activeId);
  const roots = useMemo(
    () => messages.filter((m) => m.channelId === activeId && !m.parentId).sort((a, b) => a.createdAt - b.createdAt),
    [messages, activeId],
  );
  const pinned = useMemo(
    () =>
      messages
        .filter((m) => m.channelId === activeId && m.pinnedAt)
        .sort((a, b) => (a.pinnedAt ?? 0) - (b.pinnedAt ?? 0)),
    [messages, activeId],
  );
  const bottom = useRef<HTMLDivElement>(null);
  const [editingTopic, setEditingTopic] = useState(false);
  const [topicDraft, setTopicDraft] = useState("");

  useEffect(() => {
    if (focusMessageId) {
      const el = document.getElementById(`msg-${focusMessageId}`);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        const t = window.setTimeout(() => clearFocusMessage(), 2500);
        return () => window.clearTimeout(t);
      }
    }
    bottom.current?.scrollIntoView({ block: "end" });
  }, [roots.length, activeId, focusMessageId, clearFocusMessage]);

  if (!channel) return null;

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
          {editingTopic ? (
            <form
              className="flex gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                void updateChannelTopic(channel.id, topicDraft.trim()).then(() => setEditingTopic(false));
              }}
            >
              <input
                autoFocus
                value={topicDraft}
                onChange={(e) => setTopicDraft(e.target.value)}
                onBlur={() => setEditingTopic(false)}
                className="h-6 w-full min-w-0 rounded-sm border border-border bg-composer px-1 text-xs outline-none"
              />
            </form>
          ) : (
            <button
              type="button"
              className="group flex max-w-full items-center gap-1 truncate text-left text-xs text-fg-subtle hover:text-fg"
              onClick={() => {
                setTopicDraft(channel.topic);
                setEditingTopic(true);
              }}
            >
              <span className="truncate">{channel.topic || "Add a topic"}</span>
              <Pencil className="size-3 shrink-0 opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="h-7 rounded-sm border border-border px-2 text-xs hover:bg-fg/10"
            title="Mute channel for 8 hours"
            onClick={() => {
              void setChannelPref({
                data: {
                  channelId: channel.id,
                  muted: true,
                  muteUntil: Date.now() + 8 * 60 * 60 * 1000,
                  notifyLevel: "nothing",
                },
              });
            }}
          >
            Mute
          </button>
          <button
            type="button"
            className="h-7 rounded-sm border border-border px-2 text-xs hover:bg-fg/10"
            onClick={() => {
              void setChannelPref({
                data: {
                  channelId: channel.id,
                  muted: false,
                  muteUntil: null,
                  notifyLevel: "mentions",
                },
              });
            }}
          >
            Mentions
          </button>
          <HuddleBar channelId={channel.id} />
        </div>
      </header>

      {pinned.length > 0 ? (
        <div className="flex flex-wrap gap-1 border-b border-border bg-sidebar/60 px-3 py-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-subtle">
            <Pin className="size-3" /> Pinned
          </span>
          {pinned.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => jumpToMessage(m.channelId, m.id)}
              className="max-w-[14rem] truncate rounded-sm bg-elevated px-2 py-0.5 text-xs text-fg-muted hover:text-fg"
            >
              {m.body.slice(0, 60) || "(file)"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="zoreon-scroll min-h-0 flex-1 px-3 py-4">
        {roots.map((m, i) => {
          const author = users.find((u) => u.id === m.authorId);
          const prev = roots[i - 1];
          const grouped =
            prev && prev.authorId === m.authorId && m.createdAt - prev.createdAt < 5 * 60 * 1000 && !m.system;
          return (
            <MessageRow
              key={m.id}
              message={m}
              author={author}
              grouped={Boolean(grouped)}
              focused={focusMessageId === m.id}
            />
          );
        })}
        <div ref={bottom} />
      </div>
      <Composer />
    </section>
  );
}

function FileChips({ files }: { files: MessageFile[] }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-2">
      {files.map((f) => {
        const isImage = f.mimeType.startsWith("image/");
        if (isImage && f.url) {
          return (
            <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-sm border border-border">
              <img src={f.url} alt={f.name} className="max-h-48 max-w-xs object-contain" />
            </a>
          );
        }
        return (
          <a
            key={f.id}
            href={f.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-panel px-2 py-1 text-xs text-fg-muted hover:text-fg"
          >
            <FileIcon className="size-3.5" />
            <span className="max-w-[12rem] truncate">{f.name}</span>
          </a>
        );
      })}
    </div>
  );
}

export function MessageRow({
  message,
  author,
  grouped,
  focused,
  compact,
}: {
  message: Message;
  author?: User;
  grouped: boolean;
  focused?: boolean;
  compact?: boolean;
}) {
  const setThread = useZoreon((s) => s.setThread);
  const toggleReaction = useZoreon((s) => s.toggleReaction);
  const editMessage = useZoreon((s) => s.editMessage);
  const deleteMessage = useZoreon((s) => s.deleteMessage);
  const togglePin = useZoreon((s) => s.togglePin);
  const addBookmark = useZoreon((s) => s.addBookmark);
  const addReminder = useZoreon((s) => s.addReminder);
  const currentUserId = useZoreon((s) => s.currentUserId);
  const myHandle = useZoreon((s) => s.users.find((u) => u.id === s.currentUserId)?.handle);
  const replies = useZoreon(
    (s) => s.messages.reduce((n, m) => n + (m.parentId === message.id ? 1 : 0), 0),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(message.body);
  const isMine = message.authorId === currentUserId;
  const edited = Boolean(message.updatedAt && message.updatedAt > message.createdAt);

  if (message.system) {
    return <p className="mx-auto my-3 max-w-lg text-center text-xs text-fg-subtle">{message.body}</p>;
  }

  const existingIds = new Set(message.reactions.map((r) => r.id));

  return (
    <article
      id={`msg-${message.id}`}
      className={cn(
        "group relative rounded-sm px-1 hover:bg-fg/4",
        grouped && !compact ? "py-0.5 pl-12" : "py-2",
        focused && "bg-accent-soft ring-1 ring-accent/40",
        message.pinnedAt && "bg-accent-soft/40",
      )}
    >
      <div className="flex gap-3">
        {grouped && !compact ? null : author ? (
          <ProfilePopover user={author}>
            {(open) => (
              <button type="button" onClick={open} className="shrink-0 rounded-full">
                <Avatar user={author} size={compact ? "sm" : "md"} />
              </button>
            )}
          </ProfilePopover>
        ) : (
          <span className="size-8" />
        )}
        <div className="min-w-0 flex-1">
          {grouped && !compact ? null : (
            <div className="mb-0.5 flex items-baseline gap-2">
              {author ? (
                <ProfilePopover user={author}>
                  {(open) => (
                    <button type="button" onClick={open} className="text-sm font-semibold hover:underline">
                      {author.name}
                    </button>
                  )}
                </ProfilePopover>
              ) : (
                <span className="text-sm font-semibold">Unknown</span>
              )}
              <span className="hidden text-xs text-fg-subtle sm:inline">{author?.role}</span>
              <TimeLabel ts={message.createdAt} />
              {edited ? <span className="text-xs text-fg-subtle">(edited)</span> : null}
              {message.pinnedAt ? <Pin className="size-3 text-accent" /> : null}
            </div>
          )}
          {editing ? (
            <form
              className="space-y-1"
              onSubmit={(e) => {
                e.preventDefault();
                void editMessage(message.id, editBody).then(() => setEditing(false));
              }}
            >
              <textarea
                autoFocus
                value={editBody}
                rows={3}
                onChange={(e) => setEditBody(e.target.value)}
                className="w-full rounded-sm border border-border bg-composer px-2 py-1 text-sm outline-none"
              />
              <div className="flex gap-2">
                <button type="submit" className="h-7 rounded-sm bg-accent px-2 text-xs text-accent-fg">
                  Save
                </button>
                <button
                  type="button"
                  className="h-7 rounded-sm px-2 text-xs text-fg-muted hover:bg-fg/10"
                  onClick={() => setEditing(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <MessageBody body={message.body} myHandle={myHandle} />
          )}
          {message.files?.length ? <FileChips files={message.files} /> : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
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
            <div className="relative">
              <button
                type="button"
                aria-label="Add reaction"
                onClick={() => setPickerOpen((o) => !o)}
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-pill border border-border text-fg-subtle hover:bg-elevated hover:text-fg",
                  pickerOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                <Plus className="size-3" />
              </button>
              {pickerOpen ? (
                <div className="absolute top-full left-0 z-10 mt-1 flex max-w-[16rem] flex-wrap gap-1 rounded-md border border-border-strong bg-panel p-1 shadow-menu">
                  {QUICK_REACTIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        toggleReaction(message.id, r.id, r.label);
                        setPickerOpen(false);
                      }}
                      className="rounded-sm px-1.5 py-1 text-sm hover:bg-accent-soft"
                    >
                      {r.label}
                      {existingIds.has(r.id) ? " ·" : ""}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button
                type="button"
                aria-label="Message actions"
                onClick={() => setMenuOpen((o) => !o)}
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-pill border border-border text-fg-subtle hover:bg-elevated",
                  menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                )}
              >
                <MoreHorizontal className="size-3" />
              </button>
              {menuOpen ? (
                <div className="absolute top-full right-0 z-10 mt-1 min-w-32 rounded-md border border-border-strong bg-panel p-1 shadow-menu">
                  {isMine ? (
                    <button
                      type="button"
                      className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent-soft"
                      onClick={() => {
                        setEditBody(message.body);
                        setEditing(true);
                        setMenuOpen(false);
                      }}
                    >
                      Edit
                    </button>
                  ) : null}
                  {isMine ? (
                    <button
                      type="button"
                      className="block w-full rounded-sm px-2 py-1.5 text-left text-xs text-danger hover:bg-accent-soft"
                      onClick={() => {
                        if (window.confirm("Delete this message?")) {
                          void deleteMessage(message.id);
                        }
                        setMenuOpen(false);
                      }}
                    >
                      Delete
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent-soft"
                    onClick={() => {
                      void togglePin(message.id, !message.pinnedAt);
                      setMenuOpen(false);
                    }}
                  >
                    {message.pinnedAt ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent-soft"
                    onClick={() => {
                      void addBookmark(message.id, message.channelId, message.body);
                      setMenuOpen(false);
                    }}
                  >
                    Bookmark
                  </button>
                  <button
                    type="button"
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent-soft"
                    onClick={() => {
                      void addReminder(
                        message.id,
                        message.channelId,
                        message.body,
                        Date.now() + 60 * 60 * 1000,
                      );
                      setMenuOpen(false);
                    }}
                  >
                    Remind in 1 hour
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          {!compact ? (
            replies > 0 || message.replyCount ? (
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
                className="mt-1 inline-flex min-h-11 items-center text-xs text-fg-subtle opacity-0 group-hover:opacity-100 focus-visible:opacity-100 md:min-h-0 max-md:opacity-100"
              >
                Reply in thread
              </button>
            )
          ) : null}
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

function expandSlash(raw: string): { body: string; handled: boolean; flash?: string } {
  const trimmed = raw.trim();
  if (trimmed === "/shrug") return { body: "¯\\_(ツ)_/¯", handled: true };
  if (trimmed === "/tableflip") return { body: "(╯°□°)╯︵ ┻━┻", handled: true };
  if (trimmed === "/invite" || trimmed.startsWith("/invite ")) {
    return { body: "", handled: true, flash: "invite" };
  }
  return { body: raw, handled: false };
}

export function Composer({ parentId }: { parentId?: string }) {
  const send = useZoreon((s) => s.sendMessage);
  const uploadAndSend = useZoreon((s) => s.uploadAndSend);
  const users = useZoreon((s) => s.users);
  const backend = useZoreon((s) => s.backend);
  const activeChannelId = useZoreon((s) => s.activeChannelId);
  const getDraft = useZoreon((s) => s.getDraft);
  const setDraft = useZoreon((s) => s.setDraft);
  const sendTyping = useZoreon((s) => s.sendTyping);
  const currentUserId = useZoreon((s) => s.currentUserId);
  const typingRaw = useZoreon((s) => s.typingByChannel[s.activeChannelId]);
  const typingPeers = useMemo(() => {
    const now = Date.now();
    return (typingRaw ?? []).filter((p) => p.userId !== currentUserId && now - p.at < 5000);
  }, [typingRaw, currentUserId]);
  const [value, setValue] = useState(() => getDraft(activeChannelId, parentId));
  const [mentionOpen, setMentionOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mentionQ, setMentionQ] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const typingSentAt = useRef(0);

  useEffect(() => {
    setValue(getDraft(activeChannelId, parentId));
  }, [activeChannelId, parentId, getDraft]);

  const mentionHits = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mentionQ.toLowerCase();
    return users
      .filter(
        (u) =>
          !q ||
          u.handle.toLowerCase().includes(q) ||
          u.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [mentionOpen, mentionQ, users]);

  const onChange = (next: string) => {
    setValue(next);
    setDraft(activeChannelId, parentId, next);
    if (next.trim() && Date.now() - typingSentAt.current > 2000) {
      typingSentAt.current = Date.now();
      sendTyping(activeChannelId);
    }
    const at = next.lastIndexOf("@");
    if (at >= 0) {
      const after = next.slice(at + 1);
      if (/^[\w.-]*$/.test(after) && !after.includes(" ")) {
        setMentionOpen(true);
        setMentionQ(after);
        return;
      }
    }
    setMentionOpen(false);
    setMentionQ("");
  };

  const insertMention = (handle: string) => {
    const at = value.lastIndexOf("@");
    const next = `${value.slice(0, at)}@${handle} `;
    setValue(next);
    setDraft(activeChannelId, parentId, next);
    setMentionOpen(false);
    setMentionQ("");
    ref.current?.focus();
  };

  const submit = async () => {
    const expanded = expandSlash(value);
    if (expanded.flash === "invite") {
      try {
        const res = await getInviteLink();
        const url = `${window.location.origin}${res.path}`;
        await navigator.clipboard.writeText(url);
        setFlash("Invite link copied");
        window.setTimeout(() => setFlash(null), 2000);
      } catch {
        setFlash("Could not copy invite");
        window.setTimeout(() => setFlash(null), 2000);
      }
      setValue("");
      setDraft(activeChannelId, parentId, "");
      return;
    }
    const body = expanded.body;
    if (!body.trim()) return;
    send(body, parentId);
    setValue("");
    setMentionOpen(false);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAndSend(file, value, parentId);
      setValue("");
    } catch (e) {
      setFlash(e instanceof Error ? e.message : "Upload failed");
      window.setTimeout(() => setFlash(null), 2500);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const typingLabel =
    typingPeers.length === 0
      ? null
      : typingPeers.length === 1
        ? `${typingPeers[0]!.userName} is typing…`
        : `${typingPeers.map((p) => p.userName).slice(0, 2).join(", ")} are typing…`;

  return (
    <form
      className="shrink-0 border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {typingLabel ? (
        <p className="mb-1 px-1 text-xs text-fg-subtle" aria-live="polite">
          {typingLabel}
        </p>
      ) : null}
      <div className="relative rounded-md border border-border-strong bg-composer px-3 py-2">
        {mentionOpen && mentionHits.length > 0 ? (
          <div className="absolute bottom-full left-0 z-20 mb-1 max-h-48 w-64 overflow-auto rounded-md border border-border-strong bg-panel p-1 shadow-menu">
            {mentionHits.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => insertMention(u.handle)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent-soft"
              >
                <Avatar user={u} size="sm" presence={false} />
                <span className="min-w-0 flex-1 truncate">{u.name}</span>
                <span className="text-xs text-fg-subtle">@{u.handle}</span>
              </button>
            ))}
          </div>
        ) : null}
        {emojiOpen ? (
          <div className="absolute bottom-full left-0 z-20 mb-1 flex max-w-xs flex-wrap gap-1 rounded-md border border-border-strong bg-panel p-2 shadow-menu">
            {COMPOSER_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className="rounded-sm px-1.5 py-1 text-base hover:bg-accent-soft"
                onClick={() => {
                  const next = `${value}${e}`;
                  setValue(next);
                  setDraft(activeChannelId, parentId, next);
                  setEmojiOpen(false);
                  ref.current?.focus();
                }}
              >
                {e}
              </button>
            ))}
          </div>
        ) : null}
        <textarea
          ref={ref}
          value={value}
          rows={2}
          placeholder={parentId ? "Reply in thread" : "Message · @mention · /shrug /tableflip /invite · **markdown**"}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
            if (e.key === "Escape") {
              setMentionOpen(false);
              setEmojiOpen(false);
            }
          }}
          className="w-full resize-none bg-transparent text-sm leading-normal text-fg outline-none placeholder:text-fg-subtle"
        />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Emoji"
              className="inline-flex size-8 items-center justify-center rounded-sm text-fg-subtle hover:bg-fg/10 hover:text-fg"
              onClick={() => {
                setEmojiOpen((o) => !o);
                setMentionOpen(false);
              }}
            >
              <Smile className="size-4" />
            </button>
            {backend === "mattermost" ? (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  aria-label="Attach file"
                  disabled={uploading}
                  className="inline-flex size-8 items-center justify-center rounded-sm text-fg-subtle hover:bg-fg/10 hover:text-fg disabled:opacity-40"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="size-4" />
                </button>
              </>
            ) : null}
            {flash ? <span className="text-xs text-fg-subtle">{flash}</span> : null}
            <p className="hidden text-xs text-fg-subtle sm:block">Return to send · drafts auto-saved</p>
          </div>
          <button
            type="submit"
            disabled={!value.trim() || uploading}
            className="ml-auto h-9 rounded-sm bg-accent px-3 text-xs font-medium text-accent-fg disabled:opacity-40"
          >
            {uploading ? "Uploading…" : "Send"}
          </button>
        </div>
      </div>
    </form>
  );
}
