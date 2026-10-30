import { useRef, useState } from "react";
import { ChevronDown, PenLine, Upload } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEFAULT_DPI } from "@/lib/paint/document";
import { BODY_TEMPLATES, type BodyTemplate } from "@/lib/paint/bodyTemplates";
import { tx, useUiLang } from "@/lib/uiLang";
import { SizeFields, type SizeDraft } from "./SizeFields";

const PAPER_SIZES = [
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "a3", label: "A3", widthMm: 297, heightMm: 420 },
] as const;

/**
 * First screen: three clear entries — start sketching on a paper size
 * (A4/A3), import an image, or start from a body-part template. Exact
 * millimetre size and resolution live under Advanced.
 */
export function NewSketchDialog({
  open,
  onOpenChange,
  onStart,
  onImport,
  onStartTemplate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (draft: SizeDraft) => void;
  onImport: (file: File) => void;
  onStartTemplate: (template: BodyTemplate) => void;
}) {
  useUiLang();
  const fileRef = useRef<HTMLInputElement>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draft, setDraft] = useState<SizeDraft>({
    widthMm: PAPER_SIZES[0].widthMm,
    heightMm: PAPER_SIZES[0].heightMm,
    dpi: DEFAULT_DPI,
  });

  const activePaper = PAPER_SIZES.find(
    (p) => p.widthMm === draft.widthMm && p.heightMm === draft.heightMm,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-sm overflow-y-auto border-panel-border bg-panel/97 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-base">{tx("New sketch")}</DialogTitle>
          <DialogDescription className="text-xs">
            Pick a paper size and start sketching — the sketch keeps its real size on any device and prints
            at 1:1 scale.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {PAPER_SIZES.map((paper) => (
            <button
              key={paper.id}
              type="button"
              aria-pressed={activePaper?.id === paper.id}
              onClick={() =>
                setDraft({ ...draft, widthMm: paper.widthMm, heightMm: paper.heightMm })
              }
              className={`flex h-11 items-center justify-center rounded-xl border text-sm font-medium transition-colors ${
                activePaper?.id === paper.id
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-panel-border text-foreground/75 hover:bg-accent hover:text-accent-foreground"
              }`}
            >
              {paper.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onStart(draft)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary/90 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary"
        >
          <PenLine size={15} /> {tx("Start sketching")}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label={tx("Import 3D scan")}
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
          className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-panel-border text-xs text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Upload size={15} /> {tx("Import 3D scan")}
        </button>

        <div className="space-y-2 border-t border-panel-border pt-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/55">START FROM</p>
          <div className="grid grid-cols-3 gap-2">
            {BODY_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => onStartTemplate(template)}
                className="group flex flex-col items-center gap-1 rounded-xl border border-panel-border p-2 transition-colors hover:border-primary/60 hover:bg-accent"
              >
                <img
                  src={template.url}
                  alt={tx(template.label)}
                  loading="lazy"
                  className="h-16 w-full object-contain opacity-90 invert transition-opacity group-hover:opacity-100"
                />
                <span className="text-[11px] font-medium text-foreground/85">{tx(template.label)}</span>
                <span className="text-[9px] leading-tight text-foreground/45">
                  {template.widthMm} × {template.heightMm} mm
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] leading-snug text-foreground/45">
            The template sets the canvas size and adds the body part as a locked background outline you draw
            on top of. You can change the size afterwards.
          </p>
        </div>

        <div className="border-t border-panel-border pt-3">
          <button
            type="button"
            aria-expanded={advancedOpen}
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex h-10 w-full items-center justify-between rounded-xl border border-panel-border px-3 text-xs text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {tx("Advanced — exact size & resolution")}
            <ChevronDown
              size={14}
              className={`transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
          </button>
          {advancedOpen && (
            <div className="pt-3">
              <SizeFields value={draft} onChange={setDraft} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
