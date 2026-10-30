import { useCallback, useEffect, useRef, useState } from "react";
import { Check, CreditCard, Ruler, X } from "lucide-react";
import { SCALE_REFERENCES, scoreOutlineMatch } from "@/lib/scaleCalibration";
import { detectCard, type CardDetection } from "@/lib/cardDetect";

/**
 * In-camera 1:1 calibration.
 *
 * Two ways in:
 *  - Smart: hold up a bank card, the camera finds it by itself, draws a frame
 *    around it and asks you to approve the reading before it is applied.
 *  - Manual: match an outline to a coin or a card, as before.
 *
 * A close button sits in the corner at all times, so a failed calibration is
 * always one tap away from being dismissed.
 */

const HOLD_MS = 900; // how long a good match must persist before auto-lock
const GOOD = 0.55;
const CARD_HOLD_MS = 700;
const CARD_WIDTH_CM = 8.56;

type Box = { x: number; y: number; w: number; h: number };

export function ScaleCalibrator({
  video,
  stage,
  mirrored,
  onConfirm,
  onClose,
}: {
  video: HTMLVideoElement | null;
  stage: HTMLElement | null;
  mirrored: boolean;
  onConfirm: (pxPerCm: number, refWidthPx: number) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"smart" | "manual">("smart");
  const [refId, setRefId] = useState(SCALE_REFERENCES[0].id);
  const [widthPx, setWidthPx] = useState(180);
  const [score, setScore] = useState(0);
  const [light, setLight] = useState(1);
  const [progress, setProgress] = useState(0);
  const [auto, setAuto] = useState(true);
  const drag = useRef<{ x: number; y: number; w: number } | null>(null);
  const dragging = useRef(false);
  const reference =
    SCALE_REFERENCES.find((r) => r.id === refId) ?? SCALE_REFERENCES[0];
  const pxPerCm = widthPx / reference.widthCm;
  const heightPx =
    reference.shape === "card" ? widthPx * (5.398 / 8.56) : widthPx;

  const confirm = useCallback(() => {
    onConfirm(widthPx / reference.widthCm, widthPx);
  }, [onConfirm, reference.widthCm, widthPx]);

  // --- Smart card detection ----------------------------------------------
  const [card, setCard] = useState<CardDetection | null>(null);
  const [cardBox, setCardBox] = useState<Box | null>(null); // in stage CSS px
  const [cardHold, setCardHold] = useState(0);
  // Frozen candidate waiting for the user's approval.
  const [pending, setPending] = useState<{ box: Box; pxPerCm: number; widthPx: number } | null>(
    null,
  );
  const workRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (mode !== "smart" || pending || !video || !stage) return;
    if (!workRef.current) workRef.current = document.createElement("canvas");
    let raf = 0;
    let last = 0;
    let held = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = last ? t - last : 0;
      if (dt < 130) return;
      last = t;
      const det = detectCard(video, workRef.current!);
      setCard(det);
      const rect = stage.getBoundingClientRect();
      const vw = video.videoWidth || 1;
      const vh = video.videoHeight || 1;
      // The feed is rendered object-cover: work out the on-screen geometry.
      const scale = Math.max(rect.width / vw, rect.height / vh);
      const dispW = vw * scale;
      const dispH = vh * scale;
      const offX = (rect.width - dispW) / 2;
      const offY = (rect.height - dispH) / 2;
      if (det.box) {
        const bx = mirrored ? 1 - det.box.x - det.box.w : det.box.x;
        const box: Box = {
          x: offX + bx * dispW,
          y: offY + det.box.y * dispH,
          w: det.box.w * dispW,
          h: det.box.h * dispH,
        };
        setCardBox(box);
        if (det.status === "ok") {
          held = Math.min(CARD_HOLD_MS, held + dt);
          setCardHold(held / CARD_HOLD_MS);
          if (held >= CARD_HOLD_MS) {
            const px = Math.max(box.w, box.h);
            setPending({ box, pxPerCm: px / CARD_WIDTH_CM, widthPx: px });
          }
          return;
        }
      } else {
        setCardBox(null);
      }
      held = Math.max(0, held - dt);
      setCardHold(held / CARD_HOLD_MS);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, pending, video, stage, mirrored]);

  // --- Live match scoring (manual mode) -----------------------------------
  const state = useRef({ score: 0, held: 0, last: 0 });
  useEffect(() => {
    if (mode !== "manual" || !video || !stage) return;
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const st = state.current;
      const dt = st.last ? t - st.last : 0;
      if (dt < 90) return;
      st.last = t;
      const rect = stage.getBoundingClientRect();
      const fb = scoreOutlineMatch(
        video,
        rect,
        { x: rect.width / 2, y: rect.height / 2 },
        widthPx,
        heightPx,
        reference.shape,
        mirrored,
      );
      if (!fb) return;
      // Smooth so the ring does not flicker with sensor noise.
      st.score += (fb.score - st.score) * 0.3;
      setScore(st.score);
      setLight(fb.light);
      const good = st.score >= GOOD && !dragging.current;
      st.held = good ? Math.min(HOLD_MS, st.held + dt) : Math.max(0, st.held - dt * 1.5);
      setProgress(st.held / HOLD_MS);
      if (auto && st.held >= HOLD_MS) {
        st.held = 0;
        confirm();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [mode, video, stage, widthPx, heightPx, reference.shape, mirrored, auto, confirm]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, w: widthPx };
    dragging.current = true;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const delta = Math.hypot(e.clientX - d.x, e.clientY - d.y);
    const sign = e.clientX - d.x + (e.clientY - d.y) >= 0 ? 1 : -1;
    setWidthPx(Math.max(40, Math.min(520, d.w + sign * delta)));
  };
  const onPointerUp = () => {
    drag.current = null;
    dragging.current = false;
  };

  const tip =
    light < 0.28
      ? "Too dark — move into better light"
      : dragging.current
        ? "Release when the outline sits on the edge"
        : score < 0.28
          ? `Place the ${reference.label.toLowerCase()} inside the outline`
          : score < GOOD
            ? "Almost — drag the outline until it hugs the edge"
            : progress > 0.05
              ? "Hold still — locking 1:1…"
              : "Edge found — hold still";

  const ringSize = Math.max(widthPx, heightPx) + 34;
  const r = ringSize / 2 - 4;
  const circ = 2 * Math.PI * r;
  const ringColor =
    score >= GOOD ? "var(--color-accent, #8A5BF2)" : "rgba(255,255,255,0.35)";

  const frame = pending?.box ?? cardBox;

  return (
    <div className="absolute inset-0 z-40">
      {/* Always-available escape hatch */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close calibration"
        className="absolute right-4 top-[calc(1rem+env(safe-area-inset-top))] z-50 grid size-11 place-items-center rounded-full border border-white/15 bg-ink/80 backdrop-blur-md active:scale-95 transition"
      >
        <X className="size-5" />
      </button>

      {mode === "smart" ? (
        <>
          {/* Detection frame over the card */}
          {frame && (
            <div
              className="pointer-events-none absolute rounded-lg border-2 transition-[border-color,background-color] duration-150"
              style={{
                left: frame.x,
                top: frame.y,
                width: frame.w,
                height: frame.h,
                borderColor:
                  pending || card?.status === "ok"
                    ? "var(--color-accent, #8A5BF2)"
                    : "rgba(255,255,255,0.45)",
                background:
                  pending || card?.status === "ok"
                    ? "color-mix(in oklab, var(--color-accent, #8A5BF2) 12%, transparent)"
                    : "transparent",
                boxShadow: pending ? "0 0 0 9999px rgba(5,5,5,0.55)" : undefined,
              }}
            />
          )}

          <div className="absolute inset-x-0 bottom-0 space-y-4 bg-gradient-to-t from-ink via-ink/92 to-transparent p-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-accent" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-accent">
                Smart calibration
              </span>
            </div>

            {pending ? (
              <>
                <p className="text-sm font-semibold">Card found — does the frame fit?</p>
                <p className="text-xs text-muted-foreground">
                  It should hug the card's edges. Approve and every centimetre in
                  the camera becomes real size ({pending.pxPerCm.toFixed(1)} px / cm).
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPending(null)}
                    className="flex-1 min-h-12 rounded-2xl border border-white/15 text-sm font-bold hover:bg-white/5"
                  >
                    Try again
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirm(pending.pxPerCm, pending.widthPx)}
                    className="flex-1 min-h-12 rounded-2xl bg-accent text-ink text-sm font-bold flex items-center justify-center gap-2"
                  >
                    <Check className="size-4" /> Looks right
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold">
                  {card?.message ?? "Hold a bank card against the spot"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Any standard bank or ID card works — it is always 8.56 cm wide.
                  Hold it flat against the skin where the tattoo goes.
                </p>
                <div className="h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-accent transition-[width] duration-150"
                    style={{ width: `${Math.round(cardHold * 100)}%` }}
                  />
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setPending(null);
                setMode("manual");
              }}
              className="w-full min-h-11 rounded-2xl border border-white/10 text-xs font-bold text-muted-foreground hover:bg-white/5"
            >
              Not working? Match an outline by hand
            </button>
          </div>
        </>
      ) : (
        <>
          {/* Progress ring around the outline */}
          <svg
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            width={ringSize}
            height={ringSize}
            aria-hidden
          >
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={3}
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={r}
              fill="none"
              stroke={ringColor}
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={circ * (1 - Math.max(progress, score * 0.35))}
              transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
              style={{ transition: "stroke-dashoffset 90ms linear" }}
            />
          </svg>

          {/* Outline the user matches against the real object */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 touch-none"
            style={{ width: widthPx, height: heightPx }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <div
              className={`w-full h-full border-2 transition-colors ${
                score >= GOOD
                  ? "border-accent bg-accent/15"
                  : "border-white/60 bg-white/5"
              } ${reference.shape === "card" ? "rounded-xl" : "rounded-full"}`}
            />
            <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-ink/80 px-3 py-1 text-[10px] uppercase tracking-widest text-accent backdrop-blur-md">
              {tip}
            </div>
          </div>

          {/* Controls */}
          <div className="absolute inset-x-0 bottom-0 space-y-4 bg-gradient-to-t from-ink via-ink/90 to-transparent p-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2">
              <Ruler className="size-4 text-accent" />
              <span className="text-mono-caps text-[10px] text-accent">
                Calibrate 1:1 scale
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground tabular-nums">
                match {Math.round(score * 100)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Hold the object flat against the spot where the tattoo goes and drag
              the outline until the ring turns violet.
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {SCALE_REFERENCES.map((r2) => (
                <button
                  key={r2.id}
                  type="button"
                  onClick={() => setRefId(r2.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs ${
                    r2.id === refId
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-white/10 bg-white/5 text-foreground/80"
                  }`}
                >
                  {r2.label}
                </button>
              ))}
            </div>

            <input
              type="range"
              min={40}
              max={520}
              value={Math.round(widthPx)}
              onChange={(e) => setWidthPx(Number(e.target.value))}
              aria-label="Fine-tune the outline size"
              className="w-full accent-accent"
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setAuto((a) => !a)}
                className={`rounded-full border px-3 py-1.5 text-[11px] ${
                  auto
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-white/10 bg-white/5 text-muted-foreground"
                }`}
              >
                Auto-lock {auto ? "on" : "off"}
              </button>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {pxPerCm.toFixed(1)} px / cm
              </span>
              <button
                type="button"
                onClick={confirm}
                className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-ink"
              >
                <Check className="size-4" /> Confirm
              </button>
            </div>
            <button
              type="button"
              onClick={() => setMode("smart")}
              className="w-full min-h-11 rounded-2xl border border-white/10 text-xs font-bold text-muted-foreground hover:bg-white/5"
            >
              Back to smart card detection
            </button>
          </div>
        </>
      )}
    </div>
  );
}
