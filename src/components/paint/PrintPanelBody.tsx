import { useState } from "react";
import { Printer } from "lucide-react";
import { formatMm } from "@/lib/paint/document";
import { fitsSheet, sheetSize, type Orientation, type PaperId } from "@/lib/paint/print";

const PAPER_LABEL: Record<PaperId, string> = { a4: "A4", a3: "A3" };
const ORIENTATION_LABEL: Record<Orientation, string> = {
  portrait: "Portrait",
  landscape: "Landscape",
};

export interface PrintPanelProps {
  widthPx: number;
  heightPx: number;
  mmPerPixel: number;
  onPrint: (paper: PaperId, orientation: Orientation) => void;
}

/**
 * True-scale printing: the artist picks the sheet, the artwork keeps its real
 * millimetre size. Nothing is ever scaled to fit the page.
 */
export function PrintPanelBody({ widthPx, heightPx, mmPerPixel, onPrint }: PrintPanelProps) {
  const widthMm = widthPx * mmPerPixel;
  const heightMm = heightPx * mmPerPixel;

  const [paper, setPaper] = useState<PaperId>("a4");
  const [orientation, setOrientation] = useState<Orientation>(
    widthMm > heightMm ? "landscape" : "portrait",
  );

  const sheet = sheetSize(paper, orientation);
  const fits = fitsSheet(paper, orientation, widthMm, heightMm);
  const a3Fits = fitsSheet("a3", orientation, widthMm, heightMm);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(PAPER_LABEL) as PaperId[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={paper === id}
            onClick={() => setPaper(id)}
            className={`rounded-xl border px-3 py-3 text-left transition-colors ${
              paper === id
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-panel-border text-foreground/75 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <span className="block text-base font-semibold">{PAPER_LABEL[id]}</span>
            <span className="block font-mono text-[10px] text-muted-foreground">
              {sheetSize(id, orientation).widthMm} × {sheetSize(id, orientation).heightMm} mm
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(ORIENTATION_LABEL) as Orientation[]).map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={orientation === id}
            onClick={() => setOrientation(id)}
            className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
              orientation === id
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-panel-border text-foreground/70 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            {ORIENTATION_LABEL[id]}
          </button>
        ))}
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        The body outline is an editing guide and is never included in print or export.
      </p>

      <p className="text-[11px] leading-snug text-muted-foreground">
        The sketch is {formatMm(widthMm)} × {formatMm(heightMm)} and will print at exactly that size
        on {ORIENTATION_LABEL[orientation].toLowerCase()} {PAPER_LABEL[paper]} ({sheet.widthMm} ×{" "}
        {sheet.heightMm} mm). Choose 100% / actual size in the print dialog.
      </p>

      {!fits && (
        <p className="text-[11px] leading-snug text-destructive">
          Larger than {PAPER_LABEL[paper]} — edges will be cropped.{" "}
          {paper === "a4" && a3Fits
            ? "Choose A3 instead."
            : "Rotate the paper or reduce the canvas dimensions in mm."}
        </p>
      )}

      <button
        type="button"
        onClick={() => onPrint(paper, orientation)}
        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary/90 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
      >
        <Printer size={16} /> Print {PAPER_LABEL[paper]}
      </button>
    </div>
  );
}
