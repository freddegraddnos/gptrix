/**
 * Editable text layers.
 *
 * A text layer is an ordinary pixel layer that keeps its `TextSpec` alongside
 * its canvas: the canvas is always a *render* of the spec, never the source of
 * truth. That means text stays editable forever (change the wording, font, size
 * or colour and the layer is re-rendered), while every existing feature —
 * compositing, blend modes, groups, clipping masks, export, print — keeps
 * working unchanged because the node is still `kind: "layer"`.
 *
 * No React here; this module only touches canvas 2D.
 */

import type { RGB } from "./types";
import { customFontById, listCustomFonts, loadStoredCustomFonts } from "./customFonts";

export interface TextFont {
  id: string;
  label: string;
  /** CSS font-family stack used both on the canvas and in the UI preview. */
  stack: string;
  /** Extra leading multiplier, tuned per family. */
  lineHeight: number;
}

/** Three faces that cover the tattoo lettering staples: script, serif, block. */
export const TEXT_FONTS: TextFont[] = [
  {
    id: "script",
    label: "Skrivstil",
    stack: '"Dancing Script", "Segoe Script", cursive',
    lineHeight: 1.32,
  },
  {
    id: "serif",
    label: "Klassisk",
    stack: '"Cinzel", "Times New Roman", serif',
    lineHeight: 1.28,
  },
  {
    id: "block",
    label: "Block",
    stack: '"Bebas Neue", "Arial Narrow", Impact, sans-serif',
    lineHeight: 1.1,
  },
];

export const DEFAULT_FONT_ID = "script";

/** Built-in faces plus every font the artist has loaded themselves. */
export function allTextFonts(): TextFont[] {
  return [...TEXT_FONTS, ...listCustomFonts()];
}

export function fontById(id: string): TextFont {
  return (
    TEXT_FONTS.find((f) => f.id === id) ?? customFontById(id) ?? TEXT_FONTS[0]!
  );
}

export type TextAlign = "left" | "center" | "right";

/** Everything needed to re-render the layer from scratch. */
export interface TextSpec {
  content: string;
  fontId: string;
  /** Cap height in document pixels. */
  fontSize: number;
  color: RGB;
  align: TextAlign;
  /** Block centre in document space (so rotation and scaling stay symmetric). */
  cx: number;
  cy: number;
  /** Rotation in radians, clockwise, around the centre. */
  angle: number;
  /**
   * Arc bend, -1..1. 0 is a straight baseline, positive bends the text upwards
   * (smile), negative downwards (frown). The magnitude is the fraction of a
   * half circle the line sweeps.
   */
  curve?: number;
}

export function defaultTextSpec(
  docWidth: number,
  docHeight: number,
  color: RGB,
): TextSpec {
  return {
    content: "Text",
    fontId: DEFAULT_FONT_ID,
    fontSize: Math.max(24, Math.round(Math.min(docWidth, docHeight) * 0.12)),
    color,
    align: "center",
    cx: docWidth / 2,
    cy: docHeight / 2,
    angle: 0,
    curve: 0,
  };
}

function cssFont(spec: TextSpec): string {
  return `${spec.fontSize}px ${fontById(spec.fontId).stack}`;
}

export function textLines(spec: TextSpec): string[] {
  return spec.content.replace(/\r/g, "").split("\n");
}

/** Line box height in document pixels. */
export function lineStep(spec: TextSpec): number {
  return spec.fontSize * fontById(spec.fontId).lineHeight;
}

/**
 * Renders the spec into the layer canvas, replacing whatever was there.
 * The canvas keeps document size, so no coordinate remapping is ever needed.
 */
