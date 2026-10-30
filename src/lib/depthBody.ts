/**
 * Real 3D body shape from a monocular depth map (del A, /arv2 only).
 *
 * The browser cannot run DensePose, so the body form comes from Depth
 * Anything V2 (small) running fully on-device via transformers.js. The model
 * is lazy-loaded from a CDN and never enters the app bundle (this project
 * builds for the edge). When the model cannot load, the engine falls back to
 * the existing chamfer pseudo-depth measured from the person mask, so the
 * page keeps working with no download at all.
 *
 * Depth convention everywhere in this module: 0 = far (silhouette edge),
 * 1 = closest point of the person.
 */

import { pseudoDepth } from "@/lib/pseudoDepth";
import type { SegMask } from "@/lib/personSegmentation";

export const TRANSFORMERS_URL =
  "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5";
export const DEPTH_MODEL = "onnx-community/depth-anything-v2-small";

/** Width the video frame is downscaled to before inference. */
const ESTIMATE_W = 336;
/** Minimum time between model inferences — depth moves slowly, poses do not. */
const MIN_INTERVAL_MS = 250;

export type DepthFrame = {
  /** Normalised relative depth, 0..1, 1 = closest. Row-major, width*height. */
  depth: Float32Array;
  width: number;
  height: number;
};

export type DepthEngineMode = "model" | "pseudo";

type RawDepthImage = {
  data: Uint8ClampedArray | Float32Array;
  width: number;
  height: number;
  channels: number;
};

type DepthPipelineResult = {
  predicted_depth?: { data: ArrayLike<number>; dims?: number[] } | null;
  depth?: RawDepthImage | null;
} | null;

type DepthPipeline = {
  (input: HTMLCanvasElement): Promise<DepthPipelineResult>;
  close?: () => void;
};

type TransformersModule = {
  pipeline: (
    task: string,
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<DepthPipeline>;
};

/**
 * Normalises raw depth inside the person mask to 0..1 (1 = closest).
 * Background pixels never influence the range, so a dark wall behind the
 * arm cannot trick the warp into flattening the limb.
 */
export function normalizeDepthInMask(
  depth: Float32Array,
  mask: Uint8Array | null,
  isPerson: (v: number) => boolean = (v) => v !== 0,
): Float32Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < depth.length; i++) {
    if (mask && !isPerson(mask[i])) continue;
    const v = depth[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const out = new Float32Array(depth.length);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max - min < 1e-6) {
    // No usable person pixels: flat surface rather than garbage.
    out.fill(1);
    return out;
  }
  const span = max - min;
  for (let i = 0; i < depth.length; i++) {
    out[i] = Math.max(0, Math.min(1, (depth[i] - min) / span));
  }
  return out;
}

/** Packs a normalised depth field into a single-channel luminance texture. */
export function depthToBytes(depth: Float32Array, out?: Uint8Array): Uint8Array {
  const bytes = out && out.length === depth.length ? out : new Uint8Array(depth.length);
  for (let i = 0; i < depth.length; i++) {
    bytes[i] = Math.round(Math.max(0, Math.min(1, depth[i])) * 255);
  }
  return bytes;
}

/**
 * Lambert shading from a surface normal against a light direction.
 * Returns 0..1 — 1 when the surface faces the light fully.
 */
export function lambertShade(
  nx: number,
  ny: number,
  nz: number,
  lx: number,
  ly: number,
  lz: number,
): number {
  const nl = Math.hypot(nx, ny, nz);
  const ll = Math.hypot(lx, ly, lz);
  if (nl < 1e-9 || ll < 1e-9) return 1;
  return Math.max(0, Math.min(1, (nx * lx + ny * ly + nz * lz) / (nl * ll)));
}

/**
 * Fallback depth from the person mask alone (chamfer distance transform):
 * 0 at the silhouette edge, 1 at the thickest interior point.
 */
export function pseudoDepthFromMask(
  mask: Uint8Array,
  width: number,
  height: number,
  isPerson: (v: number) => boolean = (v) => v !== 0,
): Float32Array {
  const { depth, max } = pseudoDepth(mask, width, height, isPerson);
  if (max < 1e-6) {
    const flat = new Float32Array(depth.length);
    flat.fill(1);
    return flat;
  }
  for (let i = 0; i < depth.length; i++) depth[i] /= max;
  return depth;
}

/**
 * Runs Depth Anything V2 (small) on-device, with the chamfer pseudo-depth as
 * a zero-download fallback. `request()` is throttled; `latest` always holds
 * the newest finished frame so the render loop never waits on inference.
 */
export class DepthEngine {
  mode: DepthEngineMode = "model";
  latest: DepthFrame | null = null;
  private pipe: DepthPipeline | null = null;
  private loading: Promise<DepthEngineMode> | null = null;
  private failed = false;
  private canvas: HTMLCanvasElement | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private lastRun = 0;
  private inFlight = false;
  private smoothed: Float32Array | null = null;

