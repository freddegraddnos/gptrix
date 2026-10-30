/**
 * Warp and perspective on top of a lifted transform region.
 *
 * Two modes share one representation: a net of control points in document
 * space.
 *
 *  - `grid`        NxN net, N from 3 to 6 (corners + evenly spaced edge and
 *                  interior points). The surface is a tensor-product Lagrange
 *                  patch of degree N-1, so it passes exactly through every
 *                  control point — a handle lands where you drop it.
 *  - `perspective` four freely movable corners driven by a homography, i.e.
 *                  straight lines stay straight and foreshortening looks right.
 *
 * Rendering is mesh based: the patch is diced into small quads, each quad into
 * two triangles, and every triangle is drawn with its own affine map. The same
 * routine draws the on-screen preview and the final document-resolution stamp,
 * so what you see is what gets applied.
 */

import type { Point } from "./transform";
import type { Rect } from "./types";

export type WarpMode = "grid" | "perspective";
/** Affine = the classic move/scale/rotate frame; the other two are meshes. */
export type TransformMode = "affine" | WarpMode;

/** Handle grab radius, in screen pixels (matches the affine frame). */
const GRAB_RADIUS = 14;
/** Densest and coarsest grid-nets allowed (points per side). */
export const WARP_GRID_MIN = 3;
export const WARP_GRID_MAX = 6;
/** Mesh resolution: how many quads across the patch when stamping/previewing. */
const MESH_STEPS = 18;
/** Triangles are grown a hair so neighbours overlap instead of showing seams. */
const SEAM_PAD = 0.7;

export interface WarpState {
  mode: WarpMode;
  /** Control points, row-major, `rows * cols` of them, in document space. */
  points: Point[];
  cols: number;
  rows: number;
}

export interface WarpDrag {
  index: number;
  from: Point;
  start: Point;
}

/* ------------------------------------------------------------------- setup */

/**
 * Builds a control net that matches the box the affine frame currently shows,
 * so switching mode never makes the artwork jump.
 *
 * `boxCorners` is nw, ne, se, sw in document space.
 */
export function createWarp(mode: WarpMode, boxCorners: Point[]): WarpState {
  const [nw, ne, se, sw] = boxCorners as [Point, Point, Point, Point];
  if (mode === "perspective") {
    return { mode, points: [nw, ne, se, sw].map((p) => ({ ...p })), cols: 2, rows: 2 };
  }
  const n = WARP_GRID_MIN;
  const points: Point[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      points.push(bilinear(nw, ne, se, sw, c / (n - 1), r / (n - 1)));
    }
  }
  return { mode, points, cols: n, rows: n };
}

function bilinear(nw: Point, ne: Point, se: Point, sw: Point, u: number, v: number): Point {
  const top = { x: nw.x + (ne.x - nw.x) * u, y: nw.y + (ne.y - nw.y) * u };
  const bottom = { x: sw.x + (se.x - sw.x) * u, y: sw.y + (se.y - sw.y) * u };
  return { x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v };
}

/**
 * Re-meshes a grid warp to a new density while keeping the surface's shape:
 * every new control point is placed exactly where the OLD surface sits at
 * that parameter, so already-dragged deformation survives the change as well
 * as the new resolution allows. Out-of-range densities are clamped; calling
 * this on a perspective warp or with the current density is a no-op.
 */
export function setWarpDensity(w: WarpState, n: number): WarpState {
  const size = Math.round(n);
  if (w.mode !== "grid" || size === w.cols) return w;
  const clamped = Math.max(WARP_GRID_MIN, Math.min(WARP_GRID_MAX, size));
  if (clamped === w.cols) return w;
  const points: Point[] = [];
  for (let r = 0; r < clamped; r++) {
    for (let c = 0; c < clamped; c++) {
      points.push(warpPointAt(w, c / (clamped - 1), r / (clamped - 1)));
    }
  }
  return { ...w, points, cols: clamped, rows: clamped };
}

/* --------------------------------------------------------------- surfaces */

