/** In-browser background removal (no upload). Returns an alpha-mask canvas (white = keep). */
export async function computeMask(img: HTMLImageElement, maxSide = 1024): Promise<HTMLCanvasElement> {
  const { removeBackground } = await import("@imgly/background-removal");
  const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * s));
  const h = Math.max(1, Math.round(img.naturalHeight * s));
  const src = document.createElement("canvas");
  src.width = w; src.height = h;
  src.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const blob = await new Promise<Blob>((r) => src.toBlob((b) => r(b!), "image/png"));
  const cut = await removeBackground(blob, { output: { format: "image/png" } });
  const bmp = await createImageBitmap(cut);
  const m = document.createElement("canvas");
  m.width = w; m.height = h;
  const ctx = m.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  // Normalize to luminance→alpha so mask drawing via destination-in works.
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const a = d.data[i + 3];
    d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
    d.data[i + 3] = a;
  }
  ctx.putImageData(d, 0, 0);
  return m;
}

/** Subject on white, background removed — fed to the line engine. */
export function composite(img: HTMLImageElement, mask: HTMLCanvasElement): HTMLCanvasElement {
  // Keep the source at full resolution; only the mask is upscaled.
  const w = img.naturalWidth || mask.width, h = img.naturalHeight || mask.height;
  const fg = document.createElement("canvas");
  fg.width = w; fg.height = h;
  const f = fg.getContext("2d")!;
  f.drawImage(img, 0, 0, w, h);
  f.globalCompositeOperation = "destination-in";
  f.drawImage(mask, 0, 0, w, h);
  const out = document.createElement("canvas");
  out.width = w; out.height = h;
  const o = out.getContext("2d")!;
  o.fillStyle = "#fff";
  o.fillRect(0, 0, w, h);
  o.drawImage(fg, 0, 0);
  return out;
}
