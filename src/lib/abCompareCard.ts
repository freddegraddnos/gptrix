/**
 * Builds a shareable "1 vs 2" card from two saved placement photos, and
 * helpers to share both photos together as separate files.
 *
 * No 3D/body-mesh claims here: these are the calibrated 2D AR composites
 * the app already produced, laid side by side for a friend vote.
 */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function badge(
  ctx: CanvasRenderingContext2D,
  label: string,
  cx: number,
  cy: number,
  r: number,
) {
  ctx.save();
  ctx.fillStyle = "rgba(9,10,12,0.85)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.stroke();
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${Math.round(r * 1.15)}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + r * 0.04);
  ctx.restore();
}

export type AbCardOptions = {
  labelA?: string;
  labelB?: string;
  caption?: string;
};

/** Renders a 1080x1350 card with option 1 on the left and option 2 on the right. */
export async function composeAbCard(
  srcA: string,
  srcB: string,
  opts: AbCardOptions = {},
): Promise<Blob> {
  const [a, b] = await Promise.all([loadImage(srcA), loadImage(srcB)]);
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#0a0b0d";
  ctx.fillRect(0, 0, W, H);

  const pad = 28;
  const top = 150;
  const gap = 16;
  const cellW = (W - pad * 2 - gap) / 2;
  const cellH = H - top - 150;

  drawCover(ctx, a, pad, top, cellW, cellH);
  drawCover(ctx, b, pad + cellW + gap, top, cellW, cellH);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.strokeRect(pad, top, cellW, cellH);
  ctx.strokeRect(pad + cellW + gap, top, cellW, cellH);

  badge(ctx, opts.labelA ?? "1", pad + 54, top + 54, 38);
  badge(ctx, opts.labelB ?? "2", pad + cellW + gap + 54, top + 54, 38);

  // Headline
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 62px system-ui, sans-serif";
  ctx.fillText(opts.caption ?? "1 or 2?", W / 2, 82);

  // Footer
  ctx.font = "600 30px system-ui, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText("Vote in the link · inksimulator.com", W / 2, H - 74);

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not build the card."))),
      "image/jpeg",
      0.92,
    ),
  );
}

export async function urlToBlob(url: string): Promise<Blob> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not read the saved image.");
  return await res.blob();
}

export function canShareFiles(files: File[]): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.canShare?.({ files }) &&
    !!navigator.share
  );
}

export function downloadBlobFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
