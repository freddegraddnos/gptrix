/**
 * Free transform of a lifted pixel region: move, scale, rotate.
 *
 * The session keeps the pixels it lifted in `source` (its own canvas) and the
 * rest of the layer in `base`, so nothing on the layer changes until the
 * transform is applied. Everything here is document-space maths: the same
 * matrix drives the on-screen preview and the final document-resolution draw,
 * so what you see is exactly what gets stamped down.
 */

import type { Rect } from "./types";

export type TransformHandle = "nw" | "ne" | "se" | "sw" | "rotate" | "move";

/** Corner handles and their local sign in the (unrotated) box frame. */
const CORNERS: Record<"nw" | "ne" | "se" | "sw", { sx: number; sy: number }> = {
  nw: { sx: -1, sy: -1 },
  ne: { sx: 1, sy: -1 },
  se: { sx: 1, sy: 1 },
  sw: { sx: -1, sy: 1 },
};

/** Smallest box we allow, in document pixels (avoids collapsing to nothing). */
const MIN_SIZE = 8;
/** Distance from the top edge to the rotation handle, in screen pixels. */
const ROTATE_OFFSET = 34;
/** Handle grab radius, in screen pixels. */
const GRAB_RADIUS = 13;

export interface Point {
  x: number;
  y: number;
}

export interface TransformState {
  layerId: string;
  /** The layer's pixels with the lifted region removed. */
  base: HTMLCanvasElement;
  /** The lifted pixels, at `srcRect` size and document resolution. */
  source: HTMLCanvasElement;
  /** Where the pixels were lifted from. */
  srcRect: Rect;
  /**
   * Hard-edged mask the pixels were lifted through, when a selection was
   * active. Erasing through this mask avoids the faint halo that erasing
   * through the anti-aliased artwork itself would leave behind.
   */
  liftMask: HTMLCanvasElement | null;
  /** Box centre in document space. */
  cx: number;
  cy: number;
  /** Current box size in document space. */
  w: number;
  h: number;
  /** Rotation in radians, clockwise, around the centre. */
  angle: number;
}

export interface DragState {
  handle: TransformHandle;
  /** Pointer position where the drag started (document space). */
  from: Point;
  /** Box snapshot when the drag started. */
  start: { cx: number; cy: number; w: number; h: number; angle: number };
}

/* ------------------------------------------------------------------ frame */

/** Local box axes in document space. */
function axes(angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { u: { x: cos, y: sin }, v: { x: -sin, y: cos } };
}

function pointAt(t: TransformState, sx: number, sy: number): Point {
  const { u, v } = axes(t.angle);
  const hx = (sx * t.w) / 2;
  const hy = (sy * t.h) / 2;
  return { x: t.cx + u.x * hx + v.x * hy, y: t.cy + u.y * hx + v.y * hy };
}

/** The four corners, in document space, in nw/ne/se/sw order. */
export function corners(t: TransformState): Point[] {
  return [
    pointAt(t, -1, -1),
    pointAt(t, 1, -1),
    pointAt(t, 1, 1),
    pointAt(t, -1, 1),
  ];
}

/** Rotation handle position; sits a screen-constant distance above the box. */
export function rotateHandle(t: TransformState, scale: number): Point {
  const { u, v } = axes(t.angle);
  const top = { x: t.cx - v.x * (t.h / 2), y: t.cy - v.y * (t.h / 2) };
  const out = ROTATE_OFFSET / scale;
  void u;
  return { x: top.x - v.x * out, y: top.y - v.y * out };
}

/** The matrix that maps source pixels (0,0)-(sw,sh) into document space. */
export function matrixOf(t: TransformState): DOMMatrix {
  const sw = t.srcRect.w || 1;
  const sh = t.srcRect.h || 1;
  return new DOMMatrix()
    .translateSelf(t.cx, t.cy)
    .rotateSelf((t.angle * 180) / Math.PI)
    .scaleSelf(t.w / sw, t.h / sh)
    .translateSelf(-sw / 2, -sh / 2);
}

/** Document-space bounding box of the transformed region, clamped and padded. */
export function transformedBounds(
  t: TransformState,
  width: number,
  height: number,
  pad = 2,
): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of corners(t)) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const x = Math.max(0, Math.floor(minX) - pad);
  const y = Math.max(0, Math.floor(minY) - pad);
  const right = Math.min(width, Math.ceil(maxX) + pad);
  const bottom = Math.min(height, Math.ceil(maxY) + pad);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/** Smallest rect containing both inputs, clamped to the document. */
