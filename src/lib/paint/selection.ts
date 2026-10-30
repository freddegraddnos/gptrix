/**
 * Selection as a path + rasterised alpha mask.
 *
 * The selection never touches the DOM: it is a Path2D plus a document-sized
 * mask canvas, so every pixel operation can clip to it with `destination-in`
 * and the marching-ants outline can be stroked straight onto the view canvas.
 */

import type { Rect } from "./types";

export type SelectionShape = "lasso" | "rect" | "wand";

export interface Point {
  x: number;
  y: number;
}

export interface SelectionState {
  shape: SelectionShape;
  /** Lasso: every sampled point. Rect: [start, current]. */
  points: Point[];
  path: Path2D;
  /** Integer document-space bounds of the path, clamped to the document. */
  bounds: Rect;
  /** Document-sized canvas: opaque inside the selection, transparent outside. */
  mask: HTMLCanvasElement;
}

/** Builds the outline for a shape. Returns null when there is nothing to draw. */
export function selectionPath(shape: SelectionShape, points: Point[]): Path2D | null {
  if (shape === "rect") {
    const [a, b] = points;
    if (!a || !b) return null;
    const path = new Path2D();
    path.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    return path;
  }
  if (points.length < 2) return null;
  const path = new Path2D();
  path.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) path.lineTo(points[i]!.x, points[i]!.y);
  path.closePath();
  return path;
}

function boundsOf(points: Point[], width: number, height: number): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const x = Math.max(0, Math.floor(minX) - 1);
  const y = Math.max(0, Math.floor(minY) - 1);
  const right = Math.min(width, Math.ceil(maxX) + 1);
  const bottom = Math.min(height, Math.ceil(maxY) + 1);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

/** Smallest selection that still counts as intentional (document px). */
const MIN_AREA = 4;

export function buildSelection(
  shape: SelectionShape,
  points: Point[],
  width: number,
  height: number,
): SelectionState | null {
  const path = selectionPath(shape, points);
  if (!path) return null;
  const bounds = boundsOf(points, width, height);
  if (bounds.w * bounds.h < MIN_AREA) return null;

  const mask = document.createElement("canvas");
  mask.width = width;
  mask.height = height;
  const ctx = mask.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.fill(path);

  return { shape, points: points.map((p) => ({ ...p })), path, bounds, mask };
}

/** Intersects a dirty rect with the selection bounds. */
export function intersectRect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.w, b.x + b.w);
  const bottom = Math.min(a.y + a.h, b.y + b.h);
  if (right <= x || bottom <= y) return null;
  return { x, y, w: right - x, h: bottom - y };
}

/**
 * Marching ants: two offset dash patterns drawn in document space with
 * screen-constant width, animated by shifting `lineDashOffset` over time.
 */
export function drawMarchingAnts(
  ctx: CanvasRenderingContext2D,
  path: Path2D,
  scale: number,
  timeMs: number,
) {
  const dash = 6 / scale;
  const gap = 4 / scale;
  const period = dash + gap;
  const offset = ((timeMs / 60) % period) * -1;

  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = 1 / scale;

  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  ctx.stroke(path);

  ctx.setLineDash([dash, gap]);
  ctx.lineDashOffset = offset;
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.stroke(path);
  ctx.restore();
}

/* -------------------------------------------------------- mask selections */

/**
 * Traces the outline of a mask into a Path2D of closed, consistently oriented
 * pixel-edge loops, so the same path both fills correctly (nonzero winding)
 * and strokes cleanly as marching ants.
 */
export function maskToPath(mask: HTMLCanvasElement): { path: Path2D; bounds: Rect } | null {
  const width = mask.width;
  const height = mask.height;
  const ctx = mask.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  const data = ctx.getImageData(0, 0, width, height).data;

  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && data[(y * width + x) * 4 + 3]! > 127;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Directed boundary edges, keyed by their start point, so loops can be walked.
  const edges = new Map<string, Point[]>();
  const addEdge = (ax: number, ay: number, bx: number, by: number) => {
    const key = `${ax},${ay}`;
    const list = edges.get(key);
    if (list) list.push({ x: bx, y: by });
    else edges.set(key, [{ x: bx, y: by }]);
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!inside(x, y)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      if (!inside(x, y - 1)) addEdge(x, y, x + 1, y);
      if (!inside(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
      if (!inside(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
      if (!inside(x - 1, y)) addEdge(x, y + 1, x, y);
    }
  }

  if (maxX < minX) return null;

  const path = new Path2D();
  let guard = 0;
  const budget = width * height * 4 + 64;

  for (const [startKey, startList] of edges) {
    while (startList.length > 0) {
      const [startX, startY] = startKey.split(",").map(Number) as [number, number];
      let current = { x: startX, y: startY };
      path.moveTo(current.x, current.y);
      // Walk the loop, consuming edges as we go.
      for (;;) {
        if (guard++ > budget) break;
        const list = edges.get(`${current.x},${current.y}`);
        if (!list || list.length === 0) break;
        const next = list.shift()!;
        path.lineTo(next.x, next.y);
        current = next;
        if (current.x === startX && current.y === startY) break;
      }
      path.closePath();
    }
  }

  return {
    path,
    bounds: {
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    },
  };
}

/** Wraps a rasterised mask (magic wand) as a normal selection. */
export function buildSelectionFromMask(mask: HTMLCanvasElement): SelectionState | null {
  const traced = maskToPath(mask);
  if (!traced) return null;
  return {
    shape: "wand",
    points: [],
    path: traced.path,
    bounds: traced.bounds,
    mask,
  };
}
