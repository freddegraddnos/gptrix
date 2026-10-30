/**
 * Limb axis + tilt estimation.
 *
 * The wrap pipeline already reads how round the surface is. What was missing is
 * *which way* the limb runs and how far it leans away from the camera. Without
 * that, a design on a diagonal forearm keeps its screen-vertical axis and reads
 * as a sticker floating above the skin.
 *
 * We sample a square patch of the camera image around the design, find the two
 * silhouette edges on several rows, and fit a line through the mid points. The
 * slope of that line is the limb axis; how much the limb narrows along it is a
 * usable proxy for foreshortening (the limb pointing toward the camera).
 *
 * No body-part picker: everything is measured from the frame.
 */

export type LimbAxisSample = {
  /** Limb direction in screen degrees. 0 = runs vertically on screen. */
  axisDeg: number;
  /** 0..1 how strongly the limb recedes from the camera along its axis. */
  tilt: number;
  /** Which end is nearer: -1 = top of the frame, 1 = bottom. */
  tiltDir: -1 | 1;
  /**
   * How the silhouette narrows down the frame: width at the bottom divided by
   * width at the top. 1 = a straight tube, 0.8 = the lower end is 20 % thinner.
   */
  widthRatio: number;
  /**
   * Joint angle of the limb centre line in degrees. 180 = straight; a bent
   * elbow or knee reads lower. Null when the midline is too short to judge.
   */
  bendDeg: number | null;
  /** 0..1 trust in the reading. */
  confidence: number;
};

const N = 96; // sampling resolution (square)
const ROWS = 7; // silhouette probes along the limb

let scratch: HTMLCanvasElement | null = null;
function ctx2d() {
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratch.width = N;
    scratch.height = N;
  }
  return scratch.getContext("2d", { willReadFrequently: true });
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function estimateLimbAxis(
  video: HTMLVideoElement,
  rect: { width: number; height: number },
  center: { x: number; y: number },
  widthPx: number,
  mirrored: boolean,
): LimbAxisSample | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return null;
  const ctx = ctx2d();
  if (!ctx) return null;

  const s = Math.max(rect.width / vw, rect.height / vh);
  const vx0 = (center.x - (rect.width - vw * s) / 2) / s;
  const cx = mirrored ? vw - vx0 : vx0;
  const cy = (center.y - (rect.height - vh * s) / 2) / s;

  const box = Math.min(Math.min(vw, vh), ((widthPx / s) || vw * 0.4) * 2.4);
  const sx = cx - box / 2;
  const sy = cy - box / 2;
  if (sx + box < 0 || sy + box < 0 || sx > vw || sy > vh) return null;

  try {
    ctx.clearRect(0, 0, N, N);
    ctx.drawImage(video, sx, sy, box, box, 0, 0, N, N);
  } catch {
    return null;
  }

  const data = ctx.getImageData(0, 0, N, N).data;

  // Reference skin colour: the middle of the patch, where the design sits.
  let rr = 0;
  let gg = 0;
  let bb = 0;
  let n = 0;
  for (let y = N * 0.42; y < N * 0.58; y++) {
    for (let x = N * 0.42; x < N * 0.58; x++) {
      const i = ((y | 0) * N + (x | 0)) * 4;
      rr += data[i];
      gg += data[i + 1];
      bb += data[i + 2];
      n++;
    }
  }
  if (!n) return null;
  rr /= n;
  gg /= n;
  bb /= n;

  const off = (x: number, y: number) => {
    const i = (y * N + x) * 4;
    return Math.hypot(data[i] - rr, data[i + 1] - gg, data[i + 2] - bb);
  };

  const mids: { y: number; x: number; w: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    const y = Math.round(((r + 0.5) / ROWS) * (N - 1));
    let left: number | null = null;
    let right: number | null = null;
    for (let x = N / 2; x >= 2; x--) {
      if (off(x, y) > 26 && off(x - 1, y) > 22) {
        left = x;
        break;
      }
    }
    for (let x = N / 2; x < N - 2; x++) {
      if (off(x, y) > 26 && off(x + 1, y) > 22) {
        right = x;
        break;
      }
    }
    if (left === null || right === null) continue;
    const w = right - left;
    if (w < N * 0.14) continue;
    mids.push({ y, x: (left + right) / 2, w });
  }

  if (mids.length < 3) return null;

  // Least-squares fit of x = a*y + b through the limb mid points.
  let sy1 = 0;
  let sx1 = 0;
  for (const m of mids) {
    sy1 += m.y;
    sx1 += m.x;
  }
  const my = sy1 / mids.length;
  const mx = sx1 / mids.length;
  let num = 0;
  let den = 0;
  let varX = 0;
  for (const m of mids) {
    num += (m.y - my) * (m.x - mx);
    den += (m.y - my) * (m.y - my);
    varX += (m.x - mx) * (m.x - mx);
  }
  if (den < 1) return null;
  const slope = num / den;
  const fitQuality = varX > 0.5 ? clamp(1 - (varX - (num * num) / den) / varX, 0, 1) : 1;

  // Screen angle. Mirrored preview flips the apparent lean.
  const axisRad = Math.atan(slope);
  const axisDeg = ((mirrored ? -1 : 1) * axisRad * 180) / Math.PI;

  // Foreshortening: a limb leaning toward the camera tapers along its length.
  const first = mids[0];
  const last = mids[mids.length - 1];
  const widthRatio = last.w / Math.max(1, first.w);
  const taper = Math.abs(Math.log(clamp(widthRatio, 0.4, 2.5)));
  const tilt = clamp((taper - 0.06) / 0.55, 0, 1);
  const tiltDir: -1 | 1 = widthRatio > 1 ? 1 : -1;

  // Joint bend: the angle at the middle of the centre line. A straight limb
  // gives 180 deg; a bent elbow or knee bends the midline toward the outside.
  let bendDeg: number | null = null;
  if (mids.length >= 3) {
    const mid = mids[Math.floor(mids.length / 2)];
    const v1 = { x: first.x - mid.x, y: first.y - mid.y };
    const v2 = { x: last.x - mid.x, y: last.y - mid.y };
    const m1 = Math.hypot(v1.x, v1.y);
    const m2 = Math.hypot(v2.x, v2.y);
    if (m1 > 2 && m2 > 2) {
      const cos = clamp((v1.x * v2.x + v1.y * v2.y) / (m1 * m2), -1, 1);
      bendDeg = clamp((Math.acos(cos) * 180) / Math.PI, 60, 180);
    }
  }

  const coverage = mids.length / ROWS;
  const confidence = clamp(coverage * 0.5 + fitQuality * 0.5, 0, 1);

  return {
    axisDeg: clamp(axisDeg, -60, 60),
    tilt,
    tiltDir,
    widthRatio: clamp(widthRatio, 0.5, 2),
    bendDeg,
    confidence,
  };
}