export function unionRect(a: Rect, b: Rect, width: number, height: number): Rect {
  const x = Math.max(0, Math.min(a.x, b.x));
  const y = Math.max(0, Math.min(a.y, b.y));
  const right = Math.min(width, Math.max(a.x + a.w, b.x + b.w));
  const bottom = Math.min(height, Math.max(a.y + a.h, b.y + b.h));
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/* --------------------------------------------------------------- hit test */

/** Which handle sits under a document-space point, if any. */
export function hitTest(t: TransformState, p: Point, scale: number): TransformHandle | null {
  const grab = GRAB_RADIUS / scale;
  const rot = rotateHandle(t, scale);
  if (Math.hypot(p.x - rot.x, p.y - rot.y) <= grab) return "rotate";

  const names: TransformHandle[] = ["nw", "ne", "se", "sw"];
  const pts = corners(t);
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i]!;
    if (Math.hypot(p.x - c.x, p.y - c.y) <= grab) return names[i]!;
  }

  // Inside the box (measured in the rotated frame) = move.
  const { u, v } = axes(t.angle);
  const dx = p.x - t.cx;
  const dy = p.y - t.cy;
  const local = { x: dx * u.x + dy * u.y, y: dx * v.x + dy * v.y };
  if (Math.abs(local.x) <= t.w / 2 + grab && Math.abs(local.y) <= t.h / 2 + grab) return "move";
  return null;
}

/* ----------------------------------------------------------------- drags */

/** Applies a drag to the box. Mutates `t`; safe to call every pointer move. */
export function applyDrag(
  t: TransformState,
  drag: DragState,
  p: Point,
  options: { uniform?: boolean; snap?: boolean } = {},
) {
  const { start } = drag;

  if (drag.handle === "move") {
    t.cx = start.cx + (p.x - drag.from.x);
    t.cy = start.cy + (p.y - drag.from.y);
    return;
  }

  if (drag.handle === "rotate") {
    const a0 = Math.atan2(drag.from.y - start.cy, drag.from.x - start.cx);
    const a1 = Math.atan2(p.y - start.cy, p.x - start.cx);
    let angle = start.angle + (a1 - a0);
    if (options.snap) {
      const step = Math.PI / 12; // 15 degrees
      angle = Math.round(angle / step) * step;
    }
    t.angle = angle;
    return;
  }

  // Corner scaling: the opposite corner stays pinned.
  const corner = CORNERS[drag.handle];
  const { u, v } = axes(start.angle);
  const base: TransformState = { ...t, ...start };
  const anchor = pointAt(base, -corner.sx, -corner.sy);

  const dx = p.x - anchor.x;
  const dy = p.y - anchor.y;
  let w = (dx * u.x + dy * u.y) * corner.sx;
  let h = (dx * v.x + dy * v.y) * corner.sy;
  w = Math.max(MIN_SIZE, w);
  h = Math.max(MIN_SIZE, h);

  if (options.uniform) {
    const k = Math.max(w / start.w, h / start.h);
    w = start.w * k;
    h = start.h * k;
  }

  t.w = w;
  t.h = h;
  t.angle = start.angle;
  t.cx = anchor.x + u.x * (corner.sx * w) / 2 + v.x * (corner.sy * h) / 2;
  t.cy = anchor.y + u.y * (corner.sx * w) / 2 + v.y * (corner.sy * h) / 2;
}

/* ---------------------------------------------------------------- content */

/**
 * Tight bounding box of everything non-transparent on a canvas, or null when it
 * is empty. Used so "transform layer" grabs the artwork, not the whole sheet.
 */
/**
 * Removes the lifted pixels from a layer context: a flat clear of the crop when
 * the whole region was lifted, or a mask erase when a selection defined it.
 */
export function eraseLifted(
  ctx: CanvasRenderingContext2D,
  srcRect: Rect,
  liftMask: HTMLCanvasElement | null,
) {
  const previous = ctx.globalCompositeOperation;
  if (liftMask) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(liftMask, 0, 0);
  } else {
    ctx.clearRect(srcRect.x, srcRect.y, srcRect.w, srcRect.h);
  }
  ctx.globalCompositeOperation = previous;
}

export function contentBounds(canvas: HTMLCanvasElement): Rect | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    for (let x = 0; x < width; x++) {
      if (data[row + x * 4 + 3]! !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/* --------------------------------------------------------------- overlay */

/** Draws the transform frame and handles in document space, screen-constant. */
export function drawTransformFrame(
  ctx: CanvasRenderingContext2D,
  t: TransformState,
  scale: number,
) {
  const pts = corners(t);
  const rot = rotateHandle(t, scale);
  const top = { x: (pts[0]!.x + pts[1]!.x) / 2, y: (pts[0]!.y + pts[1]!.y) / 2 };
  const r = 5.5 / scale;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = 1.5 / scale;

  // Box
  ctx.beginPath();
  ctx.moveTo(pts[0]!.x, pts[0]!.y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
  ctx.closePath();
  ctx.strokeStyle = "rgba(0,0,0,0.55)";
  ctx.lineWidth = 3 / scale;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.25 / scale;
  ctx.stroke();

  // Rotation stem
  ctx.beginPath();
  ctx.moveTo(top.x, top.y);
  ctx.lineTo(rot.x, rot.y);
  ctx.stroke();

  // Handles
  for (const p of [...pts, rot]) {
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
