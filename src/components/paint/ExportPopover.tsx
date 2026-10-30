/**
 * Export panel.
 *
 * Three formats — PNG, JPEG and PDF — and every one of them leaves at exact
 * physical scale: the raster files carry the document's real dpi, the PDF
 * places the artwork in a millimetre box on A4 or A3 (A4 by default).
 */
import { FileImage, ImageDown, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/paint/exportScale";
import { formatMm } from "@/lib/paint/document";
import type { PaperId } from "@/lib/paint/print";

const PAPERS: { id: PaperId; label: string }[] = [
  { id: "a4", label: "A4" },
  { id: "a3", label: "A3" },
];

export type ExportScope = "full" | "artwork" | "lines";

export interface ExportPanelProps {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  hasBackground: boolean;
  lineLayerCount: number;
  format: ExportFormat;
  paper: PaperId;
  onFormatChange: (format: ExportFormat) => void;
  onPaperChange: (paper: PaperId) => void;
  onExport: (scope: ExportScope) => void;
}

function Choice({
  active,
  label,
  onClick,
  ariaLabel,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={ariaLabel ?? label}
      onClick={onClick}
      className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-primary/60 bg-primary/15 text-primary"
          : "border-panel-border text-foreground/70 hover:bg-accent hover:text-accent-foreground"
      }`}
    >
      {label}
    </button>
  );
}

export function ExportPanelBody({
  widthPx,
  heightPx,
  widthMm,
  heightMm,
  hasBackground,
  lineLayerCount,
  format,
  paper,
  onFormatChange,
  onPaperChange,
  onExport,
}: ExportPanelProps) {
  return (
    <div className="space-y-3">
      <div>
        <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
          File format
        </Label>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {EXPORT_FORMATS.map((f) => (
            <Choice
              key={f.id}
              active={format === f.id}
              label={f.label}
              onClick={() => onFormatChange(f.id)}
            />
          ))}
        </div>
      </div>

      {format === "pdf" && (
        <div>
          <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">
            Paper
          </Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {PAPERS.map((p) => (
              <Choice
                key={p.id}
                active={paper === p.id}
                label={p.label}
                onClick={() => onPaperChange(p.id)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Button variant="secondary" className="w-full justify-start" onClick={() => onExport("full")}>
          <ImageDown size={16} /> Full image
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={() => onExport("artwork")}
        >
          <FileImage size={16} /> Artwork only
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-start"
          disabled={lineLayerCount === 0}
          onClick={() => onExport("lines")}
        >
          <PenLine size={16} /> Line stencil
        </Button>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        Exports at exact scale: {formatMm(widthMm)} × {formatMm(heightMm)} ({widthPx} × {heightPx}{" "}
        px). Print at 100 % — never "fit to page".
      </p>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Artwork only leaves out the background layer
        {hasBackground ? " (the reference photo)" : ""}; PNG keeps it transparent.
        {lineLayerCount === 0 ? " Mark a layer as a line layer to use the line stencil." : ""}
      </p>
    </div>
  );
}
