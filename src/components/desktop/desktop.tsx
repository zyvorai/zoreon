import { useEffect } from "react";
import { MenuBar } from "@/components/desktop/menu-bar";
import { Dock } from "@/components/desktop/dock";
import { WindowFrame } from "@/components/desktop/window-frame";
import { CommandPalette } from "@/components/desktop/command-palette";
import { Workspace } from "@/components/agora/workspace";
import { useAgora } from "@/store/use-agora";

export function Desktop() {
  const windowMode = useAgora((s) => s.windowMode);
  const setWindowMode = useAgora((s) => s.setWindowMode);
  const hydrate = useAgora((s) => s.hydrate);
  const refresh = useAgora((s) => s.refresh);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 5000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);

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
            Agora is minimized
          </p>
        ) : null}
      </div>
      <Dock />
      <CommandPalette />
    </div>
  );
}
