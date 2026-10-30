/**
 * "Lock to skin" tracker.
 *
 * Instead of matching one big patch (which is ambiguous on smooth skin and
 * therefore slides sideways), we lock a small constellation of anchor patches
 * around the design. Every frame each anchor is searched independently with a
 * coarse-to-fine translation search; the surviving anchors are then fitted to a
 * similarity transform (uniform scale + translation):
 *
 *   - translation comes from the robust median of the anchor motions
 *   - scale comes from how the distances *between* anchors change, which is a
 *     far more accurate distance estimate than resizing a single template
 *
 * Anchors that match poorly are discarded as outliers, so a passing hand or a
 * blown-out highlight can no longer drag the tattoo across the arm.
 */

export type TrackRegion = { cx: number; cy: number; w: number; h: number };

const T = 24; // anchor template resolution (T x T)
const MIN_SCORE = 0.32; // ZNCC below this = outlier
const ANCHORS: Array<[number, number]> = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [-0.5, 0.5],
  [0.5, 0.5],
  [0, 0],
  [-0.75, 0],
  [0.75, 0],
  [0, -0.75],
  [0, 0.75],
];

function grayNorm(data: Uint8ClampedArray): Float32Array {
  const n = T * T;
  const out = new Float32Array(n);
  let mean = 0;
  for (let i = 0, p = 0; p < n; p++, i += 4) {
    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    out[p] = g;
    mean += g;
  }
  mean /= n;
  let sd = 0;
  for (let i = 0; i < n; i++) {
    out[i] -= mean;
    sd += out[i] * out[i];
  }
  sd = Math.sqrt(sd / n) || 1;
  for (let i = 0; i < n; i++) out[i] /= sd;
  return out;
}

/** Zero-mean normalised cross correlation of two normalised patches (-1..1). */
function ncc(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s / a.length;
}

