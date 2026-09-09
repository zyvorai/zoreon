import { cn } from "@/lib/utils";
import { ZyvorMark } from "@/components/brand/zyvor-mark";
import { useZoreon } from "@/store/use-zoreon";

export function Dock() {
  const windowMode = useZoreon((s) => s.windowMode);
  const setWindowMode = useZoreon((s) => s.setWindowMode);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-2 z-30 flex justify-center pb-[env(safe-area-inset-bottom)] max-md:hidden">
      <div className="pointer-events-auto flex items-end gap-2 rounded-xl border border-border-strong bg-dock px-2.5 py-2 shadow-dock backdrop-blur-2xl">
        <button
          type="button"
          title="Zoreon"
          onClick={() => setWindowMode(windowMode === "minimized" ? "maximized" : windowMode)}
          className="group relative flex flex-col items-center"
        >
          <span
            className={cn(
              "flex size-12 items-center justify-center overflow-hidden rounded-lg shadow-window transition-transform duration-150 ease-[var(--ease-out)] group-hover:-translate-y-1 group-hover:scale-110",
            )}
          >
            <ZyvorMark size={48} alt="Zoreon" className="size-12 rounded-lg" />
          </span>
          <span
            className={cn(
              "mt-1 size-1 rounded-full bg-fg",
              windowMode !== "minimized" ? "opacity-100" : "opacity-0",
            )}
          />
        </button>
      </div>
    </div>
  );
}
