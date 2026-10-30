import { Check, Loader2 } from "lucide-react";
import { SCAN_STAGES, stageIndex, type ScanStatus } from "@/lib/scanStatus";

/**
 * Four-step tracker for the 3D pipeline of a booking. The stage is derived
 * from the delivery log, so it always matches the files that were shared.
 */
export function ScanStatusTracker({ status }: { status: ScanStatus }) {
  const current = stageIndex(status.stage);

  return (
    <div className="mt-3 rounded-xl border border-accent/25 bg-accent/5 p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-accent">
          3D status
        </span>
        <span className="ml-auto rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent">
          {status.label}
        </span>
      </div>

      <ol className="mt-3 flex items-center gap-1.5">
        {SCAN_STAGES.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s.id} className="min-w-0 flex-1">
              <div
                className={`h-1.5 rounded-full ${
                  done ? "bg-accent" : active ? "bg-accent/70" : "bg-white/10"
                }`}
              />
              <span
                className={`mt-1.5 flex items-center gap-1 truncate text-[10px] ${
                  done || active ? "text-accent" : "text-muted-foreground"
                }`}
              >
                {done ? (
                  <Check className="size-3 shrink-0" />
                ) : active ? (
                  <Loader2 className="size-3 shrink-0 animate-spin" />
                ) : null}
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-2 text-[11px] text-muted-foreground">
        {status.hint}
        {status.at ? ` · ${new Date(status.at).toLocaleString()}` : ""}
      </p>
    </div>
  );
}
