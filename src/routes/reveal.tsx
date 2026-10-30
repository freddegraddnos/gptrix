import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Play,
  RotateCcw,
  Share2,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { TATTOOS } from "@/lib/tattoos";
import { listMyMotifs, subscribeMyMotifs, type MyMotif } from "@/lib/myMotifs";
import { fileToDataUrl } from "@/lib/motifExtract";
import { recorderSupported } from "@/lib/videoRecording";
import { saveToCameraRoll, shareFile, shareImage } from "@/lib/share";
import { ShareToConnected } from "@/components/ShareToConnected";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_PLACEMENT,
  REVEAL_STYLES,
  REVEAL_TOTAL_MS,
  drawPreview,
  loadImg,
  runReveal,
  snapshot,
  type RevealPhase,
  type RevealPlacement,
  type RevealStyle,
} from "@/lib/revealVideo";

export const Route = createFileRoute("/reveal")({
  head: () => ({
    meta: [
      { title: "Tattoo Reveal — 3, 2, 1 and the tattoo appears | InkSimulator" },
      {
        name: "description",
        content:
          "Upload a photo of your body, count down 3-2-1, and watch the tattoo animate in. The entire reveal sequence is recorded automatically — ready to share.",
      },
      { property: "og:title", content: "Tattoo Reveal — InkSimulator" },
      {
        property: "og:description",
        content:
          "Countdown, sound, and a satisfying reveal animation, automatically recorded in 9:16.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/reveal" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/reveal" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    motif: typeof s.motif === "string" ? s.motif : undefined,
  }),
  component: RevealPage,
});

function RevealPage() {
  const { user } = useAuth();
  const { motif: motifParam } = Route.useSearch();
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const photoElRef = useRef<HTMLImageElement | null>(null);
  const motifElRef = useRef<HTMLImageElement | null>(null);
  const placementRef = useRef<RevealPlacement>({ ...DEFAULT_PLACEMENT });
  const dragRef = useRef(false);

  const [myMotifs, setMyMotifs] = useState<MyMotif[]>([]);
  const [photo, setPhoto] = useState<string | null>(null);
  const [motifId, setMotifId] = useState<string>(motifParam ?? TATTOOS[0].id);
  const [placement, setPlacement] = useState<RevealPlacement>({
    ...DEFAULT_PLACEMENT,
  });
  const [style, setStyle] = useState<RevealStyle>("wipe");
  const [caption, setCaption] = useState("What do you think — should I get it?");
  const [sound, setSound] = useState(true);
  const [running, setRunning] = useState(false);
  const [phase, setPhase] = useState<RevealPhase | null>(null);
  const [result, setResult] = useState<{ blob: Blob; ext: string } | null>(null);
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    setMyMotifs(listMyMotifs());
    return subscribeMyMotifs(() => setMyMotifs(listMyMotifs()));
  }, []);

  const motifs = [
    ...myMotifs.map((m) => ({ id: m.id, name: m.name, src: m.src })),
    ...TATTOOS.map((t) => ({ id: t.id, name: t.name, src: t.src })),
  ];
  const activeMotif = motifs.find((m) => m.id === motifId) ?? motifs[0];

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const photoEl = photoElRef.current;
    if (!canvas || !photoEl) return;
    drawPreview(canvas, photoEl, motifElRef.current, placementRef.current, true);
  }, []);

  // load photo
  useEffect(() => {
    if (!photo) return;
    let alive = true;
    void loadImg(photo).then((img) => {
      if (!alive) return;
      photoElRef.current = img;
      redraw();
    });
    return () => {
      alive = false;
    };
  }, [photo, redraw]);

  // load design
  useEffect(() => {
    if (!activeMotif) return;
    let alive = true;
    void loadImg(activeMotif.src).then((img) => {
      if (!alive) return;
      motifElRef.current = img;
      redraw();
    });
    return () => {
      alive = false;
    };
  }, [activeMotif, redraw]);

  useEffect(() => {
    placementRef.current = placement;
    if (!running) redraw();
  }, [placement, running, redraw]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    try {
      const url = await fileToDataUrl(file);
      setPhoto(url);
      setResult(null);
      setStillUrl(null);
      setVideoUrl(null);
      setPlacement({ ...DEFAULT_PLACEMENT });
    } catch {
      toast.error("Could not read the image.");
    }
  };

  const pointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current || running) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setPlacement((p) => ({ ...p, x, y }));
  };

  const start = async () => {
    const canvas = canvasRef.current;
    const photoEl = photoElRef.current;
    const motifEl = motifElRef.current;
    if (!canvas || !photoEl || !motifEl) {
      toast.error("Upload a photo and choose a design first.");
      return;
    }
    setRunning(true);
    setResult(null);
    setVideoUrl(null);
    setStillUrl(null);
    try {
      const record = recorderSupported();
      if (!record) {
        toast.message("Recording isn't supported here — the reveal will still play.");
      }
      const res = await runReveal({
        canvas,
        photo: photoEl,
        motif: motifEl,
        placement: placementRef.current,
        style,
        caption,
        sound,
        record,
        onPhase: (p) => setPhase(p),
      });
      setStillUrl(snapshot(canvas));
      if (res) {
        setResult({ blob: res.blob, ext: res.ext });
        setVideoUrl(URL.createObjectURL(res.blob));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setPhase(null);
      setRunning(false);
    }
  };

  const shareVideo = async () => {
    if (!result) return;
    const out = await shareFile(result.blob, `inksimulator-reveal.${result.ext}`, {
      title: "My InkSimulator reveal",
      text: "Check out my new tattoo — tested in InkSimulator. Try yours → inksimulator.com",
    });
    if (out === "downloaded") toast.success("Video saved.");
  };

  const saveVideo = async () => {
    if (!result) return;
    const out = await saveToCameraRoll(
      result.blob,
      `inksimulator-reveal.${result.ext}`,
    );
    if (out === "downloaded") toast.success("Saved to your downloads.");
  };

  return (
    <AppShell>
      <header className="mb-6">
        <p className="text-xs tracking-[0.3em] text-accent uppercase">
          Tattoo Reveal
        </p>
        <h1 className="text-2xl font-bold mt-1">3 … 2 … 1 — reveal</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Upload a photo of the body part without a tattoo, place the design, and
          start. The entire sequence is recorded automatically — you don't need
          any screen recording.
        </p>
      </header>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickPhoto(e.target.files?.[0])}
      />

      {!photo ? (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-white/20 bg-white/[0.03] py-16 flex flex-col items-center gap-3"
        >
          <Upload className="h-7 w-7 text-accent" />
          <span className="text-sm font-medium">Upload a photo of the body part</span>
          <span className="text-xs text-muted-foreground">
            Arm, leg, back — without a tattoo
          </span>
        </button>
      ) : (
        <div className="space-y-5">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
            <canvas
              ref={canvasRef}
              className="w-full touch-none block"
              style={{ aspectRatio: "9 / 16" }}
              onPointerDown={(e) => {
                if (running) return;
                dragRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                pointerMove(e);
              }}
              onPointerMove={pointerMove}
              onPointerUp={() => (dragRef.current = false)}
              onPointerCancel={() => (dragRef.current = false)}
            />
            {!running && !result && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-3 py-1 text-[11px] text-white/80">
                Drag to place the design
              </div>
            )}
            {running && phase === "countdown" && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent/20 border border-accent/50 px-3 py-1 text-[11px] text-accent">
                Recording …
              </div>
            )}
          </div>

          {!running && (
            <>
              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Size
                </p>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={Math.round(placement.scale * 100)}
                  onChange={(e) =>
                    setPlacement((p) => ({ ...p, scale: Number(e.target.value) / 100 }))
                  }
                  className="w-full accent-accent"
                />
                <p className="text-xs uppercase tracking-widest text-muted-foreground mt-3 mb-2">
                  Rotation
                </p>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={placement.rotation}
                  onChange={(e) =>
                    setPlacement((p) => ({ ...p, rotation: Number(e.target.value) }))
                  }
                  className="w-full accent-accent"
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Design
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {motifs.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMotifId(m.id)}
                      className={`shrink-0 h-16 w-16 rounded-xl border p-1 bg-artwork ${
                        m.id === activeMotif?.id
                          ? "border-accent"
                          : "border-white/10"
                      }`}
                      aria-label={m.name}
                    >
                      <img
                        src={m.src}
                        alt={m.name}
                        className="h-full w-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Reveal effect
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {REVEAL_STYLES.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setStyle(s.id)}
                      className={`rounded-xl border px-3 py-3 text-left ${
                        style === s.id
                          ? "border-accent bg-accent/10"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <span className="block text-sm font-semibold">{s.label}</span>
                      <span className="block text-[11px] text-muted-foreground leading-tight mt-1">
                        {s.hint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
                  Caption
                </p>
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={90}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
                  placeholder="Write a caption…"
                />
              </div>

              <button
                onClick={() => setSound((s) => !s)}
                className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"
              >
                <span className="flex items-center gap-2">
                  {sound ? (
                    <Volume2 className="h-4 w-4 text-accent" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  )}
                  Sound during countdown
                </span>
                <span className="text-xs text-muted-foreground">
                  {sound ? "On" : "Off"}
                </span>
              </button>

              <div className="flex gap-2">
                <Button
                  onClick={() => void start()}
                  className="flex-1 h-12 rounded-xl bg-accent text-black hover:bg-accent"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start reveal ({Math.round(REVEAL_TOTAL_MS / 100) / 10}s)
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl"
                  onClick={() => fileRef.current?.click()}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </>
          )}

          {running && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {phase === "countdown"
                ? "Counting down…"
                : phase === "reveal"
                  ? "Reveal!"
                  : "Finishing…"}
            </div>
          )}

          {(result || stillUrl) && !running && (
            <div className="space-y-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-accent" /> Ready to share
              </p>
              {videoUrl && (
                <video
                  src={videoUrl}
                  controls
                  playsInline
                  className="w-full rounded-xl border border-white/10"
                />
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={() => void shareVideo()}
                  disabled={!result}
                  className="h-11 rounded-xl bg-accent text-black hover:bg-accent"
                >
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl"
                  onClick={() => void saveVideo()}
                  disabled={!result}
                >
                  <Download className="h-4 w-4 mr-2" /> Save
                </Button>
              </div>
              <ShareToConnected
                userId={user?.id}
                url={typeof window !== "undefined" ? window.location.origin : "https://www.inksimulator.com"}
                text="My InkSimulator reveal ✨ Try yours →"
                file={result?.blob ?? null}
                filename={`inksimulator-reveal.${result?.ext ?? "mp4"}`}
              />
              {stillUrl && (
                <Button
                  variant="ghost"
                  className="w-full h-10 rounded-xl text-xs"
                  onClick={() => void shareImage(stillUrl, "inksimulator-reveal.png")}
                >
                  Share as a still image instead
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full h-10 rounded-xl text-xs"
                onClick={() => void start()}
              >
                Run reveal again
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-xs text-muted-foreground">
        Want to make a before/after video instead?{" "}
        <Link to="/before-after" className="text-accent underline">
          Before/After →
        </Link>
      </p>
    </AppShell>
  );
}
