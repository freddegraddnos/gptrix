import { Check, RefreshCw, ScanLine, X } from "lucide-react";
import type { SurfaceProfile } from "@/lib/surfaceProfile";

/**
 * Surface Scan UI: a sweep instruction, a coverage ring that only fills when a
 * genuinely new angle is seen, live coaching, and the measured summary.
 * Purely presentational — all measuring lives in the AR camera.
 */
export function SurfaceScanSheet({
  open,
  scanning,
  coverage,
  samples,
  hint,
  quality = 0,
  angles = 0,
  targetAngles = 8,
  usable = false,
  result,
  onStart,
  onFinish,
  onCancel,
  onApply,
  onClose,
}: {
  open: boolean;
  scanning: boolean;
  coverage: number;
  samples: number;
  hint: string | null;
  /** Live 0..1 fit quality while sweeping. */
  quality?: number;
  /** Distinct viewing angles banked so far. */
  angles?: number;
  /** Angles a full sweep aims for. */
  targetAngles?: number;
  /** True once stopping early still yields a usable profile. */
  usable?: boolean;
  result: SurfaceProfile | null;
  onStart: () => void;
  /** Stop now and keep what has been measured. */
  onFinish: () => void;
  onCancel: () => void;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const pct = Math.round(coverage * 100);
  const ring = 2 * Math.PI * 34;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        type="button"
        aria-label="Close surface scan"
        className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
        onClick={() => {
          if (scanning) onCancel();
          onClose();
        }}
      />
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-ink/95 backdrop-blur-xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl">


        <div className="flex items-center gap-2 mb-1">
          <ScanLine className="size-4 text-accent" />
          <h2 className="text-sm font-bold tracking-tight">Scan surface</h2>
          <span className="text-[10px] uppercase tracking-widest text-accent/80">
            beta
          </span>
          <button
            type="button"
            onClick={() => {
              if (scanning) onCancel();
              onClose();
            }}
            className="ml-auto size-8 rounded-full grid place-items-center hover:bg-white/10"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Keep the design on your skin and swing the phone slowly around the
          limb. The more angles it sees, the more realistically the tattoo sits.
        </p>

        <div className="mt-5 flex items-center gap-5">
          <div className="relative size-[84px] shrink-0">
            <svg viewBox="0 0 80 80" className="size-full -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="6"
                className="stroke-white/10"
              />
              <circle
                cx="40"
                cy="40"
                r="34"
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className="stroke-accent transition-[stroke-dashoffset] duration-300"
                strokeDasharray={ring}
                strokeDashoffset={ring * (1 - coverage)}
              />
            </svg>
            <div className="absolute inset-0 grid place-items-center">
              {result ? (
                <Check className="size-6 text-accent" />
              ) : (
                <span className="text-sm font-bold tabular-nums">{pct}%</span>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1">
            {result ? (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                <dt className="text-muted-foreground">Width</dt>
                <dd className="font-bold tabular-nums text-right">
                  {result.widthCm ? `${result.widthCm} cm` : "—"}
                </dd>
                <dt className="text-muted-foreground">Curvature</dt>
                <dd className="font-bold tabular-nums text-right">
                  {Math.round(result.curve * 100)}%
                </dd>
                <dt className="text-muted-foreground">Direction</dt>
                <dd className="font-bold tabular-nums text-right">
                  {result.axisDeg.toFixed(0)}°
                </dd>
                <dt className="text-muted-foreground">Lean</dt>
                <dd className="font-bold tabular-nums text-right">
                  {Math.round(result.tilt * 100)}%
                </dd>
                {result.taper != null && (
                  <>
                    <dt className="text-muted-foreground">Taper</dt>
                    <dd className="font-bold tabular-nums text-right">
                      {Math.round(Math.abs(1 - result.taper) * 100)}%
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">Fit quality</dt>
                <dd className="font-bold tabular-nums text-right">
                  {Math.round((result.quality ?? result.coverage) * 100)}%
                </dd>
                <dt className="text-muted-foreground">Readings</dt>
                <dd className="font-bold tabular-nums text-right">
                  {result.samples}
                </dd>
              </dl>

            ) : (
              <p
                className={`text-[12px] font-medium ${
                  hint ? "text-amber-300" : "text-muted-foreground"
                }`}
                aria-live="polite"
              >
                {scanning
                  ? (hint ??
                    (usable
                      ? `Looking good — ${angles} of ${targetAngles} angles captured. Stop whenever you like.`
                      : "Sweep slowly around the limb…"))
                  : "Ready when you are. You can stop at any point — whatever it measured is still used."}
              </p>
            )}
            {!result && scanning && (
              <div className="mt-2 space-y-2">
                {/* Each pip is one distinct angle the sweep has banked. */}
                <div className="flex gap-1" aria-hidden>
                  {Array.from({ length: targetAngles }).map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i < angles ? "bg-accent" : "bg-white/10"
                      }`}
                    />
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
                    <span>Fit quality</span>
                    <span className="tabular-nums font-bold text-accent">
                      {Math.round(quality * 100)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-300"
                      style={{ width: `${Math.round(quality * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          {result ? (
            <>
              <button
                type="button"
                onClick={onStart}
                className="flex-1 h-12 rounded-full border border-white/15 text-[12px] font-bold flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <RefreshCw className="size-4" />
                Scan again
              </button>
              <button
                type="button"
                onClick={onApply}
                className="flex-1 h-12 rounded-full bg-accent text-accent-foreground text-[12px] font-bold flex items-center justify-center gap-2 active:scale-95 transition"
              >
                <Check className="size-4" />
                Use profile
              </button>
            </>
          ) : scanning ? (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="h-12 px-5 rounded-full border border-white/15 text-[12px] font-bold flex items-center justify-center active:scale-95 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onFinish}
                disabled={!usable}
                className="flex-1 h-12 rounded-full bg-accent text-accent-foreground text-[12px] font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-40"
              >
                <Check className="size-4" />
                {usable ? `Done — use this scan (${pct}%)` : "Keep sweeping…"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onStart}
              className="flex-1 h-12 rounded-full bg-accent text-accent-foreground text-[12px] font-bold flex items-center justify-center gap-2 active:scale-95 transition"
            >
              <ScanLine className="size-4" />
              Start scan
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
