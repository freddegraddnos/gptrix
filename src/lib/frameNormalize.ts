/**
 * Frame normalization for the vision models.
 *
 * Landmark and segmentation models are trained on well-exposed footage. On
 * darker skin, in warm indoor light, or in a low-contrast scene the local
 * contrast the models rely on collapses and their confidence drops — which is
 * exactly the failure mode that makes AR try-on feel worse for some users than
 * for others.
 *
 * So every frame is normalized before it reaches a model: we convert to a
 * luminance/chroma space and run CLAHE (contrast-limited adaptive histogram
 * equalization) on the luminance channel only. CLAHE equalizes in small tiles
 * and clips the histogram, so it lifts local detail (pores, hair, the limb
 * edge) without blowing out highlights or shifting skin colour — the chroma
 * channels are untouched, so tone matching still sees the real skin colour.
 *
 * If OpenCV is not available the raw video is passed through unchanged: the
 * pipeline degrades to previous behaviour rather than stopping.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadOpenCV, opencvReady, type CV } from "./opencvLoader";

/** Models run happily at this width; smaller keeps CLAHE cheap on mobile. */
const PROC_WIDTH = 640;
const CLIP_LIMIT = 2.5;
const TILES = 8;

export function createFrameNormalizer(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  let cv: CV | null = opencvReady();
  let clahe: any = null;
  let disposed = false;
  let lastLuma = 128;

  if (!cv) {
    void loadOpenCV().then((ok) => {
      if (!disposed && ok) cv = opencvReady();
    });
  }

  const ensureClahe = () => {
    if (!cv) return null;
    if (!clahe) {
      try {
        clahe = new cv.CLAHE(CLIP_LIMIT, new cv.Size(TILES, TILES));
      } catch {
        clahe = null;
      }
    }
    return clahe;
  };

  return {
    /** Mean scene luminance (0-255) of the last raw frame. */
    get luminance() {
      return lastLuma;
    },
    get active() {
      return !!cv && !!clahe;
    },
    /**
     * Returns a canvas with the CLAHE-normalized frame, or the raw video when
     * OpenCV is not ready. Either value can be handed straight to a MediaPipe
     * `detectForVideo` call; landmarks come back normalized either way.
     */
    frame(): HTMLCanvasElement | HTMLVideoElement {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (disposed || !ctx || !cv || !vw || !vh || video.readyState < 2)
        return video;
      const c = ensureClahe();
      if (!c) return video;

      const k = Math.min(1, PROC_WIDTH / vw);
      const w = Math.max(2, Math.round(vw * k));
      const h = Math.max(2, Math.round(vh * k));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      let src: any = null;
      let ycrcb: any = null;
      let channels: any = null;
      try {
        ctx.drawImage(video, 0, 0, w, h);
        src = cv.imread(canvas);
        ycrcb = new cv.Mat();
        cv.cvtColor(src, ycrcb, cv.COLOR_RGBA2RGB);
        cv.cvtColor(ycrcb, ycrcb, cv.COLOR_RGB2YCrCb);
        channels = new cv.MatVector();
        cv.split(ycrcb, channels);
        const y = channels.get(0);
        lastLuma = cv.mean(y)[0] ?? lastLuma;
        c.apply(y, y);
        channels.set(0, y);
        cv.merge(channels, ycrcb);
        cv.cvtColor(ycrcb, ycrcb, cv.COLOR_YCrCb2RGB);
        cv.cvtColor(ycrcb, ycrcb, cv.COLOR_RGB2RGBA);
        cv.imshow(canvas, ycrcb);
        y.delete();
        return canvas;
      } catch {
        return video;
      } finally {
        src?.delete();
        ycrcb?.delete();
        channels?.delete();
      }
    },
    dispose() {
      disposed = true;
      try {
        clahe?.delete?.();
      } catch {
        /* runtime already gone */
      }
      clahe = null;
    },
  };
}

export type FrameNormalizer = ReturnType<typeof createFrameNormalizer>;

/* -------------------------------------------------------------------------
 * Confidence telemetry
 *
 * Used while testing across skin tones and lighting setups: it prints the
 * models' own scores next to the measured scene luminance, so an inconsistency
 * shows up as a number rather than as "it feels worse on my arm".
 * Enable with `localStorage.setItem("inkvision.debug.cv", "1")`.
 * ---------------------------------------------------------------------- */

type ConfBucket = { n: number; sum: number; min: number; max: number };
const buckets = new Map<string, ConfBucket>();
let lastLog = 0;

/** Reads the best available confidence out of a MediaPipe result. */
export function resultConfidence(res: any): number | null {
  const hand = res?.handedness?.[0]?.[0]?.score ?? res?.handednesses?.[0]?.[0]?.score;
  if (typeof hand === "number") return hand;
  const marks = res?.landmarks?.[0];
  if (Array.isArray(marks) && marks.length) {
    // Pose landmarks carry per-point visibility; the mean is a fair proxy.
    let sum = 0;
    let n = 0;
    for (const p of marks) {
      const v = p?.visibility;
      if (typeof v === "number") {
        sum += v;
        n++;
      }
    }
    if (n) return sum / n;
    return 1; // landmarks present, model exposes no score
  }
  return null;
}

/** Buckets scores by scene brightness and prints a summary twice a minute. */
export function logConfidence(
  score: number | null,
  luminance: number,
  normalized: boolean,
) {
  if (score == null) return;
  const tone =
    luminance < 70 ? "dark/low-light" : luminance < 140 ? "mid" : "bright";
  const key = `${tone}${normalized ? " +CLAHE" : " raw"}`;
  const b = buckets.get(key) ?? { n: 0, sum: 0, min: 1, max: 0 };
  b.n++;
  b.sum += score;
  b.min = Math.min(b.min, score);
  b.max = Math.max(b.max, score);
  buckets.set(key, b);

  const now = performance.now();
  if (now - lastLog < 30_000) return;
  lastLog = now;
  const rows: Record<string, unknown> = {};
  for (const [k, v] of buckets) {
    rows[k] = {
      samples: v.n,
      avg: +(v.sum / v.n).toFixed(3),
      min: +v.min.toFixed(3),
      max: +v.max.toFixed(3),
    };
  }
  // eslint-disable-next-line no-console
  console.table(rows);
}
