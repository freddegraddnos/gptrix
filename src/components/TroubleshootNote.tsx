import { useState } from "react";
import { AlertTriangle, Settings } from "lucide-react";
import {
  openAppSettings,
  troubleshootFor,
  type TroubleKind,
} from "@/lib/troubleshoot";

/**
 * A short, human error note with numbered recovery steps and a one-tap
 * shortcut to the device/browser settings when the platform allows it.
 */
export function TroubleshootNote({
  kind,
  message,
  className = "",
}: {
  kind: TroubleKind;
  message?: string;
  className?: string;
}) {
  const guide = troubleshootFor(kind);
  const [manual, setManual] = useState(false);

  return (
    <div
      role="alert"
      className={`rounded-xl border border-destructive/40 bg-destructive/10 p-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="size-4 mt-0.5 text-destructive shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-bold">{message ?? guide.title}</p>
          <ol className="mt-1.5 space-y-1 text-[11px] leading-snug text-muted-foreground list-decimal pl-4">
            {guide.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
        </div>
      </div>
      <button
        onClick={() => {
          if (!openAppSettings()) setManual(true);
        }}
        className="mt-2 w-full min-h-[44px] rounded-xl border border-white/15 bg-slate text-xs font-bold flex items-center justify-center gap-2"
      >
        <Settings className="size-4" /> Open settings
      </button>
      {manual && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          This browser won't let a website open settings — follow the steps
          above instead.
        </p>
      )}
    </div>
  );
}
