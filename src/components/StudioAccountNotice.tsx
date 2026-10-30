import { Link } from "@tanstack/react-router";
import { Store } from "lucide-react";
import { tx, useUiLang } from "@/lib/uiLang";

/**
 * Shown instead of customer actions (requests, bookings, slot requests) when a
 * studio account is signed in. The server rejects these actions regardless.
 */
export function StudioAccountNotice({ studioName, onClose }: { studioName: string | null; onClose?: () => void }) {
  useUiLang();
  return (
    <div role="note" className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-sm">
      <div className="flex items-start gap-3">
        <Store className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
        <div className="min-w-0">
          <p className="font-medium">
            {tx("You are signed in as the studio")} <span>{studioName ?? ""}</span>
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {tx("Studio accounts cannot send customer requests or book with studios. To try the customer flow, sign out and use a customer account.")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/artists/dashboard" onClick={onClose} className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-xs font-bold text-ink">
              {tx("Back to the studio panel")}
            </Link>
            {onClose && (
              <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-xs">
                {tx("Close")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
