import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Hash, Headphones, RotateCcw, Search, Users } from "lucide-react";
import { useAgora } from "@/store/use-agora";

export function CommandPalette() {
  const open = useAgora((s) => s.paletteOpen);
  const setOpen = useAgora((s) => s.setPaletteOpen);
  const channels = useAgora((s) => s.channels);
  const setActiveChannel = useAgora((s) => s.setActiveChannel);
  const startHuddle = useAgora((s) => s.startHuddle);
  const resetDemo = useAgora((s) => s.resetDemo);
  const [q, setQ] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-desktop/50 px-4 pt-[12vh] backdrop-blur-sm">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Dismiss" onClick={() => setOpen(false)} />
      <Command
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-lg border border-border-strong bg-panel shadow-window"
        shouldFilter
      >
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-fg-subtle" />
          <Command.Input
            value={q}
            onValueChange={setQ}
            autoFocus
            placeholder="Jump to a channel, person, or command"
            className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <Command.List className="agora-scroll max-h-80 p-1">
          <Command.Empty className="px-3 py-6 text-center text-sm text-fg-subtle">Nothing matches.</Command.Empty>
          <Command.Group
            heading="Spaces"
            className="px-1 py-1 text-xs font-medium tracking-wide text-fg-subtle uppercase"
          >
            {channels.map((ch) => (
              <Command.Item
                key={ch.id}
                value={`${ch.name} ${ch.kind}`}
                onSelect={() => {
                  setActiveChannel(ch.id);
                  setOpen(false);
                }}
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm text-fg aria-selected:bg-accent-soft"
              >
                {ch.kind === "dm" ? <Users className="size-4 text-fg-muted" /> : <Hash className="size-4 text-fg-muted" />}
                <span className="truncate">{ch.kind === "dm" ? ch.name : `#${ch.name}`}</span>
                {ch.kind === "war-room" ? (
                  <span className="ml-auto rounded-pill bg-accent-soft px-2 py-0.5 text-xs text-accent">War room</span>
                ) : null}
              </Command.Item>
            ))}
          </Command.Group>
          <Command.Group
            heading="Commands"
            className="px-1 py-1 text-xs font-medium tracking-wide text-fg-subtle uppercase"
          >
            <Command.Item
              value="start huddle"
              onSelect={() => {
                startHuddle();
                setOpen(false);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm aria-selected:bg-accent-soft"
            >
              <Headphones className="size-4 text-fg-muted" />
              Start huddle
            </Command.Item>
            <Command.Item
              value="reset demo"
              onSelect={() => {
                resetDemo();
                setOpen(false);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm aria-selected:bg-accent-soft"
            >
              <RotateCcw className="size-4 text-fg-muted" />
              Reset demo data
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
