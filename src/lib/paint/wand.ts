/**
 * Magic wand: flood fill on the active layer's pixels into a selection mask.
 *
 * Pure canvas/typed-array work — no React, no DOM beyond the offscreen canvas
 * the mask lives on, so the result plugs straight into the normal selection.
 */

export interface WandResult {
  /** Document-sized mask: opaque inside the selection, transparent outside. */
  mask: HTMLCanvasElement;
  /** Number of selected pixels (0 = nothing matched). */
  count: number;
}

/** Tolerance slider range, in percent. */
export const WAND_TOLERANCE_MIN = 1;
export const WAND_TOLERANCE_MAX = 100;
export const WAND_TOLERANCE_DEFAULT = 24;

/**
 * Flood fills from (seedX, seedY) over pixels whose colour (and alpha) is
 * within `tolerance` percent of the seed. 4-connected, so the result matches
 * what the user sees as one continuous area.
 */
export function magicWandMask(
  source: HTMLCanvasElement,
  seedX: number,
  seedY: number,
  tolerance: number,
): WandResult | null {
  const width = source.width;
  const height = source.height;
  const sx = Math.floor(seedX);
  const sy = Math.floor(seedY);
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return null;

  const ctx = source.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, width, height).data;

  // Distances are compared in squared RGBA space; 100% ≈ the whole cube.
  const t = Math.max(WAND_TOLERANCE_MIN, Math.min(WAND_TOLERANCE_MAX, tolerance)) / 100;
  const limit = (t * 255) ** 2 * 4;

  const seed = (sy * width + sx) * 4;
  const sr = data[seed]!;
  const sg = data[seed + 1]!;
  const sb = data[seed + 2]!;
  const sa = data[seed + 3]!;

  const visited = new Uint8Array(width * height);
  const inside = new Uint8Array(width * height);
  const stack = new Int32Array(width * height);
  let top = 0;
  let count = 0;

  stack[top++] = sy * width + sx;
  visited[sy * width + sx] = 1;

  while (top > 0) {
    const index = stack[--top]!;
    const p = index * 4;
    const dr = data[p]! - sr;
    const dg = data[p + 1]! - sg;
    const db = data[p + 2]! - sb;
    const da = data[p + 3]! - sa;
    // Fully transparent pixels only match other transparent pixels loosely:
    // premultiplying by alpha keeps colour noise in cleared areas out.
    const alphaWeight = (data[p + 3]! + sa) / 510;
    const dist = (dr * dr + dg * dg + db * db) * alphaWeight + da * da;
    if (dist > limit) continue;

    inside[index] = 1;
    count++;

    const x = index % width;
    const y = (index - x) / width;
    if (x > 0 && !visited[index - 1]) {
      visited[index - 1] = 1;
      stack[top++] = index - 1;
    }
    if (x + 1 < width && !visited[index + 1]) {
      visited[index + 1] = 1;
      stack[top++] = index + 1;
    }
    if (y > 0 && !visited[index - width]) {
      visited[index - width] = 1;
      stack[top++] = index - width;
    }
    if (y + 1 < height && !visited[index + width]) {
      visited[index + width] = 1;
      stack[top++] = index + width;
    }
  }

  if (count === 0) return null;

  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const maskCtx = mask.getContext("2d");
  if (!maskCtx) return null;
  const out = maskCtx.createImageData(width, height);
  const pixels = out.data;
  for (let i = 0; i < inside.length; i++) {
    if (!inside[i]) continue;
    const p = i * 4;
    pixels[p] = 255;
    pixels[p + 1] = 255;
    pixels[p + 2] = 255;
    pixels[p + 3] = 255;
  }
  maskCtx.putImageData(out, 0, 0);

  return { mask, count };
}
