/**
 * Lightweight card detection in the browser (same principle as OpenCV.js
 * edge/contour detection, but without an external WASM download).
 *
 * We look for a flat rectangular object with the bank card's proportions
 * (85.6 x 54 mm ≈ 1.586:1) in the center of the image.
 */

export const CARD_RATIO = 85.6 / 54; // ≈ 1.586
export const CARD_WIDTH_MM = 85.6;

export type CardStatus = "none" | "far" | "tilted" | "glare" | "ok";

export type CardDetection = {
  status: CardStatus;
  /** Normalized box 0-1 in the video's coordinate system. */
  box: { x: number; y: number; w: number; h: number } | null;
  ratio: number;
  /** Help text shown in the overlay. */
  message: string;
};

export const CARD_MESSAGES: Record<CardStatus, string> = {
  none: "Point the camera at the card",
  far: "Move closer to the card",
  tilted: "Hold the card flatter against the skin",
  glare: "Too much reflection – angle away from the light",
  ok: "Card detected – hold still",
};

const SAMPLE_W = 160;

/**
 * Analyzes a video frame and tries to find the card.
 * Uses grayscale + Sobel edges and searches for the strongest rectangular
 * edge box, plus checks for overexposure (glare).
 */
export function detectCard(
  video: HTMLVideoElement,
  work: HTMLCanvasElement,
): CardDetection {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return { status: "none", box: null, ratio: 0, message: CARD_MESSAGES.none };

  const w = SAMPLE_W;
  const h = Math.max(1, Math.round((vh / vw) * SAMPLE_W));
  work.width = w;
  work.height = h;
  const ctx = work.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { status: "none", box: null, ratio: 0, message: CARD_MESSAGES.none };
  ctx.drawImage(video, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  let blown = 0;
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const v = 0.299 * r + 0.587 * g + 0.114 * b;
    gray[i] = v;
    if (v > 250) blown++;
  }
  const glareRatio = blown / (w * h);

  // Sobel magnitude
  const mags = new Float32Array(w * h);
  let maxMag = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -gray[i - w - 1] - 2 * gray[i - 1] - gray[i + w - 1] +
        gray[i - w + 1] + 2 * gray[i + 1] + gray[i + w + 1];
      const gy =
        -gray[i - w - 1] - 2 * gray[i - w] - gray[i - w + 1] +
        gray[i + w - 1] + 2 * gray[i + w] + gray[i + w + 1];
      const m = Math.hypot(gx, gy);
      mags[i] = m;
      if (m > maxMag) maxMag = m;
    }
  }
  if (maxMag < 40) {
    return { status: "none", box: null, ratio: 0, message: CARD_MESSAGES.none };
  }

  // Edge threshold and bounding box over the strongest edges near the image center
  const thr = Math.max(60, maxMag * 0.45);
  let minX = w, minY = h, maxX = 0, maxY = 0, count = 0;
  const cx = w / 2;
  const cy = h / 2;
  const maxDist = Math.hypot(w, h) * 0.42;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mags[y * w + x] < thr) continue;
      if (Math.hypot(x - cx, y - cy) > maxDist) continue;
      count++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  if (count < 40 || maxX <= minX || maxY <= minY) {
    return { status: "none", box: null, ratio: 0, message: CARD_MESSAGES.none };
  }

  const bw = maxX - minX;
  const bh = maxY - minY;
  const ratio = bw >= bh ? bw / bh : bh / bw;
  const box = { x: minX / w, y: minY / h, w: bw / w, h: bh / h };
  const areaFrac = (bw * bh) / (w * h);

  if (glareRatio > 0.12) {
    return { status: "glare", box, ratio, message: CARD_MESSAGES.glare };
  }
  if (areaFrac < 0.06) {
    return { status: "far", box, ratio, message: CARD_MESSAGES.far };
  }
  if (Math.abs(ratio - CARD_RATIO) > 0.35) {
    return { status: "tilted", box, ratio, message: CARD_MESSAGES.tilted };
  }
  return { status: "ok", box, ratio, message: CARD_MESSAGES.ok };
}

/** Millimeters per pixel based on the card's measured width in the image. */
export function mmPerPixel(cardPixelWidth: number) {
  return cardPixelWidth > 0 ? CARD_WIDTH_MM / cardPixelWidth : 0;
}
