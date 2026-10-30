import { describe, expect, it } from "vitest";
import { normalizeInkBounds, scaledInkBounds, stencilInkBounds, stencilSourceSize } from "../src/lib/paint/stencilBounds";
import { pageRulerTicks, pageSize } from "../src/lib/paint/printLayout";

describe("stencil motif sizing", () => {
  it("excludes white and transparent image margins", () => {
    const data = new Uint8ClampedArray(100 * 80 * 4).fill(255);
    for (let y = 20; y < 60; y++) for (let x = 30; x < 70; x++) {
      const i = (y * 100 + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 0;
    }
    data[0] = data[1] = data[2] = data[3] = 0;
    expect(stencilInkBounds(data, 100, 80)).toEqual({ x: 30, y: 20, w: 40, h: 40 });
  });
  it("makes a 15 cm motif 150 mm wide rather than its padded source", () => {
    const bounds = normalizeInkBounds({ x: 30, y: 20, w: 40, h: 40 }, 100, 80);
    const source = stencilSourceSize(150, 150, bounds);
    expect(source).toEqual({ w: 375, h: 300 });
    expect(source.w * bounds.w).toBe(150);
    expect(source.h * bounds.h).toBe(150);
    expect(scaledInkBounds(bounds, 2000, 1600)).toEqual({ x: 600, y: 400, w: 800, h: 800 });
  });
  it("rejects a stencil with no visible ink", () => {
    expect(stencilInkBounds(new Uint8ClampedArray(400), 10, 10)).toBeNull();
    expect(stencilInkBounds(new Uint8ClampedArray(400).fill(255), 10, 10)).toBeNull();
  });
});

describe("physical page rulers", () => {
  it.each([
    ["A4", "portrait", 210, 297], ["A4", "landscape", 297, 210],
    ["A3", "portrait", 297, 420], ["A3", "landscape", 420, 297],
    ["Letter", "portrait", 215.9, 279.4],
  ] as const)("matches %s %s paper dimensions", (paper, orientation, w, h) => {
    expect(pageSize(paper, orientation)).toEqual({ w, h });
    expect(pageRulerTicks(w).at(-1)?.mm).toBe(w);
    expect(pageRulerTicks(h).at(-1)?.mm).toBe(h);
    expect(pageRulerTicks(w).find((t) => t.mm === 50)?.label).toBe("5");
  });
});