/**
 * QuickShape: turns a freehand stroke into the shape the artist clearly meant.
 *
 * The rule Procreate uses is "hold still at the end of the stroke and I'll
 * clean it up". This module only does the geometry: it takes the raw stroke
 * path and returns a polyline for a straight line, a circle/ellipse, a
 * rectangle or a polygon — whichever fits the drawn path best. The engine then
 * re-draws the stroke along that polyline with the same brush, so the snapped
 * shape looks painted, not vector-pasted.
 *
 * No React, no canvas state: pure maths on points.
 */

export interface Point {
  x: number;
  y: number;
}

export type ShapeKind = "line" | "ellipse" | "rect" | "polygon";

export interface ShapeFit {
  kind: ShapeKind;
  /** Polyline to paint along, in document space. */
  points: Point[];
  /** True when the last point should join the first. */
  closed: boolean;
  /** Mean deviation from the drawn path, in document pixels. */
  error: number;
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  line: "Rak linje",
  ellipse: "Cirkel",
  rect: "Rektangel",
  polygon: "Polygon",
};

function dist(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function pathLength(points: Point[]): number {
  let sum = 0;
  for (let i = 1; i < points.length; i++) sum += dist(points[i - 1]!, points[i]!);
  return sum;
}

/** Shortest distance from `p` to the segment a-b. */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return dist(p, a);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** Mean distance from every drawn point to the candidate polyline. */
function meanError(points: Point[], poly: Point[], closed: boolean): number {
  if (poly.length < 2) return Infinity;
  const segments: [Point, Point][] = [];
  for (let i = 1; i < poly.length; i++) segments.push([poly[i - 1]!, poly[i]!]);
  if (closed) segments.push([poly.at(-1)!, poly[0]!]);
  let sum = 0;
  for (const p of points) {
    let best = Infinity;
    for (const [a, b] of segments) best = Math.min(best, distToSegment(p, a, b));
    sum += best;
  }
  return sum / points.length;
}

/** Ramer–Douglas–Peucker simplification: the corners a polygon needs. */
function simplify(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return [...points];
  const first = points[0]!;
  const last = points.at(-1)!;
  let index = -1;
  let maxDist = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSegment(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist <= tolerance || index < 0) return [first, last];
  const left = simplify(points.slice(0, index + 1), tolerance);
  const right = simplify(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

function bounds(points: Point[]) {
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
  return { minX, minY, maxX, maxY };
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, steps = 72): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    out.push({ x: cx + Math.cos(t) * rx, y: cy + Math.sin(t) * ry });
  }
  return out;
}

/** Builds a specific shape from a drawn path, so the UI can override the guess. */
export function fitShape(raw: Point[], kind: ShapeKind): ShapeFit | null {
  const points = raw.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (points.length < 3) return null;
  const first = points[0]!;
  const last = points.at(-1)!;
  const perimeter = pathLength(points);
  if (perimeter < 8) return null;
  const closedish = dist(first, last) < perimeter * 0.22;
  const b = bounds(points);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);

  if (kind === "line") {
    const poly = [first, last];
    return { kind, points: poly, closed: false, error: meanError(points, poly, false) };
  }

  if (kind === "ellipse") {
    // Bounding-box ellipse: robust, and it keeps a circle a circle because a
    // hand-drawn circle has a near-square box.
    const cx = (b.minX + b.maxX) / 2;
    const cy = (b.minY + b.maxY) / 2;
    const square = Math.min(w, h) / Math.max(w, h) > 0.88;
    const r = (w + h) / 4;
    const poly = square
      ? ellipsePoints(cx, cy, r, r)
      : ellipsePoints(cx, cy, w / 2, h / 2);
    return { kind, points: poly, closed: true, error: meanError(points, poly, true) };
  }

  if (kind === "rect") {
    const poly = [
      { x: b.minX, y: b.minY },
      { x: b.maxX, y: b.minY },
      { x: b.maxX, y: b.maxY },
      { x: b.minX, y: b.maxY },
    ];
    return { kind, points: poly, closed: true, error: meanError(points, poly, true) };
  }

  // Polygon: keep the corners, drop the wobble.
  const tolerance = Math.max(2, Math.min(w, h) * 0.06);
  let poly = simplify(points, tolerance);
  if (closedish && poly.length > 2) poly = poly.slice(0, -1);
  if (poly.length < 2) return null;
  return { kind, points: poly, closed: closedish, error: meanError(points, poly, closedish) };
}

/**
 * Picks the shape that explains the drawn path best.
 *
 * Simpler shapes win ties: a slightly worse line beats a five-corner polygon,
 * because that is what the artist almost always meant.
 */
export function detectShape(raw: Point[]): ShapeFit | null {
  const points = raw.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (points.length < 3) return null;
  const perimeter = pathLength(points);
  const closedish = dist(points[0]!, points.at(-1)!) < perimeter * 0.22;

  const candidates: { fit: ShapeFit; bias: number }[] = [];
  const push = (kind: ShapeKind, bias: number) => {
    const fit = fitShape(points, kind);
    if (fit) candidates.push({ fit, bias });
  };

  if (!closedish) push("line", 0.75);
  push("ellipse", closedish ? 0.9 : 1.35);
  push("rect", closedish ? 0.95 : 1.4);
  push("polygon", 1.15);

  let best: ShapeFit | null = null;
  let bestScore = Infinity;
  for (const { fit, bias } of candidates) {
    const score = fit.error * bias;
    if (score < bestScore) {
      bestScore = score;
      best = fit;
    }
  }
  return best;
}

/** Evenly spaced points along the fitted polyline, ready to stamp along. */
export function resampleShape(fit: ShapeFit, step: number): Point[] {
  const poly = fit.closed ? [...fit.points, fit.points[0]!] : fit.points;
  const spacing = Math.max(0.5, step);
  const out: Point[] = [poly[0]!];
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1]!;
    const b = poly[i]!;
    const d = dist(a, b);
    const n = Math.max(1, Math.round(d / spacing));
    for (let k = 1; k <= n; k++) {
      out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
  }
  return out;
}
