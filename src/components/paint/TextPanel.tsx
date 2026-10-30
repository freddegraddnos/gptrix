import { useEffect, useMemo, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Library, Plus, Stamp, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { allTextFonts, measureTextSpec, type TextAlign, type TextSpec } from "@/lib/paint/text";
import {
  addCustomFontFile,
  listCustomFonts,
  removeCustomFont,
  subscribeCustomFonts,
} from "@/lib/paint/customFonts";
import { rgbToHex } from "@/lib/paint/color";
import { FontCatalogDialog } from "./FontCatalogDialog";

const ALIGNS: { id: TextAlign; label: string; icon: typeof AlignLeft }[] = [
  { id: "left", label: "Align left", icon: AlignLeft },
  { id: "center", label: "Center", icon: AlignCenter },
  { id: "right", label: "Align right", icon: AlignRight },
];

/** Above this many faces the grid becomes a dropdown, so the panel stays short. */
const GRID_LIMIT = 6;

/**
 * Editor for the active text layer. It never bakes anything: every control
 * writes back to the layer's spec, so the same text can be edited again later.
 *
 * Size is expressed in millimetres: the slider and the field both work in mm and
 * convert through the document's `mmPerPixel`, so a 12 mm letter measures 12 mm
 * on paper no matter the canvas resolution.
 */
export function TextPanel({
  spec,
  mmPerPixel,
  onChange,
  onRasterize,
}: {
  spec: TextSpec;
  mmPerPixel: number;
  onChange: (patch: Partial<TextSpec>) => void;
  onRasterize: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [, bumpFonts] = useState(0);
  const [fontError, setFontError] = useState<string | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);

  useEffect(() => subscribeCustomFonts(() => bumpFonts((n) => n + 1)), []);

  const fonts = allTextFonts();
  const customIds = new Set(listCustomFonts().map((f) => f.id));
  const activeFont = fonts.find((f) => f.id === spec.fontId) ?? fonts[0]!;

  const heightMm = spec.fontSize * mmPerPixel;
  // Block size in mm, so the artist sees what the text really measures on paper.
  const blockMm = useMemo(() => {
    const { width, height } = measureTextSpec(spec);
    return { width: width * mmPerPixel, height: height * mmPerPixel };
  }, [spec, mmPerPixel]);
  const [mmDraft, setMmDraft] = useState(heightMm.toFixed(1));
  useEffect(() => setMmDraft(heightMm.toFixed(1)), [heightMm]);

  /** mm is the source of truth; pixels follow the document scale. */
  const setSizeMm = (mm: number) => {
    if (!Number.isFinite(mm) || mm <= 0) return;
    onChange({ fontSize: Math.max(1, mm / mmPerPixel) });
  };

  async function handleFontFiles(files: FileList | null) {
    if (!files?.length) return;
    setFontError(null);
    for (const file of Array.from(files)) {
      try {
        const font = await addCustomFontFile(file);
        onChange({ fontId: font.id });
      } catch (err) {
        setFontError(err instanceof Error ? err.message : "Could not add the font.");
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const removeFont = (id: string) => {
    removeCustomFont(id);
    if (spec.fontId === id) onChange({ fontId: fonts[0]!.id });
  };

  return (
    <div className="pointer-events-auto w-72 rounded-2xl border border-panel-border bg-panel/92 p-3 shadow-panel backdrop-blur-xl animate-fade-in">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] tracking-wide text-muted-foreground uppercase">Text</span>
        <button
          type="button"
          onClick={onRasterize}
          aria-label="Rasterize text"
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Stamp size={13} /> Rasterize
        </button>
      </div>

      <textarea
        value={spec.content}
        onChange={(e) => onChange({ content: e.target.value })}
        rows={2}
        spellCheck={false}
        aria-label="Text content"
        className="w-full resize-none rounded-xl border border-panel-border bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      {/* Few faces: pick straight from a grid. Many: a dropdown keeps the size
          controls one glance away instead of a scroll away. */}
      {fonts.length <= GRID_LIMIT ? (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {fonts.map((font) => (
            <div key={font.id} className="relative">
              <button
                type="button"
                onClick={() => onChange({ fontId: font.id })}
                aria-pressed={spec.fontId === font.id}
                title={font.label}
                className={`w-full truncate rounded-xl border px-2 py-2 text-sm transition-colors ${
                  spec.fontId === font.id
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-panel-border text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                }`}
                style={{ fontFamily: font.stack }}
              >
                {font.label}
              </button>
              {customIds.has(font.id) && (
                <button
                  type="button"
                  aria-label={`Remove ${font.label}`}
                  onClick={() => removeFont(font.id)}
                  className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full border border-panel-border bg-panel text-foreground/60 transition-colors hover:text-destructive"
                >
                  <X size={9} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex items-center gap-1.5">
          <Select value={activeFont.id} onValueChange={(id) => onChange({ fontId: id })}>
            <SelectTrigger aria-label="Font" className="flex-1">
              <SelectValue>
                <span style={{ fontFamily: activeFont.stack }}>{activeFont.label}</span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {fonts.map((font) => (
                <SelectItem key={font.id} value={font.id} style={{ fontFamily: font.stack }}>
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {customIds.has(activeFont.id) && (
            <button
              type="button"
              aria-label={`Remove ${activeFont.label}`}
              onClick={() => removeFont(activeFont.id)}
              className="flex size-8 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-accent hover:text-destructive"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCatalogOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-panel-border px-2 py-2 text-[11px] text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Library size={12} /> Font catalog
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-panel-border px-2.5 py-2 text-[11px] text-foreground/60 transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Plus size={12} /> Custom file
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
        multiple
        hidden
        onChange={(e) => void handleFontFiles(e.target.files)}
      />
      {fontError && <p className="mt-1 text-[11px] text-destructive">{fontError}</p>}

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Letter height</span>
        <span className="flex items-center gap-1.5">
          <Input
            value={mmDraft}
            inputMode="decimal"
            aria-label="Text height in millimeters"
            onChange={(e) => setMmDraft(e.target.value)}
            onBlur={() => setSizeMm(parseFloat(mmDraft.replace(",", ".")))}
            onKeyDown={(e) => {
              if (e.key === "Enter") setSizeMm(parseFloat(mmDraft.replace(",", ".")));
            }}
            className="h-7 w-16 px-2 text-right font-mono text-[11px]"
          />
          mm · {Math.round(spec.fontSize)} px
        </span>
      </div>
      <Slider
        value={[Math.min(300, heightMm)]}
        min={1}
        max={300}
        step={0.5}
        aria-label="Text height in millimeters"
        onValueChange={([v]) => setSizeMm(v ?? heightMm)}
        className="mt-1.5"
      />

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Curve (arc)</span>
        <span className="font-mono">
          {Math.round((spec.curve ?? 0) * 100)}%
          {(spec.curve ?? 0) !== 0 && (
            <button
              type="button"
              onClick={() => onChange({ curve: 0 })}
              className="ml-2 rounded px-1 text-foreground/60 transition-colors hover:text-foreground"
            >
              Reset
            </button>
          )}
        </span>
      </div>
      <Slider
        value={[spec.curve ?? 0]}
        min={-1}
        max={1}
        step={0.01}
        aria-label="Curve text in an arc"
        onValueChange={([v]) => onChange({ curve: v ?? 0 })}
        className="mt-1.5"
      />

      <div className="mt-3 flex items-center gap-1.5">
        {ALIGNS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={spec.align === id}
            onClick={() => onChange({ align: id })}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
              spec.align === id
                ? "bg-primary/15 text-primary"
                : "text-foreground/60 hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <Icon size={15} />
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          <span
            className="size-5 rounded-full border border-panel-border"
            style={{ background: rgbToHex(spec.color) }}
          />
          {rgbToHex(spec.color)}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-panel-border bg-background/40 px-2.5 py-2 text-[11px] text-muted-foreground">
        <span>Text block size</span>
        <span className="font-mono text-foreground/80">
          {blockMm.width.toFixed(1).replace(".", ",")} ×{" "}
          {blockMm.height.toFixed(1).replace(".", ",")} mm
        </span>
      </div>

      <p className="mt-2.5 text-[11px] leading-snug text-muted-foreground">
        Move, scale, and rotate with the transform tool — the text stays editable.
      </p>

      <FontCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onInstalled={(fontId) => onChange({ fontId })}
      />
    </div>
  );
}
