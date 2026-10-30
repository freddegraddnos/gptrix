/** Client tools for votes: device ID, local vote guard, and share image. */

import { drawBrandBadge } from "@/lib/brandBadge";

const DEVICE_KEY = "inkvision.device-id";
const VOTED_PREFIX = "inkvision.voted.";

export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return "";
  }
}

export function getLocalVote(slug: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOTED_PREFIX + slug);
  } catch {
    return null;
  }
}

export function setLocalVote(slug: string, choice: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOTED_PREFIX + slug, choice);
  } catch {
    /* ignore */
  }
}

export type SummaryInput = {
  caption: string;
  headline: string;
  subline: string;
  bars: { label: string; pct: number }[];
  total: number;
  imageUrls: string[];
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Renders a shareable summary image (1080x1350) with the InkSimulator logo. */
export async function renderVoteSummary(input: SummaryInput): Promise<Blob | null> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 260, 40, W / 2, 260, 700);
  glow.addColorStop(0, "rgba(34,211,238,0.18)");
  glow.addColorStop(1, "rgba(11,11,13,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Images
  const imgs = (await Promise.all(input.imageUrls.slice(0, 2).map(loadImage))).filter(
    (i): i is HTMLImageElement => !!i,
  );
  const top = 150;
  const boxH = 520;
  if (imgs.length > 0) {
    const gap = 24;
    const boxW = imgs.length === 2 ? (W - 120 - gap) / 2 : W - 120;
    imgs.forEach((img, i) => {
      const x = 60 + i * (boxW + gap);
      ctx.save();
      roundRect(ctx, x, top, boxW, boxH, 28);
      ctx.clip();
      const scale = Math.max(boxW / img.width, boxH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      ctx.drawImage(img, x + (boxW - dw) / 2, top + (boxH - dh) / 2, dw, dh);
      ctx.restore();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 2;
      roundRect(ctx, x, top, boxW, boxH, 28);
      ctx.stroke();
    });
  }

  // Caption
  ctx.fillStyle = "#f5f2ec";
  ctx.textAlign = "center";
  ctx.font = "600 46px system-ui, -apple-system, Segoe UI, sans-serif";
  const caption = input.caption.length > 42 ? `${input.caption.slice(0, 41)}…` : input.caption;
  ctx.fillText(caption, W / 2, 100);

  // Headline
  ctx.fillStyle = "#8A5BF2";
  ctx.font = "700 96px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(input.headline, W / 2, top + boxH + 130);
  ctx.fillStyle = "rgba(245,242,236,0.65)";
  ctx.font = "400 34px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText(input.subline, W / 2, top + boxH + 182);

  // Bars
  let barY = top + boxH + 240;
  ctx.textAlign = "left";
  for (const bar of input.bars) {
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 90, barY, W - 180, 44, 22);
    ctx.fill();
    ctx.fillStyle = "#8A5BF2";
    roundRect(ctx, 90, barY, Math.max(44, ((W - 180) * bar.pct) / 100), 44, 22);
    ctx.fill();
    ctx.fillStyle = "#0b0b0d";
    ctx.font = "600 26px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(`${bar.label} ${bar.pct}%`, 110, barY + 30);
    barY += 62;
  }

  // Logo lockup
  drawBrandBadge(ctx, { x: W / 2, y: H - 96, size: 56, align: "center", showUrl: false });
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(245,242,236,0.55)";
  ctx.font = "500 28px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("inksimulator.com — try your tattoo in AR", W / 2, H - 38);

  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 0.95));
}
