import { rgbCss } from "./color";
import type { BrushId, RGB } from "./types";

export interface StampContext {
  x: number;
  y: number;
  /** brush size in document px at this stamp */
  size: number;
  /** 0..1 per-stamp alpha */
  alpha: number;
  /** direction of travel in radians */
  angle: number;
  color: RGB;
}

export interface Brush {
  id: BrushId;
  label: string;
  /** stamp spacing as a fraction of brush size */
  spacing: number;
  /** how the finished stroke buffer is composited onto the layer */
  composite: GlobalCompositeOperation;
  /** map normalised pressure -> size multiplier */
  sizeFromPressure: (pressure: number) => number;
  /** map normalised pressure -> alpha multiplier */
  alphaFromPressure: (pressure: number) => number;
  stamp: (ctx: CanvasRenderingContext2D, s: StampContext) => void;
}

function softCircle(ctx: CanvasRenderingContext2D, s: StampContext, hardness: number) {
  const r = Math.max(0.35, s.size / 2);
  const inner = r * hardness;
  const grad = ctx.createRadialGradient(s.x, s.y, inner, s.x, s.y, r);
  grad.addColorStop(0, rgbCss(s.color, s.alpha));
  grad.addColorStop(1, rgbCss(s.color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
  ctx.fill();
}

const round: Brush = {
  id: "round",
  label: "Rund",
  spacing: 0.12,
  composite: "source-over",
  sizeFromPressure: (p) => 0.25 + 0.75 * p,
  alphaFromPressure: (p) => 0.35 + 0.65 * p,
  stamp: (ctx, s) => softCircle(ctx, s, 0.72),
};

const calligraphy: Brush = {
  id: "calligraphy",
  label: "Kalligrafi",
  spacing: 0.06,
  composite: "source-over",
  sizeFromPressure: (p) => 0.45 + 0.55 * p,
  alphaFromPressure: (p) => 0.55 + 0.45 * p,
  stamp: (ctx, s) => {
    // A flat nib held at a fixed 35 degree angle: width depends on how the
    // travel direction relates to the nib angle, which is what makes the
    // stroke thick on down-strokes and thin on cross-strokes.
    const nib = (-35 * Math.PI) / 180;
    const rel = Math.abs(Math.sin(s.angle - nib));
    const w = Math.max(0.6, (s.size / 2) * (0.18 + 0.82 * rel));
    const h = Math.max(0.6, s.size / 2);
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(nib);
    ctx.fillStyle = rgbCss(s.color, s.alpha);
    ctx.beginPath();
    ctx.ellipse(0, 0, h, w * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },
};

const airbrush: Brush = {
  id: "airbrush",
  label: "Airbrush",
  spacing: 0.1,
  composite: "source-over",
  sizeFromPressure: (p) => 0.55 + 0.45 * p,
  alphaFromPressure: (p) => 0.12 + 0.5 * p,
  stamp: (ctx, s) => {
    const r = Math.max(1, s.size / 2);
    const dots = Math.max(3, Math.round(r * 0.9));
    ctx.fillStyle = rgbCss(s.color, Math.min(1, s.alpha * 0.9));
    for (let i = 0; i < dots; i++) {
      // Gaussian-ish falloff so the spray is dense in the middle.
      const t = Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      const d = t * r;
      const dotR = Math.max(0.4, r * 0.055);
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
    softCircle(ctx, { ...s, alpha: s.alpha * 0.28 }, 0.05);
  },
};

/**
 * Fine line: a technical-pen feel. Hard edge, near-constant opacity, so
 * pressure mostly changes width a little and never lightens the ink.
 */
const fineline: Brush = {
  id: "fineline",
  label: "Fine Line",
  spacing: 0.08,
  composite: "source-over",
  sizeFromPressure: (p) => 0.7 + 0.3 * p,
  alphaFromPressure: (p) => 0.9 + 0.1 * p,
  stamp: (ctx, s) => softCircle(ctx, s, 0.94),
};

/**
 * Dotwork: stipple instead of a continuous line. Stamps are spaced far apart
 * and each stamp scatters a handful of dots whose count (density) follows
 * pressure — light touch = sparse, heavy = dense.
 */
/**
 * Dotwork density, 0..100, shared app state (a Brush has no per-instance
 * params). It drives both the stamp spacing and how many dots each stamp
 * scatters: low = airy stippling, high = tight, almost solid shading.
 */
let dotworkDensity = 50;

export const DOTWORK_DENSITY_MIN = 0;
export const DOTWORK_DENSITY_MAX = 100;

export function getDotworkDensity() {
  return dotworkDensity;
}

export function setDotworkDensity(value: number) {
  dotworkDensity = Math.min(DOTWORK_DENSITY_MAX, Math.max(DOTWORK_DENSITY_MIN, value));
  // Spacing is read per stroke, so updating it here changes the next stroke.
  dotwork.spacing = 0.9 - (dotworkDensity / 100) * 0.72;
}

const dotwork: Brush = {
  id: "dotwork",
  label: "Dotwork",
  spacing: 0.54,
  composite: "source-over",
  sizeFromPressure: () => 1,
  // Density carries the pressure, so keep each dot solid.
  alphaFromPressure: (p) => 0.75 + 0.25 * p,
  stamp: (ctx, s) => {
    const r = Math.max(1, s.size / 2);
    // s.alpha already encodes pressure: use it to drive how many dots land,
    // scaled by the artist-set density.
    const pressure = Math.max(0.12, (s.alpha - 0.7) / 0.3);
    const density = pressure * (0.35 + (dotworkDensity / 100) * 1.65);
    const dots = Math.max(1, Math.round(1 + density * Math.max(2, r * 0.55)));
    const dotR = Math.max(0.45, r * 0.13);
    ctx.fillStyle = rgbCss(s.color, 1);
    for (let i = 0; i < dots; i++) {
      const t = Math.sqrt(Math.random());
      const a = Math.random() * Math.PI * 2;
      const d = t * (r - dotR);
      ctx.beginPath();
      ctx.arc(s.x + Math.cos(a) * d, s.y + Math.sin(a) * d, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  },
};

/** Blackwork: wide, hard-edged, fully opaque filler for large black areas. */
const blackwork: Brush = {
  id: "blackwork",
  label: "Blackwork",
  spacing: 0.05,
  composite: "source-over",
  sizeFromPressure: (p) => 0.8 + 0.2 * p,
  alphaFromPressure: () => 1,
  stamp: (ctx, s) => {
    const r = Math.max(0.5, s.size / 2);
    ctx.fillStyle = rgbCss(s.color, s.alpha);
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
    // A crisp rim so the edge stays hard even at low alpha.
    ctx.strokeStyle = rgbCss(s.color, s.alpha);
    ctx.lineWidth = Math.max(0.5, r * 0.08);
    ctx.stroke();
  },
};

/**
 * Watercolor: very soft, wide falloff washes with an irregular edge. Kept light
 * per stamp so colour builds up as you go back over an area.
 */
const watercolor: Brush = {
  id: "watercolor",
  label: "Watercolor",
  spacing: 0.16,
  composite: "source-over",
  sizeFromPressure: (p) => 0.6 + 0.4 * p,
  alphaFromPressure: (p) => 0.08 + 0.22 * p,
  stamp: (ctx, s) => {
    const r = Math.max(1, s.size / 2);
    // Two offset soft blobs give the wash a slightly uneven, bleeding edge.
    softCircle(ctx, { ...s, size: s.size * 1.05 }, 0.02);
    const jx = (Math.random() - 0.5) * r * 0.35;
    const jy = (Math.random() - 0.5) * r * 0.35;
    softCircle(
      ctx,
      { ...s, x: s.x + jx, y: s.y + jy, size: s.size * 0.8, alpha: s.alpha * 0.7 },
      0.1,
    );
  },
};

const eraser: Brush = {
  id: "eraser",
  label: "Suddgummi",
  spacing: 0.1,
  composite: "destination-out",
  sizeFromPressure: (p) => 0.35 + 0.65 * p,
  alphaFromPressure: (p) => 0.4 + 0.6 * p,
  stamp: (ctx, s) => softCircle(ctx, s, 0.6),
};

export const BRUSHES: Record<BrushId, Brush> = {
  round,
  calligraphy,
  airbrush,
  fineline,
  dotwork,
  blackwork,
  watercolor,
  eraser,
};

export const BRUSH_ORDER: BrushId[] = [
  "round",
  "calligraphy",
  "airbrush",
  "fineline",
  "dotwork",
  "blackwork",
  "watercolor",
  "eraser",
];
