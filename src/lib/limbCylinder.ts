/**
 * Estimates the limb as a tapered cylinder from the live frame.
 *
 * The two landmarks that define the limb's long axis (wrist + elbow for a
 * forearm, the two nearest knuckle joints for a finger) give the centerline.
 * The radius is measured at a few points along that line by walking outwards
 * perpendicular to the axis until the pixels stop looking like the skin at the
 * centerline — that edge is the limb's silhouette. When the edge can't be
 * found (busy background, sleeve, motion blur) we fall back to a proportional
 * default of 12% of the axis length.
 */

export type AxisPoint = { x: number; y: number };

/** Radius samples run from the start of the axis (t=0) to its end (t=1). */
export type LimbCylinder = {
  /** Radii in source pixels, evenly spaced along the axis. */
  radii: number[];
  /** True when at least half the samples came from a measured silhouette. */
  measured: boolean;
};

const SAMPLES = 5;
const PROC_WIDTH = 192;
/** Colour distance that counts as "no longer skin". */
const EDGE_DELTA = 46;
const FALLBACK_RATIO = 0.12;

let work: HTMLCanvasElement | null = null;

function scratch(w: number, h: number) {
  if (!work) work = document.createElement("canvas");
  if (work.width !== w || work.height !== h) {
    work.width = w;
    work.height = h;
  }
  return work;
}

const dist = (a: AxisPoint, b: AxisPoint) => Math.hypot(b.x - a.x, b.y - a.y);

export function measureLimbCylinder(
  source: HTMLCanvasElement | HTMLVideoElement,
  a: AxisPoint,
  b: AxisPoint,
): LimbCylinder {
  const sw =
    (source as HTMLVideoElement).videoWidth || (source as HTMLCanvasElement).width;
  const sh =
    (source as HTMLVideoElement).videoHeight ||
    (source as HTMLCanvasElement).height;
  const axisLen = dist(a, b);
  const fallback = Math.max(4, axisLen * FALLBACK_RATIO);
  const flat = (): LimbCylinder => ({
    radii: new Array(SAMPLES).fill(fallback),
    measured: false,
  });
  if (!sw || !sh || axisLen < 8) return flat();

  const k = Math.min(1, PROC_WIDTH / sw);
  const w = Math.max(2, Math.round(sw * k));
  const h = Math.max(2, Math.round(sh * k));
  let data: ImageData;
  try {
    const c = scratch(w, h);
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return flat();
    ctx.drawImage(source, 0, 0, w, h);
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return flat();
  }

  const px = data.data;
  const at = (x: number, y: number): [number, number, number] | null => {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= w || iy >= h) return null;
    const i = (iy * w + ix) * 4;
    return [px[i], px[i + 1], px[i + 2]];
  };

  // Axis and its perpendicular, in processing pixels.
  const ax = a.x * k;
  const ay = a.y * k;
  const bx = b.x * k;
  const by = b.y * k;
  const len = Math.hypot(bx - ax, by - ay) || 1;
  const nx = -(by - ay) / len;
  const ny = (bx - ax) / len;
  const maxWalk = len * 0.45;

  const radii: number[] = [];
  let measuredCount = 0;

  for (let s = 0; s < SAMPLES; s++) {
    const t = s / (SAMPLES - 1);
    const cx = ax + (bx - ax) * t;
    const cy = ay + (by - ay) * t;
    const base = at(cx, cy);
    if (!base) {
      radii.push(fallback);
      continue;
    }

    const walk = (dir: 1 | -1): number | null => {
      let outside = 0;
      for (let d = 1; d <= maxWalk; d++) {
        const p = at(cx + nx * d * dir, cy + ny * d * dir);
        if (!p) return d;
        const delta =
          Math.abs(p[0] - base[0]) +
          Math.abs(p[1] - base[1]) +
          Math.abs(p[2] - base[2]);
        // Two consecutive off-skin pixels: a real edge, not sensor noise.
        if (delta > EDGE_DELTA * 3) {
          outside++;
          if (outside >= 2) return d - 1;
        } else outside = 0;
      }
      return null;
    };

    const left = walk(-1);
    const right = walk(1);
    if (left != null && right != null) {
      radii.push(Math.max(2, ((left + right) / 2) / k));
      measuredCount++;
    } else if (left != null || right != null) {
      radii.push(Math.max(2, (left ?? right!) / k));
      measuredCount++;
    } else {
      radii.push(fallback);
    }
  }

  // Reject wild samples: the limb tapers, it does not jump.
  const sorted = [...radii].sort((p, q) => p - q);
  const median = sorted[Math.floor(sorted.length / 2)];
  const clean = radii.map((r) =>
    r > median * 1.9 || r < median * 0.45 ? median : r,
  );
  // Light smoothing along the axis so the wrap does not shimmer frame to frame.
  const smoothed = clean.map((r, i) => {
    const prev = clean[Math.max(0, i - 1)];
    const next = clean[Math.min(clean.length - 1, i + 1)];
    return prev * 0.25 + r * 0.5 + next * 0.25;
  });

  return { radii: smoothed, measured: measuredCount >= Math.ceil(SAMPLES / 2) };
}

