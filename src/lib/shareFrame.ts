/**
 * Shared layout engine for every exported share image and clip.
 *
 * Social apps overlay their own UI on top of media (Stories/Reels put buttons
 * in the bottom ~18% and a header in the top ~12%), so all burned-in content —
 * caption, tagline and the InkSimulator badge — is laid out inside a safe area
 * and stacked bottom-up so nothing is ever clipped or hidden.
 */

import { drawBrandBadge } from "@/lib/brandBadge";

export type ShareFormat = "original" | "9:16" | "1:1";

export const SHARE_FORMATS: { id: ShareFormat; label: string; hint: string }[] = [
  { id: "9:16", label: "9:16", hint: "Stories, Reels, TikTok" },
  { id: "1:1", label: "1:1", hint: "Feed posts, profiles" },
  { id: "original", label: "Original", hint: "Full camera frame" },
];

/** Fractional insets kept free of important content, per format. */
export function safeArea(format: ShareFormat) {
  if (format === "9:16") return { top: 0.1, bottom: 0.16, side: 0.075 };
  if (format === "1:1") return { top: 0.05, bottom: 0.07, side: 0.06 };
  return { top: 0.04, bottom: 0.05, side: 0.045 };
}

/** Longest edge of an exported frame in the source ratio. */
const TARGET_LONG_EDGE = 1920;

export function targetSize(
  format: ShareFormat,
  img: { width: number; height: number },
): { w: number; h: number } {
  if (format === "9:16") return { w: 1080, h: 1920 };
  if (format === "1:1") return { w: 1350, h: 1350 };
  const long = Math.max(img.width, img.height);
  const k = long > TARGET_LONG_EDGE ? TARGET_LONG_EDGE / long : 1;
  return { w: Math.round(img.width * k), h: Math.round(img.height * k) };
}

/** Greedy word wrap against a pixel width, capped at `maxLines`. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    // ellipsise the last line if there is still text left over
    let last = lines[maxLines - 1]!;
    const joined = lines.join(" ");
    if (joined.length < text.length) {
      while (ctx.measureText(`${last}…`).width > maxWidth && last.length > 2) {
        last = last.slice(0, -1);
      }
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

export type FrameContent = {
  caption?: string;
  subline?: string;
  format: ShareFormat;
  /** 0-1 fade for animated exports (text and badge only). */
  textAlpha?: number;
};

/**
 * Draws the complete branded frame: blurred backdrop, the photo fitted above
 * the text block, then caption + tagline + logo stacked inside the safe area.
 */
export function drawShareFrame(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource & { width: number; height: number },
  w: number,
  h: number,
  content: FrameContent,
  /** 1 = no zoom; used by the animated export for a slow push-in. */
  zoom = 1,
) {
  const { format } = content;
  const safe = safeArea(format);
  const sideInset = w * safe.side;
  const maxTextWidth = w - sideInset * 2;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, w, h);

  // ---- measure the text block first, so the photo can sit above it ----
  const captionText = content.caption?.trim();
  const sublineText = content.subline?.trim();
  const base = Math.min(w, h * 0.9);
  let capSize = Math.round(base * 0.058);
  let capLines: string[] = [];
  if (captionText) {
    for (;;) {
      ctx.font = `700 ${capSize}px "Space Grotesk", "Inter", sans-serif`;
      capLines = wrap(ctx, captionText, maxTextWidth, 2);
      const widest = Math.max(...capLines.map((l) => ctx.measureText(l).width));
      if (widest <= maxTextWidth || capSize <= base * 0.032) break;
      capSize = Math.round(capSize * 0.92);
    }
  }
  const subSize = Math.round(capSize * 0.5);
  const badgeSize = Math.round(base * 0.05);
  const lineGap = capSize * 1.22;

  const bottomInset = h * safe.bottom;
  const badgeH = badgeSize * 1.6;
  const blockH =
    capLines.length * lineGap +
    (sublineText ? subSize * 1.7 : 0) +
    badgeH +
    capSize * 0.5;
  const blockTop = h - bottomInset - blockH;

  // ---- backdrop: blurred, over-scaled copy so gaps are never black bars ----
  const coverK = Math.max(w / img.width, h / img.height);
  ctx.save();
  ctx.filter = "blur(48px) brightness(0.45)";
  const bw = img.width * coverK * 1.2 * zoom;
  const bh = img.height * coverK * 1.2 * zoom;
  ctx.drawImage(img, (w - bw) / 2, (h - bh) / 2, bw, bh);
  ctx.restore();

  // ---- photo, fitted into the area above the text block ----
  const areaTop = h * safe.top * 0.35;
  const areaH = Math.max(h * 0.35, blockTop - areaTop + capSize * 0.4);
  const fitK =
    format === "original"
      ? coverK * zoom
      : Math.min(w / img.width, areaH / img.height) * zoom;
  const dw = img.width * fitK;
  const dh = img.height * fitK;
  const dy =
    format === "original" ? (h - dh) / 2 : areaTop + (areaH - dh) / 2;
  ctx.drawImage(img, (w - dw) / 2, dy, dw, dh);

  // ---- veil behind the text block ----
  const veilTop = Math.max(0, blockTop - capSize * 2.2);
  const grad = ctx.createLinearGradient(0, veilTop, 0, h);
  grad.addColorStop(0, "rgba(5,5,5,0)");
  grad.addColorStop(0.45, "rgba(5,5,5,0.72)");
  grad.addColorStop(1, "rgba(5,5,5,0.95)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, veilTop, w, h - veilTop);

  // ---- text stack ----
  ctx.save();
  ctx.globalAlpha = content.textAlpha ?? 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  let y = blockTop + capSize;
  if (capLines.length) {
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${capSize}px "Space Grotesk", "Inter", sans-serif`;
    for (const line of capLines) {
      ctx.fillText(line, w / 2, y);
      y += lineGap;
    }
  }
  if (sublineText) {
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `500 ${subSize}px "Inter", sans-serif`;
    const subLines = wrap(ctx, sublineText, maxTextWidth, 1);
    ctx.fillText(subLines[0] ?? "", w / 2, y);
    y += subSize * 1.7;
  }
  drawBrandBadge(ctx, {
    x: w / 2,
    y: Math.min(y + badgeH * 0.3, h - bottomInset * 0.35),
    size: badgeSize,
    align: "center",
    showUrl: true,
  });
  ctx.restore();
}
