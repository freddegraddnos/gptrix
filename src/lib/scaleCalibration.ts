/**
 * Distance-aware 1:1 scale.
 *
 * A coin/card calibration only tells us how many screen pixels one centimetre
 * covered *at that distance*. As soon as the camera moves closer or further
 * away, the same centimetre covers a different number of pixels, so a design
 * that was 8 cm wide silently becomes 6 or 11 cm.
 *
 * The monitor solves that by locking the same anchor constellation the skin
 * tracker uses onto the area under the design at the moment of calibration.
 * The constellation's spread grows and shrinks exactly in proportion to
 * 1 / distance, so:
 *
 *   pxPerCm(now) = pxPerCm(calibrated) * spread(now) / spread(calibrated)
 *
 * That ratio is all we need: multiply the design's scale by the same ratio and
 * the physical size stays constant in centimetres while the user moves.
 */

import { createRegionTracker, type TrackRegion } from "./arTracker";

export type DistanceSample = {
  /** Current distance ratio relative to the calibration frame. */
  rel: number;
  /** 0..1 match quality of the constellation. */
  confidence: number;
};

/** Ratios outside this range are physically implausible for a handheld shot. */
const MIN_REL = 0.4;
const MAX_REL = 2.6;

export function createDistanceMonitor(
  video: HTMLVideoElement,
  region: TrackRegion,
) {
  let tracker = createRegionTracker(video, region);
  let rel = 1;
  let weak = 0;

  return {
    get ok() {
      return tracker.ok;
    },
    /** Re-learns the reference patch — call after a big move or a lost track. */
    reanchor(next: TrackRegion, keepRel = true) {
      tracker = createRegionTracker(video, next);
      if (!keepRel) rel = 1;
      weak = 0;
      return tracker.ok;
    },
    update(): DistanceSample | null {
      const res = tracker.update();
      if (!res) return null;
      if (res.confidence < 0.3) {
        weak++;
        // Unknown, not "moved": hold the last good ratio.
        return { rel, confidence: res.confidence };
      }
      weak = 0;
      const target = Math.min(MAX_REL, Math.max(MIN_REL, res.scale));
      // Heavier damping than the placement tracker — size must never breathe.
      rel += (target - rel) * (0.06 + 0.14 * res.confidence);
      return { rel, confidence: res.confidence };
    },
    /** True when the reference has been unreliable for a while. */
    get stale() {
      return weak > 25;
    },
    get rel() {
      return rel;
    },
  };
}

/**
 * Screen-space rect -> video-space region, accounting for object-cover fit and
 * front-camera mirroring (the preview is flipped, the pixels are not).
 */
export function screenRegionToVideo(
  video: HTMLVideoElement,
  rect: { width: number; height: number },
  center: { x: number; y: number },
  sizePx: number,
  mirrored: boolean,
): TrackRegion | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const s = Math.max(rect.width / vw, rect.height / vh);
  const vx = (center.x - (rect.width - vw * s) / 2) / s;
  const vy = (center.y - (rect.height - vh * s) / 2) / s;
  return {
    cx: mirrored ? vw - vx : vx,
    cy: vy,
    w: sizePx / s,
    h: sizePx / s,
  };
}

/** Reference objects the user can hold up against the skin. */
export const SCALE_REFERENCES = [
  { id: "card", label: "Bank card", widthCm: 8.56, shape: "card" as const },
  { id: "sek-5", label: "Swedish 5 kr", widthCm: 2.375, shape: "coin" as const },
  { id: "sek-10", label: "Swedish 10 kr", widthCm: 2.05, shape: "coin" as const },
  { id: "eur-1", label: "1 Euro", widthCm: 2.325, shape: "coin" as const },
  { id: "usd-quarter", label: "US quarter", widthCm: 2.426, shape: "coin" as const },
];

/* ---------------------------------------------------------------------------
 * Live outline feedback
 *
 * While the user matches the outline to a coin or a card we score how well the
 * drawn edge coincides with a real edge in the camera image: for a set of
 * points along the outline we compare the luminance just inside with the
 * luminance just outside. On the rim of a coin that difference is large and
 * consistent all the way around; on empty skin it is noise. That single number
 * drives the progress ring, the hint text and the auto-confirm.
 * ------------------------------------------------------------------------- */

