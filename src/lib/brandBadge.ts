/**
 * Shared canvas branding: the InkSimulator viewfinder mark, wordmark and URL.
 * Every shareable image goes through this so nothing leaves the app unbranded.
 */

const BRAND_ACCENT = "#8A5BF2";

export type BadgeOptions = {
  /** Left edge of the badge. */
  x: number;
  /** Vertical centre of the badge. */
  y: number;
  /** Mark size (square). Text scales from this. */
  size?: number;
  color?: string;
  /** Draw a translucent pill behind the badge for busy backgrounds. */
  pill?: boolean;
  align?: "left" | "center";
  /** Show "inksimulator.com" under the wordmark. */
  showUrl?: boolean;
};

/** Total width the badge occupies, for layout maths. */
export function brandBadgeWidth(size = 44) {
  return size + size * 0.42 + size * 4.6;
}

/** Draws the InkSimulator mark + wordmark + inksimulator.com onto a canvas. */
export function drawBrandBadge(
  ctx: CanvasRenderingContext2D,
  opts: BadgeOptions,
) {
  const size = opts.size ?? 44;
  const color = opts.color ?? "#FFFFFF";
  const showUrl = opts.showUrl ?? true;
  const gap = size * 0.42;
  const wordSize = size * 0.62;
  const urlSize = size * 0.4;
  const textW = Math.max(
    ctx.measureText("INKSIMULATOR").width,
    size * 4.2,
  );
  const totalW = size + gap + textW;
  let x = opts.x;
  if (opts.align === "center") x = opts.x - totalW / 2;
  const cy = opts.y;

  ctx.save();

  if (opts.pill) {
    const padX = size * 0.5;
    const padY = size * 0.38;
    const h = size + padY * 2;
    ctx.fillStyle = "rgba(5,5,5,0.55)";
    const r = h / 2;
    const px = x - padX;
    const py = cy - h / 2;
    const pw = totalW + padX * 2;
    ctx.beginPath();
    ctx.moveTo(px + r, py);
    ctx.arcTo(px + pw, py, px + pw, py + h, r);
    ctx.arcTo(px + pw, py + h, px, py + h, r);
    ctx.arcTo(px, py + h, px, py, r);
    ctx.arcTo(px, py, px + pw, py, r);
    ctx.closePath();
    ctx.fill();
  }

  // Viewfinder mark
  const mx = x;
  const my = cy - size / 2;
  const corner = size * 0.3;
  const lw = Math.max(2, size * 0.09);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.lineCap = "round";
  const corners: [number, number, number, number][] = [
    [mx, my, 1, 1],
    [mx + size, my, -1, 1],
    [mx, my + size, 1, -1],
    [mx + size, my + size, -1, -1],
  ];
  for (const [cx0, cy0, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx0 + sx * corner, cy0);
    ctx.lineTo(cx0, cy0);
    ctx.lineTo(cx0, cy0 + sy * corner);
    ctx.stroke();
  }
  // Needle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(mx + size * 0.3, my + size * 0.3);
  ctx.lineTo(mx + size * 0.62, my + size * 0.46);
  ctx.lineTo(mx + size * 0.46, my + size * 0.62);
  ctx.closePath();
  ctx.fill();
  // Violet dot accent
  ctx.fillStyle = BRAND_ACCENT;
  ctx.beginPath();
  ctx.arc(mx + size * 0.72, my + size * 0.72, size * 0.11, 0, Math.PI * 2);
  ctx.fill();

  // Wordmark
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = color;
  ctx.font = `700 ${wordSize}px "Space Grotesk", "Inter", system-ui, sans-serif`;
  const tx = x + size + gap;
  if (showUrl) {
    ctx.fillText("INKSIMULATOR", tx, cy + wordSize * 0.05);
    ctx.fillStyle = BRAND_ACCENT;
    ctx.font = `600 ${urlSize}px "Inter", system-ui, sans-serif`;
    ctx.fillText("inksimulator.com", tx, cy + wordSize * 0.05 + urlSize * 1.25);
  } else {
    ctx.fillText("INKSIMULATOR", tx, cy + wordSize * 0.35);
  }

  ctx.restore();
}
