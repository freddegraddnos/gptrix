import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Coins,
  Ruler,
  Sparkles,
  HelpCircle,
  SwitchCamera,
} from "lucide-react";
import { COINS, setPxPerCm, useAccess } from "@/lib/access";

export const Route = createFileRoute("/calibrate")({
  head: () => ({
    meta: [
      { title: "Calibrate the camera — InkSimulator" },
      {
        name: "description",
        content:
          "Calibrate the camera with a coin for millimeter-accurate AR measurement at 1:1 scale.",
      },
      { property: "og:title", content: "Calibrate the camera — InkSimulator" },
      {
        property: "og:description",
        content: "Give the app the right scale with a coin — 30 seconds.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.inksimulator.com/calibrate" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://www.inksimulator.com/calibrate" }],
  }),
  component: Calibrate,
});

const INITIAL_CIRCLE_PX = 120;

function Calibrate() {
  const navigate = useNavigate();
  const { subscribed } = useAccess();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [coinId, setCoinId] = useState<string | null>(null);
  const [circlePx, setCirclePx] = useState(INITIAL_CIRCLE_PX);
  const [ready, setReady] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");

  const isCard = coinId === "card";

  const coin = COINS.find((c) => c.id === coinId);

  const pxPerCm = useMemo(
    () => (coin ? circlePx / (coin.diameterMm / 10) : 0),
    [circlePx, coin],
  );

  useEffect(() => {
    let stream: MediaStream | null = null;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) return;
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facing } },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
        }
      } catch {
        /* silent */
      }
    })();
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, [facing]);

  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const startDist = useRef<{ dist: number; px: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      startDist.current = {
        dist: Math.hypot(b.x - a.x, b.y - a.y),
        px: circlePx,
      };
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && startDist.current) {
      const [a, b] = Array.from(pointers.current.values());
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      setCirclePx(
        Math.max(30, Math.min(700, startDist.current.px * (d / startDist.current.dist))),
      );
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) startDist.current = null;
  };

  const confirm = () => {
    if (!coin) return;
    setPxPerCm(pxPerCm);
    // Back to the AR view after calibration.
    navigate({ to: "/ar" });
  };

  const step = !coin ? 1 : 2;

  return (
    <div className="relative w-full h-[100dvh] bg-ink overflow-hidden text-foreground select-none">
      {/* Bright, undimmed camera feed */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={facing === "user" ? { transform: "scaleX(-1)" } : undefined}
      />
      {/* Only a light top/bottom fade so UI chrome remains legible; no full-screen dim */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-ink/70 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-ink via-ink/70 to-transparent" />

      {/* Header */}
      <div className="absolute inset-x-0 top-0 z-30 px-6 pt-[calc(1.25rem+env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-mono-caps text-[10px] text-accent">
              Calibration · Step {step} of 2
            </div>
            <div className="flex gap-1">
              {[1, 2].map((n) => (
                <div
                  key={n}
                  className={`h-1 w-6 rounded-full transition-colors ${
                    n <= step ? "bg-accent" : "bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setReady(false);
              setFacing((f) => (f === "environment" ? "user" : "environment"));
            }}
            className="glass px-3 py-1.5 rounded-full text-[9px] uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition"
            aria-label="Flip camera"
          >
            <SwitchCamera className="size-3" />
            Flip
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="glass px-3 py-1.5 rounded-full text-[9px] uppercase tracking-widest flex items-center gap-1.5 active:scale-95 transition"
          >
            <HelpCircle className="size-3" />
            Help
          </button>
          </div>
        </div>
      </div>

      {!coin ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-center px-6 overflow-y-auto no-scrollbar py-24">
          <div className="rounded-3xl border border-white/10 bg-ink/85 backdrop-blur-xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 text-mono-caps text-[9px] text-accent mb-3">
              <Ruler className="size-3" />
              Calibration · 30 seconds
            </div>
            <h1 className="font-display text-[26px] leading-[1.1] font-bold tracking-tight text-balance">
              Give the camera real scale with a coin or card
            </h1>
            <p className="mt-3 text-sm text-muted-foreground text-pretty leading-relaxed">
              Choose a coin you have in your pocket. In the next step you'll match
              it against a circle on the screen — then the app knows exactly how
              many millimeters a pixel corresponds to on your skin.
            </p>

            <ol className="mt-5 space-y-2.5">
              {[
                { icon: Coins, text: "Choose a coin or bank card" },
                { icon: Ruler, text: "Place it on your skin and match the shape" },
                { icon: Sparkles, text: "Done — try tattoos at 1:1 scale" },
              ].map((s, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="size-7 rounded-full bg-accent/15 border border-accent/30 grid place-items-center text-[10px] font-bold text-accent">
                    {i + 1}
                  </div>
                  <s.icon className="size-3.5 text-accent/70" />
                  <span className="text-xs text-foreground/80">{s.text}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 text-mono-caps text-[9px] text-muted-foreground mb-2">
              Choose reference
            </div>
            <div className="grid grid-cols-2 gap-2">
              {COINS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setCoinId(c.id);
                    setCirclePx(c.id === "card" ? 260 : INITIAL_CIRCLE_PX);
                  }}
                  className="group text-left rounded-2xl border border-white/10 bg-slate/80 hover:border-accent/60 active:scale-[0.98] transition p-3.5"
                >
                  <div className="flex items-start justify-between">
                    <div className="text-xl leading-none">{c.country}</div>
                    <div className="size-6 rounded-full border border-white/15 grid place-items-center">
                      <ArrowRight className="size-3 opacity-60" />
                    </div>
                  </div>
                  <div className="mt-2 text-sm font-bold leading-tight">
                    {c.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {c.id === "card" ? "Width" : "Diameter"} {c.diameterMm} mm
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate({ to: "/ar" })}
              className="mt-5 w-full text-center text-[11px] text-muted-foreground hover:text-foreground py-2"
            >
              Skip for now — <span className="text-accent underline underline-offset-4">calibrate later</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 z-[5]">
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />
            <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
          </div>

          <div
            className="absolute inset-0 z-10 touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/25"
                style={{ width: circlePx + 40, height: circlePx + 40 }}
              />
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15"
                style={{ width: circlePx + 80, height: circlePx + 80 }}
              />

              <div
                className={`relative border-2 border-accent shadow-[0_0_60px_rgba(138,91,242,0.45)] ${
                  isCard ? "rounded-xl" : "rounded-full"
                }`}
                style={{
                  width: circlePx,
                  height: isCard ? circlePx * (53.98 / 85.6) : circlePx,
                  background:
                    "repeating-conic-gradient(rgba(138,91,242,0.18) 0deg 8deg, transparent 8deg 16deg)",
                }}
              >
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-1.5 rounded-full bg-accent" />
                {[0, 90, 180, 270].map((deg) => (
                  <div
                    key={deg}
                    className="absolute left-1/2 top-1/2 w-px h-2 bg-accent"
                    style={{
                      transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-${circlePx / 2}px)`,
                    }}
                  />
                ))}
              </div>

              <div className="absolute left-1/2 -top-14 -translate-x-1/2 whitespace-nowrap text-center">
                <div className="glass px-3 py-1.5 rounded-full text-[10px] uppercase tracking-widest font-bold text-accent">
                  Match your {coin.label}
                </div>
                <div className="mt-1 text-[9px] text-white/80 drop-shadow">
                  {isCard ? "Width" : "Ø"} {coin.diameterMm} mm in real life
                </div>
              </div>

              <div className="absolute left-1/2 top-full mt-4 -translate-x-1/2 flex items-center gap-2 whitespace-nowrap">
                <div className="glass px-2.5 py-1 rounded-md text-[10px] font-mono">
                  {Math.round(circlePx)} px
                </div>
                <div className="text-[10px] text-accent font-bold">→</div>
                <div className="glass px-2.5 py-1 rounded-md text-[10px] font-mono text-accent">
                  {pxPerCm.toFixed(1)} px/cm
                </div>
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-20 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-8">
            <div className="rounded-2xl border border-white/10 bg-slate/85 backdrop-blur-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="size-8 rounded-full bg-accent/15 border border-accent/30 grid place-items-center text-[11px] font-bold text-accent flex-none">
                  2
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">
                    {isCard ? "Place the card on your skin" : "Place the coin on your skin"}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                    Place the <span className="text-accent font-bold">{coin.label}</span> where the tattoo should go. Adjust the circle below until it covers the coin exactly.
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-muted-foreground mb-1.5">
                  <span>Size</span>
                  <span className="text-accent font-bold">
                    {Math.round(circlePx)} px · pinch to fine-tune
                  </span>
                </div>
                <input
                  type="range"
                  min={40}
                  max={isCard ? 640 : 360}
                  value={circlePx}
                  onChange={(e) => setCirclePx(Number(e.target.value))}
                  className="w-full accent-[color:var(--accent)]"
                />
              </div>

              <button
                onClick={() => setCoinId(null)}
                className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                ← Change reference
              </button>
            </div>

            <button
              onClick={confirm}
              className="mt-3 w-full h-14 rounded-2xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition shadow-[0_10px_40px_-10px_rgba(138,91,242,0.5)]"
            >
              <Check className="size-4" strokeWidth={3} />
              Confirm calibration
              <ArrowRight className="size-4" />
            </button>
          </div>
        </>
      )}

      {!ready && !coin && (
        <div className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-[10px] uppercase tracking-widest text-white/80 z-20">
          Camera optional for calibration
        </div>
      )}

      {showHelp && (
        <div className="absolute inset-0 z-40 bg-ink/95 backdrop-blur-xl p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <div className="text-mono-caps text-accent text-[10px]">Help</div>
              <h2 className="font-display font-bold text-lg">Why calibrate?</h2>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="size-10 rounded-full glass grid place-items-center text-sm"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="space-y-4 text-sm text-foreground/85 leading-relaxed">
            <p>
              Every phone has a different camera, sensor and distance to the skin.
              Without calibration, a 10 cm tattoo could look like 6 cm — or 14.
            </p>
            <p>
              By matching a <span className="text-accent font-bold">coin with a known diameter</span>{" "}
              against the circle, the app knows exactly how many pixels a
              centimeter is right now. The printout will then be accurate to
              the millimeter.
            </p>
            <div className="rounded-xl border border-white/10 bg-slate/60 p-4">
              <div className="text-mono-caps text-[9px] text-accent mb-2">Tips</div>
              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li>· Hold the phone still and parallel to your skin</li>
                <li>· Use good lighting — avoid harsh shadows</li>
                <li>· Pinch with two fingers to fine-tune</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => setShowHelp(false)}
            className="mt-auto h-14 rounded-2xl bg-accent text-ink font-bold text-sm"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
