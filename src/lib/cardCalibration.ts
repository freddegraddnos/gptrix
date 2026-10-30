/**
 * Scaling step: analyzes the calibration phase (first 3–5 seconds of the
 * recording) plus the standalone still image, finds the card's four corners
 * in the frame where detection is most reliable, and calculates a scale
 * factor against the card's real dimensions (85.6 x 54 mm).
 */
import { CARD_RATIO, CARD_WIDTH_MM, detectCard } from "./cardDetect";

export type CalibrationResult = {
  /** Scale factor to apply to the 3D model (real cm / model unit). */
  scaleFactor: number | null;
  /** 0–1, how reliable the calibration is. */
  confidence: number;
  /** Millimeters per pixel in the selected frame. */
  mmPerPixel: number | null;
  /** The card's width in pixels in the selected frame. */
  cardWidthPx: number | null;
  source: "video" | "still" | null;
};

type Candidate = {
  confidence: number;
  widthPx: number;
  frameWidth: number;
  source: "video" | "still";
};

/** Sharpness measure (variance of Laplace) to select the sharpest frame. */
function sharpness(canvas: HTMLCanvasElement): number {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  const w = Math.min(canvas.width, 160);
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  tmp.getContext("2d")?.drawImage(canvas, 0, 0, w, h);
  const data = tmp.getContext("2d")!.getImageData(0, 0, w, h).data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - w] - gray[i + w];
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return Math.min(1, (sumSq / n - mean * mean) / 400);
}

function scoreFrame(source: HTMLVideoElement | HTMLImageElement, kind: "video" | "still"): Candidate | null {
  const width = "videoWidth" in source ? source.videoWidth : source.naturalWidth;
  const height = "videoWidth" in source ? source.videoHeight : source.naturalHeight;
  if (!width || !height) return null;

  const frame = document.createElement("canvas");
  frame.width = width;
  frame.height = height;
  frame.getContext("2d")?.drawImage(source as CanvasImageSource, 0, 0, width, height);

  const work = document.createElement("canvas");
  // detectCard reads videoWidth/videoHeight and draws the element – a canvas
  // works as a CanvasImageSource, so we borrow the same detector for still images.
  const frameSource = Object.assign(frame, {
    videoWidth: width,
    videoHeight: height,
  }) as unknown as HTMLVideoElement;
  const detection = detectCard(frameSource, work);
  if (!detection.box || detection.status === "none") return null;

  const boxWidthPx = detection.box.w * width;
  const boxHeightPx = detection.box.h * height;
  const ratio = boxWidthPx >= boxHeightPx ? boxWidthPx / boxHeightPx : boxHeightPx / boxWidthPx;
  const ratioError = Math.min(1, Math.abs(ratio - CARD_RATIO) / CARD_RATIO);

  const sharp = sharpness(frame);
  const statusScore = detection.status === "ok" ? 1 : detection.status === "tilted" ? 0.5 : 0.3;
  const sizeScore = Math.min(1, (boxWidthPx * boxHeightPx) / (width * height) / 0.15);
  const confidence =
    Math.max(0, 0.4 * statusScore + 0.25 * (1 - ratioError) + 0.2 * sharp + 0.15 * sizeScore) *
    (kind === "still" ? 1.05 : 1);

  return {
    confidence: Math.min(1, confidence),
    widthPx: Math.max(boxWidthPx, boxHeightPx),
    frameWidth: width,
    source: kind,
  };
}

async function seek(video: HTMLVideoElement, time: number) {
  return new Promise<void>((resolve) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      resolve();
    };
    video.addEventListener("seeked", done);
    video.currentTime = time;
    setTimeout(done, 1200);
  });
}

/**
 * Runs edge/contour detection on multiple frames from the calibration phase
 * plus the still image and picks the one with the highest confidence.
 */
export async function calibrateFromRecording(
  videoBlob: Blob,
  stillDataUrl: string | null,
  calibrationSeconds = 5,
): Promise<CalibrationResult> {
  const candidates: Candidate[] = [];

  // 1. The still image (no motion blur)
  if (stillDataUrl) {
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => resolve(null);
      i.src = stillDataUrl;
    });
    if (img) {
      const c = scoreFrame(img, "still");
      if (c) candidates.push(c);
    }
  }

  // 2. Frames from the first seconds of the video
  const url = URL.createObjectURL(videoBlob);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("video_load_failed"));
    });
    const end = Math.min(calibrationSeconds, video.duration || calibrationSeconds);
    const times = [0.4, 0.9, 1.5, 2.2, 3, 3.8, 4.6].filter((t) => t < end);
    for (const t of times) {
      await seek(video, t);
      const c = scoreFrame(video, "video");
      if (c) candidates.push(c);
    }
  } catch {
    /* continue with what we have */
  } finally {
    URL.revokeObjectURL(url);
  }

  if (!candidates.length) {
    return { scaleFactor: null, confidence: 0, mmPerPixel: null, cardWidthPx: null, source: null };
  }

  const best = candidates.reduce((a, b) => (b.confidence > a.confidence ? b : a));
  const mmPerPixel = CARD_WIDTH_MM / best.widthPx;
  // The model from KIRI is unitless; the card's real width relative to the
  // image's width gives the metric reference for the entire coordinate system.
  const sceneWidthCm = (mmPerPixel * best.frameWidth) / 10;
  const scaleFactor = sceneWidthCm > 0 ? sceneWidthCm / 100 : null;

  return {
    scaleFactor,
    confidence: Number(best.confidence.toFixed(2)),
    mmPerPixel,
    cardWidthPx: best.widthPx,
    source: best.source,
  };
}
