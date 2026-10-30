import { toast } from "sonner";
import { computeMask, composite } from "@/lib/paint/bgMask";
import { aiCleanLines } from "@/lib/paint/aiStencil.functions";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, Eraser, Loader2, Sparkles, Brush, ImagePlus, Redo2, Undo2, Upload, X } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { createStencilClient, exportMaxSide } from "@/lib/paint/stencilClient";
import { tx } from "@/lib/uiLang";
import { looksLikeLineArt } from "@/lib/paint/stencilEngine";
import { mmToPx } from "@/lib/paint/printLayout";
import { StencilPrint } from "./StencilPrint";
import { normalizeInkBounds, scaledInkBounds, stencilInkBounds, stencilSourceSize, type InkBounds } from "@/lib/paint/stencilBounds";

type Step = 1 | 2 | 3;
type Style = "lineart" | "outline" | "simple" | "detailed";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";
const STEPS: { id: Step; label: string }[] = [
  { id: 1, label: "Upload" },
  { id: 2, label: "Refine" },
  { id: 3, label: "Size & Print" },
];
const DEFAULT_WIDTH_MM = 100;

/**
 * Stencil mode: a guided 3-step flow layered over the drawing app.
 * Line processing runs in a Web Worker (see src/lib/paint/stencilEngine.ts).
 */
