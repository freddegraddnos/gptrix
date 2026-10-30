/**
 * Object picking for the arrow ("pointer") tool.
 *
 * The arrow tool never paints: it hit-tests whole objects — text layers and
 * imported images — and drags them around. Everything here is pure canvas
 * maths so the tool stays independent of the stroke engine, the selection
 * mask and the transform session.
 */

import type { Rect } from "./types";

/** Alpha (0..255) at a document point, or 0 outside the canvas. */
export function alphaAt(canvas: HTMLCanvasElement, x: number, y: number): number {
  const px = Math.floor(x);
  const py = Math.floor(y);
  if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return 0;
  const ctx = canvas.getContext("2d");
  if (!ctx) return 0;
  return ctx.getImageData(px, py, 1, 1).data[3] ?? 0;
}

/** Anything above this counts as "the user tapped the object". */
export const HIT_ALPHA = 8;

/** Grows a rect by a screen-constant margin so the frame hugs the artwork. */
export function padRect(rect: Rect, pad: number, width: number, height: number): Rect {
  const x = Math.max(0, rect.x - pad);
  const y = Math.max(0, rect.y - pad);
  const right = Math.min(width, rect.x + rect.w + pad);
  const bottom = Math.min(height, rect.y + rect.h + pad);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

/** True when the point is inside the rect (used for grabbing a picked object). */
export function insideRect(rect: Rect, x: number, y: number): boolean {
  return x >= rect.x && y >= rect.y && x <= rect.x + rect.w && y <= rect.y + rect.h;
}

/**
 * Selection frame for a picked object: an axis-aligned box with eight handles,
 * drawn in document space with screen-constant weights.
 */
export function drawObjectFrame(ctx: CanvasRenderingContext2D, rect: Rect, scale: number) {
  const { x, y, w, h } = rect;
  const r = 5 / scale;
  const handles = [
    { x, y },
    { x: x + w / 2, y },
    { x: x + w, y },
    { x: x + w, y: y + h / 2 },
    { x: x + w, y: y + h },
    { x: x + w / 2, y: y + h },
    { x, y: y + h },
    { x, y: y + h / 2 },
  ];

  ctx.save();
  ctx.lineJoin = "round";

  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3 / scale;
  ctx.strokeRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.25 / scale;
  ctx.strokeRect(x, y, w, h);

  for (const p of handles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.98)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1.25 / scale;
    ctx.stroke();
  }
  ctx.restore();
}
