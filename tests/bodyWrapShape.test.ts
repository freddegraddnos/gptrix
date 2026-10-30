import { describe, expect, it } from "bun:test";
import { curveForCoverage, hasLimbShape } from "@/lib/bodyWrap";

describe("curveForCoverage", () => {
  it("returns null for unusable measurements", () => {
    expect(curveForCoverage(0, 10)).toBeNull();
    expect(curveForCoverage(8, 0)).toBeNull();
  });

  it("wraps harder on a thin limb than on a thick one", () => {
    const wrist = curveForCoverage(8, 9)!;
    const thigh = curveForCoverage(8, 40)!;
    expect(wrist).toBeGreaterThan(thigh);
    expect(wrist).toBeLessThanOrEqual(1);
    expect(thigh).toBeGreaterThan(0);
  });

  it("is monotonic in design width", () => {
    const small = curveForCoverage(4, 12)!;
    const mid = curveForCoverage(8, 12)!;
    const wide = curveForCoverage(11, 12)!;
    expect(small).toBeLessThan(mid);
    expect(mid).toBeLessThan(wide);
  });
});

describe("hasLimbShape", () => {
  it("ignores a straight tube of constant thickness", () => {
    expect(hasLimbShape({})).toBe(false);
    expect(hasLimbShape({ taper: 1, tilt: 0, bendDeg: 180 })).toBe(false);
    expect(hasLimbShape({ taper: 0.99, tilt: 0.02, bendDeg: 178 })).toBe(false);
  });

  it("reacts to taper, tilt and a bent joint", () => {
    expect(hasLimbShape({ taper: 0.82 })).toBe(true);
    expect(hasLimbShape({ tilt: 0.3 })).toBe(true);
    expect(hasLimbShape({ bendDeg: 140 })).toBe(true);
  });
});
