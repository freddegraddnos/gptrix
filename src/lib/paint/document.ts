/**
 * Physical document scale.
 *
 * Everything the engine draws lives in document pixels. `mmPerPixel` is the
 * bridge to the real world: it says how many millimetres one document pixel
 * covers. That single number is what makes a sketch the same physical size on
 * an iPad, a phone and a desktop — the pixel density of the screen never enters
 * the maths, only the CSS reference pixel does.
 */

/** A CSS reference pixel is 1/96 inch by definition. */
export const MM_PER_CSS_PX = 25.4 / 96;

/** Default document scale: 2048 px across ≈ 205 mm (A4 width-ish). */
export const DEFAULT_MM_PER_PIXEL = 0.1;

/** Common print sheet sizes in millimetres (portrait). */
export const PAPER_SIZES = {
  a4: { widthMm: 210, heightMm: 297 },
  a3: { widthMm: 297, heightMm: 420 },
} as const;

/** Print resolutions offered when a document size is chosen in millimetres. */
export const DPI_OPTIONS = [150, 300] as const;
export const DEFAULT_DPI = 300;

/**
 * Shortcuts only — any width and height in millimetres can be typed freely.
 */
export const SIZE_PRESETS: { id: string; label: string; widthMm: number; heightMm: number }[] = [
  { id: "square100", label: "100 × 100", widthMm: 100, heightMm: 100 },
  { id: "square150", label: "150 × 150", widthMm: 150, heightMm: 150 },
  { id: "a5", label: "A5", widthMm: 148, heightMm: 210 },
  { id: "a4", label: "A4", widthMm: 210, heightMm: 297 },
  { id: "a3", label: "A3", widthMm: 297, heightMm: 420 },
];

/** Pixels needed to render `mm` millimetres at `dpi` dots per inch. */
export function pixelsForMm(mm: number, dpi: number): number {
  return Math.max(1, Math.round((mm / 25.4) * dpi));
}

/** Document scale implied by a print resolution. */
export function mmPerPixelForDpi(dpi: number): number {
  return dpi > 0 ? 25.4 / dpi : DEFAULT_MM_PER_PIXEL;
}


export interface PhysicalSize {
  widthMm: number;
  heightMm: number;
}

export function physicalSize(
  widthPx: number,
  heightPx: number,
  mmPerPixel: number,
): PhysicalSize {
  return { widthMm: widthPx * mmPerPixel, heightMm: heightPx * mmPerPixel };
}

/** mmPerPixel that makes a `widthPx`-wide document exactly `widthMm` wide. */
export function mmPerPixelFor(widthPx: number, widthMm: number): number {
  if (widthPx <= 0 || widthMm <= 0) return DEFAULT_MM_PER_PIXEL;
  return widthMm / widthPx;
}

/** Dots per inch implied by a document scale. */
export function dpiOf(mmPerPixel: number): number {
  return mmPerPixel > 0 ? 25.4 / mmPerPixel : 0;
}

/**
 * Viewport scale that renders the document at true physical size on screen.
 * doc px -> mm -> CSS px.
 */
export function actualSizeScale(mmPerPixel: number): number {
  return mmPerPixel / MM_PER_CSS_PX;
}

/** "12,4 cm" / "34 mm" — short, locale-friendly readout. */
export function formatMm(mm: number): string {
  if (mm >= 100) return `${(mm / 10).toFixed(1).replace(".", ",")} cm`;
  return `${Math.round(mm)} mm`;
}