export function StencilMode({ onClose, initialImage, initialWidthMm }: { onClose: () => void; initialImage?: string; initialWidthMm?: number }) {
  const [widthMm, setWidthMm] = useState(DEFAULT_WIDTH_MM);
  const [step, setStep] = useState<Step>(1);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [loading, setLoading] = useState(false);

  const [style, setStyle] = useState<Style>("simple");
  const [detail, setDetail] = useState(50);
  const [thickness, setThickness] = useState(0.5);
  const [removeBg, setRemoveBg] = useState(true);
  const [mirror, setMirror] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [contrast, setContrast] = useState(0);
  const [noise, setNoise] = useState(20);
  const [invert, setInvert] = useState(false);

  const [split, setSplit] = useState(50);
  const [erasing, setErasing] = useState(false);
  const [eraserMm, setEraserMm] = useState(4);
  const [processing, setProcessing] = useState(false);
  const [mask, setMask] = useState<HTMLCanvasElement | null>(null);
  const [maskBusy, setMaskBusy] = useState(false);
  const [maskVer, setMaskVer] = useState(0);
  const [refine, setRefine] = useState<null | "restore" | "erase">(null);
  const [aiBusy, setAiBusy] = useState(false);
  const aiAppliedRef = useRef(false);
  const [printSnap, setPrintSnap] = useState<{ preview: HTMLCanvasElement; erase: HTMLCanvasElement | null; ai: boolean; bounds: InkBounds } | null>(null);

  const outRef = useRef<HTMLCanvasElement>(null);
  const eraseRef = useRef<HTMLCanvasElement>(null);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [future, setFuture] = useState<ImageData[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  const load = useCallback((file: File | Blob) => {
    setLoading(true);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setSource(img);
      setMask(null);
      try {
        const k = Math.min(1, 200 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        const cx = c.getContext("2d")!; cx.drawImage(img, 0, 0, c.width, c.height);
        const line = looksLikeLineArt(cx.getImageData(0, 0, c.width, c.height).data);
        setStyle(line ? "lineart" : "simple");
        // Line drawings need no background removal (heavy AI model, downscales the image).
        setRemoveBg(!line);
      } catch { /* keep current style */ }
      setLoading(false);
      setHistory([]);
      setFuture([]);
      setStep(2);
    };
    img.onerror = () => setLoading(false);
    img.src = url;
  }, []);

  // Drawing handed over from the canvas: flatten on white, skip upload if it has ink.
  useEffect(() => {
    if (!initialImage) return;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const cx = c.getContext("2d")!;
      cx.fillStyle = "#fff"; cx.fillRect(0, 0, c.width, c.height);
      cx.drawImage(img, 0, 0);
      const d = cx.getImageData(0, 0, c.width, c.height).data;
      let ink = false;
      for (let i = 3; i < d.length; i += 16) { if (d[i - 3] < 200) { ink = true; break; } }
      if (!ink) return;
      if (initialWidthMm && initialWidthMm > 0) setWidthMm(initialWidthMm);
      c.toBlob((b) => { if (b) load(b); }, "image/png");
    };
    img.src = initialImage;
  }, [initialImage, initialWidthMm, load]);

  // Paste anywhere while on step 1
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      const f = item?.getAsFile();
      if (f) load(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [load]);

  // Real line engine in a Web Worker (downscaled preview)
  const clientRef = useRef<ReturnType<typeof createStencilClient> | null>(null);
  useEffect(() => {
    clientRef.current = createStencilClient();
    return () => clientRef.current?.dispose();
  }, []);
  // In-browser background removal (no upload)
  useEffect(() => {
    if (!removeBg || !source || mask || maskBusy) return;
    let off = false;
    setMaskBusy(true);
    Promise.race([
      computeMask(source),
      new Promise<never>((_, bad) => window.setTimeout(() => bad(new Error("timeout")), 60000)),
    ])
      .then((m) => { if (!off) setMask(m); })
      .catch(() => { if (!off) { setRemoveBg(false); toast.error("Background removal failed — using full image"); } })
      .finally(() => { if (!off) setMaskBusy(false); });
    return () => { off = true; setMaskBusy(false); };
  }, [removeBg, source, mask]);

  useEffect(() => {
    const c = outRef.current;
    if (!c || !source || step === 1) return;
    if (removeBg && maskBusy) return;
    const input = removeBg && mask ? composite(source, mask) : source;
    setProcessing(true);
    let cancelled = false;
    const t = window.setTimeout(async () => {
      let r;
      try {
        r = await clientRef.current?.run(input, Math.min(2000, Math.max(900, Math.round((c.parentElement?.clientWidth || 900) * (window.devicePixelRatio || 1)))), {
          style, detail, thicknessMm: thickness, widthMm,
          contrast, noise, invert, removeBg, mirror,
        });
      } catch (err) {
        if (!cancelled) { setProcessing(false); toast.error(err instanceof Error ? err.message : "Stencil failed"); }
        return;
      }
      if (cancelled || !r) return;
      c.width = r.w;
      c.height = r.h;
      c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
      const e = eraseRef.current;
      if (e) {
        e.width = c.width;
        e.height = c.height;
      }
      aiAppliedRef.current = false;
      setHistory([]);
      setFuture([]);
      setProcessing(false);
    }, 60);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [source, step, style, detail, thickness, contrast, noise, invert, removeBg, mirror, mask, maskBusy, maskVer, widthMm]);

  const pxPerMm = () => (outRef.current ? outRef.current.width / widthMm : 1);

  const snapshot = () => {
    const e = eraseRef.current;
    if (!e) return;
    setHistory((h) => [...h.slice(-29), e.getContext("2d")!.getImageData(0, 0, e.width, e.height)]);
    setFuture([]);
  };
  const undo = () => {
    const e = eraseRef.current;
    if (!e || !history.length) return;
    const ctx = e.getContext("2d")!;
    setFuture((f) => [ctx.getImageData(0, 0, e.width, e.height), ...f]);
    ctx.putImageData(history[history.length - 1], 0, 0);
    setHistory((h) => h.slice(0, -1));
  };
  const redo = () => {
    const e = eraseRef.current;
    if (!e || !future.length) return;
    const ctx = e.getContext("2d")!;
    setHistory((h) => [...h, ctx.getImageData(0, 0, e.width, e.height)]);
    ctx.putImageData(future[0], 0, 0);
    setFuture((f) => f.slice(1));
  };

  const drawing = useRef(false);
  const paint = (ev: React.PointerEvent<HTMLCanvasElement>) => {
    const e = eraseRef.current;
    if (!e) return;
    const r = e.getBoundingClientRect();
    if (refine && mask) {
      let fx = (ev.clientX - r.left) / r.width;
      if (mirror) fx = 1 - fx;
      const mx = fx * mask.width, my = ((ev.clientY - r.top) / r.height) * mask.height;
      const m = mask.getContext("2d")!;
      m.globalCompositeOperation = refine === "restore" ? "source-over" : "destination-out";
      m.fillStyle = "#fff";
      m.beginPath();
      m.arc(mx, my, (eraserMm * mask.width) / widthMm / 2, 0, Math.PI * 2);
      m.fill();
      m.globalCompositeOperation = "source-over";
      return;
    }
    const x = ((ev.clientX - r.left) / r.width) * e.width;
    const y = ((ev.clientY - r.top) / r.height) * e.height;
    const ctx = e.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x, y, (eraserMm * pxPerMm()) / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const runAi = async () => {
    const c = outRef.current, e = eraseRef.current;
    if (!c) return;
    setAiBusy(true);
    try {
      const t = document.createElement("canvas");
      t.width = c.width; t.height = c.height;
      const tc = t.getContext("2d")!;
      tc.fillStyle = "#fff"; tc.fillRect(0, 0, t.width, t.height);
      tc.drawImage(c, 0, 0);
      if (e) tc.drawImage(e, 0, 0);
      const r = await aiCleanLines({ data: { imageDataUrl: t.toDataURL("image/png") } });
      if ("error" in r) throw new Error(r.error);
      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error("Could not load AI result")); img.src = r.url; });
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const ink = d.data[i] * 0.299 + d.data[i + 1] * 0.587 + d.data[i + 2] * 0.114 < 128;
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 0;
        d.data[i + 3] = ink ? 255 : 0;
      }
      ctx.putImageData(d, 0, 0);
      e?.getContext("2d")!.clearRect(0, 0, e.width, e.height);
      aiAppliedRef.current = true;
      setHistory([]); setFuture([]);
      toast.success("AI clean lines applied");
    } catch (err) {
      toast.error(`AI unavailable — keeping local stencil. ${err instanceof Error ? err.message : ""}`);
    } finally {
      setAiBusy(false);
    }
  };

  // Freeze the refined result (incl. touch-ups / AI) when entering Size & Print.
  const goToPrint = () => {
    const c = outRef.current, e = eraseRef.current;
    if (!c) return;
    const preview = document.createElement("canvas");
    preview.width = c.width; preview.height = c.height;
    const pc = preview.getContext("2d");
    if (!pc) return;
    pc.drawImage(c, 0, 0);
    let erase: HTMLCanvasElement | null = null;
    if (e) {
      erase = document.createElement("canvas");
      erase.width = e.width; erase.height = e.height;
      erase.getContext("2d")!.drawImage(e, 0, 0);
      // touch-ups erase lines: punch them out of the transparent stencil
      pc.globalCompositeOperation = "destination-out";
      pc.drawImage(e, 0, 0);
    }
    const bounds = stencilInkBounds(pc.getImageData(0, 0, preview.width, preview.height).data, preview.width, preview.height);
    if (!bounds) { toast.error(tx("The stencil has no visible lines. Return to Refine.")); return; }
    const cropped = document.createElement("canvas");
    cropped.width = bounds.w; cropped.height = bounds.h;
    const croppedCtx = cropped.getContext("2d");
    if (!croppedCtx) return;
    croppedCtx.drawImage(preview, bounds.x, bounds.y, bounds.w, bounds.h, 0, 0, bounds.w, bounds.h);
    setPrintSnap({ preview: cropped, erase, ai: aiAppliedRef.current, bounds: normalizeInkBounds(bounds, preview.width, preview.height) });
    setStep(3);
  };

  /** Full-resolution stencil at the final print size (300 DPI); black on transparent. */
  const getStencil = async (widthMm: number, heightMm: number): Promise<HTMLCanvasElement> => {
    const snap = printSnap;
    if (!snap) throw new Error("Stencil preview unavailable");
    const w = mmToPx(widthMm), h = mmToPx(heightMm);
    const out = document.createElement("canvas");
    out.width = w; out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    if (snap.ai || !source) {
      ctx.drawImage(snap.preview, 0, 0, w, h);
      return out;
    }
    const input = removeBg && mask ? composite(source, mask) : source;
    const fullSize = stencilSourceSize(widthMm, heightMm, snap.bounds);
    const r = await clientRef.current?.run(input, exportMaxSide(fullSize.w, fullSize.h), {
      style, detail, thicknessMm: thickness, widthMm: fullSize.w, contrast, noise, invert, removeBg, mirror,
    }, false);
    if (!r) throw new Error("Stencil engine unavailable");
    const full = document.createElement("canvas");
    full.width = r.w; full.height = r.h;
    const fullCtx = full.getContext("2d");
    if (!fullCtx) throw new Error("Canvas unavailable");
    fullCtx.putImageData(new ImageData(new Uint8ClampedArray(r.data), r.w, r.h), 0, 0);
    const crop = scaledInkBounds(snap.bounds, r.w, r.h);
    ctx.drawImage(full, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
    if (snap.erase) {
      ctx.globalCompositeOperation = "destination-out";
      const eraseCrop = scaledInkBounds(snap.bounds, snap.erase.width, snap.erase.height);
      ctx.drawImage(snap.erase, eraseCrop.x, eraseCrop.y, eraseCrop.w, eraseCrop.h, 0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
    }
    return out;
  };

  const heightMm = source ? Math.round((widthMm * source.height) / source.width) : 0;

  return (
    <div className="fixed inset-x-0 bottom-0 top-[var(--studio-bar-h,0px)] z-50 flex min-h-0 flex-col overflow-hidden bg-background text-foreground">
      {/* Stepper */}
      <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-border bg-background p-2">
        <ol className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {STEPS.map((s) => {
            const enabled = s.id === 1 || !!source;
            return (
              <li key={s.id} className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  disabled={!enabled}
                  onClick={() => s.id === 3 ? goToPrint() : setStep(s.id)}
                  aria-current={step === s.id ? "step" : undefined}
                  className={`flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm disabled:opacity-40 ${
                    step === s.id ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                  }`}
                >
                  <span className="font-mono">{s.id}</span>
                  <span className="whitespace-nowrap">{s.label}</span>
                </button>
                {s.id < 3 && <span className="h-px w-4 bg-border" />}
              </li>
            );
          })}
        </ol>
        <button
          type="button"
          aria-label="Close stencil mode"
          onClick={onClose}
          className="flex size-11 shrink-0 items-center justify-center rounded-xl hover:bg-accent"
        >
          <X size={20} />
        </button>
      </header>

      <input ref={fileRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ""; }} />

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {step === 1 && (
          <div className="mx-auto flex max-w-xl flex-col gap-3 p-4">
            {loading ? (
              <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
            ) : (
              <div
                role="button"
                tabIndex={0}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) load(f); }}
                className="flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-6 text-center hover:bg-accent/40"
              >
                <Upload size={36} className="text-muted-foreground" />
                <p className="text-base">Drop an image here</p>
                <p className="text-xs text-muted-foreground">or paste (Ctrl/⌘+V) · JPG, PNG, WEBP, HEIC</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border hover:bg-accent">
                <ImagePlus size={18} /> Choose file
              </button>
              <button type="button" onClick={() => camRef.current?.click()} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border hover:bg-accent">
                <Camera size={18} /> Camera
              </button>
            </div>
          </div>
        )}

        {step === 2 && source && (
          <div className="mx-auto grid max-w-5xl gap-4 p-3 lg:grid-cols-[1fr_20rem]">
            <div className="flex flex-col gap-2">
              <div className="relative overflow-hidden rounded-2xl border border-border" style={{ backgroundColor: "#ffffff" }}>
                {(processing || maskBusy || aiBusy) && <Skeleton className="absolute inset-0 z-10" />}
                {(maskBusy || aiBusy) && <p className="absolute inset-x-0 top-2 z-20 text-center text-xs">{aiBusy ? "AI is cleaning lines…" : "Removing background…"}</p>}
                <img src={source.src} alt="Original" className="block w-full" style={{ transform: mirror ? "scaleX(-1)" : undefined }} />
                <div className="absolute inset-0" style={{ backgroundColor: "#ffffff", clipPath: `inset(0 0 0 ${split}%)` }}>
                  <canvas ref={outRef} className="absolute inset-0 h-full w-full" />
                  <canvas
                    ref={eraseRef}
                    className="absolute inset-0 h-full w-full"
                    style={{ touchAction: "none", cursor: erasing || refine ? "cell" : "default", pointerEvents: erasing || refine ? "auto" : "none" }}
                    onPointerDown={(e) => { drawing.current = true; if (!refine) snapshot(); e.currentTarget.setPointerCapture(e.pointerId); paint(e); }}
                    onPointerMove={(e) => drawing.current && paint(e)}
                    onPointerUp={() => { drawing.current = false; if (refine) setMaskVer((v) => v + 1); }}
                  />
                </div>
                <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${split}%` }} />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Before</span>
                <Slider value={[split]} min={0} max={100} step={1} onValueChange={([v]) => setSplit(v ?? 50)} aria-label="Before/after" className="flex-1" />
                <span className="text-xs text-muted-foreground">After</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" aria-pressed={erasing} onClick={() => { setRefine(null); setErasing((v) => !v); }} className={`flex min-h-11 items-center gap-2 rounded-xl px-3 ${erasing ? "bg-primary text-primary-foreground" : "border border-border hover:bg-accent"}`}>
                  <Eraser size={18} /> Touch-up
                </button>
                <button type="button" aria-label="Undo" disabled={!history.length} onClick={undo} className="flex size-11 items-center justify-center rounded-xl border border-border disabled:opacity-40"><Undo2 size={18} /></button>
                <button type="button" aria-label="Redo" disabled={!future.length} onClick={redo} className="flex size-11 items-center justify-center rounded-xl border border-border disabled:opacity-40"><Redo2 size={18} /></button>
                {(erasing || refine) && (
                  <div className="flex flex-1 items-center gap-2">
                    <Slider value={[eraserMm]} min={1} max={20} step={0.5} onValueChange={([v]) => setEraserMm(v ?? 4)} aria-label="Eraser size" className="flex-1" />
                    <span className="w-14 text-right font-mono text-xs">{eraserMm} mm</span>
                  </div>
                )}
              </div>
            </div>

            <aside className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-xs text-muted-foreground">Style</p>
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                  {(["lineart", "outline", "simple", "detailed"] as Style[]).map((s) => (
                    <button key={s} type="button" aria-pressed={style === s} onClick={() => setStyle(s)} className={`min-h-11 rounded-lg text-sm capitalize ${style === s ? "bg-background shadow" : ""}`}>{s === "lineart" ? tx("Line art") : s}</button>
                  ))}
                </div>
              </div>
              <Field label="Detail" value={`${detail}%`}>
                <Slider value={[detail]} min={0} max={100} step={1} onValueChange={([v]) => setDetail(v ?? 50)} aria-label="Detail" />
              </Field>
              <Field label="Line thickness" value={`${thickness.toFixed(1)} mm`}>
                <Slider value={[thickness]} min={0.1} max={2} step={0.1} onValueChange={([v]) => setThickness(v ?? 0.5)} aria-label="Line thickness" />
              </Field>
              <Toggle label="Remove background" checked={removeBg} onChange={setRemoveBg} />
              {removeBg && mask && (
                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Refine edge</p>
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1">
                    {(["restore", "erase"] as const).map((m) => (
                      <button key={m} type="button" aria-pressed={refine === m} onClick={() => { setErasing(false); setRefine((v) => (v === m ? null : m)); }} className={`flex min-h-11 items-center justify-center gap-1 rounded-lg text-sm capitalize ${refine === m ? "bg-background shadow" : ""}`}>
                        <Brush size={14} /> {m}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <Toggle label="Mirror" checked={mirror} onChange={setMirror} />
              <button type="button" disabled={aiBusy || processing} onClick={runAi} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border hover:bg-accent disabled:opacity-50">
                {aiBusy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} {aiBusy ? "Cleaning…" : "AI clean lines (optional)"}
              </button>

              <div className="rounded-xl border border-border">
                <button type="button" aria-expanded={advancedOpen} onClick={() => setAdvancedOpen((v) => !v)} className="flex min-h-11 w-full items-center justify-between px-3 text-sm">
                  Advanced <ChevronDown size={16} className={advancedOpen ? "rotate-180" : ""} />
                </button>
                {advancedOpen && (
                  <div className="flex flex-col gap-4 p-3 pt-0">
                    <Field label="Contrast" value={`${contrast}`}>
                      <Slider value={[contrast]} min={-50} max={50} step={1} onValueChange={([v]) => setContrast(v ?? 0)} aria-label="Contrast" />
                    </Field>
                    <Field label="Noise cleanup" value={`${noise}%`}>
                      <Slider value={[noise]} min={0} max={100} step={1} onValueChange={([v]) => setNoise(v ?? 20)} aria-label="Noise cleanup" />
                    </Field>
                    <Toggle label="Invert" checked={invert} onChange={setInvert} />
                  </div>
                )}
              </div>

              <button type="button" disabled={processing || maskBusy || aiBusy} onClick={goToPrint} className="min-h-11 rounded-xl bg-primary text-primary-foreground disabled:opacity-50">
                Next: Size & Print
              </button>
            </aside>
          </div>
        )}

        {step === 3 && printSnap && source && (
          <StencilPrint
            preview={printSnap.preview}
            aspect={printSnap.preview.height / printSnap.preview.width}
            getStencil={getStencil}
            onBack={() => setStep(2)}
          />
        )}
      </main>
    </div>
  );
}

function Field({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-xs"><span className="text-muted-foreground">{label}</span><span className="font-mono">{value}</span></div>
      <div className="flex min-h-11 items-center">{children}</div>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between text-sm">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}
