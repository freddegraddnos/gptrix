/**
 * "Trace to lines": edge detection that turns an imported photo into pure
 * black line art on a transparent background.
 *
 * Framework-agnostic, like the rest of src/lib/paint. The source canvas is only
 * ever read — the result is always returned as a fresh canvas, so the caller
 * can drop it on a new layer and leave the original photo untouched.
 */

export interface EdgeSettings {
  /**
   * 0..100. Higher means more edges survive (lower gradient threshold), so the
   * result gets more detail — and more noise.
   */
  sensitivity: number;
  /**
   * 0..100 hard cut on edge strength. Every pixel weaker than this is dropped
   * entirely, so raising it burns away faint, grey half-edges and leaves only
   * the confident lines. 0 keeps the soft ramp untouched.
   */
  threshold: number;
}

export const DEFAULT_EDGES: EdgeSettings = { sensitivity: 45, threshold: 0 };
export const EDGE_SENSITIVITY_MIN = 1;
export const EDGE_SENSITIVITY_MAX = 100;
export const EDGE_THRESHOLD_MIN = 0;
export const EDGE_THRESHOLD_MAX = 100;

function createCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Luminance buffer with a light 3×3 box blur, to keep sensor noise out. */
function luminance(data: Uint8ClampedArray, w: number, h: number): Float32Array {
  const raw = new Float32Array(w * h);
  for (let i = 0, p = 0; i < raw.length; i++, p += 4) {
    // Unpainted (transparent) pixels read as paper white so they yield no edge.
    const a = data[p + 3]! / 255;
    const l = 0.2126 * data[p]! + 0.7152 * data[p + 1]! + 0.0722 * data[p + 2]!;
    raw[i] = l * a + 255 * (1 - a);
  }
  const blur = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += raw[yy * w + xx]!;
          n++;
        }
      }
      blur[y * w + x] = sum / n;
    }
  }
  return blur;
}

/**
 * Sobel edge detection in document resolution. The output is black where an
 * edge was found, fully transparent everywhere else.
 */
export function detectEdges(
  source: HTMLCanvasElement,
  settings: EdgeSettings,
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const out = createCanvas(w, h);
  const octx = out.getContext("2d")!;
  const sctx = source.getContext("2d");
  if (!sctx || w < 3 || h < 3) return out;

  const src = sctx.getImageData(0, 0, w, h);
  const lum = luminance(src.data, w, h);

  // Sensitivity 1..100 → gradient threshold ~160 down to ~12.
  const t = Math.min(100, Math.max(1, settings.sensitivity)) / 100;
  const threshold = 160 - t * 148;
  const soft = threshold * 0.6;
  // The threshold is an absolute gradient floor: raising it removes weak,
  // low-contrast edges (soft shadows, film grain) and keeps the crisp ones.
  const magCut = Math.min(100, Math.max(0, settings.threshold ?? 0)) * 6;

  const dst = octx.createImageData(w, h);
  const px = dst.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = lum[i - w - 1]!;
      const tc = lum[i - w]!;
      const tr = lum[i - w + 1]!;
      const ml = lum[i - 1]!;
      const mr = lum[i + 1]!;
      const bl = lum[i + w - 1]!;
      const bc = lum[i + w]!;
      const br = lum[i + w + 1]!;
      const gx = tr + 2 * mr + br - (tl + 2 * ml + bl);
      const gy = bl + 2 * bc + br - (tl + 2 * tc + tr);
      const mag = Math.sqrt(gx * gx + gy * gy);
      // magCut is the artist-set hard floor: too weak to count as a line.
      if (mag <= soft || mag < magCut) continue;
      // Soft ramp up to the threshold keeps the lines from looking jagged.
      const a = mag >= threshold ? 1 : (mag - soft) / (threshold - soft);
      const p = i * 4;
      px[p] = 0;
      px[p + 1] = 0;
      px[p + 2] = 0;
      px[p + 3] = Math.round(a * 255);
    }
  }
  octx.putImageData(dst, 0, 0);
  return out;
}

/**
 * Picks a sensitivity automatically for a photo, so the artist gets a usable
 * line layer with one tap instead of hunting on the slider.
 *
 * The gradient magnitudes are histogrammed and we choose the threshold that
 * makes roughly `targetCoverage` of the pixels turn into ink — a stable target
 * across bright, dark and low-contrast photos.
 */
export function autoSensitivity(source: HTMLCanvasElement, targetCoverage = 0.035): number {
  const w = source.width;
  const h = source.height;
  const sctx = source.getContext("2d");
  if (!sctx || w < 3 || h < 3) return DEFAULT_EDGES.sensitivity;

  const lum = luminance(sctx.getImageData(0, 0, w, h).data, w, h);
  // Histogram of gradient magnitude, 1 bucket per unit up to 512.
  const buckets = new Int32Array(513);
  let total = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        lum[i - w + 1]! + 2 * lum[i + 1]! + lum[i + w + 1]! -
        (lum[i - w - 1]! + 2 * lum[i - 1]! + lum[i + w - 1]!);
      const gy =
        lum[i + w - 1]! + 2 * lum[i + w]! + lum[i + w + 1]! -
        (lum[i - w - 1]! + 2 * lum[i - w]! + lum[i - w + 1]!);
      const mag = Math.min(512, Math.round(Math.sqrt(gx * gx + gy * gy)));
      buckets[mag] = (buckets[mag] ?? 0) + 1;
      total++;
    }
  }
  if (total === 0) return DEFAULT_EDGES.sensitivity;

  // Walk down from the strongest edges until the wanted coverage is reached.
  const wanted = total * Math.min(0.3, Math.max(0.005, targetCoverage));
  let seen = 0;
  let threshold = 160;
  for (let m = 512; m >= 1; m--) {
    seen += buckets[m] ?? 0;
    if (seen >= wanted) {
      threshold = m;
      break;
    }
  }
  // Never dive into the noise floor: a clean drawing needs far less coverage
  // than a photo, and a too-low threshold would ink the whole canvas.
  threshold = Math.min(160, Math.max(30, threshold));
  // Invert the sensitivity → threshold mapping used by detectEdges.
  const sensitivity = ((160 - threshold) / 148) * 100;
  return Math.min(EDGE_SENSITIVITY_MAX, Math.max(EDGE_SENSITIVITY_MIN, Math.round(sensitivity)));
}

/**
 * Removes isolated speckles from a line result: connected groups of inked
 * pixels smaller than `minPixels` are erased. Keeps auto-generated line art
 * from looking like sensor noise, without touching real lines.
 */
export function despeckle(canvas: HTMLCanvasElement, minPixels = 12): HTMLCanvasElement {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext("2d");
  if (!ctx || w < 2 || h < 2) return canvas;

  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const group = new Int32Array(1024);

  for (let start = 0; start < w * h; start++) {
    if (seen[start] || px[start * 4 + 3]! < 24) continue;
    let top = 0;
    let count = 0;
    stack[top++] = start;
    seen[start] = 1;
    let overflow = false;
    while (top > 0) {
      const i = stack[--top]!;
      if (count < group.length) group[count] = i;
      else overflow = true;
      count++;
      if (overflow && count > minPixels) break;
      const x = i % w;
      const y = (i - x) / w;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          const j = yy * w + xx;
          if (seen[j] || px[j * 4 + 3]! < 24) continue;
          seen[j] = 1;
          stack[top++] = j;
        }
      }
    }
    if (count < minPixels && count <= group.length) {
      for (let k = 0; k < count; k++) px[group[k]! * 4 + 3] = 0;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
