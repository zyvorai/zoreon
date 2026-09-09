import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useZoreon } from "@/store/use-zoreon";

export function WindowFrame({ children }: { children: ReactNode }) {
  const windowMode = useZoreon((s) => s.windowMode);
  const setWindowMode = useZoreon((s) => s.setWindowMode);
  const setPaletteOpen = useZoreon((s) => s.setPaletteOpen);

  if (windowMode === "minimized") return null;

  const maximized = windowMode === "maximized";

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden border border-border-strong bg-window shadow-window",
        maximized
          ? "h-full flex-1 self-stretch rounded-none md:rounded-lg"
          : "mx-auto h-full max-w-6xl flex-1 self-stretch rounded-lg md:h-[92%] md:max-h-[760px] md:w-[92%] md:flex-none",
      )}
    >
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-titlebar px-3">
        <div className="flex items-center gap-1.5 pr-1">
          <Traffic color="bg-traffic-close" label="Close" onClick={() => setWindowMode("minimized")} />
          <Traffic
            color="bg-traffic-max"
            label={maximized ? "Restore" : "Maximize"}
            onClick={() => setWindowMode(maximized ? "normal" : "maximized")}
          />
        </div>
        <p className="hidden min-w-0 flex-1 truncate text-center text-xs font-medium text-fg-muted sm:block">
          Zoreon — Zyvor ops chat
        </p>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="ml-auto flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-window text-fg-subtle sm:h-7 sm:w-56 sm:justify-start sm:px-2.5"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="hidden truncate sm:inline sm:pl-2">Search or jump</span>
          <kbd className="ml-auto hidden rounded-xs bg-elevated px-1.5 py-0.5 font-sans text-xs text-fg-muted sm:inline">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex min-h-0 flex-1">{children}</div>
    </div>
  );
}

function Traffic({ color, label, onClick }: { color: string; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn("size-3 rounded-full ring-1 ring-desktop/40", color)}
    />
  );
}
