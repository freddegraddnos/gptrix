export type InkBounds = { x: number; y: number; w: number; h: number };
/** Bounds of black ink, excluding transparent and white margins. */
export function stencilInkBounds(data: ArrayLike<number>, width: number, height: number): InkBounds | null {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 128 || (data[i] + data[i + 1] + data[i + 2]) / 3 >= 128) continue;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
  }
  return right < left ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}
export function normalizeInkBounds(b: InkBounds, w: number, h: number): InkBounds {
  return { x: b.x / w, y: b.y / h, w: b.w / w, h: b.h / h };
}
export function scaledInkBounds(b: InkBounds, w: number, h: number): InkBounds {
  return { x: b.x * w, y: b.y * h, w: b.w * w, h: b.h * h };
}
export function stencilSourceSize(widthMm: number, heightMm: number, b: InkBounds) {
  return { w: widthMm / b.w, h: heightMm / b.h };
}