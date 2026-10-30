import { useState } from "react";
import { Eye } from "lucide-react";
import { SCAN_STAGES, type ScanStage } from "@/lib/scanStatus";
import { buildScanStageMessage } from "@/lib/scanNotifications";

/**
 * Preview of the exact client and studio notification wording for each 3D
 * stage, so both sides can read the messages before they are ever sent.
 */
export function ScanNotificationPreview({
  startsAt,
  currentStage,
}: {
  startsAt?: string | null;
  currentStage?: ScanStage;
}) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<ScanStage>(currentStage ?? "requested");
  const when = startsAt ? new Date(startsAt).toLocaleString() : "your booking";

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-slate/30 p-2.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-[11px] font-semibold text-accent"
      >
        <Eye className="size-3.5" />
        Preview status notifications
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {SCAN_STAGES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStage(s.id)}
                aria-pressed={stage === s.id}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                  stage === s.id
                    ? "bg-accent text-ink"
                    : "border border-white/10 text-muted-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          {(["client", "studio"] as const).map((audience) => {
            const msg = buildScanStageMessage(stage, audience, when);
            return (
              <div key={audience} className="rounded-lg border border-white/5 bg-ink/50 p-2.5">
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {audience === "client" ? "To the client" : "To the studio"}
                </p>
                <p className="mt-1 text-xs font-semibold">{msg.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{msg.body}</p>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground">
            Sent on each recipient's own channels (in-app, push, e-mail) when the stage changes.
          </p>
        </div>
      )}
    </div>
  );
}
