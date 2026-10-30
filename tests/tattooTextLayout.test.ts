import { describe, expect, it } from "vitest";
import { calculateTextMotifLayout } from "../src/lib/tattooFonts";

describe("tattoo text layouts", () => {
  it("keeps horizontal text on one compact row", () => {
    expect(calculateTextMotifLayout("horizontal", 500, 180, 7)).toEqual({
      width: 580,
      height: 260,
      radius: 0,
    });
  });

  it("stacks vertical letters from top to bottom", () => {
    expect(calculateTextMotifLayout("vertical", 120, 180, 7)).toEqual({
      width: 200,
      height: 1340,
      radius: 0,
    });
  });

  it("adds room for an open arc", () => {
    const flat = calculateTextMotifLayout("horizontal", 500, 180, 7);
    const arc = calculateTextMotifLayout("arc", 500, 180, 7, 60);
    expect(arc.width).toBe(flat.width);
    expect(arc.height).toBeGreaterThan(flat.height);
  });

  it("uses a square canvas for a complete circle", () => {
    const circle = calculateTextMotifLayout("circle", 900, 180, 7);
    expect(circle.width).toBe(circle.height);
    expect(circle.radius).toBeGreaterThanOrEqual(184);
    expect(circle.width).toBeGreaterThan(700);
  });
});