export function renderTextSpec(
  ctx: CanvasRenderingContext2D,
  spec: TextSpec,
  docWidth: number,
  docHeight: number,
) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, docWidth, docHeight);

  const lines = textLines(spec);
  if (lines.every((l) => l.trim() === "")) return;

  const step = lineStep(spec);
  const blockHeight = step * lines.length;

  ctx.save();
  ctx.translate(spec.cx, spec.cy);
  ctx.rotate(spec.angle);
  ctx.font = cssFont(spec);
  ctx.textAlign = spec.align === "left" ? "left" : spec.align === "right" ? "right" : "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgb(${spec.color.r},${spec.color.g},${spec.color.b})`;

  // Align each line inside the measured block, so left/right alignment is
  // relative to the widest line rather than the canvas.
  const widths = lines.map((line) => ctx.measureText(line).width);
  const blockWidth = Math.max(1, ...widths);
  const anchorX =
    spec.align === "left" ? -blockWidth / 2 : spec.align === "right" ? blockWidth / 2 : 0;

  const curve = spec.curve ?? 0;

  lines.forEach((line, i) => {
    const y = -blockHeight / 2 + step * (i + 0.5);
    if (Math.abs(curve) < 0.01) {
      ctx.fillText(line, anchorX, y);
    } else {
      drawArcLine(ctx, line, widths[i] ?? 0, y, curve, spec.align);
    }
  });
  ctx.restore();
}

/**
 * Draws one line along a circular arc. The arc keeps the same centre as the
 * straight baseline would, so bending never makes the block jump.
 */
function drawArcLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  lineWidth: number,
  baselineY: number,
  curve: number,
  align: TextAlign,
) {
  if (line === "" || lineWidth <= 0) return;

  const sweep = Math.PI * Math.max(-1, Math.min(1, curve));
  const radius = lineWidth / Math.abs(sweep);
  const up = sweep > 0;
  const chars = Array.from(line);
  const charWidths = chars.map((c) => ctx.measureText(c).width);

  // Where the line starts along the arc, mirroring the straight-text alignment.
  const startOffset = align === "left" ? 0 : align === "right" ? -lineWidth : -lineWidth / 2;

  const prevAlign = ctx.textAlign;
  ctx.textAlign = "center";
  ctx.save();
  // Arc centre sits radius away from the baseline, on the side we bend towards.
  ctx.translate(0, baselineY + (up ? radius : -radius));

  let travelled = startOffset;
  for (let i = 0; i < chars.length; i++) {
    const w = charWidths[i] ?? 0;
    const mid = travelled + w / 2;
    const theta = mid / radius;
    ctx.save();
    if (up) {
      ctx.rotate(theta);
      ctx.translate(0, -radius);
    } else {
      ctx.rotate(-theta);
      ctx.translate(0, radius);
    }
    ctx.fillText(chars[i]!, 0, 0);
    ctx.restore();
    travelled += w;
  }

  ctx.restore();
  ctx.textAlign = prevAlign;
}

/** Web fonts must be loaded before the first canvas render, or it falls back. */
export async function ensureTextFontsLoaded(sizePx = 64): Promise<void> {
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  if (!fonts) return;
  await loadStoredCustomFonts();
  await Promise.all(
    TEXT_FONTS.map((f) => fonts.load(`${sizePx}px ${f.stack}`).catch(() => undefined)),
  );
}

/**
 * Size of the rendered text block in document pixels. Curved lines are measured
 * on their arc, so the readout matches what actually lands on paper.
 */
export function measureTextSpec(spec: TextSpec): { width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const lines = textLines(spec);
  if (!ctx || lines.every((l) => l.trim() === "")) return { width: 0, height: 0 };
  ctx.font = `${spec.fontSize}px ${fontById(spec.fontId).stack}`;

  const step = lineStep(spec);
  const widths = lines.map((line) => ctx.measureText(line).width);
  const straightWidth = Math.max(0, ...widths);
  const curve = Math.max(-1, Math.min(1, spec.curve ?? 0));

  if (Math.abs(curve) < 0.01) {
    return { width: straightWidth, height: step * lines.length };
  }

  // Each line becomes a circular arc: chord across, plus the bulge it rises.
  const sweep = Math.PI * Math.abs(curve);
  const radius = straightWidth / sweep;
  const chord = 2 * radius * Math.sin(sweep / 2);
  const bulge = radius * (1 - Math.cos(sweep / 2));
  return { width: chord, height: step * lines.length + bulge };
}
