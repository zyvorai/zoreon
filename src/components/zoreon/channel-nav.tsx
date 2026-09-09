import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bookmark, Bell, Hash, Inbox, Plus, Radio, Star, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/desktop/avatar";
import { ZyvorMark } from "@/components/brand/zyvor-mark";
import { useZoreon } from "@/store/use-zoreon";

export function ChannelNav() {
  const channels = useZoreon((s) => s.channels);
  const users = useZoreon((s) => s.users);
  const active = useZoreon((s) => s.activeChannelId);
  const setActive = useZoreon((s) => s.setActiveChannel);
  const currentUserId = useZoreon((s) => s.currentUserId);
  const createChannel = useZoreon((s) => s.createChannel);
  const createDirect = useZoreon((s) => s.createDirect);
  const setMyStatus = useZoreon((s) => s.setMyStatus);
  const toggleStarChannel = useZoreon((s) => s.toggleStarChannel);
  const backend = useZoreon((s) => s.backend);
  const inboxMode = useZoreon((s) => s.inboxMode);
  const setInboxMode = useZoreon((s) => s.setInboxMode);
  const teams = useZoreon((s) => s.teams);
  const teamId = useZoreon((s) => s.teamId);
  const setPreferredTeam = useZoreon((s) => s.setPreferredTeam);
  const loadTeams = useZoreon((s) => s.loadTeams);
  const me = users.find((u) => u.id === currentUserId);
  const [modal, setModal] = useState<"channel" | "dm" | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [channelName, setChannelName] = useState("");
  const [channelPurpose, setChannelPurpose] = useState("");
  const [dmQuery, setDmQuery] = useState("");

  useEffect(() => {
    if (backend === "mattermost") void loadTeams();
  }, [backend, loadTeams]);

  const rooms = channels.filter((c) => c.kind === "war-room");
  const starred = channels.filter((c) => c.starred);
  const chans = channels.filter((c) => c.kind === "channel" && !c.starred);
  const dms = channels.filter((c) => c.kind === "dm");
  const unreadTotal = channels.reduce((n, c) => n + (c.unread > 0 ? 1 : 0), 0);
  const dmCandidates = useMemo(() => {
    const q = dmQuery.trim().toLowerCase();
    return users
      .filter((u) => u.id !== currentUserId)
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.handle.toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [users, currentUserId, dmQuery]);

  const submitChannel = async () => {
    const name = channelName.trim().replace(/^#/, "");
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      await createChannel(name, channelPurpose.trim() || undefined);
      setChannelName("");
      setChannelPurpose("");
      setModal(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not create channel");
    } finally {
      setBusy(false);
    }
  };

  const submitDm = async (userId: string) => {
    setBusy(true);
    setErr(null);
    try {
      await createDirect(userId);
      setDmQuery("");
      setModal(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start DM");
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full max-w-full shrink-0 bg-sidebar md:w-60">
      <div className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-border bg-rail py-3 md:flex">
        <ZyvorMark size={32} className="size-8 rounded-md" alt="Zyvor" />
        {me ? (
          <div className="relative mt-auto">
            <button
              type="button"
              aria-label="Set status"
              className="rounded-full"
              onClick={() => setStatusOpen((o) => !o)}
            >
              <Avatar user={me} size="sm" />
            </button>
            {statusOpen ? (
              <div className="absolute bottom-0 left-full z-30 ml-2 min-w-28 rounded-md border border-border-strong bg-panel p-1 shadow-menu">
                {(
                  [
                    ["online", "Active"],
                    ["away", "Away"],
                    ["dnd", "Do not disturb"],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    className="block w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent-soft"
                    onClick={() => {
                      void setMyStatus(status).finally(() => setStatusOpen(false));
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center gap-2 border-b border-border px-3">
          {backend === "mattermost" && teams.length > 1 ? (
            <select
              className="min-w-0 flex-1 truncate rounded-sm border-0 bg-transparent text-sm font-semibold outline-none"
              value={teamId ?? teams[0]?.id ?? ""}
              onChange={(e) => void setPreferredTeam(e.target.value)}
              aria-label="Team"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.displayName || t.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="truncate text-sm font-semibold tracking-tight">Zyvor</p>
          )}
        </div>
        <div className="zoreon-scroll min-h-0 flex-1 px-2 py-3">
          <Section label="Inbox">
            <NavRow
              active={inboxMode === "unreads"}
              unread={unreadTotal}
              onClick={() => setInboxMode(inboxMode === "unreads" ? "none" : "unreads")}
              icon={<Inbox className="size-3.5" />}
              name="All unreads"
            />
            <NavRow
              active={inboxMode === "bookmarks"}
              unread={0}
              onClick={() => setInboxMode(inboxMode === "bookmarks" ? "none" : "bookmarks")}
              icon={<Bookmark className="size-3.5" />}
              name="Bookmarks"
            />
            <NavRow
              active={inboxMode === "reminders"}
              unread={0}
              onClick={() => setInboxMode(inboxMode === "reminders" ? "none" : "reminders")}
              icon={<Bell className="size-3.5" />}
              name="Reminders"
            />
          </Section>
          {starred.length > 0 ? (
            <Section label="Starred">
              {starred.map((c) => (
                <NavRow
                  key={c.id}
                  active={inboxMode === "none" && active === c.id}
                  unread={c.unread}
                  mention={c.mention}
                  onClick={() => setActive(c.id)}
                  onStar={() => void toggleStarChannel(c.id)}
                  starred
                  icon={
                    c.kind === "war-room" ? (
                      <Radio className="size-3.5" />
                    ) : c.kind === "dm" ? (
                      <Users className="size-3.5" />
                    ) : (
                      <Hash className="size-3.5" />
                    )
                  }
                  name={c.name}
                />
              ))}
            </Section>
          ) : null}
          <Section label="War rooms">
            {rooms
              .filter((c) => !c.starred)
              .map((c) => (
                <NavRow
                  key={c.id}
                  active={inboxMode === "none" && active === c.id}
                  unread={c.unread}
                  mention={c.mention}
                  onClick={() => setActive(c.id)}
                  onStar={() => void toggleStarChannel(c.id)}
                  icon={<Radio className="size-3.5" />}
                  name={c.name}
                />
              ))}
          </Section>
          <Section
            label="Channels"
            action={
              <button
                type="button"
                aria-label="Create channel"
                className="rounded-sm p-0.5 text-fg-subtle hover:bg-fg/10 hover:text-fg"
                onClick={() => {
                  setErr(null);
                  setModal("channel");
                }}
              >
                <Plus className="size-3.5" />
              </button>
            }
          >
            {chans.map((c) => (
              <NavRow
                key={c.id}
                active={inboxMode === "none" && active === c.id}
                unread={c.unread}
                mention={c.mention}
                onClick={() => setActive(c.id)}
                onStar={() => void toggleStarChannel(c.id)}
                icon={<Hash className="size-3.5" />}
                name={c.name}
              />
            ))}
          </Section>
          <Section
            label="Direct"
            action={
              backend === "mattermost" ? (
                <button
                  type="button"
                  aria-label="Start direct message"
                  className="rounded-sm p-0.5 text-fg-subtle hover:bg-fg/10 hover:text-fg"
                  onClick={() => {
                    setErr(null);
                    setModal("dm");
                  }}
                >
                  <Plus className="size-3.5" />
                </button>
              ) : null
            }
          >
            {dms.length === 0 ? (
              <p className="px-2 py-1 text-xs text-fg-subtle">No directs yet</p>
            ) : (
              dms
                .filter((c) => !c.starred)
                .map((c) => {
                  const other = users.find((u) => c.members.includes(u.id) && u.id !== currentUserId);
                  return (
                    <NavRow
                      key={c.id}
                      active={inboxMode === "none" && active === c.id}
                      unread={c.unread}
                      mention={c.mention}
                      onClick={() => setActive(c.id)}
                      onStar={() => void toggleStarChannel(c.id)}
                      icon={
                        other ? (
                          <Avatar user={other} size="sm" presence={false} />
                        ) : (
                          <Users className="size-3.5" />
                        )
                      }
                      name={c.name}
                    />
                  );
                })
            )}
          </Section>
        </div>
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-desktop/50 px-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Dismiss"
            onClick={() => !busy && setModal(null)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-lg border border-border-strong bg-panel p-4 shadow-window">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">
                {modal === "channel" ? "Create channel" : "Start a direct message"}
              </p>
              <button
                type="button"
                className="rounded-sm p-1 text-fg-subtle hover:bg-fg/10"
                onClick={() => !busy && setModal(null)}
              >
                <X className="size-4" />
              </button>
            </div>
            {err ? <p className="mb-2 text-xs text-danger">{err}</p> : null}
            {modal === "channel" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitChannel();
                }}
                className="space-y-3"
              >
                <input
                  autoFocus
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="channel-name"
                  className="h-9 w-full rounded-sm border border-border bg-composer px-2 text-sm outline-none focus:border-accent"
                  disabled={busy}
                />
                <input
                  value={channelPurpose}
                  onChange={(e) => setChannelPurpose(e.target.value)}
                  placeholder="Purpose (optional)"
                  className="h-9 w-full rounded-sm border border-border bg-composer px-2 text-sm outline-none focus:border-accent"
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !channelName.trim()}
                  className="h-9 w-full rounded-sm bg-accent text-xs font-medium text-accent-fg disabled:opacity-40"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
              </form>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  value={dmQuery}
                  onChange={(e) => setDmQuery(e.target.value)}
                  placeholder="Find a person"
                  className="h-9 w-full rounded-sm border border-border bg-composer px-2 text-sm outline-none focus:border-accent"
                  disabled={busy}
                />
                <div className="zoreon-scroll max-h-48 space-y-0.5">
                  {dmCandidates.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      disabled={busy}
                      onClick={() => void submitDm(u.id)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent-soft"
                    >
                      <Avatar user={u} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{u.name}</span>
                      <span className="text-xs text-fg-subtle">@{u.handle}</span>
                    </button>
                  ))}
                  {dmCandidates.length === 0 ? (
                    <p className="px-2 py-3 text-center text-xs text-fg-subtle">No matches</p>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function Section({
  label,
  children,
  action,
}: {
  label: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">{label}</p>
        {action}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavRow({
  name,
  icon,
  active,
  unread,
  mention,
  onClick,
  onStar,
  starred,
}: {
  name: string;
  icon: ReactNode;
  active: boolean;
  unread: number;
  mention?: boolean;
  onClick: () => void;
  onStar?: () => void;
  starred?: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex min-h-11 items-center gap-1 rounded-sm px-1 text-sm md:min-h-8",
        active ? "bg-selection text-fg" : "text-fg-muted hover:bg-fg/5 hover:text-fg",
        unread > 0 && !active && "font-semibold text-fg",
      )}
    >
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 items-center gap-2 px-1 text-left">
        <span className="flex size-5 items-center justify-center text-fg-subtle">{icon}</span>
        <span className="min-w-0 flex-1 truncate">{name}</span>
        {unread > 0 || mention ? (
          <span
            className={cn(
              "min-w-4 rounded-pill px-1.5 text-center text-xs tabular-nums",
              mention ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
            )}
          >
            {unread > 0 ? unread : "@"}
          </span>
        ) : null}
      </button>
      {onStar ? (
        <button
          type="button"
          aria-label={starred ? "Unstar" : "Star"}
          className={cn(
            "rounded-sm p-1 text-fg-subtle hover:text-fg",
            starred ? "opacity-100 text-accent" : "opacity-0 group-hover:opacity-100",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
        >
          <Star className={cn("size-3", starred && "fill-current")} />
        </button>
      ) : null}
    </div>
  );
}