/**
 * Lagrange basis for `n` equally spaced nodes at t = i/(n-1), evaluated at t.
 * Weights sum to 1 and basis[i] is 1 exactly at node i, so the patch passes
 * through every control point. n = 2 gives plain linear, n = 3 the classic
 * quadratic patch, up to n = 6 for dense warps.
 */
function lagrange(t: number, n: number): number[] {
  const basis: number[] = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    const ti = i / (n - 1);
    let w = 1;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      w *= (t - j / (n - 1)) / (ti - j / (n - 1));
    }
    basis[i] = w;
  }
  return basis;
}

/**
 * Homography that maps the unit square onto four corners (nw, ne, se, sw).
 * Returns the 8 coefficients of x' = (a u + b v + c) / (g u + h v + 1).
 */
function homography(pts: Point[]) {
  const [p0, p1, p2, p3] = pts as [Point, Point, Point, Point];
  const dx1 = p1.x - p2.x;
  const dx2 = p3.x - p2.x;
  const dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y;
  const dy2 = p3.y - p2.y;
  const dy3 = p0.y - p1.y + p2.y - p3.y;

  const den = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(den) < 1e-12) {
    // Degenerate quad: fall back to the affine map through three corners.
    return {
      a: p1.x - p0.x,
      b: p3.x - p0.x,
      c: p0.x,
      d: p1.y - p0.y,
      e: p3.y - p0.y,
      f: p0.y,
      g: 0,
      h: 0,
    };
  }
  const g = (dx3 * dy2 - dy3 * dx2) / den;
  const h = (dx1 * dy3 - dy1 * dx3) / den;
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

/** Document-space position of the patch at parameter (u, v), both in [0,1]. */
export function warpPointAt(w: WarpState, u: number, v: number): Point {
  if (w.mode === "perspective") {
    const m = homography(w.points);
    const den = m.g * u + m.h * v + 1 || 1e-9;
    return { x: (m.a * u + m.b * v + m.c) / den, y: (m.d * u + m.e * v + m.f) / den };
  }
  const bu = lagrange(u, w.cols);
  const bv = lagrange(v, w.rows);
  let x = 0;
  let y = 0;
  for (let r = 0; r < w.rows; r++) {
    for (let c = 0; c < w.cols; c++) {
      const wgt = bu[c]! * bv[r]!;
      const p = w.points[r * w.cols + c]!;
      x += p.x * wgt;
      y += p.y * wgt;
    }
  }
  return { x, y };
}

/* -------------------------------------------------------------- hit tests */

/** Index of the control point under a document-space point, or null. */
export function warpHitTest(w: WarpState, p: Point, scale: number): number | null {
  const grab = GRAB_RADIUS / scale;
  let best: number | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < w.points.length; i++) {
    const c = w.points[i]!;
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d <= grab && d < bestDist) {
      best = i;
      bestDist = d;
    }
  }
  return best;
}

/** Moves one control point. Mutates `w`; safe to call on every pointer move. */
export function applyWarpDrag(w: WarpState, drag: WarpDrag, p: Point) {
  const target = w.points[drag.index];
  if (!target) return;
  target.x = drag.start.x + (p.x - drag.from.x);
  target.y = drag.start.y + (p.y - drag.from.y);
}

/** Bounding box of the warped patch, padded and clamped to the document. */
export function warpBounds(w: WarpState, width: number, height: number, pad = 2): Rect {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  // Sample the edges as well as the net: a bent edge can bulge past its handles.
  const steps = 12;
  const sample = (u: number, v: number) => {
    const p = warpPointAt(w, u, v);
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    sample(t, 0);
    sample(t, 1);
    sample(0, t);
    sample(1, t);
    sample(t, 0.5);
    sample(0.5, t);
  }
  for (const p of w.points) sample01(p);
  function sample01(p: Point) {
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

/* ---------------------------------------------------------------- drawing */

/** Grows a triangle around its centroid so adjacent triangles overlap. */
function expand(tri: Point[], pad: number): Point[] {
  const cx = (tri[0]!.x + tri[1]!.x + tri[2]!.x) / 3;
  const cy = (tri[0]!.y + tri[1]!.y + tri[2]!.y) / 3;
  return tri.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * pad, y: p.y + (dy / len) * pad };
  });
}

