import { useState, type ReactNode } from "react";
import type { User } from "@/data/types";
import { Avatar } from "@/components/desktop/avatar";
import { useZoreon } from "@/store/use-zoreon";

export function ProfilePopover({
  user,
  children,
}: {
  user: User;
  children: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const createDirect = useZoreon((s) => s.createDirect);
  const backend = useZoreon((s) => s.backend);
  const currentUserId = useZoreon((s) => s.currentUserId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <span className="relative inline-flex">
      {children(() => setOpen(true))}
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Dismiss"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-full left-0 z-50 mt-1 w-56 rounded-md border border-border-strong bg-panel p-3 shadow-menu">
            <div className="flex items-center gap-2">
              <Avatar user={user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-fg-subtle">@{user.handle}</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-fg-muted">{user.role}</p>
            <p className="mt-0.5 text-xs capitalize text-fg-subtle">{user.presence}</p>
            {err ? <p className="mt-2 text-xs text-danger">{err}</p> : null}
            {user.id !== currentUserId && backend === "mattermost" ? (
              <button
                type="button"
                disabled={busy}
                className="mt-3 h-8 w-full rounded-sm bg-accent text-xs font-medium text-accent-fg disabled:opacity-40"
                onClick={() => {
                  setBusy(true);
                  setErr(null);
                  void createDirect(user.id)
                    .then(() => setOpen(false))
                    .catch((e) => setErr(e instanceof Error ? e.message : "Could not open DM"))
                    .finally(() => setBusy(false));
                }}
              >
                {busy ? "Opening…" : "Message"}
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </span>
  );
}
