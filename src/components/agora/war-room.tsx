import { useEffect, useState } from "react";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgora } from "@/store/use-agora";

export function WarRoomRail() {
  const channel = useAgora((s) => s.channels.find((c) => c.id === s.activeChannelId));
  const wave = useAgora((s) => s.waves.find((w) => w.id === channel?.waveId));
  const toggleCheck = useAgora((s) => s.toggleCheck);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!channel || channel.kind !== "war-room" || !wave) return null;

  const remaining = now == null ? 0 : Math.max(0, wave.windowEnd - now);
  const hh = Math.floor(remaining / 3600000);
  const mm = Math.floor((remaining % 3600000) / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  const done = wave.items.filter((i) => i.done).length;

  return (
    <aside className="hidden h-full min-h-0 w-72 shrink-0 flex-col border-l border-border bg-sidebar lg:flex">
      <header className="flex h-12 items-center border-b border-border px-3">
        <p className="text-sm font-semibold">Cutover</p>
      </header>
      <div className="agora-scroll min-h-0 flex-1 px-3 py-3">
        <p className="text-xs font-medium tracking-wide text-fg-subtle uppercase">Window remaining</p>
        <p className="mt-1 font-mono text-2xl font-medium tracking-tight tabular-nums text-fg">
          {now == null
            ? "--:--:--"
            : `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`}
        </p>
        <p className="mt-1 text-xs text-fg-subtle">{wave.name}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Stat label="Cluster" value={wave.cluster} />
          <Stat label="VMs" value={String(wave.vms)} />
          <Stat label="First-boot" value={`${wave.firstBoot}%`} />
          <Stat label="Checklist" value={`${done}/${wave.items.length}`} />
        </div>

        <p className="mt-5 mb-2 text-xs font-medium tracking-wide text-fg-subtle uppercase">Runbook</p>
        <ul className="flex flex-col gap-1">
          {wave.items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => toggleCheck(wave.id, item.id)}
                className="flex w-full items-start gap-2 rounded-sm px-1.5 py-2 text-left hover:bg-fg/5"
              >
                {item.done ? (
                  <Check className="mt-0.5 size-4 text-success" />
                ) : (
                  <Circle className="mt-0.5 size-4 text-fg-subtle" />
                )}
                <span className="min-w-0">
                  <span className={cn("block text-sm", item.done && "text-fg-muted line-through")}>{item.label}</span>
                  <span className="text-xs text-fg-subtle">{item.owner}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-panel px-2.5 py-2">
      <p className="text-xs text-fg-subtle">{label}</p>
      <p className="truncate text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}
