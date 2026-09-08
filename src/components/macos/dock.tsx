import { cn } from "@/lib/utils";
import { useRelay } from "@/store/use-relay";
import { Folder, Globe, MessageSquare, Settings, TerminalSquare } from "lucide-react";

const apps = [
  { id: "finder", label: "Finder", icon: Folder, open: false },
  { id: "relay", label: "Relay", icon: MessageSquare, open: true },
  { id: "term", label: "Term", icon: TerminalSquare, open: false },
  { id: "web", label: "Safari", icon: Globe, open: false },
  { id: "set", label: "Settings", icon: Settings, open: false },
] as const;

export function Dock() {
  const windowMode = useRelay((s) => s.windowMode);
  const setWindowMode = useRelay((s) => s.setWindowMode);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center pb-[env(safe-area-inset-bottom)] max-md:hidden">
      <div className="pointer-events-auto flex items-end gap-2 rounded-xl border border-border-strong bg-dock px-2.5 py-2 shadow-dock backdrop-blur-2xl">
        {apps.map((app) => {
          const Icon = app.icon;
          const isRelay = app.id === "relay";
          return (
            <button
              key={app.id}
              type="button"
              title={app.label}
              onClick={() => {
                if (isRelay) setWindowMode(windowMode === "minimized" ? "maximized" : windowMode);
              }}
              className="group relative flex flex-col items-center"
            >
              <span
                className={cn(
                  "flex size-12 items-center justify-center rounded-lg bg-panel text-fg shadow-window transition-transform duration-150 ease-[var(--ease-out)] group-hover:-translate-y-1 group-hover:scale-110",
                  isRelay && "bg-accent text-accent-fg",
                )}
              >
                <Icon className="size-6" strokeWidth={1.75} />
              </span>
              <span
                className={cn(
                  "mt-1 size-1 rounded-full bg-fg",
                  isRelay && windowMode !== "minimized" ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
