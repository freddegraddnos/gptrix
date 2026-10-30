/**
 * Drawing guides: a millimetre grid and symmetry.
 *
 * Symmetry is implemented as extra copies of every stroke sample, mirrored or
 * rotated around the document centre. Because the copies go through the very
 * same stroke renderer, they get the same brush, pressure and taper — nothing
 * downstream needs to know symmetry exists.
 */

export type SymmetryMode = "off" | "vertical" | "horizontal" | "quad" | "radial";

export interface GuideSettings {
  /** Draw the grid overlay. */
  grid: boolean;
  /** Grid pitch in millimetres. */
  gridMm: number;
  symmetry: SymmetryMode;
  /** Radial mode only: how many wedges the circle is split into. */
  radialSegments: number;
}

export const DEFAULT_GUIDES: GuideSettings = {
  grid: false,
  gridMm: 10,
  symmetry: "off",
  radialSegments: 8,
};

export const SYMMETRY_LABELS: Record<SymmetryMode, string> = {
  off: "Av",
  vertical: "Vertikal",
  horizontal: "Horisontell",
  quad: "Fyrkant",
  radial: "Radiell",
};

export interface Point {
  x: number;
  y: number;
}

/**
 * Mirror/rotation copies of a document point, excluding the point itself.
 * The centre of the document is the axis, which is what tattoo motifs want.
 */
export function symmetryPoints(
  p: Point,
  mode: SymmetryMode,
  width: number,
  height: number,
  segments: number,
): Point[] {
  const cx = width / 2;
  const cy = height / 2;
  const mirrorX = { x: 2 * cx - p.x, y: p.y };
  const mirrorY = { x: p.x, y: 2 * cy - p.y };

  switch (mode) {
    case "vertical":
      return [mirrorX];
    case "horizontal":
      return [mirrorY];
    case "quad":
      return [mirrorX, mirrorY, { x: 2 * cx - p.x, y: 2 * cy - p.y }];
    case "radial": {
      const n = Math.max(2, Math.round(segments));
      const dx = p.x - cx;
      const dy = p.y - cy;
      const out: Point[] = [];
      for (let i = 1; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        out.push({ x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos });
      }
      return out;
    }
    default:
      return [];
  }
}

/**
 * Draws the grid and the symmetry axes in document space. `scale` keeps the
 * lines one screen pixel wide however far the canvas is zoomed.
 */
export function drawGuides(
  ctx: CanvasRenderingContext2D,
  settings: GuideSettings,
  width: number,
  height: number,
  mmPerPixel: number,
  scale: number,
) {
  const hairline = 1 / Math.max(0.0001, scale);
  ctx.save();

  if (settings.grid && mmPerPixel > 0) {
    const step = Math.max(4, settings.gridMm / mmPerPixel);
    ctx.lineWidth = hairline;
    ctx.strokeStyle = "rgba(90,120,190,0.28)";
    ctx.beginPath();
    for (let x = step; x < width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = step; y < height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Every fifth line a little stronger, so the pitch is readable at a glance.
    ctx.strokeStyle = "rgba(90,120,190,0.5)";
    ctx.beginPath();
    for (let i = 5, x = step * 5; x < width; i += 5, x = step * i) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let i = 5, y = step * 5; y < height; i += 5, y = step * i) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  if (settings.symmetry !== "off") {
    const cx = width / 2;
    const cy = height / 2;
    ctx.lineWidth = hairline * 1.5;
    ctx.strokeStyle = "rgba(120,200,255,0.55)";
    ctx.beginPath();
    if (settings.symmetry === "vertical" || settings.symmetry === "quad") {
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
    }
    if (settings.symmetry === "horizontal" || settings.symmetry === "quad") {
      ctx.moveTo(0, cy);
      ctx.lineTo(width, cy);
    }
    if (settings.symmetry === "radial") {
      const n = Math.max(2, Math.round(settings.radialSegments));
      const r = Math.hypot(width, height) / 2;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}
