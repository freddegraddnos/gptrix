/**
 * Stencil generator.
 *
 * A stencil is the sketch reduced to pure line: every pixel is either ink or
 * nothing, so a thermal printer or a stencil transfer produces crisp lines
 * instead of muddy grey. The generator never resamples — it works on the
 * document's own pixels, so the millimetre scale set on the canvas carries
 * straight through to `printAtActualSize`.
 *
 * No React here; canvas 2D only.
 */

export interface StencilOptions {
  /** 0-255 luminance cut-off: darker than this becomes ink. */
  threshold: number;
  /** Ink colour; stencil paper is usually traced in purple/blue. */
  ink: string;
  /** Mirror horizontally — needed when the stencil is pressed onto skin. */
  mirror: boolean;
  /** White paper behind the ink (off = transparent PNG). */
  opaqueBackground: boolean;
}

export const DEFAULT_STENCIL: StencilOptions = {
  threshold: 170,
  ink: "#1b1b1f",
  mirror: false,
  opaqueBackground: true,
};

export const STENCIL_INKS = [
  { id: "black", label: "Svart", value: "#1b1b1f" },
  { id: "violet", label: "Violett", value: "#5b2d8e" },
  { id: "blue", label: "Blue", value: "#1c4f9c" },
];

function parseHex(hex: string): [number, number, number] {
  const v = hex.replace("#", "");
  const n = parseInt(v.length === 3 ? v.replace(/(.)/g, "$1$1") : v, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * Turns artwork into a stencil of the same pixel size (and therefore the same
 * physical size). Semi-transparent pixels are composited over white first, so
 * soft airbrush edges threshold predictably instead of vanishing.
 */
export function makeStencil(source: HTMLCanvasElement, options: StencilOptions): HTMLCanvasElement {
  const { width, height } = source;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  const src = source.getContext("2d");
  if (!ctx || !src) return out;

  const input = src.getImageData(0, 0, width, height);
  const data = input.data;
  const result = ctx.createImageData(width, height);
  const rgb = result.data;
  const [ir, ig, ib] = parseHex(options.ink);
  const paper = options.opaqueBackground ? 255 : 0;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3]! / 255;
    // Composite over white, then measure perceptual luminance.
    const r = data[i]! * a + 255 * (1 - a);
    const g = data[i + 1]! * a + 255 * (1 - a);
    const b = data[i + 2]! * a + 255 * (1 - a);
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (lum <= options.threshold) {
      rgb[i] = ir;
      rgb[i + 1] = ig;
      rgb[i + 2] = ib;
      rgb[i + 3] = 255;
    } else {
      rgb[i] = 255;
      rgb[i + 1] = 255;
      rgb[i + 2] = 255;
      rgb[i + 3] = paper;
    }
  }

  ctx.putImageData(result, 0, 0);

  if (!options.mirror) return out;

  const mirrored = document.createElement("canvas");
  mirrored.width = width;
  mirrored.height = height;
  const mctx = mirrored.getContext("2d");
  if (!mctx) return out;
  mctx.translate(width, 0);
  mctx.scale(-1, 1);
  mctx.drawImage(out, 0, 0);
  return mirrored;
}

/** Small preview for the UI, scaled down to fit `maxPx` on the long edge. */
export function stencilPreview(stencil: HTMLCanvasElement, maxPx = 240): string {
  const scale = Math.min(1, maxPx / Math.max(stencil.width, stencil.height));
  if (scale >= 1) return stencil.toDataURL("image/png");
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(stencil.width * scale));
  small.height = Math.max(1, Math.round(stencil.height * scale));
  const ctx = small.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(stencil, 0, 0, small.width, small.height);
  }
  return small.toDataURL("image/png");
}

/** Bounding box of the ink pixels, in document pixels. Null when empty. */
export function inkBounds(
  stencil: HTMLCanvasElement,
  options: StencilOptions,
): { x: number; y: number; width: number; height: number } | null {
  const ctx = stencil.getContext("2d");
  if (!ctx) return null;
  const { width, height } = stencil;
  const { data } = ctx.getImageData(0, 0, width, height);
  const [ir, ig, ib] = parseHex(options.ink);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3]! < 8) continue;
      // Ink is written as a flat colour, so an exact-ish match is enough.
      if (
        Math.abs(data[i]! - ir) > 6 ||
        Math.abs(data[i + 1]! - ig) > 6 ||
        Math.abs(data[i + 2]! - ib) > 6
      )
        continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}
