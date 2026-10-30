/**
 * Image pipeline for "Try It On Me":
 *  1. white background -> transparent (same engine as the upload tool)
 *  2. automatic crop to the motif's visible area (alpha bounding box)
 *  3. manual crop (crop-rect in 0..1) as the final step
 */
import { removeColor, DEFAULT_KEY, type RemovalOptions } from "@/lib/transparency";

export type Rect = { x: number; y: number; w: number; h: number };

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read the file"));
    fr.readAsDataURL(file);
  });
}

function canvasOf(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Runs white-to-transparent on an image and returns a PNG data URL (downscaled to maxSize). */
export async function keyOutBackground(
  src: string,
  opts?: Partial<RemovalOptions> & { maxSize?: number },
): Promise<string> {
  const img = await loadImage(src);
  const max = opts?.maxSize ?? 1400;
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = canvasOf(img.width * scale, img.height * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return src;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const out = removeColor(ctx.getImageData(0, 0, c.width, c.height), {
    color: opts?.color ?? DEFAULT_KEY,
    tolerance: opts?.tolerance ?? 28,
    feather: opts?.feather ?? 54,
    edgesOnly: opts?.edgesOnly ?? false,
  });
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.putImageData(out, 0, 0);
  return c.toDataURL("image/png");
}

/** Finds the motif's bounding box (normalized 0..1) based on the alpha channel. */
export async function autoCropRect(src: string, padding = 0.03): Promise<Rect> {
  const img = await loadImage(src);
  const c = canvasOf(Math.min(480, img.width), Math.min(480, img.width) * (img.height / img.width));
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { x: 0, y: 0, w: 1, h: 1 };
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 24) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: 1, h: 1 };
  const rect = {
    x: minX / width - padding,
    y: minY / height - padding,
    w: (maxX - minX + 1) / width + padding * 2,
    h: (maxY - minY + 1) / height + padding * 2,
  };
  return clampRect(rect);
}

export function clampRect(r: Rect): Rect {
  const w = Math.min(1, Math.max(0.05, r.w));
  const h = Math.min(1, Math.max(0.05, r.h));
  return {
    w,
    h,
    x: Math.min(1 - w, Math.max(0, r.x)),
    y: Math.min(1 - h, Math.max(0, r.y)),
  };
}

/** Crops the image according to a normalized rect and returns a PNG data URL. */
export async function cropToDataUrl(src: string, rect: Rect, maxSize = 1024): Promise<string> {
  const img = await loadImage(src);
  const sx = rect.x * img.width;
  const sy = rect.y * img.height;
  const sw = Math.max(1, rect.w * img.width);
  const sh = Math.max(1, rect.h * img.height);
  const scale = Math.min(1, maxSize / Math.max(sw, sh));
  const c = canvasOf(sw * scale, sh * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return c.toDataURL("image/png");
}
