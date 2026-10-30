/**
 * Watermarking for paid marketplace designs.
 *
 * Paid designs are shown watermarked everywhere — gallery, AR camera and any
 * saved image — until the buyer has paid for them. The watermark is burned
 * into the pixels (not a CSS overlay) so a screenshot or a saved file cannot
 * be used as a clean stencil.
 */

const cache = new Map<string, string>();

/** Repeated diagonal "INKSIMULATOR" text across the whole image. */
export async function watermarkImage(src: string, label = "INKSIMULATOR"): Promise<string> {
  if (typeof window === "undefined") return src;
  const cached = cache.get(src);
  if (cached) return cached;

  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || 1024;
  canvas.height = image.naturalHeight || 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;

  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const step = Math.max(canvas.width, canvas.height) / 5;
  const fontSize = Math.max(14, step / 6);
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#0a0a0b";
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = Math.max(1, fontSize / 18);
  ctx.font = `bold ${fontSize}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-Math.PI / 6);
  const reach = Math.hypot(canvas.width, canvas.height);
  for (let y = -reach; y <= reach; y += step) {
    for (let x = -reach; x <= reach; x += step * 1.6) {
      ctx.fillText(label, x, y);
      ctx.strokeText(label, x, y);
    }
  }
  ctx.restore();

  const out = canvas.toDataURL("image/png");
  cache.set(src, out);
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image failed to load"));
    img.src = src;
  });
}