/** Radius at a normalized position along the axis (0..1), interpolated. */
export function radiusAt(cyl: LimbCylinder, t: number): number {
  const n = cyl.radii.length;
  if (!n) return 1;
  const p = Math.min(1, Math.max(0, t)) * (n - 1);
  const i = Math.floor(p);
  const f = p - i;
  return cyl.radii[i] * (1 - f) + cyl.radii[Math.min(n - 1, i + 1)] * f;
}

/**
 * A chain of tapered cylinders — one per limb segment (upper arm, forearm …).
 * Distances are pixel offsets measured from the start of the chain.
 */
export type SegmentedLimb = {
  parts: LimbCylinder[];
  /** Length of each segment in source pixels. */
  lengths: number[];
  /** Offsets where two segments meet (a joint crease). */
  seams: number[];
  total: number;
  measured: boolean;
};

/** Fits one tapered cylinder per consecutive landmark pair in the chain. */
export function measureSegmentedLimb(
  source: HTMLCanvasElement | HTMLVideoElement,
  points: AxisPoint[],
): SegmentedLimb | null {
  if (points.length < 2) return null;
  const parts: LimbCylinder[] = [];
  const lengths: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    parts.push(measureLimbCylinder(source, points[i], points[i + 1]));
    lengths.push(Math.max(1, dist(points[i], points[i + 1])));
  }
  const seams: number[] = [];
  let acc = 0;
  for (let i = 0; i < lengths.length - 1; i++) {
    acc += lengths[i];
    seams.push(acc);
  }
  return {
    parts,
    lengths,
    seams,
    total: lengths.reduce((s, l) => s + l, 0),
    measured: parts.some((p) => p.measured),
  };
}

/** Where a point falls along the chain, as a pixel offset from its start. */
export function offsetAlongChain(points: AxisPoint[], p: AxisPoint): number {
  let acc = 0;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const px = a.x + dx * t;
    const py = a.y + dy * t;
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bestDist) {
      bestDist = d;
      best = acc + Math.sqrt(len2) * t;
    }
    acc += Math.sqrt(len2);
  }
  return best;
}

/**
 * Radius at a pixel offset along the chain. Within `blendPx` of a seam the two
 * neighbouring cylinders are cross-faded, so the wrap (and the shading derived
 * from it) stays continuous across the joint instead of stepping.
 */
export function radiusAtDistance(
  seg: SegmentedLimb,
  d: number,
  blendPx = 0,
): number {
  if (!seg.parts.length) return 1;
  const clamped = Math.min(seg.total, Math.max(0, d));
  let start = 0;
  let idx = seg.lengths.length - 1;
  let acc = 0;
  for (let i = 0; i < seg.lengths.length; i++) {
    if (clamped <= acc + seg.lengths[i]) {
      idx = i;
      start = acc;
      break;
    }
    acc += seg.lengths[i];
    start = acc;
  }
  let r = radiusAt(seg.parts[idx], (clamped - start) / seg.lengths[idx]);

  if (blendPx > 0.5) {
    for (let s = 0; s < seg.seams.length; s++) {
      const delta = clamped - seg.seams[s];
      const ad = Math.abs(delta);
      if (ad > blendPx) continue;
      const neighbour =
        delta < 0
          ? radiusAt(seg.parts[s + 1], ad / seg.lengths[s + 1])
          : radiusAt(seg.parts[s], 1 - ad / seg.lengths[s]);
      const k = 1 - ad / blendPx;
      // Smoothstep, capped at 0.5 so both sides agree exactly at the seam.
      const w = 0.5 * (k * k * (3 - 2 * k));
      r = r * (1 - w) + neighbour * w;
    }
  }
  return Math.max(1, r);
}
