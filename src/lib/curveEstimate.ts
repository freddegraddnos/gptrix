/**
 * Automatic limb-curvature estimation.
 *
 * Instead of asking the user to guess how round their own arm is, we read it
 * from the camera image: a cylindrical limb lit by any ordinary room light
 * shows a bright band along its length with the luminance falling off toward
 * both silhouette edges. A flat surface (chest, back, table) does not.
 *
 * We sample a horizontal strip of the video under the design, average the
 * luminance per column, then compare the middle of the limb with its edges.
 * The relative falloff maps almost directly onto the `curve` amount the wrap
 * pipeline already takes (0 = flat, 1 = a thin wrist).
 */

export type CurveSample = {
  /** 0..1 curvature amount for the body wrap. */
  curve: number;
  /** 0..1 how trustworthy the reading is. */
  confidence: number;
  /** Both silhouette edges of the limb were found inside the sampled strip. */
  edgesInFrame: boolean;
  /** How wide the limb is relative to the sampled strip, 0..1. */
  limbFraction: number;
};

const W = 128; // sampling width in columns
const H = 36; // sampled rows

let scratch: HTMLCanvasElement | null = null;
function ctx2d() {
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratch.width = W;
    scratch.height = H;
  }
  return scratch.getContext("2d", { willReadFrequently: true });
}

/**
 * @param center screen-space centre of the design, in CSS px inside `rect`
 * @param widthPx on-screen width of the design in CSS px
 */
