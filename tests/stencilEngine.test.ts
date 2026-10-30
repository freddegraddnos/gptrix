import { describe, it, expect } from "vitest";
import { runStencil, mapParams, MIN_LINE_MM } from "../src/lib/paint/stencilEngine";

function img(w: number, h: number) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const inside = (x - w / 2) ** 2 + (y - h / 2) ** 2 < (w / 4) ** 2;
    const v = inside ? 30 : 230 + ((x * 7 + y * 13) % 9); // light noise
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  return d;
}
const base = { style: "outline" as const, detail: 50, thicknessMm: 0.5, widthMm: 100, contrast: 0, noise: 20, invert: false, removeBg: false, mirror: false };

describe("stencil engine", () => {
  it("outputs only pure black or pure white pixels", () => {
    for (const style of ["outline", "simple", "detailed"] as const) {
      const out = runStencil(img(120, 120), 120, 120, { ...base, style });
      let ink = 0;
      for (let i = 0; i < out.length; i += 4) {
        expect([0, 255]).toContain(out[i]);
        if (out[i] === 0) ink++;
      }
      expect(ink, style).toBeGreaterThan(0);
    }
  });
  it("clamps line thickness to at least 0.3 mm at print size", () => {
    const m = mapParams({ ...base, thicknessMm: 0.1 }, 1000);
    expect(m.linePx).toBeCloseTo(MIN_LINE_MM * 10);
  });
  it("background is transparent when Remove background is on", () => {
    const out = runStencil(img(80, 80), 80, 80, { ...base, removeBg: true });
    expect(out[3]).toBe(0);
  });
  it("line art keeps a straight line straight and its width within 1 px", () => {
    const w = 200, h = 100, d = new Uint8ClampedArray(w * h * 4).fill(255);
    for (let y = 45; y < 51; y++) for (let x = 10; x < 190; x++) { const i = (y * w + x) * 4; d[i] = d[i + 1] = d[i + 2] = 0; }
    const out = runStencil(d, w, h, { ...base, style: "lineart" });
    for (let x = 30; x < 170; x += 10) {
      let top = -1, bottom = -1;
      for (let y = 0; y < h; y++) if (out[(y * w + x) * 4] === 0) { if (top < 0) top = y; bottom = y; }
      expect(top, `x=${x}`).toBeGreaterThanOrEqual(44); expect(top).toBeLessThanOrEqual(46);
      expect(bottom - top + 1).toBeGreaterThanOrEqual(5); expect(bottom - top + 1).toBeLessThanOrEqual(7);
    }
  });
});
