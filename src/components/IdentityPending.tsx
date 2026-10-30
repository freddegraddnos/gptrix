import { Loader2 } from "lucide-react";
import { tx, useUiLang } from "@/lib/uiLang";

/** Neutral placeholder while we find out who is signed in — no form is shown yet. */
export function IdentityPending() {
  useUiLang();
  return (
    <div role="status" aria-live="polite" className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      {tx("Checking your account…")}
    </div>
  );
}
