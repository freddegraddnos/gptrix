/**
 * Animated share export: a 3-5 second branded clip rendered from a single
 * captured still. Canvas + MediaRecorder (MP4 where the browser supports it,
 * WebM otherwise) — same branding, safe areas and burned-in logo/link as the
 * still exports.
 */

import { drawShareFrame, targetSize, type ShareFormat } from "@/lib/shareFrame";
import { extFor, pickMimeType, recorderSupported } from "@/lib/videoRecording";

export const clipSupported = recorderSupported;

export type ClipOptions = {
  caption?: string;
  subline?: string;
  format?: ShareFormat;
  /** Clip length in seconds (3-5). */
  seconds?: number;
  onProgress?: (fraction: number) => void;
};

export type ClipResult = { blob: Blob; ext: string; mime: string };

const FPS = 30;

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

/** Slow push-in + caption fade + light sweep, then a clean branded hold. */
export async function renderShareClip(
  sourceDataUrl: string,
  opts: ClipOptions = {},
): Promise<ClipResult> {
  if (!recorderSupported()) {
    throw new Error("This browser can't record video clips.");
  }
  const mime = pickMimeType();
  if (!mime) throw new Error("This browser can't record video clips.");

  const seconds = Math.min(5, Math.max(3, opts.seconds ?? 4));
  const format = opts.format ?? "9:16";
  const img = await loadImage(sourceDataUrl);
  const { w, h } = targetSize(format, img);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not prepare the clip.");

  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<ClipResult>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve({
        blob: new Blob(chunks, { type: mime }),
        ext: extFor(mime),
        mime,
      });
    };
  });

  recorder.start();
  const total = seconds * 1000;
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(1, elapsed / total);
      opts.onProgress?.(t);

      // Slow push-in over the whole clip
      const zoom = 1.06 - 0.06 * easeInOut(t);
      // Text and badge fade in over the first 0.7 s and stay put
      const textAlpha = Math.min(1, elapsed / 700);

      drawShareFrame(
        ctx,
        img,
        w,
        h,
        {
          caption: opts.caption ?? "Should I get this tattoo?",
          subline: opts.subline,
          format,
          textAlpha,
        },
        zoom,
      );

      // Diagonal light sweep across the middle of the clip
      const sweep = (t - 0.25) / 0.45;
      if (sweep > 0 && sweep < 1) {
        const x = -w * 0.4 + sweep * w * 1.8;
        const g = ctx.createLinearGradient(x - w * 0.25, 0, x + w * 0.25, h);
        g.addColorStop(0, "rgba(255,255,255,0)");
        g.addColorStop(0.5, `rgba(255,255,255,${0.16 * Math.sin(sweep * Math.PI)})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      if (t >= 1) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  recorder.stop();
  return done;
}
