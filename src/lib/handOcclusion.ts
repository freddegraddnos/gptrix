/**
 * Hand occlusion for the live try-on.
 *
 * The Hand Landmarker tracks two hands. One of them carries the placement;
 * whenever the *other* hand moves in front of the tattoo we need the design to
 * disappear behind it instead of floating on top of the fingers.
 *
 * A per-pixel matte is overkill for that: the 21 landmarks of the occluding
 * hand already describe its silhouette well enough. We take a convex hull of
 * those points, inflate it a little so knuckles and finger width are covered,
 * and use it as a local mask. It layers on top of the general segmentation
 * mask that already handles background, hair and sleeves.
 */

export type Pt = { x: number; y: number };

/** Andrew's monotone chain — returns the hull in counter-clockwise order. */
export function convexHull(points: Pt[]): Pt[] {
  if (points.length < 3) return points.slice();
  const pts = points
    .slice()
    .sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const cross = (o: Pt, a: Pt, b: Pt) =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower: Pt[] = [];
  for (const p of pts) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0
    )
      lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0
    )
      upper.pop();
    upper.push(p);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** Pushes every hull vertex outward from the centroid by `amount` (px). */
export function inflateHull(hull: Pt[], amount: number): Pt[] {
  if (!hull.length) return hull;
  let cx = 0;
  let cy = 0;
  for (const p of hull) {
    cx += p.x;
    cy += p.y;
  }
  cx /= hull.length;
  cy /= hull.length;
  return hull.map((p) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy) || 1;
    return { x: p.x + (dx / len) * amount, y: p.y + (dy / len) * amount };
  });
}

/** True when any hull vertex sits inside the circle, or the centre in the hull. */
export function hullIntersectsCircle(
  hull: Pt[],
  cx: number,
  cy: number,
  radius: number,
): boolean {
  if (hull.length < 3) return false;
  for (const p of hull) {
    if (Math.hypot(p.x - cx, p.y - cy) <= radius) return true;
  }
  // Point-in-polygon for the fully-covering case (hand larger than the design).
  let inside = false;
  for (let i = 0, j = hull.length - 1; i < hull.length; j = i++) {
    const a = hull[i];
    const b = hull[j];
    if (
      a.y > cy !== b.y > cy &&
      cx < ((b.x - a.x) * (cy - a.y)) / (b.y - a.y || 1e-6) + a.x
    )
      inside = !inside;
  }
  return inside;
}

/** Traces the hull as a closed path on a 2D context. */
export function pathHull(ctx: CanvasRenderingContext2D, hull: Pt[]) {
  ctx.beginPath();
  hull.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}
