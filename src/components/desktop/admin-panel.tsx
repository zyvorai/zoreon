import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  adminDeactivate,
  adminDemote,
  adminList,
  adminPromote,
  adminReactivate,
  adminSetRetention,
} from "@/lib/zoreon/api";

type AdminPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function AdminPanel({ open, onClose }: AdminPanelProps) {
  const [admins, setAdmins] = useState<string[]>([]);
  const [deactivated, setDeactivated] = useState<string[]>([]);
  const [audit, setAudit] = useState<
    { id: string; at: number; actorEmail: string | null; action: string; meta: string }[]
  >([]);
  const [retentionDays, setRetentionDays] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setBusy(true);
    setErr(null);
    try {
      const data = await adminList();
      setAdmins(data.admins);
      setDeactivated(data.deactivated);
      setAudit(data.audit);
      setRetentionDays(data.retentionDays);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-desktop/55 px-4 backdrop-blur-sm">
      <button type="button" className="absolute inset-0" aria-label="Dismiss" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border-strong bg-panel p-4 shadow-window">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">Workspace admin</p>
          <button type="button" className="rounded-sm p-1 hover:bg-fg/10" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>
        {err ? <p className="mb-2 text-xs text-danger">{err}</p> : null}

        <div className="zoreon-scroll min-h-0 flex-1 space-y-4 text-sm">
          <section>
            <p className="mb-1 text-xs font-medium uppercase text-fg-subtle">Admins</p>
            <ul className="mb-2 space-y-1">
              {admins.map((a) => (
                <li key={a} className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-xs">{a}</span>
                  <button
                    type="button"
                    className="text-xs text-fg-subtle hover:text-danger"
                    disabled={busy}
                    onClick={() =>
                      void adminDemote({ data: { email: a } })
                        .then(setAdmins)
                        .catch((e) => setErr(e instanceof Error ? e.message : "Failed"))
                    }
                  >
                    Demote
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@zyvor.dev"
                className="h-8 min-w-0 flex-1 rounded-sm border border-border bg-composer px-2 text-xs"
              />
              <button
                type="button"
                className="h-8 rounded-sm bg-accent px-2 text-xs text-accent-fg"
                disabled={busy || !email.includes("@")}
                onClick={() =>
                  void adminPromote({ data: { email } })
                    .then((list) => {
                      setAdmins(list);
                      setEmail("");
                    })
                    .catch((e) => setErr(e instanceof Error ? e.message : "Failed"))
                }
              >
                Promote
              </button>
              <button
                type="button"
                className="h-8 rounded-sm border border-border px-2 text-xs"
                disabled={busy || !email.includes("@")}
                onClick={() =>
                  void adminDeactivate({ data: { email } })
                    .then(setDeactivated)
                    .catch((e) => setErr(e instanceof Error ? e.message : "Failed"))
                }
              >
                Deactivate
              </button>
            </div>
          </section>

          <section>
            <p className="mb-1 text-xs font-medium uppercase text-fg-subtle">Deactivated</p>
            {deactivated.length === 0 ? (
              <p className="text-xs text-fg-subtle">None</p>
            ) : (
              <ul className="space-y-1">
                {deactivated.map((e) => (
                  <li key={e} className="flex justify-between gap-2">
                    <span className="font-mono text-xs">{e}</span>
                    <button
                      type="button"
                      className="text-xs text-accent"
                      onClick={() =>
                        void adminReactivate({ data: { email: e } }).then(setDeactivated)
                      }
                    >
                      Reactivate
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <p className="mb-1 text-xs font-medium uppercase text-fg-subtle">
              Retention (local extras / SQL messages)
            </p>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                placeholder="days"
                value={retentionDays ?? ""}
                onChange={(e) =>
                  setRetentionDays(e.target.value === "" ? null : Number(e.target.value))
                }
                className="h-8 w-24 rounded-sm border border-border bg-composer px-2 text-xs"
              />
              <button
                type="button"
                className="h-8 rounded-sm border border-border px-2 text-xs"
                onClick={() =>
                  void adminSetRetention({ data: { days: retentionDays } }).then((r) =>
                    setRetentionDays(r.retentionDays),
                  )
                }
              >
                Save & purge
              </button>
            </div>
            <p className="mt-1 text-xs text-fg-subtle">
              Mattermost tape retention is managed in Mattermost admin — Zoreon does not purge MM posts.
            </p>
          </section>

          <section>
            <p className="mb-1 text-xs font-medium uppercase text-fg-subtle">Audit</p>
            <ul className="max-h-40 space-y-1 overflow-auto">
              {audit.map((a) => (
                <li key={a.id} className="text-xs text-fg-muted">
                  {new Date(a.at).toLocaleString()} · {a.action} · {a.actorEmail ?? "—"}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
