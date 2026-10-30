import { useRef, useState } from "react";
import { Ruler, Trash2, Upload } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { dpiOf, formatMm } from "@/lib/paint/document";
import { SizeFields, type SizeDraft } from "./SizeFields";

/**
 * Canvas size and physical scale.
 *
 * The document's real size in millimetres is the primary input — the pixel
 * canvas follows from it. Importing a scanned reference photo is the secondary
 * path: then the photo decides the pixels and the artist states its real width.
 */
export function CanvasPanelBody({
  hasBackground,
  widthPx,
  heightPx,
  mmPerPixel,
  hasArtwork,
  backgroundOpacity,
  onApplySize,
  onImport,
  onWidthMmChange,
  onBackgroundOpacityChange,
  onRemoveBackground,
  onActualSize,
}: {
  hasBackground: boolean;
  widthPx: number;
  heightPx: number;
  mmPerPixel: number;
  hasArtwork: boolean;
  backgroundOpacity: number;
  onApplySize: (draft: SizeDraft) => void;
  onImport: (file: File) => void;
  onWidthMmChange: (widthMm: number) => void;
  onBackgroundOpacityChange: (opacity: number) => void;
  onRemoveBackground: () => void;
  onActualSize: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const widthMm = widthPx * mmPerPixel;
  const heightMm = heightPx * mmPerPixel;
  const currentDpi = Math.round(dpiOf(mmPerPixel));

  const [draft, setDraft] = useState<SizeDraft>({
    widthMm: Math.round(widthMm),
    heightMm: Math.round(heightMm),
    dpi: currentDpi === 150 || currentDpi === 300 ? currentDpi : 300,
  });

  const changed =
    Math.round(draft.widthMm) !== Math.round(widthMm) ||
    Math.round(draft.heightMm) !== Math.round(heightMm) ||
    draft.dpi !== currentDpi;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] tracking-wide text-muted-foreground uppercase">
          <Ruler size={13} /> Canvas size
        </p>
        <SizeFields value={draft} onChange={setDraft} />
        <button
          type="button"
          disabled={!changed}
          onClick={() => onApplySize(draft)}
          className="mt-3 h-10 w-full rounded-xl bg-primary/90 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary disabled:opacity-35"
        >
          {changed ? "Apply size" : "Size is active"}
        </button>
        {changed && hasArtwork && (
          <p className="mt-1.5 text-[11px] leading-snug text-destructive">
            A new size resets the undo history. The sketch is kept.
          </p>
        )}
        <p className="mt-2 font-mono text-[11px] text-muted-foreground">
          Now: {widthPx} × {heightPx} px · {formatMm(widthMm)} × {formatMm(heightMm)} ·{" "}
          {currentDpi} dpi
        </p>
        <button
          type="button"
          onClick={onActualSize}
          className="mt-2 flex h-9 w-full items-center justify-center rounded-xl border border-panel-border bg-background/40 text-xs text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Show at actual size (1:1)
        </button>
      </div>

      <div className="border-t border-panel-border pt-3">
        <p className="mb-2 text-[11px] tracking-wide text-muted-foreground uppercase">
          Reference image (optional)
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="Import background image"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImport(file);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-xl border border-panel-border bg-background/40 text-xs text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Upload size={15} />
          {hasBackground ? "Replace reference image" : "Import reference image"}
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          A scanned body part sets the canvas resolution and is locked at the bottom — you
          draw on top of it, never into it. Enter its real width below.
        </p>

        {hasBackground && (
          <div className="mt-3">
            <label className="flex items-center gap-2 text-xs text-foreground/80">
              Image width
              <input
                type="number"
                min={1}
                step={1}
                inputMode="decimal"
                defaultValue={Math.round(widthMm)}
                aria-label="Reference image width in millimeters"
                onBlur={(e) => {
                  const v = Number(e.target.value.replace(",", "."));
                  if (Number.isFinite(v) && v > 0) onWidthMmChange(v);
                }}
                className="h-9 w-24 rounded-lg border border-panel-border bg-background/40 px-2 font-mono text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              />
              mm
            </label>

            <div className="mt-3 mb-1.5 flex items-center justify-between text-xs">
              <span className="text-foreground/80">Visibility</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {Math.round(backgroundOpacity * 100)}%
              </span>
            </div>
            <Slider
              min={0}
              max={100}
              step={1}
              aria-label="Background visibility"
              value={[Math.round(backgroundOpacity * 100)]}
              onValueChange={([v]) => onBackgroundOpacityChange((v ?? 100) / 100)}
            />
            <button
              type="button"
              onClick={onRemoveBackground}
              className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-xl text-xs text-foreground/65 transition-colors hover:bg-destructive/15 hover:text-destructive"
            >
              <Trash2 size={14} /> Remove background
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
