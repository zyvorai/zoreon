import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ZyvorMark } from "@/components/brand/zyvor-mark";
import { UserButton } from "@/lib/auth/gates";
import { useZoreon } from "@/store/use-zoreon";
import { InviteDialog } from "@/components/desktop/invite-dialog";
import { AdminPanel } from "@/components/desktop/admin-panel";

const menus = ["Zoreon", "Go"] as const;

export function MenuBar() {
  const [clock, setClock] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const setPaletteOpen = useZoreon((s) => s.setPaletteOpen);
  const resetDemo = useZoreon((s) => s.resetDemo);
  const backend = useZoreon((s) => s.backend);
  const tapeUsername = useZoreon((s) => s.tapeUsername);
  const isAdmin = useZoreon((s) => s.isAdmin);
  const notifPrefs = useZoreon((s) => s.notifPrefs);
  const setNotifPrefs = useZoreon((s) => s.setNotifPrefs);

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

  const refreshLabel = backend === "mattermost" ? "Refresh from Mattermost" : "Reset workspace data";

  return (
    <>
      <header className="relative z-40 flex h-7 shrink-0 items-center justify-between bg-menubar px-3 text-xs text-fg backdrop-blur-xl">
        <nav className="flex items-center gap-0.5">
          <ZyvorMark size={16} className="mr-1.5" alt="" />
          {menus.map((item) => (
            <div key={item} className={cn("relative", item !== "Zoreon" && "hidden sm:block")}>
              <button
                type="button"
                onClick={() => setOpen(open === item ? null : item)}
                className={cn(
                  "rounded-xs px-2 py-0.5 font-medium",
                  item === "Zoreon" && "font-semibold",
                  open === item ? "bg-accent text-accent-fg" : "hover:bg-fg/10",
                )}
              >
                {item}
              </button>
              {open === item ? (
                <div className="absolute top-full left-0 z-50 pt-1">
                  <div className="min-w-52 rounded-md border border-border-strong bg-panel/95 p-1 shadow-menu backdrop-blur-xl">
                    {item === "Zoreon" ? (
                      <>
                        <MenuItem
                          label="Command palette"
                          kbd="⌘K"
                          onClick={() => {
                            setPaletteOpen(true);
                            setOpen(null);
                          }}
                        />
                        {isAdmin ? (
                          <MenuItem
                            label="Invite people"
                            onClick={() => {
                              setInviteOpen(true);
                              setOpen(null);
                            }}
                          />
                        ) : null}
                        <MenuItem
                          label="Notification prefs"
                          onClick={() => {
                            setPrefsOpen(true);
                            setOpen(null);
                          }}
                        />
                        {isAdmin ? (
                          <MenuItem
                            label="Workspace admin"
                            onClick={() => {
                              setAdminOpen(true);
                              setOpen(null);
                            }}
                          />
                        ) : null}
                        <MenuItem
                          label={refreshLabel}
                          onClick={() => {
                            resetDemo();
                            setOpen(null);
                          }}
                        />
                      </>
                    ) : (
                      <MenuItem
                        label="Jump to channel"
                        kbd="⌘K"
                        onClick={() => {
                          setPaletteOpen(true);
                          setOpen(null);
                        }}
                      />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <span className="hidden rounded-sm bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent sm:inline">
              Admin
            </span>
          ) : null}
          {backend === "mattermost" && tapeUsername ? (
            <span
              className="hidden items-center gap-1.5 text-fg-muted sm:inline-flex"
              title="Mattermost tape"
            >
              <span className="size-1.5 rounded-full bg-success" aria-hidden />
              Tape: {tapeUsername}
            </span>
          ) : null}
          <div className="hidden scale-90 sm:block [&_span]:text-xs [&_button]:text-xs">
            <UserButton />
          </div>
          <time className="tabular-nums text-fg-muted">{clock}</time>
        </div>
      </header>
      <InviteDialog open={inviteOpen} onClose={() => setInviteOpen(false)} />
      <AdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      {prefsOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-desktop/55 px-4 backdrop-blur-sm">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Dismiss"
            onClick={() => setPrefsOpen(false)}
          />
          <div className="relative z-10 w-full max-w-sm rounded-lg border border-border-strong bg-panel p-4 shadow-window">
            <p className="mb-3 text-sm font-semibold">Notification preferences</p>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifPrefs.desktop}
                onChange={(e) => {
                  const next = { ...notifPrefs, desktop: e.target.checked };
                  void setNotifPrefs(next);
                  if (next.desktop && typeof Notification !== "undefined" && Notification.permission === "default") {
                    void Notification.requestPermission();
                  }
                }}
              />
              Desktop notifications
            </label>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifPrefs.mentionsOnly}
                onChange={(e) => void setNotifPrefs({ ...notifPrefs, mentionsOnly: e.target.checked })}
              />
              Mentions only
            </label>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={notifPrefs.muteDms}
                onChange={(e) => void setNotifPrefs({ ...notifPrefs, muteDms: e.target.checked })}
              />
              Mute DMs
            </label>
            <button
              type="button"
              className="h-8 w-full rounded-sm bg-accent text-xs font-medium text-accent-fg"
              onClick={() => setPrefsOpen(false)}
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MenuItem({ label, kbd, onClick }: { label: string; kbd?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-fg hover:bg-accent hover:text-accent-fg"
    >
      <span>{label}</span>
      {kbd ? <kbd className="text-xs opacity-70">{kbd}</kbd> : null}
    </button>
  );
}
