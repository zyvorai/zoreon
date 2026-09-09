import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { useAgora } from "@/store/use-agora";

const menus = ["Agora", "File", "Edit", "View", "Go", "Window"] as const;

export function MenuBar() {
  const [clock, setClock] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const setPaletteOpen = useAgora((s) => s.setPaletteOpen);
  const resetDemo = useAgora((s) => s.resetDemo);

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }),
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="relative z-40 flex h-7 shrink-0 items-center justify-between bg-menubar px-3 text-xs text-fg backdrop-blur-xl">
      <nav className="flex items-center gap-0.5">
        <span className="mr-1 flex size-6 items-center justify-center font-semibold tracking-tight" aria-hidden>
          Z
        </span>
        {menus.map((item) => (
          <div key={item} className={cn("relative", item !== "Agora" && "hidden sm:block")}>
            <button
              type="button"
              onClick={() => setOpen(open === item ? null : item)}
              className={cn(
                "rounded-xs px-2 py-0.5 font-medium",
                item === "Agora" && "font-semibold",
                open === item ? "bg-accent text-accent-fg" : "hover:bg-fg/10",
              )}
            >
              {item}
            </button>
            {open === item ? (
              <div
                className="absolute top-full left-0 mt-1 min-w-52 rounded-md border border-border-strong bg-panel/95 p-1 shadow-menu backdrop-blur-xl"
                onMouseLeave={() => setOpen(null)}
              >
                {item === "Agora" ? (
                  <>
                    <MenuItem
                      label="Command palette"
                      kbd="⌘K"
                      onClick={() => {
                        setPaletteOpen(true);
                        setOpen(null);
                      }}
                    />
                    <MenuItem
                      label="Reset demo data"
                      onClick={() => {
                        resetDemo();
                        setOpen(null);
                      }}
                    />
                  </>
                ) : item === "Go" ? (
                  <MenuItem
                    label="Jump to channel"
                    kbd="⌘K"
                    onClick={() => {
                      setPaletteOpen(true);
                      setOpen(null);
                    }}
                  />
                ) : (
                  <p className="px-2 py-1.5 text-fg-subtle">Native macOS chrome · demo</p>
                )}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
      <time className="tabular-nums text-fg-muted">{clock}</time>
    </header>
  );
}

function MenuItem({ label, kbd, onClick }: { label: string; kbd?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xs px-2 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-fg"
    >
      {label}
      {kbd ? <span className="text-fg-subtle">{kbd}</span> : null}
    </button>
  );
}
