import { MenuBar } from "@/components/macos/menu-bar";
import { Dock } from "@/components/macos/dock";
import { WindowFrame } from "@/components/macos/window-frame";
import { CommandPalette } from "@/components/macos/command-palette";
import { Workspace } from "@/components/relay/workspace";
import { useRelay } from "@/store/use-relay";

export function Desktop() {
  const windowMode = useRelay((s) => s.windowMode);
  const setWindowMode = useRelay((s) => s.setWindowMode);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-desktop text-fg">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px 700px at 18% 0%, var(--color-desktop-mist) 0%, transparent 55%), radial-gradient(900px 600px at 90% 100%, var(--color-desktop-deep) 0%, transparent 50%), var(--color-desktop)",
        }}
      />
      <MenuBar />
      <div
        className="relative flex min-h-0 flex-1 items-stretch justify-center p-0 md:items-center md:p-3 md:pb-20"
        onDoubleClick={() => {
          if (windowMode === "minimized") setWindowMode("maximized");
        }}
      >
        <WindowFrame>
          <Workspace />
        </WindowFrame>
        {windowMode === "minimized" ? (
          <p className="pointer-events-none absolute bottom-28 hidden text-sm text-fg-muted md:block">
            Relay is in the Dock
          </p>
        ) : null}
      </div>
      <Dock />
      <CommandPalette />
    </div>
  );
}
