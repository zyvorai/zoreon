import { cn } from "@/lib/utils";
import type { Presence, User } from "@/data/types";

const tones: Record<User["tone"], string> = {
  slate: "bg-elevated text-fg",
  steel: "bg-panel text-fg",
  navy: "bg-desktop-mist text-fg",
  fog: "bg-titlebar text-fg-muted",
  accent: "bg-accent text-accent-fg",
};

const presenceDot: Record<Presence, string> = {
  active: "bg-online",
  away: "bg-away",
  dnd: "bg-dnd",
};

export function Avatar({
  user,
  size = "md",
  presence = true,
}: {
  user: User;
  size?: "sm" | "md" | "lg";
  presence?: boolean;
}) {
  const dim = size === "sm" ? "size-6 text-xs" : size === "lg" ? "size-10 text-sm" : "size-8 text-xs";
  return (
    <span className={cn("relative inline-flex shrink-0", dim)}>
      <span
        className={cn(
          "flex size-full items-center justify-center rounded-full font-medium tracking-tight",
          tones[user.tone],
        )}
      >
        {user.initials}
      </span>
      {presence ? (
        <span
          className={cn(
            "absolute -right-px -bottom-px size-2.5 rounded-full ring-2 ring-sidebar",
            presenceDot[user.presence],
          )}
          aria-label={user.presence}
        />
      ) : null}
    </span>
  );
}
