import type { ReactNode } from "react";
import { Hash, Inbox, Radio, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/macos/avatar";
import { useAgora } from "@/store/use-agora";

export function ChannelNav() {
  const channels = useAgora((s) => s.channels);
  const users = useAgora((s) => s.users);
  const active = useAgora((s) => s.activeChannelId);
  const setActive = useAgora((s) => s.setActiveChannel);
  const currentUserId = useAgora((s) => s.currentUserId);
  const me = users.find((u) => u.id === currentUserId)!;

  const rooms = channels.filter((c) => c.kind === "war-room");
  const chans = channels.filter((c) => c.kind === "channel");
  const dms = channels.filter((c) => c.kind === "dm");

  return (
    <aside className="flex h-full min-h-0 w-full max-w-full shrink-0 bg-sidebar md:w-60">
      <div className="hidden w-12 shrink-0 flex-col items-center gap-2 border-r border-border bg-rail py-3 md:flex">
        <span className="flex size-8 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-fg">
          Z
        </span>
        <span className="mt-2 flex size-9 items-center justify-center rounded-md bg-accent-soft text-accent">
          <Inbox className="size-4" />
        </span>
        <span className="flex size-9 items-center justify-center rounded-md text-fg-muted">
          <Radio className="size-4" />
        </span>
        <div className="mt-auto">
          <Avatar user={me} size="sm" />
        </div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-12 items-center border-b border-border px-3">
          <p className="truncate text-sm font-semibold tracking-tight">Zyvor</p>
        </div>
        <div className="agora-scroll min-h-0 flex-1 px-2 py-3">
          <Section label="War rooms">
            {rooms.map((c) => (
              <NavRow
                key={c.id}
                active={active === c.id}
                unread={c.unread}
                mention={c.mention}
                onClick={() => setActive(c.id)}
                icon={<Radio className="size-3.5" />}
                name={c.name}
              />
            ))}
          </Section>
          <Section label="Channels">
            {chans.map((c) => (
              <NavRow
                key={c.id}
                active={active === c.id}
                unread={c.unread}
                onClick={() => setActive(c.id)}
                icon={<Hash className="size-3.5" />}
                name={c.name}
              />
            ))}
          </Section>
          <Section label="Direct">
            {dms.map((c) => {
              const other = users.find((u) => c.members.includes(u.id) && u.id !== currentUserId);
              return (
                <NavRow
                  key={c.id}
                  active={active === c.id}
                  unread={c.unread}
                  onClick={() => setActive(c.id)}
                  icon={other ? <Avatar user={other} size="sm" presence={false} /> : <Users className="size-3.5" />}
                  name={c.name}
                />
              );
            })}
          </Section>
        </div>
      </div>
    </aside>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-4">
      <p className="px-2 pb-1 text-xs font-medium tracking-wide text-fg-subtle uppercase">{label}</p>
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
}: {
  name: string;
  icon: ReactNode;
  active: boolean;
  unread: number;
  mention?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-sm px-2 text-left text-sm md:min-h-8",
        active ? "bg-selection text-fg" : "text-fg-muted hover:bg-fg/5 hover:text-fg",
        unread > 0 && !active && "font-semibold text-fg",
      )}
    >
      <span className="flex size-5 items-center justify-center text-fg-subtle">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{name}</span>
      {unread > 0 ? (
        <span
          className={cn(
            "min-w-4 rounded-pill px-1.5 text-center text-xs tabular-nums",
            mention ? "bg-accent text-accent-fg" : "bg-elevated text-fg",
          )}
        >
          {unread}
        </span>
      ) : null}
    </button>
  );
}
