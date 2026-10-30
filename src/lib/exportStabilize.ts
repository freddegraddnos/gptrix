/**
 * Offline (post-recording) stabilization pass.
 *
 * Live preview has to be causal: every frame is placed using only what the
 * tracker knows *right now*, and the smoothing window has to stay short or
 * the tattoo lags behind the arm. Export has no such constraint — the whole
 * cylinder-space track is already on disk when the user stops recording, so
 * we can re-run it with a much wider, *non-causal* window that looks a few
 * frames into the future as well as the past. The result is a clip whose
 * placement is noticeably steadier than anything real time could produce.
 */

import type { Placement } from "./livePlacement";
import type { LimbCylinder } from "./limbCylinder";
import type { ManualAdjust } from "./tattooOverlay";

/** One recorded frame of the cylinder-space track. */
export type TrackSample = {
  /** Milliseconds since recording started. */
  t: number;
  placement: Placement | null;
  cylinder: LimbCylinder | null;
  adjust: ManualAdjust;
  /** Low-res alpha of the occluder layer (hands / sleeves / hair). */
  mask: { w: number; h: number; alpha: Uint8Array } | null;
};

/**
 * Half-width of the smoothing window in frames. ~7 frames each way is a
 * quarter-second of look-ahead at 30 fps — far more than live could afford.
 */
export const SMOOTH_RADIUS = 7;

/** Savitzky–Golay (quadratic) weights for a centered window of ±r frames. */
function sgWeights(r: number): number[] {
  const n = 2 * r + 1;
  // Least squares fit of a quadratic, evaluated at the window centre.
  let s0 = 0;
  let s2 = 0;
  let s4 = 0;
  for (let i = -r; i <= r; i++) {
    s0 += 1;
    s2 += i * i;
    s4 += i * i * i * i;
  }
  const det = s0 * s4 - s2 * s2 || 1;
  const w: number[] = new Array(n);
  for (let i = -r; i <= r; i++) {
    w[i + r] = (s4 - s2 * i * i) / det;
  }
  return w;
}

/** Centered, non-causal smoothing of one numeric channel. */
function smoothChannel(values: number[], radius: number): number[] {
  if (values.length < 3) return [...values];
  const r = Math.min(radius, Math.floor((values.length - 1) / 2));
  if (r < 1) return [...values];
  const w = sgWeights(r);
  return values.map((_, i) => {
    let sum = 0;
    let wsum = 0;
    for (let k = -r; k <= r; k++) {
      const j = i + k;
      if (j < 0 || j >= values.length) continue; // shrink window at the ends
      const weight = w[k + r];
      sum += values[j] * weight;
      wsum += weight;
    }
    return wsum ? sum / wsum : values[i];
  });
}

/** Angles need unwrapping before they can be averaged. */
function unwrap(values: number[]): number[] {
  const out = [...values];
  for (let i = 1; i < out.length; i++) {
    let d = out[i] - out[i - 1];
    while (d > Math.PI) {
      out[i] -= Math.PI * 2;
      d = out[i] - out[i - 1];
    }
    while (d < -Math.PI) {
      out[i] += Math.PI * 2;
      d = out[i] - out[i - 1];
    }
  }
  return out;
}

/**
 * Re-runs the recorded cylinder-space track through a wide, symmetric
 * smoothing window. Position, rotation, span, limb axis and the per-sample
 * cylinder radii are all filtered, so the geometry stays consistent with the
 * smoothed placement instead of only the anchor point being steady.
 */
