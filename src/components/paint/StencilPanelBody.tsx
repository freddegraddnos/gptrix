import { useEffect, useMemo, useState } from "react";
import { FileImage, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_STENCIL, STENCIL_INKS, type StencilOptions } from "@/lib/paint/stencil";
import { fitsSheet, type PaperId } from "@/lib/paint/print";
import { EXPORT_FORMATS, type ExportFormat } from "@/lib/paint/exportScale";


export interface StencilPreview {
  url: string;
  /** Size of the inked motif itself, in millimetres (null when empty). */
  inkWidthMm: number | null;
  inkHeightMm: number | null;
}

const PAPERS: { id: PaperId; label: string }[] = [
  { id: "a4", label: "A4" },
  { id: "a3", label: "A3" },
];

/**
 * Stencil generator UI. The preview is regenerated from the live document each
 * time a setting changes, and printing goes through the same true-scale sheet as
 * the ordinary print panel, so the stencil comes out in exact mm.
 */
export function StencilPanelBody({
  widthMm,
  heightMm,
  buildPreview,
  onPrint,
  onExport,
}: {
  widthMm: number;
  heightMm: number;
  buildPreview: (options: StencilOptions) => StencilPreview | null;
  onPrint: (options: StencilOptions, paper: PaperId) => void;
  onExport: (options: StencilOptions, format: ExportFormat, paper: PaperId) => void;
}) {
  const [options, setOptions] = useState<StencilOptions>(DEFAULT_STENCIL);
  const [paper, setPaper] = useState<PaperId>("a4");
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [preview, setPreview] = useState<StencilPreview | null>(null);


  const mm = (v: number) => v.toFixed(1).replace(".", ",");

  const patch = (next: Partial<StencilOptions>) => setOptions((o) => ({ ...o, ...next }));

  useEffect(() => {
    setPreview(buildPreview(options));
    // buildPreview reads the live engine, so re-run whenever settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);

  const fits = useMemo(
    () => fitsSheet(paper, widthMm > heightMm ? "landscape" : "portrait", widthMm, heightMm),
    [paper, widthMm, heightMm],
  );

  return (
    <div className="space-y-3">
      <Label className="text-[11px] tracking-wide text-muted-foreground uppercase">Stencil</Label>

      <div className="flex items-center justify-center overflow-hidden rounded-xl border border-panel-border bg-white p-2">
        {preview ? (
          <img
            src={preview.url}
            alt="Stencil preview"
            className="max-h-40 object-contain"
          />
        ) : (
          <p className="py-6 text-[11px] text-muted-foreground">Draw something first</p>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Line threshold</span>
          <span className="font-mono">{options.threshold}</span>
        </div>
        <Slider
          value={[options.threshold]}
          min={40}
          max={240}
          step={1}
          aria-label="Line threshold"
          onValueChange={([v]) => patch({ threshold: v ?? options.threshold })}
          className="mt-1.5"
        />
      </div>

      <div className="flex items-center gap-2">
        <Select value={options.ink} onValueChange={(v) => patch({ ink: v })}>
          <SelectTrigger aria-label="Stencil color" className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STENCIL_INKS.map((ink) => (
              <SelectItem key={ink.id} value={ink.value}>
                {ink.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={paper} onValueChange={(v) => setPaper(v as PaperId)}>
          <SelectTrigger aria-label="Paper" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAPERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <label className="flex items-center justify-between text-[12px] text-foreground/80">
        Mirror
        <Switch
          checked={options.mirror}
          onCheckedChange={(v) => patch({ mirror: v })}
          aria-label="Mirror stencil"
        />
      </label>
      <label className="flex items-center justify-between text-[12px] text-foreground/80">
        White background
        <Switch
          checked={options.opaqueBackground}
          onCheckedChange={(v) => patch({ opaqueBackground: v })}
          aria-label="White background"
        />
      </label>

      <Button
        variant="secondary"
        className="w-full justify-start"
        disabled={!preview}
        onClick={() => onPrint(options, paper)}
      >
        <Printer size={16} /> Print stencil ({paper.toUpperCase()}, 1:1)
      </Button>
      <div>
        <div className="text-[11px] text-muted-foreground">Export format (exact scale)</div>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {EXPORT_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={format === f.id}
              onClick={() => setFormat(f.id)}
              className={`rounded-lg border px-2 py-1.5 text-xs font-semibold transition-colors ${
                format === f.id
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-panel-border text-foreground/70 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <Button
        variant="secondary"
        className="w-full justify-start"
        disabled={!preview}
        onClick={() => onExport(options, format, paper)}
      >
        <FileImage size={16} /> Export stencil ({format.toUpperCase()})
      </Button>


      <div className="space-y-1 rounded-xl border border-panel-border bg-background/40 px-2.5 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Sheet (document)</span>
          <span className="font-mono text-foreground/80">
            {mm(widthMm)} × {mm(heightMm)} mm
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Motif (stencil lines)</span>
          <span className="font-mono text-foreground/80">
            {preview?.inkWidthMm != null && preview.inkHeightMm != null
              ? `${mm(preview.inkWidthMm)} × ${mm(preview.inkHeightMm)} mm`
              : "—"}
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        The print is exactly 1:1 — the sheet includes a 50 mm reference scale to measure against. Choose 100% scale in
        the print dialog (no fit-to-page).
        {fits ? "" : ` Note: the motif is larger than ${paper.toUpperCase()}.`}
      </p>
    </div>
  );
}
