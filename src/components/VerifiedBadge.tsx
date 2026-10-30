import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Trust badge shown next to a studio name when the studio has verified both
 * its contact email and its business document.
 */
export function VerifiedBadge({
  verified,
  size = "sm",
  withLabel = true,
  className,
}: {
  verified?: boolean | null;
  size?: "sm" | "md";
  withLabel?: boolean;
  className?: string;
}) {
  if (!verified) return null;
  return (
    <span
      title="Verified studio — contact email confirmed and business documentation registered; not a hygiene inspection"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 text-accent font-bold uppercase tracking-widest",
        size === "sm" ? "px-2 py-0.5 text-[9px]" : "px-2.5 py-1 text-[10px]",
        className,
      )}
    >
      <BadgeCheck className={size === "sm" ? "size-3" : "size-3.5"} />
      {withLabel && "Verified"}
    </span>
  );
}
