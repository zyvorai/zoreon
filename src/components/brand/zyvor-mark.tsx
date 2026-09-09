import { cn } from "@/lib/utils";

/** zyvor.dev Bracket Z mark — orange rounded square + white Z stroke. */
export function ZyvorMark({
  className,
  size = 32,
  alt = "Zyvor",
}: {
  className?: string;
  size?: number;
  alt?: string;
}) {
  return (
    <img
      src="/brand/zyvor-mark.svg"
      alt={alt}
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[22%]", className)}
      draggable={false}
    />
  );
}
