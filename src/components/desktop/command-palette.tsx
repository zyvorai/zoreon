import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Bookmark, Hash, MessageSquare, RotateCcw, Search, Users } from "lucide-react";
import { useZoreon } from "@/store/use-zoreon";
import { deleteSavedSearch, listSavedSearches, saveSearch, searchMessages } from "@/lib/zoreon/api";

type Hit = {
  id: string;
  channelId: string;
  body: string;
  createdAt: number;
  authorId: string;
};

type Saved = { id: string; name: string; query: string };

export function CommandPalette() {
  const open = useZoreon((s) => s.paletteOpen);
  const setOpen = useZoreon((s) => s.setPaletteOpen);
  const channels = useZoreon((s) => s.channels);
  const setActiveChannel = useZoreon((s) => s.setActiveChannel);
  const jumpToMessage = useZoreon((s) => s.jumpToMessage);
  const resetDemo = useZoreon((s) => s.resetDemo);
  const backend = useZoreon((s) => s.backend);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [searching, setSearching] = useState(false);

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
    if (!open) {
      setQ("");
      setHits([]);
      return;
    }
    void listSavedSearches()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, [open]);

  useEffect(() => {
    const terms = q.trim();
    if (!open || terms.length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      setSearching(true);
      void searchMessages({ data: { terms } })
        .then((rows) => {
          if (!cancelled) setHits(rows);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [q, open]);

  if (!open) return null;

  const channelName = (id: string) => channels.find((c) => c.id === id)?.name ?? id;

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
            placeholder="from:ani in:cutover has:link after:2026-01-01 …"
            className="h-11 w-full bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
          />
        </div>
        <p className="border-b border-border px-3 py-1 text-[10px] text-fg-subtle">
          Modifiers: from: · in: · has:link|file|reaction · before: · after:
          {q.trim().length >= 2 ? (
            <button
              type="button"
              className="ml-2 text-accent hover:underline"
              onClick={() => {
                const name = window.prompt("Name this search", q.trim().slice(0, 40));
                if (!name) return;
                void saveSearch({ data: { name, query: q.trim() } })
                  .then((row) => setSaved((s) => [row, ...s]))
                  .catch(() => undefined);
              }}
            >
              Save search
            </button>
          ) : null}
        </p>
        <Command.List className="zoreon-scroll max-h-80 p-1">
          <Command.Empty className="px-3 py-6 text-center text-sm text-fg-subtle">
            {searching ? "Searching…" : "Nothing matches."}
          </Command.Empty>
          {saved.length > 0 ? (
            <Command.Group
              heading="Saved searches"
              className="px-1 py-1 text-xs font-medium tracking-wide text-fg-subtle uppercase"
            >
              {saved.map((s) => (
                <Command.Item
                  key={s.id}
                  value={`saved ${s.name} ${s.query}`}
                  onSelect={() => setQ(s.query)}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm aria-selected:bg-accent-soft"
                >
                  <Bookmark className="size-4 text-fg-muted" />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <button
                    type="button"
                    className="text-xs text-fg-subtle hover:text-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteSavedSearch({ data: { id: s.id } }).then(() =>
                        setSaved((list) => list.filter((x) => x.id !== s.id)),
                      );
                    }}
                  >
                    ×
                  </button>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
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
                {ch.kind === "dm" ? (
                  <Users className="size-4 text-fg-muted" />
                ) : (
                  <Hash className="size-4 text-fg-muted" />
                )}
                <span className="truncate">{ch.kind === "dm" ? ch.name : `#${ch.name}`}</span>
              </Command.Item>
            ))}
          </Command.Group>
          {hits.length > 0 ? (
            <Command.Group
              heading="Messages"
              className="px-1 py-1 text-xs font-medium tracking-wide text-fg-subtle uppercase"
            >
              {hits.map((h) => (
                <Command.Item
                  key={h.id}
                  value={`msg ${h.body} ${channelName(h.channelId)}`}
                  onSelect={() => {
                    jumpToMessage(h.channelId, h.id);
                    setOpen(false);
                  }}
                  className="flex cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-sm aria-selected:bg-accent-soft"
                >
                  <MessageSquare className="mt-0.5 size-4 shrink-0 text-fg-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-fg-subtle">#{channelName(h.channelId)}</p>
                    <p className="line-clamp-2 text-fg">{h.body}</p>
                  </div>
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}
          <Command.Group
            heading="Commands"
            className="px-1 py-1 text-xs font-medium tracking-wide text-fg-subtle uppercase"
          >
            <Command.Item
              value={backend === "mattermost" ? "refresh mattermost" : "reset workspace"}
              onSelect={() => {
                resetDemo();
                setOpen(false);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-2 text-sm aria-selected:bg-accent-soft"
            >
              <RotateCcw className="size-4 text-fg-muted" />
              {backend === "mattermost" ? "Refresh from Mattermost" : "Reset workspace data"}
            </Command.Item>
          </Command.Group>
        </Command.List>
      </Command>
    </div>
  );
}
