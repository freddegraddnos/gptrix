/** Helpers for canvas recording, watermarking, and sharing/downloading. */

export const MAX_RECORD_SECONDS = 30;

/** Picks the first mime type the browser actually supports. */
export function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/mp4;codecs=h264,aac",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      /* ignore */
    }
  }
  return null;
}

export const recorderSupported = () =>
  typeof MediaRecorder !== "undefined" &&
  typeof HTMLCanvasElement !== "undefined" &&
  typeof HTMLCanvasElement.prototype.captureStream === "function";

export const extFor = (mime: string) =>
  mime.includes("mp4") ? "mp4" : "webm";

/** Loads the app icon as a watermark (returns null if it can't be loaded). */
export function loadWatermark(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = "/icon-192.png";
  });
}

/** Draws the InkSimulator logo small and semi-transparent in the bottom-right corner. */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  logo: HTMLImageElement | null,
) {
  const pad = Math.round(width * 0.025);
  const size = Math.max(28, Math.round(width * 0.07));
  ctx.save();
  ctx.globalAlpha = 0.55;
  const textSize = Math.max(11, Math.round(width * 0.026));
  ctx.font = `600 ${textSize}px system-ui, sans-serif`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "right";
  const label = "INKSIMULATOR";
  const textWidth = ctx.measureText(label).width;
  const baseY = height - pad - size / 2;
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = size * 0.25;
  ctx.fillText(label, width - pad, baseY);
  if (logo) {
    ctx.drawImage(
      logo,
      width - pad - textWidth - size * 0.5 - size,
      height - pad - size,
      size,
      size,
    );
  }
  ctx.restore();
}

export const shareSupported = (file: File) =>
  typeof navigator !== "undefined" &&
  typeof navigator.share === "function" &&
  (typeof navigator.canShare !== "function" ||
    navigator.canShare({ files: [file] }));

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
