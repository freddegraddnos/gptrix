import { describe, expect, it } from "vitest";
import { fitsOnPage, mmToPx, pageSize, pngWithDpi, rotatedBox, tileGrid, toMm } from "../src/lib/paint/printLayout";

describe("print layout", () => {
  it("converts units to mm", () => {
    expect(toMm(10, "cm")).toBe(100);
    expect(toMm(1, "in")).toBe(25.4);
  });
  it("300 DPI pixel size", () => expect(mmToPx(25.4)).toBe(300));
  it("paper sizes and orientation", () => {
    expect(pageSize("A4", "portrait")).toEqual({ w: 210, h: 297 });
    expect(pageSize("A3", "landscape")).toEqual({ w: 420, h: 297 });
  });
  it("90° rotation swaps the box", () => {
    const b = rotatedBox(100, 50, 90);
    expect(b.w).toBeCloseTo(50); expect(b.h).toBeCloseTo(100);
  });
  it("tiles oversized stencil with 10 mm overlap and A1.. labels", () => {
    expect(fitsOnPage(300, 200, 210, 297)).toBe(false);
    const g = tileGrid(300, 200, 210, 297);
    expect(g.cols).toBe(2); expect(g.rows).toBe(1);
    expect(g.tiles.map((t) => t.label)).toEqual(["A1", "A2"]);
    const [a, b] = g.tiles;
    expect(a.xMm + a.wMm - b.xMm).toBe(10);
    expect(b.xMm + b.wMm).toBe(300);
  });
  it("writes 300 DPI pHYs chunk", () => {
    const png = new Uint8Array(45); png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    const out = pngWithDpi(png, 300);
    expect(String.fromCharCode(...out.slice(37, 41))).toBe("pHYs");
    expect(new DataView(out.buffer).getUint32(41)).toBe(11811);
    expect(out[49]).toBe(1);
  });
});
