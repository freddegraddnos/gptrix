import { useEffect, useState } from "react";
import { DPI_OPTIONS, SIZE_PRESETS, pixelsForMm } from "@/lib/paint/document";

export interface SizeDraft {
  widthMm: number;
  heightMm: number;
  dpi: number;
}

/**
 * Size-first document controls: width and height are typed freely in
 * millimetres, presets are only shortcuts, and the resulting pixel canvas is
 * shown so nothing about the scale is hidden.
 */
export function SizeFields({
  value,
  onChange,
}: {
  value: SizeDraft;
  onChange: (next: SizeDraft) => void;
}) {
  const [w, setW] = useState(String(Math.round(value.widthMm)));
  const [h, setH] = useState(String(Math.round(value.heightMm)));

  useEffect(() => {
    setW(String(Math.round(value.widthMm)));
    setH(String(Math.round(value.heightMm)));
  }, [value.widthMm, value.heightMm]);

  const parse = (raw: string, fallback: number) => {
    const n = Number(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? Math.min(2000, n) : fallback;
  };

  const commit = () => {
    onChange({
      ...value,
      widthMm: parse(w, value.widthMm),
      heightMm: parse(h, value.heightMm),
    });
  };

  const pxW = pixelsForMm(value.widthMm, value.dpi);
  const pxH = pixelsForMm(value.heightMm, value.dpi);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2">
        <label className="min-w-0 text-[11px] text-muted-foreground">
          Width (mm)
          <input
            type="text"
            inputMode="decimal"
            value={w}
            aria-label="Width in millimeters"
            onChange={(e) => setW(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            className="mt-1 h-10 w-full rounded-xl border border-panel-border bg-background/50 px-3 font-mono text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
        <span className="pb-3 text-muted-foreground">×</span>
        <label className="min-w-0 text-[11px] text-muted-foreground">
          Height (mm)
          <input
            type="text"
            inputMode="decimal"
            value={h}
            aria-label="Height in millimeters"
            onChange={(e) => setH(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
            }}
            className="mt-1 h-10 w-full rounded-xl border border-panel-border bg-background/50 px-3 font-mono text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SIZE_PRESETS.map((preset) => {
          const active =
            Math.round(value.widthMm) === preset.widthMm &&
            Math.round(value.heightMm) === preset.heightMm;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange({ ...value, widthMm: preset.widthMm, heightMm: preset.heightMm })
              }
              className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
                active
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-panel-border text-foreground/70 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {preset.label}
            </button>
          );
        })}
        <button
          type="button"
          aria-label="Swap portrait and landscape"
          onClick={() =>
            onChange({ ...value, widthMm: value.heightMm, heightMm: value.widthMm })
          }
          className="shrink-0 rounded-lg border border-panel-border px-2.5 py-1 text-[11px] text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Flip
        </button>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">Resolution</span>
        {DPI_OPTIONS.map((dpi) => (
          <button
            key={dpi}
            type="button"
            aria-pressed={value.dpi === dpi}
            onClick={() => onChange({ ...value, dpi })}
            className={`rounded-lg border px-2.5 py-1 text-[11px] transition-colors ${
              value.dpi === dpi
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-panel-border text-foreground/70 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {dpi} dpi
          </button>
        ))}
      </div>

      <p className="font-mono text-[11px] text-muted-foreground">
        {pxW} × {pxH} px · {value.dpi} dpi
      </p>

    </div>
  );
}
