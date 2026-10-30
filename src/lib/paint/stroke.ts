import type { Brush } from "./brushes";
import type { BrushSettings, Rect, StrokePoint } from "./types";

/**
 * Renders one continuous stroke into a dedicated buffer canvas.
 *
 * Drawing into a buffer (instead of straight onto the layer) means overlapping
 * stamps inside a single stroke don't darken each other: the finished buffer is
 * composited once, at the brush opacity. That's the behaviour Procreate users
 * expect, and it's also what makes clipping the stroke to a selection possible
 * later without touching this code.
 */
export class StrokeRenderer {
  private last: StrokePoint | null = null;
  private residual = 0;
  private dirty: Rect | null = null;

  constructor(
    private readonly ctx: CanvasRenderingContext2D,
    private readonly brush: Brush,
    private readonly settings: BrushSettings,
  ) {}

  begin(point: StrokePoint) {
    this.last = point;
    this.residual = 0;
    this.stamp(point, 0);
  }

  extend(point: StrokePoint) {
    const prev = this.last;
    if (!prev) {
      this.begin(point);
      return;
    }
    const dx = point.x - prev.x;
    const dy = point.y - prev.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;

    const angle = Math.atan2(dy, dx);
    const step = Math.max(0.6, this.settings.size * this.brush.spacing);

    const prevAlpha = prev.pressureAlpha ?? prev.pressure;
    const nextAlpha = point.pressureAlpha ?? point.pressure;

    let travelled = this.residual;
    while (travelled + step <= dist) {
      travelled += step;
      const t = travelled / dist;
      this.stamp(
        {
          x: prev.x + dx * t,
          y: prev.y + dy * t,
          pressure: prev.pressure + (point.pressure - prev.pressure) * t,
          pressureAlpha: prevAlpha + (nextAlpha - prevAlpha) * t,
        },
        angle,
      );
    }
    this.residual = travelled - dist;
    this.last = point;
  }

  private stamp(point: StrokePoint, angle: number) {
    const size = Math.max(0.5, this.settings.size * this.brush.sizeFromPressure(point.pressure));
    const alpha = Math.min(
      1,
      this.brush.alphaFromPressure(point.pressureAlpha ?? point.pressure),
    );
    this.brush.stamp(this.ctx, {
      x: point.x,
      y: point.y,
      size,
      alpha,
      angle,
      color: this.settings.color,
    });
    this.growDirty(point.x, point.y, size);
  }

  private growDirty(x: number, y: number, size: number) {
    const pad = size / 2 + 2;
    const minX = x - pad;
    const minY = y - pad;
    const maxX = x + pad;
    const maxY = y + pad;
    if (!this.dirty) {
      this.dirty = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      return;
    }
    const r = this.dirty;
    const rx = Math.min(r.x, minX);
    const ry = Math.min(r.y, minY);
    const rw = Math.max(r.x + r.w, maxX) - rx;
    const rh = Math.max(r.y + r.h, maxY) - ry;
    this.dirty = { x: rx, y: ry, w: rw, h: rh };
  }

  /** Dirty rect clamped to the document, or null if nothing was drawn. */
  getDirtyRect(docW: number, docH: number): Rect | null {
    if (!this.dirty) return null;
    const x = Math.max(0, Math.floor(this.dirty.x));
    const y = Math.max(0, Math.floor(this.dirty.y));
    const w = Math.min(docW, Math.ceil(this.dirty.x + this.dirty.w)) - x;
    const h = Math.min(docH, Math.ceil(this.dirty.y + this.dirty.h)) - y;
    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
  }
}
