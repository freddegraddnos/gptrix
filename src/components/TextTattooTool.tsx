import { useCallback, useEffect, useMemo, useState } from "react";
import { X, Type, Loader2, ArrowLeft, Search, Trash2 } from "lucide-react";
import {
  TATTOO_FONTS,
  customTattooFonts,
  renderTextMotif,
  type TattooFont,
} from "@/lib/tattooFonts";
import { FontCatalogDialog } from "@/components/paint/FontCatalogDialog";
import {
  loadStoredCustomFonts,
  removeCustomFont,
  subscribeCustomFonts,
} from "@/lib/paint/customFonts";

/**
 * Create a text tattoo: choose a font, type the text, and use it directly
 * as a motif in AR. The result is a transparent PNG.
 */
export function TextTattooTool({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: (dataUrl: string, label: string) => void;
}) {
  const [text, setText] = useState("Forever");
  const [fontId, setFontId] = useState(TATTOO_FONTS[0].id);
  const [letterSpacing, setLetterSpacing] = useState(0);
  const [curve, setCurve] = useState(0);
  const [italic, setItalic] = useState(false);
  const [preview, setPreview] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [custom, setCustom] = useState<TattooFont[]>([]);

  // Fonts installed from the catalogue are shared with the drawing studio.
  useEffect(() => {
    const sync = () => setCustom(customTattooFonts());
    void loadStoredCustomFonts().then(sync);
    sync();
    return subscribeCustomFonts(sync);
  }, []);

  const fonts = useMemo(() => [...custom, ...TATTOO_FONTS], [custom]);

  const font = useMemo<TattooFont>(
    () => fonts.find((f) => f.id === fontId) ?? TATTOO_FONTS[0],
    [fonts, fontId],
  );

  const dropFont = useCallback(
    (id: string) => {
      removeCustomFont(id);
      setFontId((cur) => (cur === id ? TATTOO_FONTS[0].id : cur));
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    const t = setTimeout(() => {
      void renderTextMotif({ text, font, letterSpacing, curve, italic })
        .then((url) => {
          if (!cancelled) setPreview(url);
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, font, letterSpacing, curve, italic]);

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-lg flex flex-col p-5 pt-[calc(1.25rem+env(safe-area-inset-top))] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="size-10 rounded-full glass grid place-items-center shrink-0"
            aria-label="Back to camera"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="text-mono-caps text-accent text-[10px]">
              Custom motif · Text
            </div>
            <h2 className="font-display font-bold text-lg">Write your tattoo</h2>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="size-10 rounded-full glass grid place-items-center"
          aria-label="Cancel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div>
        <label
          htmlFor="text-tattoo-input"
          className="block text-mono-caps text-[9px] text-accent mb-1.5"
        >
          Your text
        </label>
        <textarea
          id="text-tattoo-input"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 60))}
          rows={2}
          placeholder="Type your text — line break for multiple lines"
          className="w-full min-h-[88px] rounded-2xl bg-slate/60 border border-accent/40 p-4 text-lg leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 resize-none"
        />
      </div>

      {/* Preview */}
      <div
        className="mt-3 rounded-2xl border border-white/10 min-h-[140px] grid place-items-center p-4 overflow-hidden"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          backgroundColor: "#0a0a0a",
        }}
      >
        {preview ? (
          <img
            src={preview}
            alt="Text preview"
            className="max-h-[22dvh] max-w-full object-contain invert"
          />
        ) : (
          <Loader2 className="size-5 animate-spin text-accent" />
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
        The text is saved with a transparent background — perfect for AR and stencils.
      </p>

      {/* Fonts */}
      <div className="mt-4">
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-mono-caps text-[9px] text-muted-foreground">Font</div>
          <button
            onClick={() => setCatalogOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-slate/60 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest"
          >
            <Search className="size-3" />
            Font catalogue
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {fonts.map((f) => (
            <div key={f.id} className="relative">
              <button
                onClick={() => setFontId(f.id)}
                className={`w-full rounded-xl px-3 py-2.5 border text-left transition ${
                  f.id === fontId
                    ? "border-accent ring-2 ring-accent/25 bg-accent/5"
                    : "border-white/10 bg-slate/60"
                }`}
              >
                <div
                  className="text-[19px] leading-tight truncate"
                  style={{
                    fontFamily: `"${f.family}", serif`,
                    fontWeight: f.weight ?? 400,
                  }}
                >
                  {text.split("\n")[0]?.slice(0, 14) || f.label}
                </div>
                <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1 truncate pr-5">
                  {f.label} · {f.style}
                </div>
              </button>
              {f.custom && (
                <button
                  onClick={() => dropFont(f.id)}
                  className="absolute bottom-1.5 right-1.5 size-6 rounded-md grid place-items-center text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${f.label}`}
                >
                  <Trash2 className="size-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <FontCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onInstalled={(id) => {
          setCustom(customTattooFonts());
          setFontId(id);
          setCatalogOpen(false);
        }}
      />

      {/* Adjustments */}
      <div className="mt-4 rounded-xl border border-white/10 bg-slate/60 p-3 space-y-3">
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
            <span>Letter spacing</span>
            <span>{letterSpacing}</span>
          </div>
          <input
            type="range"
            min={-8}
            max={40}
            value={letterSpacing}
            onChange={(e) => setLetterSpacing(Number(e.target.value))}
            className="w-full accent-[color:var(--accent)]"
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
            <span>Curve (arc)</span>
            <span>{curve}°</span>
          </div>
          <input
            type="range"
            min={-60}
            max={60}
            value={curve}
            onChange={(e) => setCurve(Number(e.target.value))}
            className="w-full accent-[color:var(--accent)]"
          />
        </div>
        <button
          onClick={() => setItalic((i) => !i)}
          className={`w-full rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-widest transition ${
            italic
              ? "border-accent bg-accent/10 text-accent"
              : "border-white/10 text-muted-foreground"
          }`}
        >
          Italic
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 pb-4">
        <button
          onClick={onCancel}
          className="py-4 rounded-xl border border-white/15 bg-slate text-sm font-bold"
        >
          Cancel
        </button>
        <button
          onClick={() => preview && onDone(preview, text.split("\n")[0] || "Text")}
          disabled={!preview || busy}
          className="py-4 rounded-xl bg-accent text-ink text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          <Type className="size-4" />
          Use in AR
        </button>
      </div>
    </div>
  );
}