export function estimateCurvature(
  video: HTMLVideoElement,
  rect: { width: number; height: number },
  center: { x: number; y: number },
  widthPx: number,
  mirrored: boolean,
): CurveSample | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh || video.readyState < 2) return null;
  const ctx = ctx2d();
  if (!ctx) return null;

  // Screen -> video pixels (object-cover fit, mirrored preview for selfie cam).
  const s = Math.max(rect.width / vw, rect.height / vh);
  const vx0 = (center.x - (rect.width - vw * s) / 2) / s;
  const cx = mirrored ? vw - vx0 : vx0;
  const cy = (center.y - (rect.height - vh * s) / 2) / s;

  // Look a bit wider than the design so both silhouette edges fall inside.
  const boxW = Math.min(vw, ((widthPx / s) || vw * 0.4) * 2.1);
  const boxH = Math.max(8, boxW * 0.22);
  const sx = cx - boxW / 2;
  const sy = cy - boxH / 2;
  if (sx + boxW < 0 || sy + boxH < 0 || sx > vw || sy > vh) return null;

  try {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(video, sx, sy, boxW, boxH, 0, 0, W, H);
  } catch {
    return null;
  }

  const data = ctx.getImageData(0, 0, W, H).data;
  const cols = new Float32Array(W);
  const red = new Float32Array(W);
  const green = new Float32Array(W);
  const blue = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0;
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let y = 0; y < H; y++) {
      const i = (y * W + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      sr += r;
      sg += g;
      sb += b;
    }
    cols[x] = sum / H;
    red[x] = sr / H;
    green[x] = sg / H;
    blue[x] = sb / H;
  }

  // Light 5-tap smoothing kills sensor noise and skin texture.
  const sm = new Float32Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0;
    let n = 0;
    for (let k = -2; k <= 2; k++) {
      const j = x + k;
      if (j < 0 || j >= W) continue;
      sum += cols[j];
      n++;
    }
    sm[x] = sum / n;
  }

  // First estimate the actual silhouette. This works in even lighting where
  // the old "bright middle, dark edges" assumption made every limb look flat.
  const centerFrom = Math.round(W * 0.45);
  const centerTo = Math.round(W * 0.55);
  let cr = 0;
  let cg = 0;
  let cb = 0;
  let cl = 0;
  for (let x = centerFrom; x <= centerTo; x++) {
    cr += red[x];
    cg += green[x];
    cb += blue[x];
    cl += sm[x];
  }
  const centerCount = centerTo - centerFrom + 1;
  cr /= centerCount;
  cg /= centerCount;
  cb /= centerCount;
  cl /= centerCount;

  const difference = (x: number) => {
    const color = Math.hypot(red[x] - cr, green[x] - cg, blue[x] - cb);
    const luminance = Math.abs(sm[x] - cl);
    const gradient = x > 1 && x < W - 2 ? Math.abs(sm[x + 2] - sm[x - 2]) : 0;
    return color * 0.72 + luminance * 0.28 + gradient * 0.7;
  };
  const findEdge = (direction: -1 | 1) => {
    const start = direction < 0 ? centerFrom : centerTo;
    const end = direction < 0 ? 3 : W - 4;
    for (let x = start; direction < 0 ? x >= end : x <= end; x += direction) {
      const d0 = difference(x);
      const d1 = difference(x + direction);
      const d2 = difference(x + direction * 2);
      if (d0 > 17 && d1 > 17 && d2 > 14) return x;
    }
    return null;
  };
  const leftEdge = findEdge(-1);
  const rightEdge = findEdge(1);
  const hasSilhouette = leftEdge !== null && rightEdge !== null && rightEdge - leftEdge > W * 0.24;
  const motifSampleWidth = W / 2.1;
  const limbWidth = hasSilhouette ? rightEdge - leftEdge : W;
  const coverage = Math.max(0.18, Math.min(0.96, motifSampleWidth / limbWidth));
  // A decal covering this fraction of a cylindrical silhouette spans asin(f)
  // radians around it. This is geometric curvature, independent of shadows.
  const silhouetteCurve = Math.min(1, Math.asin(coverage) / (75 * Math.PI / 180));

  // Lighting remains a useful secondary cue when the silhouette is cropped.
  let peak = 0;
  let peakX = W / 2;
  for (let x = 8; x < W - 8; x++) {
    if (sm[x] > peak) {
      peak = sm[x];
      peakX = x;
    }
  }
  if (peak < 18) return null; // too dark to judge

  const edge = (from: number, to: number) => {
    let min = Infinity;
    for (let x = from; x < to; x++) min = Math.min(min, sm[x]);
    return min;
  };
  const left = edge(0, Math.max(4, Math.round(W * 0.18)));
  const right = edge(Math.round(W * 0.82), W);

  // A cylinder falls off on *both* sides; a shadow or a wall edge only on one.
  const dl = (peak - left) / peak;
  const dr = (peak - right) / peak;
  const symmetric = 1 - Math.min(1, Math.abs(dl - dr) / Math.max(0.08, dl + dr));
  const falloff = Math.min(dl, dr);

  // Empirical mapping: ~8 % falloff reads as flat, ~45 % as a wrist.
  const lightCurve = Math.max(0, Math.min(1, (falloff - 0.05) / 0.32));

  // Off-centre peaks mean we are looking at an edge, not at a limb.
  const centred = 1 - Math.min(1, Math.abs(peakX - W / 2) / (W / 2));
  const lightConfidence = Math.max(
    0,
    Math.min(1, symmetric * 0.55 + centred * 0.3 + Math.min(1, falloff * 3) * 0.15),
  );
  const edgeStrength = hasSilhouette
    ? Math.min(1, (difference(leftEdge) + difference(rightEdge)) / 70)
    : 0;
  const silhouetteConfidence = hasSilhouette ? 0.55 + edgeStrength * 0.45 : 0;
  const confidence = Math.max(lightConfidence * 0.72, silhouetteConfidence);
  const curve = hasSilhouette
    ? silhouetteCurve * 0.78 + lightCurve * 0.22
    : lightCurve;

  return {
    curve: Math.max(0.12, Math.min(1, curve)),
    confidence,
    edgesInFrame: hasSilhouette,
    limbFraction: Math.max(0, Math.min(1, limbWidth / W)),
  };
}
