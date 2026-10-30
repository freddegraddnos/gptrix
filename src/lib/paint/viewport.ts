import { clamp } from "./color";

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 32;

/**
 * Document -> screen mapping: screen = R(rotation) * (doc * scale) + offset,
 * in CSS pixels relative to the canvas element's top-left corner.
 *
 * Rotation is part of the view, never of the artwork: pixels are untouched, so
 * turning the canvas to draw a comfortable line costs nothing and is undoable
 * by simply turning it back.
 */
export class Viewport {
  scale = 1;
  x = 0;
  y = 0;
  /** View rotation in radians, clockwise. */
  rotation = 0;

  screenToDoc(px: number, py: number) {
    const dx = (px - this.x) / this.scale;
    const dy = (py - this.y) / this.scale;
    const cos = Math.cos(-this.rotation);
    const sin = Math.sin(-this.rotation);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  }

  docToScreen(dx: number, dy: number) {
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const rx = dx * cos - dy * sin;
    const ry = dx * sin + dy * cos;
    return { x: rx * this.scale + this.x, y: ry * this.scale + this.y };
  }

  panBy(dx: number, dy: number) {
    this.x += dx;
    this.y += dy;
  }

  /** Zoom so the document point under (px, py) stays under (px, py). */
  zoomTo(nextScale: number, px: number, py: number) {
    const next = clamp(nextScale, MIN_ZOOM, MAX_ZOOM);
    const k = next / this.scale;
    this.x = px - (px - this.x) * k;
    this.y = py - (py - this.y) * k;
    this.scale = next;
  }

  /** Rotates the view by `delta` radians around the screen point (px, py). */
  rotateBy(delta: number, px: number, py: number) {
    if (!Number.isFinite(delta) || delta === 0) return;
    const cos = Math.cos(delta);
    const sin = Math.sin(delta);
    const ox = this.x - px;
    const oy = this.y - py;
    this.x = px + ox * cos - oy * sin;
    this.y = py + ox * sin + oy * cos;
    this.rotation += delta;
  }

  resetRotation() {
    this.rotation = 0;
  }

  /** Wheel zoom: magnitude-scaled and cursor-anchored. */
  zoomByWheel(deltaY: number, deltaMode: number, px: number, py: number, intensity = 0.0015) {
    const dy = deltaY * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);
    this.zoomTo(this.scale * Math.exp(-dy * intensity), px, py);
  }

  /** Fit a document of docW x docH inside a viewport of viewW x viewH. */
  fit(docW: number, docH: number, viewW: number, viewH: number, padding = 48) {
    this.rotation = 0;
    const s = Math.min(
      (viewW - padding * 2) / docW,
      (viewH - padding * 2) / docH,
    );
    this.scale = clamp(s, MIN_ZOOM, MAX_ZOOM);
    this.x = (viewW - docW * this.scale) / 2;
    this.y = (viewH - docH * this.scale) / 2;
  }
}