export function smoothTrack(
  samples: TrackSample[],
  radius = SMOOTH_RADIUS,
): TrackSample[] {
  const idx = samples
    .map((s, i) => (s.placement ? i : -1))
    .filter((i) => i >= 0);
  if (idx.length < 3) return samples;

  const pick = (fn: (p: Placement) => number) =>
    idx.map((i) => fn(samples[i].placement!));

  const xs = smoothChannel(pick((p) => p.x), radius);
  const ys = smoothChannel(pick((p) => p.y), radius);
  const spans = smoothChannel(pick((p) => p.span), radius);
  const rots = smoothChannel(unwrap(pick((p) => p.rotation)), radius);
  const bends = smoothChannel(
    pick((p) => p.bendDeg ?? 180),
    radius,
  );
  const hasAxis = idx.every((i) => samples[i].placement!.axis);
  const ax = hasAxis ? smoothChannel(pick((p) => p.axis!.a.x), radius) : null;
  const ay = hasAxis ? smoothChannel(pick((p) => p.axis!.a.y), radius) : null;
  const bx = hasAxis ? smoothChannel(pick((p) => p.axis!.b.x), radius) : null;
  const by = hasAxis ? smoothChannel(pick((p) => p.axis!.b.y), radius) : null;

  // Cylinder radii: one channel per sample position along the axis.
  const radiiCount = samples[idx[0]].cylinder?.radii.length ?? 0;
  const radiiChannels: number[][] = [];
  const radiiOk =
    radiiCount > 0 &&
    idx.every((i) => samples[i].cylinder?.radii.length === radiiCount);
  if (radiiOk) {
    for (let k = 0; k < radiiCount; k++) {
      radiiChannels.push(
        smoothChannel(
          idx.map((i) => samples[i].cylinder!.radii[k]),
          radius,
        ),
      );
    }
  }

  const out = [...samples];
  idx.forEach((sampleIndex, n) => {
    const src = samples[sampleIndex];
    const p = src.placement!;
    out[sampleIndex] = {
      ...src,
      placement: {
        ...p,
        x: xs[n],
        y: ys[n],
        span: spans[n],
        rotation: rots[n],
        bendDeg: p.bendDeg == null ? null : bends[n],
        axis:
          hasAxis && ax && ay && bx && by
            ? {
                a: { ...p.axis!.a, x: ax[n], y: ay[n] },
                b: { ...p.axis!.b, x: bx[n], y: by[n] },
              }
            : p.axis,
      },
      cylinder: radiiOk
        ? {
            radii: radiiChannels.map((c) => c[n]),
            measured: src.cylinder!.measured,
          }
        : src.cylinder,
    };
  });
  return out;
}

/** Nearest recorded sample for a given playback time (ms). */
export function sampleAt(
  samples: TrackSample[],
  timeMs: number,
): TrackSample | null {
  if (!samples.length) return null;
  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t < timeMs) lo = mid + 1;
    else hi = mid;
  }
  const a = samples[Math.max(0, lo - 1)];
  const b = samples[lo];
  return Math.abs(a.t - timeMs) <= Math.abs(b.t - timeMs) ? a : b;
}

/** Waits for a seek to land, with a timeout so a stubborn frame can't hang. */
function seekTo(video: HTMLVideoElement, t: number) {
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      video.removeEventListener("seeked", finish);
      resolve();
    };
    video.addEventListener("seeked", finish);
    video.currentTime = t;
    window.setTimeout(finish, 600);
  });
}

/**
 * Steps through the raw recording frame by frame, hands each frame plus its
 * smoothed track sample to the caller for re-rendering, and encodes the
 * result. Runs faster or slower than real time — export can afford it.
 */
export async function reRenderStabilizedClip(opts: {
  raw: Blob;
  mime: string;
  width: number;
  height: number;
  fps?: number;
  samples: TrackSample[];
  /** Draws one finished frame into `ctx`. */
  drawFrame: (
    video: HTMLVideoElement,
    sample: TrackSample | null,
    ctx: CanvasRenderingContext2D,
  ) => void;
  onProgress?: (fraction: number) => void;
  signal?: { cancelled: boolean };
}): Promise<Blob | null> {
  const { raw, mime, width, height, samples, drawFrame } = opts;
  const fps = opts.fps ?? 30;
  if (!raw.size || !samples.length || !width || !height) return null;

  const url = URL.createObjectURL(raw);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("decode failed"));
      window.setTimeout(() => resolve(), 4000);
    });

    const trackMs = samples[samples.length - 1].t;
    const duration =
      Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(video.duration, trackMs / 1000 + 0.5)
        : trackMs / 1000;
    if (!duration || duration < 0.2) return null;

    const out = document.createElement("canvas");
    out.width = width;
    out.height = height;
    const ctx = out.getContext("2d");
    if (!ctx) return null;

    const stream = out.captureStream(0);
    const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack;
    const recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 6_000_000,
    });
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const finished = new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
    });
    recorder.start();

    const step = 1 / fps;
    const total = Math.max(1, Math.floor(duration / step));
    for (let i = 0; i < total; i++) {
      if (opts.signal?.cancelled) break;
      const t = i * step;
      await seekTo(video, Math.min(t, duration - 0.001));
      drawFrame(video, sampleAt(samples, t * 1000), ctx);
      track.requestFrame?.();
      if (i % 5 === 0) {
        opts.onProgress?.(i / total);
        // Let the encoder breathe so the tab stays responsive.
        await new Promise((r) => window.setTimeout(r, 0));
      }
    }

    recorder.stop();
    await finished;
    stream.getTracks().forEach((t) => t.stop());
    opts.onProgress?.(1);
    const blob = new Blob(chunks, { type: mime });
    return blob.size ? blob : null;
  } catch {
    return null;
  } finally {
    video.src = "";
    URL.revokeObjectURL(url);
  }
}