function median(v: number[]): number {
  const a = [...v].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

export type TrackResult = {
  scale: number;
  dx: number;
  dy: number;
  /** 0..1 — how well the constellation matches the locked template. */
  confidence: number;
};

type Anchor = {
  /** offset from the design centre, in *base* video px */
  ox: number;
  oy: number;
  tpl: Float32Array;
  /** last known absolute position in video px */
  x: number;
  y: number;
  score: number;
  alive: boolean;
};

export function createRegionTracker(
  video: HTMLVideoElement,
  initial: TrackRegion,
) {
  const canvas = document.createElement("canvas");
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const patchBase = Math.max(18, Math.min(initial.w, initial.h) * 0.42);

  const sample = (x: number, y: number, size: number): Float32Array | null => {
    if (!ctx) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    const sx = x - size / 2;
    const sy = y - size / 2;
    if (sx < 0 || sy < 0 || sx + size > vw || sy + size > vh) return null;
    try {
      ctx.drawImage(video, sx, sy, size, size, 0, 0, T, T);
    } catch {
      return null;
    }
    return grayNorm(ctx.getImageData(0, 0, T, T).data);
  };

  /** Texture energy — flat, featureless patches make useless anchors. */
  const textureOf = (x: number, y: number, size: number): number => {
    if (!ctx) return 0;
    const sx = x - size / 2;
    const sy = y - size / 2;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (sx < 0 || sy < 0 || sx + size > vw || sy + size > vh) return 0;
    try {
      ctx.drawImage(video, sx, sy, size, size, 0, 0, T, T);
    } catch {
      return 0;
    }
    const d = ctx.getImageData(0, 0, T, T).data;
    let mean = 0;
    const n = T * T;
    for (let i = 0, p = 0; p < n; p++, i += 4) mean += d[i];
    mean /= n;
    let sd = 0;
    for (let i = 0, p = 0; p < n; p++, i += 4) sd += (d[i] - mean) * (d[i] - mean);
    return Math.sqrt(sd / n);
  };

  const anchors: Anchor[] = [];
  for (const [rx, ry] of ANCHORS) {
    const ox = rx * initial.w * 0.5;
    const oy = ry * initial.h * 0.5;
    const x = initial.cx + ox;
    const y = initial.cy + oy;
    if (textureOf(x, y, patchBase) < 3) continue; // too flat to track
    const tpl = sample(x, y, patchBase);
    if (!tpl) continue;
    anchors.push({ ox, oy, tpl, x, y, score: 1, alive: true });
  }

  const baseCenter = { x: initial.cx, y: initial.cy };
  let center = { x: initial.cx, y: initial.cy };
  let scale = 1;
  /** Measured per-frame motion, used to predict the next search window. */
  let vel = { x: 0, y: 0 };
  let lostFrames = 0;
  let smoothConfidence = anchors.length >= 3 ? 1 : 0.5;

  /** Mean distance of anchors from the centroid in base coordinates. */
  const baseSpread = (() => {
    if (anchors.length < 2) return 0;
    let mx = 0;
    let my = 0;
    for (const a of anchors) {
      mx += a.ox;
      my += a.oy;
    }
    mx /= anchors.length;
    my /= anchors.length;
    let s = 0;
    for (const a of anchors) s += Math.hypot(a.ox - mx, a.oy - my);
    return s / anchors.length;
  })();

  // Coarse then fine translation search (in units of the patch size).
  const PASSES = [
    { step: 0.3, n: 3 },
    { step: 0.11, n: 3 },
    { step: 0.04, n: 3 },
  ];

  /** Parabolic sub-pixel peak from three NCC samples. */
  const subPixel = (left: number, mid: number, right: number, step: number) => {
    const denom = left - 2 * mid + right;
    if (!isFinite(denom) || Math.abs(denom) < 1e-6) return 0;
    const delta = (0.5 * (left - right)) / denom;
    return Math.abs(delta) > 1 ? 0 : delta * step;
  };

  /**
   * Coarse-to-fine translation search around (px, py).
   * `reach` widens the first pass so fast sideways pans stay inside the window.
   */
  const searchAnchor = (
    a: Anchor,
    px: number,
    py: number,
    size: number,
    reach = 1,
  ) => {
    let bx = px;
    let by = py;
    let best = -2;
    let lastStep = 0;
    for (let pi = 0; pi < PASSES.length; pi++) {
      const pass = PASSES[pi];
      const grow = pi === 0 ? reach : 1;
      const d = pass.step * size * grow;
      const n = pi === 0 ? Math.min(6, Math.round(pass.n * reach)) : pass.n;
      let localBest = { x: bx, y: by, s: -2 };
      for (let iy = -n; iy <= n; iy++) {
        for (let ix = -n; ix <= n; ix++) {
          const x = bx + ix * d;
          const y = by + iy * d;
          const patch = sample(x, y, size);
          if (!patch) continue;
          const s = ncc(a.tpl, patch);
          if (s > localBest.s) localBest = { x, y, s };
        }
      }
      if (localBest.s < -1) break;
      bx = localBest.x;
      by = localBest.y;
      best = localBest.s;
      lastStep = d;
    }

    // Sub-pixel refinement on the finest grid — kills lateral micro-jitter.
    if (best > -1 && lastStep > 0) {
      const l = sample(bx - lastStep, by, size);
      const r = sample(bx + lastStep, by, size);
      const u = sample(bx, by - lastStep, size);
      const dn = sample(bx, by + lastStep, size);
      if (l && r) bx += subPixel(ncc(a.tpl, l), best, ncc(a.tpl, r), lastStep);
      if (u && dn) by += subPixel(ncc(a.tpl, u), best, ncc(a.tpl, dn), lastStep);
    }

    return { x: bx, y: by, score: best };
  };

  const result = (): TrackResult => ({
    scale: Math.max(0.35, Math.min(3, scale)),
    dx: center.x - baseCenter.x,
    dy: center.y - baseCenter.y,
    confidence: smoothConfidence,
  });

  return {
    ok: anchors.length >= 3,
    update(): TrackResult | null {
      if (anchors.length < 2) return null;
      const size = Math.max(14, patchBase * scale);

      // Predict this frame's centre from the measured camera motion, so a
      // sideways pan starts its search where the skin actually moved to.
      const predX = center.x + vel.x;
      const predY = center.y + vel.y;

      // How far to widen the coarse pass: fast pans and recent losses widen it.
      const speed = Math.hypot(vel.x, vel.y);
      const reach = Math.min(
        3,
        1 + speed / Math.max(6, size * 0.35) + lostFrames * 0.6,
      );

      const good: Array<{ a: Anchor; x: number; y: number; score: number }> = [];
      for (const a of anchors) {
        const px = predX + a.ox * scale;
        const py = predY + a.oy * scale;
        const found = searchAnchor(a, px, py, size, reach);
        a.score = a.score * 0.5 + found.score * 0.5;
        if (found.score >= MIN_SCORE) {
          good.push({ a, x: found.x, y: found.y, score: found.score });
        }
      }

      if (good.length < 2) {
        lostFrames = Math.min(6, lostFrames + 1);
        smoothConfidence = smoothConfidence * 0.7;
        // Coast on the last measured motion, decaying fast, then freeze.
        vel = { x: vel.x * 0.5, y: vel.y * 0.5 };
        return result(); // hold placement, never slide on a bad frame
      }
      lostFrames = 0;

      // --- robust scale from anchor spread ---------------------------------
      let mx = 0;
      let my = 0;
      let bmx = 0;
      let bmy = 0;
      for (const g of good) {
        mx += g.x;
        my += g.y;
        bmx += g.a.ox;
        bmy += g.a.oy;
      }
      mx /= good.length;
      my /= good.length;
      bmx /= good.length;
      bmy /= good.length;

      let newScale = scale;
      if (good.length >= 3 && baseSpread > 1) {
        const ratios: number[] = [];
        for (const g of good) {
          const bd = Math.hypot(g.a.ox - bmx, g.a.oy - bmy);
          if (bd < baseSpread * 0.4) continue;
          const cd = Math.hypot(g.x - mx, g.y - my);
          ratios.push(cd / bd);
        }
        if (ratios.length >= 2) {
          const r = median(ratios);
          if (r > 0.3 && r < 3) newScale = scale + (r - scale) * 0.35;
        }
      }

      // --- robust translation (median of per-anchor implied centres) -------
      let implied = good.map((g) => ({
        x: g.x - g.a.ox * newScale,
        y: g.y - g.a.oy * newScale,
        score: g.score,
      }));
      let targetX = median(implied.map((p) => p.x));
      let targetY = median(implied.map((p) => p.y));

      // Reject anchors that disagree with the constellation (a passing hand,
      // a shadow edge) and re-fit — the main source of lateral drift.
      if (implied.length >= 3) {
        const tol = Math.max(2.5, size * 0.45);
        const kept = implied.filter(
          (p) => Math.hypot(p.x - targetX, p.y - targetY) <= tol,
        );
        if (kept.length >= 2) {
          implied = kept;
          // Score-weighted mean of the inliers: smoother than a bare median.
          let wx = 0;
          let wy = 0;
          let w = 0;
          for (const p of implied) {
            const weight = Math.max(0.05, p.score);
            wx += p.x * weight;
            wy += p.y * weight;
            w += weight;
          }
          targetX = wx / w;
          targetY = wy / w;
        }
      }

      const meanScore =
        implied.reduce((s, p) => s + p.score, 0) / implied.length;
      const agree = implied.length / anchors.length;
      const conf = Math.max(0, Math.min(1, meanScore * 1.15)) * (0.45 + 0.55 * agree);
      smoothConfidence = smoothConfidence * 0.6 + conf * 0.4;

      // Follow strongly when the constellation agrees, barely when it doesn't:
      // this is what keeps the lateral lock rock solid.
      const k = 0.18 + 0.55 * conf;
      const nextX = center.x + (targetX - center.x) * k;
      const nextY = center.y + (targetY - center.y) * k;

      // Measured motion feeds next frame's prediction (clamped so a bad frame
      // cannot launch the search off the arm).
      const maxVel = size * 1.2;
      const vxRaw = nextX - center.x;
      const vyRaw = nextY - center.y;
      const damp = 0.55 * conf;
      vel = {
        x: Math.max(-maxVel, Math.min(maxVel, vel.x * (1 - damp) + vxRaw * damp)),
        y: Math.max(-maxVel, Math.min(maxVel, vel.y * (1 - damp) + vyRaw * damp)),
      };

      // Dead zone: sub-pixel wobble never reaches the UI.
      if (Math.hypot(nextX - center.x, nextY - center.y) > 0.3) {
        center = { x: nextX, y: nextY };
      }
      if (Math.abs(newScale - scale) > 0.0015) scale = newScale;

      // Slowly re-learn appearance (lighting drift) on confident anchors only.
      if (conf > 0.6) {
        for (const g of good) {
          if (g.score < 0.6) continue;
          const patch = sample(g.x, g.y, size);
          if (!patch) continue;
          const tpl = g.a.tpl;
          for (let i = 0; i < tpl.length; i++) tpl[i] = tpl[i] * 0.93 + patch[i] * 0.07;
        }
      }

      return result();
    },
  };
}