const ROI = 128; // sampling canvas resolution
let roiCanvas: HTMLCanvasElement | null = null;

function roiCtx() {
  if (!roiCanvas) {
    roiCanvas = document.createElement("canvas");
    roiCanvas.width = ROI;
    roiCanvas.height = ROI;
  }
  return roiCanvas.getContext("2d", { willReadFrequently: true });
}

/** Outline points with outward normals, in unit space around the centre. */
function outlinePoints(shape: "coin" | "card", n = 56) {
  const pts: Array<{ x: number; y: number; nx: number; ny: number }> = [];
  if (shape === "coin") {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) / 2;
      const y = Math.sin(a) / 2;
      pts.push({ x, y, nx: Math.cos(a), ny: Math.sin(a) });
    }
    return pts;
  }
  for (let i = 0; i < n; i++) {
    const t = (i / n) * 4;
    const side = Math.floor(t);
    const f = t - side - 0.5;
    if (side === 0) pts.push({ x: f, y: -0.5, nx: 0, ny: -1 });
    else if (side === 1) pts.push({ x: 0.5, y: f, nx: 1, ny: 0 });
    else if (side === 2) pts.push({ x: -f, y: 0.5, nx: 0, ny: 1 });
    else pts.push({ x: -0.5, y: -f, nx: -1, ny: 0 });
  }
  return pts;
}

export type OutlineFeedback = {
  /** 0..1 — how convincingly a real edge follows the outline. */
  score: number;
  /** 0..1 — brightness headroom; low means "too dark to measure". */
  light: number;
};

export function scoreOutlineMatch(
  video: HTMLVideoElement,
  rect: { width: number; height: number },
  center: { x: number; y: number },
  widthPx: number,
  heightPx: number,
  shape: "coin" | "card",
  mirrored: boolean,
): OutlineFeedback | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return null;
  const ctx = roiCtx();
  if (!ctx) return null;

  // Screen -> video pixels (object-cover fit, mirrored preview for selfie cam).
  const s = Math.max(rect.width / vw, rect.height / vh);
  const toVideoX = (x: number) => {
    const vx = (x - (rect.width - vw * s) / 2) / s;
    return mirrored ? vw - vx : vx;
  };
  const cx = toVideoX(center.x);
  const cy = (center.y - (rect.height - vh * s) / 2) / s;
  const boxW = (widthPx / s) * 1.5;
  const boxH = (heightPx / s) * 1.5;
  const sx = cx - boxW / 2;
  const sy = cy - boxH / 2;
  if (sx < -boxW || sy < -boxH || sx > vw || sy > vh) return null;

  ctx.clearRect(0, 0, ROI, ROI);
  try {
    ctx.drawImage(video, sx, sy, boxW, boxH, 0, 0, ROI, ROI);
  } catch {
    return null;
  }
  const img = ctx.getImageData(0, 0, ROI, ROI).data;
  const lum = (px: number, py: number) => {
    const x = Math.max(0, Math.min(ROI - 1, Math.round(px)));
    const y = Math.max(0, Math.min(ROI - 1, Math.round(py)));
    const i = (y * ROI + x) * 4;
    return 0.299 * img[i] + 0.587 * img[i + 1] + 0.114 * img[i + 2];
  };

  // The outline occupies 1/1.5 of the ROI box.
  const halfW = ROI / 1.5 / 2;
  const halfH = (ROI / 1.5) * (heightPx / widthPx) / 2;
  const step = Math.max(2, ROI * 0.035);

  const pts = outlinePoints(shape);
  let sum = 0;
  let strong = 0;
  let mean = 0;
  for (const p of pts) {
    const px = ROI / 2 + p.x * halfW * 2;
    const py = ROI / 2 + p.y * halfH * 2;
    const inside = lum(px - p.nx * step, py - p.ny * step);
    const outside = lum(px + p.nx * step, py + p.ny * step);
    const d = Math.abs(inside - outside);
    mean += (inside + outside) / 2;
    sum += d;
    if (d > 12) strong++;
  }
  const avgDiff = sum / pts.length;
  const coverage = strong / pts.length;
  // Both a strong average edge and an edge that goes all the way around.
  const score = Math.max(
    0,
    Math.min(1, (avgDiff / 26) * 0.55 + coverage * 0.45),
  );
  return { score, light: Math.min(1, mean / pts.length / 90) };
}