  /** Starts loading the model (once); resolves with the engine mode. */
  ensure(): Promise<DepthEngineMode> {
    if (!this.loading) this.loading = this.init();
    return this.loading;
  }

  private async init(): Promise<DepthEngineMode> {
    if (this.failed) return (this.mode = "pseudo");
    const mod = await this.loadTransformers();
    if (!mod) return (this.mode = "pseudo");
    const attempts: Record<string, unknown>[] = [];
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      attempts.push({ device: "webgpu", dtype: "fp16" });
    }
    attempts.push({ device: "wasm", dtype: "q8" });
    for (const options of attempts) {
      try {
        this.pipe = await mod.pipeline("depth-estimation", DEPTH_MODEL, options);
        this.mode = "model";
        return "model";
      } catch (e) {
        console.warn("Depth model load failed for options", options, e);
      }
    }
    this.failed = true;
    this.mode = "pseudo";
    return "pseudo";
  }

  private async loadTransformers(): Promise<TransformersModule | null> {
    try {
      return (await import(/* @vite-ignore */ TRANSFORMERS_URL)) as TransformersModule;
    } catch (e) {
      console.warn("transformers.js unavailable, depth falls back to mask", e);
      return null;
    }
  }

  /**
   * Throttled entry point for the render loop. Kicks off inference when due
   * and returns the newest finished depth frame (or null before the first).
   */
  request(
    video: HTMLVideoElement,
    mask: SegMask | null,
    now: number,
  ): DepthFrame | null {
    if (now - this.lastRun < MIN_INTERVAL_MS || this.inFlight) return this.latest;
    if (video.videoWidth < 2 || video.videoHeight < 2) return this.latest;
    this.lastRun = now;
    if (this.mode === "pseudo" || !this.pipe) {
      if (mask) {
        this.latest = {
          depth: pseudoDepthFromMask(mask.data, mask.width, mask.height),
          width: mask.width,
          height: mask.height,
        };
      }
      return this.latest;
    }
    this.inFlight = true;
    void this.runModel(video, mask).finally(() => {
      this.inFlight = false;
    });
    return this.latest;
  }

  private async runModel(video: HTMLVideoElement, mask: SegMask | null) {
    const pipe = this.pipe;
    if (!pipe) return;
    try {
      const w = ESTIMATE_W;
      const h = Math.max(2, Math.round((ESTIMATE_W * video.videoHeight) / video.videoWidth));
      if (!this.canvas) {
        this.canvas = document.createElement("canvas");
        this.ctx2d = this.canvas.getContext("2d", { willReadFrequently: true });
      }
      const c = this.canvas;
      if (!c || !this.ctx2d) return;
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
      this.ctx2d.drawImage(video, 0, 0, w, h);
      const out = await pipe(c);
      const raw = out?.depth;
      if (!raw || !raw.width || !raw.height) return;
      const ch = Math.max(1, raw.channels || 1);
      const rawDepth = new Float32Array(raw.width * raw.height);
      for (let i = 0; i < rawDepth.length; i++) rawDepth[i] = Number(raw.data[i * ch]);
      // Depth Anything: larger = closer. Mask-normalise and time-smooth.
      const normalised = normalizeDepthInMask(
        rawDepth,
        mask
          ? resampleMask(mask, raw.width, raw.height)
          : null,
      );
      this.latest = {
        depth: this.smoothed
          ? smoothDepth(this.smoothed, normalised)
          : normalised,
        width: raw.width,
        height: raw.height,
      };
      this.smoothed = Float32Array.from(this.latest.depth);
    } catch (e) {
      console.warn("Depth inference failed this frame", e);
    }
  }

  /** Best-effort release of the on-device session. */
  dispose(): void {
    try {
      this.pipe?.close?.();
    } catch {
      /* ignore */
    }
    this.pipe = null;
    this.latest = null;
    this.smoothed = null;
  }
}

/** Resamples the person mask onto the depth grid with nearest neighbour. */
export function resampleMask(
  mask: SegMask,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const sy = Math.min(mask.height - 1, Math.round((y / height) * mask.height));
    for (let x = 0; x < width; x++) {
      const sx = Math.min(mask.width - 1, Math.round((x / width) * mask.width));
      out[y * width + x] = mask.data[sy * mask.width + sx];
    }
  }
  return out;
}

/**
 * Per-pixel exponential smoothing between depth frames. The model only runs
 * a few times per second, so the blend stops the body form from stepping;
 * the tracked pose itself is already One Euro filtered upstream.
 */
export function smoothDepth(
  prev: Float32Array,
  next: Float32Array,
  alpha = 0.35,
): Float32Array {
  if (prev.length !== next.length) return Float32Array.from(next);
  const out = new Float32Array(next.length);
  for (let i = 0; i < next.length; i++) {
    out[i] = prev[i] + (next[i] - prev[i]) * alpha;
  }
  return out;
}