/** Draws one source triangle into one destination triangle. */
function drawTriangle(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  src: Point[],
  dst: Point[],
  pad: number,
) {
  const [s0, s1, s2] = src as [Point, Point, Point];
  const [d0, d1, d2] = dst as [Point, Point, Point];

  const denom = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
  if (Math.abs(denom) < 1e-9) return;

  // Affine map taking the source triangle onto the destination triangle.
  const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / denom;
  const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / denom;
  const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / denom;
  const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / denom;
  const e = d0.x - a * s0.x - c * s0.y;
  const f = d0.y - b * s0.x - d * s0.y;

  const clip = expand(dst, pad);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(clip[0]!.x, clip[0]!.y);
  ctx.lineTo(clip[1]!.x, clip[1]!.y);
  ctx.lineTo(clip[2]!.x, clip[2]!.y);
  ctx.closePath();
  ctx.clip();
  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/**
 * Draws the lifted pixels through the warp, in document space.
 *
 * `source` holds the lifted crop at document resolution, so the stamp and the
 * preview go through exactly the same maths.
 */
export function drawWarped(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  w: WarpState,
  scale = 1,
) {
  const sw = source.width;
  const sh = source.height;
  if (sw < 1 || sh < 1) return;

  const steps = MESH_STEPS;
  // One extra sample row/column of the patch, cached so each vertex is
  // evaluated once instead of six times.
  const grid: Point[][] = [];
  for (let r = 0; r <= steps; r++) {
    const row: Point[] = [];
    for (let c = 0; c <= steps; c++) row.push(warpPointAt(w, c / steps, r / steps));
    grid.push(row);
  }

  const pad = SEAM_PAD / Math.max(scale, 0.05);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  for (let r = 0; r < steps; r++) {
    for (let c = 0; c < steps; c++) {
      const u0 = (c / steps) * sw;
      const u1 = ((c + 1) / steps) * sw;
      const v0 = (r / steps) * sh;
      const v1 = ((r + 1) / steps) * sh;
      const sA = { x: u0, y: v0 };
      const sB = { x: u1, y: v0 };
      const sC = { x: u1, y: v1 };
      const sD = { x: u0, y: v1 };
      const dA = grid[r]![c]!;
      const dB = grid[r]![c + 1]!;
      const dC = grid[r + 1]![c + 1]!;
      const dD = grid[r + 1]![c]!;
      drawTriangle(ctx, source, [sA, sB, sC], [dA, dB, dC], pad);
      drawTriangle(ctx, source, [sA, sC, sD], [dA, dC, dD], pad);
    }
  }
  ctx.restore();
}

/* --------------------------------------------------------------- overlay */

/** Draws the mesh outline and its handles, screen-constant, in document space. */
export function drawWarpFrame(ctx: CanvasRenderingContext2D, w: WarpState, scale: number) {
  const r = 5.5 / scale;
  const line = (path: Point[]) => {
    ctx.beginPath();
    ctx.moveTo(path[0]!.x, path[0]!.y);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i]!.x, path[i]!.y);
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 3 / scale;
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.lineWidth = 1.25 / scale;
    ctx.stroke();
  };

  ctx.save();
  ctx.lineJoin = "round";

  const steps = 10;
  if (w.mode === "perspective") {
    const [nw, ne, se, sw] = w.points as [Point, Point, Point, Point];
    line([nw, ne, se, sw, nw]);
  } else {
    // Curved isolines along every grid line show how the surface bends.
    for (let r = 0; r < w.rows; r++) {
      const v = r / (w.rows - 1);
      const path: Point[] = [];
      for (let i = 0; i <= steps; i++) path.push(warpPointAt(w, i / steps, v));
      line(path);
    }
    for (let c = 0; c < w.cols; c++) {
      const u = c / (w.cols - 1);
      const path: Point[] = [];
      for (let i = 0; i <= steps; i++) path.push(warpPointAt(w, u, i / steps));
      line(path);
    }
  }

  for (const p of w.points) {
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
