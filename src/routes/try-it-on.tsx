import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  Share2,
  Wand2,
  Check,
  RotateCcw,
  Camera,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  autoCropRect,
  clampRect,
  cropToDataUrl,
  fileToDataUrl,
  keyOutBackground,
  type Rect,
} from "@/lib/motifExtract";
import {
  deleteMyMotif,
  listMyMotifs,
  saveMyMotif,
  subscribeMyMotifs,
  takeSharedImage,
  type MyMotif,
} from "@/lib/myMotifs";

export const Route = createFileRoute("/try-it-on")({
  head: () => ({
    meta: [
      { title: "Try It On Me — try any tattoo | InkSimulator" },
      {
        name: "description",
        content:
          "Upload or share an image of a tattoo. InkSimulator cuts out the design, makes the white background transparent, and saves it to your library for AR.",
      },
      { property: "og:title", content: "Try It On Me — InkSimulator" },
      {
        property: "og:description",
        content:
          "Extract a tattoo design from any image and try it on your own skin in AR.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/try-it-on" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/try-it-on" }],
  }),
  component: TryItOnPage,
});

type Phase = "pick" | "processing" | "confirm";

function TryItOnPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [original, setOriginal] = useState<string | null>(null);
  const [keyed, setKeyed] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect>({ x: 0, y: 0, w: 1, h: 1 });
  const [tolerance, setTolerance] = useState(52);
  const [keepBg, setKeepBg] = useState(false);
  const [name, setName] = useState("");
  const [widthCm, setWidthCm] = useState(8);
  const [mine, setMine] = useState<MyMotif[]>([]);

  useEffect(() => {
    setMine(listMyMotifs());
    return subscribeMyMotifs(() => setMine(listMyMotifs()));
  }, []);

  const runPipeline = useCallback(
    async (src: string, tol: number, keep: boolean) => {
      const processed = keep ? src : await keyOutBackground(src, { tolerance: tol });
      setKeyed(processed);
      return processed;
    },
    [],
  );

  const ingest = useCallback(
    async (src: string, label?: string) => {
      setPhase("processing");
      setOriginal(src);
      try {
        const processed = await runPipeline(src, tolerance, false);
        setRect(await autoCropRect(processed));
        setName(label?.replace(/\.[a-z0-9]+$/i, "").slice(0, 40) || "My design");
        setPhase("confirm");
      } catch {
        toast.error("Could not read the image. Try another one.");
        setPhase("pick");
      }
    },
    [runPipeline, tolerance],
  );

  // Image shared into the app ("Share to InkSimulator")
  useEffect(() => {
    const shared = takeSharedImage();
    if (shared) void ingest(shared, "Shared image");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFile = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    void ingest(await fileToDataUrl(file), file.name);
  };

  const reprocess = async (tol: number, keep: boolean) => {
    if (!original) return;
    setTolerance(tol);
    setKeepBg(keep);
    const processed = await runPipeline(original, tol, keep);
    if (!keep) setRect(await autoCropRect(processed));
  };

  const save = async (target: "live" | "photo" | "ar" = "live") => {
    if (!keyed) return;
    const src = await cropToDataUrl(keyed, rect);
    const motif = saveMyMotif({ name, src, widthCm });
    toast.success("Design saved to your library");
    if (target === "photo") {
      void navigate({ to: "/photo-tryon", search: { motif: motif.id } as never });
    } else if (target === "live") {
      void navigate({ to: "/ar", search: { motif: motif.id } as never });
    } else {
      void navigate({ to: "/ar", search: { motif: motif.id } as never });
    }
  };


  return (
    <AppShell>
      <header className="mb-6">
        <div className="text-mono-caps text-[10px] text-accent">Try It On Me</div>
        <h1 className="mt-1 text-3xl font-display font-bold tracking-tight">
          Try any tattoo
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a screenshot, a photo of someone else's tattoo, or a
          Pinterest image. We cut out the design and make{" "}
          <span className="text-foreground">white background transparent</span> automatically.
        </p>
      </header>

      {phase === "pick" && (
        <section className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-2xl border border-dashed border-accent/40 bg-slate/60 p-8 text-center active:scale-[0.99] transition"
          >
            <div className="mx-auto mb-3 size-12 rounded-2xl bg-accent text-ink grid place-items-center">
              <Upload className="size-5" strokeWidth={2.5} />
            </div>
            <div className="font-display font-bold">Upload image</div>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, or screenshot · max ~10 MB
            </p>
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />

          <div className="rounded-2xl border border-white/10 bg-slate/50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Share2 className="size-4 text-accent" /> Share to InkSimulator
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Install the app on your home screen. Then you can use your phone's
              share menu in Instagram, Pinterest, or Photos and pick{" "}
              <span className="text-foreground">InkSimulator</span> — the image lands
              directly in this flow.
            </p>
          </div>

          {mine.length > 0 && (
            <div>
              <h2 className="mb-2 mt-6 text-sm font-bold">My designs</h2>
              <div className="grid grid-cols-3 gap-3">
                {mine.map((m) => (
                  <div key={m.id} className="relative">
                    <Link
                      to="/ar"
                      search={{ motif: m.id } as never}
                      className="block rounded-xl border border-white/10 bg-checker p-2"
                    >
                      <img
                        src={m.src}
                        alt={m.name}
                        className="aspect-square w-full object-contain"
                      />
                      <div className="mt-1 truncate text-[10px] text-muted-foreground">
                        {m.name}
                      </div>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Remove ${m.name}`}
                      onClick={() => deleteMyMotif(m.id)}
                      className="absolute right-1 top-1 rounded-md bg-ink/80 p-1 text-muted-foreground"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {phase === "processing" && (
        <div className="grid place-items-center py-24 text-center">
          <Loader2 className="mb-3 size-8 animate-spin text-accent" />
          <p className="text-sm text-muted-foreground">
            Analyzing the image and removing the background…
          </p>
        </div>
      )}

      {phase === "confirm" && keyed && (
        <section className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-slate/50 p-4">
            <h2 className="font-display text-lg font-bold">Is this the right design?</h2>
            <p className="text-xs text-muted-foreground">
              Drag the frame to adjust the crop. Adjust the threshold if parts
              of the design disappear.
            </p>
          </div>

          <CropCanvas src={keyed} rect={rect} onChange={(r) => setRect(clampRect(r))} />

          <div className="space-y-3 rounded-2xl border border-white/10 bg-slate/50 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-bold">
                <Wand2 className="size-3.5 text-accent" /> White → transparent
              </span>
              <button
                type="button"
                onClick={() => void reprocess(tolerance, !keepBg)}
                className="text-accent underline underline-offset-4"
              >
                {keepBg ? "Turn on" : "Keep background"}
              </button>
            </div>
            <input
              type="range"
              min={10}
              max={120}
              value={tolerance}
              disabled={keepBg}
              onChange={(e) => void reprocess(Number(e.target.value), keepBg)}
              className="w-full accent-accent disabled:opacity-40"
              aria-label="Background removal threshold"
            />

            <label className="block text-xs font-bold">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-xl border border-white/10 bg-ink px-3 text-sm focus:border-accent focus:outline-none"
            />

            <label className="block text-xs font-bold">
              Skin width: {widthCm} cm
            </label>
            <input
              type="range"
              min={2}
              max={30}
              value={widthCm}
              onChange={(e) => setWidthCm(Number(e.target.value))}
              className="w-full accent-accent"
              aria-label="Width in cm"
            />
          </div>

          <div className="space-y-2 pb-6">
            <Button
              className="w-full rounded-full"
              onClick={() => void save("live")}
            >
              <Check className="mr-2 size-4" /> Save & try live
            </Button>
            <Button
              variant="secondary"
              className="w-full rounded-full"
              onClick={() => void save("photo")}
            >
              <ImageIcon className="mr-2 size-4" /> Save & try on a photo
            </Button>
            <Button
              variant="ghost"
              className="w-full rounded-full"
              onClick={() => {
                setPhase("pick");
                setKeyed(null);
                setOriginal(null);
              }}
            >
              <RotateCcw className="mr-2 size-4" /> Start over
            </Button>
          </div>

          <p className="flex items-center justify-center gap-1.5 pb-8 text-[11px] text-muted-foreground">
            <Camera className="size-3.5" /> The design will be available in the AR camera,
            in Live Try-On, and in Paste tattoo on a picture.
          </p>

        </section>
      )}
    </AppShell>
  );
}

/** Crop frame overlaid on the image — drag to move, drag corners to resize. */
function CropCanvas({
  src,
  rect,
  onChange,
}: {
  src: string;
  rect: Rect;
  onChange: (r: Rect) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: string; sx: number; sy: number; start: Rect } | null>(null);

  const onDown = (mode: string) => (e: React.PointerEvent) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: rect };
  };

  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = boxRef.current;
    if (!d || !el) return;
    const b = el.getBoundingClientRect();
    const dx = (e.clientX - d.sx) / b.width;
    const dy = (e.clientY - d.sy) / b.height;
    const s = d.start;
    let next: Rect = { ...s };
    if (d.mode === "move") next = { ...s, x: s.x + dx, y: s.y + dy };
    if (d.mode === "nw") next = { x: s.x + dx, y: s.y + dy, w: s.w - dx, h: s.h - dy };
    if (d.mode === "ne") next = { x: s.x, y: s.y + dy, w: s.w + dx, h: s.h - dy };
    if (d.mode === "sw") next = { x: s.x + dx, y: s.y, w: s.w - dx, h: s.h + dy };
    if (d.mode === "se") next = { x: s.x, y: s.y, w: s.w + dx, h: s.h + dy };
    onChange(next);
  };

  const stop = () => {
    drag.current = null;
  };

  const pct = (n: number) => `${n * 100}%`;
  const handle =
    "absolute size-6 rounded-full border-2 border-accent bg-ink touch-none";

  return (
    <div
      ref={boxRef}
      onPointerMove={onMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-checker"
    >
      <img src={src} alt="Preview of the design" className="block w-full" />
      <div className="pointer-events-none absolute inset-0 bg-ink/50" />
      <div
        className="absolute touch-none"
        style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
      >
        <div
          onPointerDown={onDown("move")}
          className="absolute inset-0 cursor-move overflow-hidden border-2 border-accent"
        >
          <img
            src={src}
            alt=""
            aria-hidden
            className="absolute max-w-none"
            style={{
              width: `${100 / rect.w}%`,
              left: `${(-rect.x / rect.w) * 100}%`,
              top: `${(-rect.y / rect.h) * 100}%`,
              height: `${100 / rect.h}%`,
            }}
          />
        </div>
        <div className={`${handle} -left-3 -top-3`} onPointerDown={onDown("nw")} />
        <div className={`${handle} -right-3 -top-3`} onPointerDown={onDown("ne")} />
        <div className={`${handle} -bottom-3 -left-3`} onPointerDown={onDown("sw")} />
        <div className={`${handle} -bottom-3 -right-3`} onPointerDown={onDown("se")} />
      </div>
    </div>
  );
}
