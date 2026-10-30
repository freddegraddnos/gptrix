/**
 * Background / colour removal used by the upload tool and the AI generator.
 *
 * Improvements over a plain "exact colour = alpha 0" cut:
 *  - soft feather band so anti-aliased edges fade instead of leaving a halo
 *  - colour spill suppression (un-premultiplies the key colour out of edge pixels)
 *  - optional edge-connected mode so white *inside* a motif is preserved
 */

export type RemovalOptions = {
  /** Colour to knock out, 0-255 */
  color: { r: number; g: number; b: number };
  /** Distance (0-140) that is fully transparent */
  tolerance: number;
  /** Extra distance band that fades from transparent to opaque */
  feather?: number;
  /** Only remove pixels connected to the image border */
  edgesOnly?: boolean;
};

export const DEFAULT_KEY = { r: 255, g: 255, b: 255 };

export function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** Returns a NEW ImageData with the key colour removed. Does not mutate input. */
export function removeColor(source: ImageData, opts: RemovalOptions): ImageData {
  const { color, tolerance } = opts;
  const feather = Math.max(1, opts.feather ?? Math.max(12, tolerance * 0.6));
  const w = source.width;
  const h = source.height;
  const out = new ImageData(new Uint8ClampedArray(source.data), w, h);
  const d = out.data;
  const n = w * h;

  // 1. per-pixel distance -> alpha factor
  const alpha = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const dr = d[i] - color.r;
    const dg = d[i + 1] - color.g;
    const db = d[i + 2] - color.b;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    if (dist <= tolerance) alpha[p] = 0;
    else if (dist >= tolerance + feather) alpha[p] = 1;
    else alpha[p] = (dist - tolerance) / feather;
  }

  // 2. optionally restrict to the region connected to the border
  if (opts.edgesOnly) {
    const reach = new Uint8Array(n);
    const stack: number[] = [];
    const push = (p: number) => {
      if (!reach[p] && alpha[p] < 1) {
        reach[p] = 1;
        stack.push(p);
      }
    };
    for (let x = 0; x < w; x++) {
      push(x);
      push((h - 1) * w + x);
    }
    for (let y = 0; y < h; y++) {
      push(y * w);
      push(y * w + w - 1);
    }
    while (stack.length) {
      const p = stack.pop() as number;
      const x = p % w;
      const y = (p / w) | 0;
      if (x > 0) push(p - 1);
      if (x < w - 1) push(p + 1);
      if (y > 0) push(p - w);
      if (y < h - 1) push(p + w);
    }
    for (let p = 0; p < n; p++) if (!reach[p]) alpha[p] = 1;
  }

  // 3. write alpha + suppress colour spill on partially transparent pixels
  for (let p = 0; p < n; p++) {
    const a = alpha[p];
    const i = p * 4;
    if (a >= 1) continue;
    if (a <= 0) {
      d[i + 3] = 0;
      continue;
    }
    d[i] = (d[i] - color.r * (1 - a)) / a;
    d[i + 1] = (d[i + 1] - color.g * (1 - a)) / a;
    d[i + 2] = (d[i + 2] - color.b * (1 - a)) / a;
    d[i + 3] = Math.round(d[i + 3] * a);
  }

  return out;
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

/** Convenience: run removal on a data URL and return a transparent PNG data URL. */
export async function removeBackgroundFromDataUrl(
  src: string,
  opts?: Partial<RemovalOptions> & { maxSize?: number },
): Promise<string> {
  const img = await loadImage(src);
  const max = opts?.maxSize ?? 1024;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const result = removeColor(data, {
    color: opts?.color ?? DEFAULT_KEY,
    tolerance: opts?.tolerance ?? 48,
    feather: opts?.feather,
    edgesOnly: opts?.edgesOnly ?? false,
  });
  ctx.clearRect(0, 0, w, h);
  ctx.putImageData(result, 0, 0);
  return canvas.toDataURL("image/png");
}
