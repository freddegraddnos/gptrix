/**
 * Scene light estimation.
 *
 * A tattoo only looks glued to skin when its shading agrees with the light in
 * the room. We approximate the dominant light direction by downsampling the
 * camera frame and measuring the luminance gradient across it: the brightest
 * side is where the light comes from.
 */

export type LightEstimate = {
  /** -1 = light from the left, +1 = light from the right. */
  x: number;
  /** -1 = light from above, +1 = light from below. */
  y: number;
  /** 0 = flat, even light; 1 = hard directional light. */
  strength: number;
  /** Average scene luminance, 0..1. */
  luminance: number;
};

export const NEUTRAL_LIGHT: LightEstimate = {
  x: 0,
  y: -0.35,
  strength: 0.35,
  luminance: 0.5,
};

const GRID = 9;

/**
 * Estimates the dominant light direction from a video frame.
 * Returns null when the frame is not ready yet.
 */
export function estimateLight(
  video: HTMLVideoElement | HTMLCanvasElement,
): LightEstimate | null {
  const vw =
    "videoWidth" in video ? video.videoWidth || video.width : video.width;
  const vh =
    "videoHeight" in video ? video.videoHeight || video.height : video.height;
  if (!vw || !vh) return null;

  const c = document.createElement("canvas");
  c.width = GRID;
  c.height = GRID;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  try {
    ctx.drawImage(video as CanvasImageSource, 0, 0, GRID, GRID);
  } catch {
    return null;
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, GRID, GRID).data;
  } catch {
    return null;
  }

  const lum: number[] = [];
  let sum = 0;
  let min = 1;
  let max = 0;
  for (let i = 0; i < GRID * GRID; i++) {
    const r = data[i * 4] / 255;
    const g = data[i * 4 + 1] / 255;
    const b = data[i * 4 + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lum.push(l);
    sum += l;
    if (l < min) min = l;
    if (l > max) max = l;
  }
  const mean = sum / lum.length;
  if (mean <= 0) return null;

  // Luminance-weighted centroid: pulls toward the bright side of the frame.
  let wx = 0;
  let wy = 0;
  let wsum = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const l = lum[y * GRID + x];
      const w = Math.max(0, l - mean); // only the brighter-than-average part
      wx += (((x + 0.5) / GRID) * 2 - 1) * w;
      wy += (((y + 0.5) / GRID) * 2 - 1) * w;
      wsum += w;
    }
  }
  const dirX = wsum > 0 ? wx / wsum : 0;
  const dirY = wsum > 0 ? wy / wsum : -0.35;

  const contrast = Math.max(0, Math.min(1, (max - min) / Math.max(0.08, max)));
  const mag = Math.min(1, Math.hypot(dirX, dirY) * 1.6);
  const strength = Math.max(0, Math.min(1, contrast * 0.6 + mag * 0.6));

  return {
    x: Math.max(-1, Math.min(1, dirX * 1.8)),
    y: Math.max(-1, Math.min(1, dirY * 1.8)),
    strength,
    luminance: mean,
  };
}

/** Eases a new estimate toward the previous one so lighting never flickers. */
export function smoothLight(
  prev: LightEstimate | null,
  next: LightEstimate,
  alpha = 0.25,
): LightEstimate {
  if (!prev) return next;
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
    strength: prev.strength + (next.strength - prev.strength) * alpha,
    luminance: prev.luminance + (next.luminance - prev.luminance) * alpha,
  };
}

/** True when two estimates differ enough to justify re-rendering the motif. */
export function lightChanged(
  a: LightEstimate | null,
  b: LightEstimate | null,
): boolean {
  if (!a || !b) return a !== b;
  return (
    Math.abs(a.x - b.x) > 0.08 ||
    Math.abs(a.y - b.y) > 0.08 ||
    Math.abs(a.strength - b.strength) > 0.08 ||
    Math.abs(a.luminance - b.luminance) > 0.06
  );
}
