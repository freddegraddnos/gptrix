import { describe, expect, it } from "vitest";
import { centerlineFromPositions } from "../src/lib/limbCenterline";

/** Synthetic bent tube: radius tapers from 0.4 (thin) to 1.0 (thick). */
function bentTube(reverse = false): Float64Array {
  const out: number[] = [];
  const steps = 60;
  const ring = 24;
  for (let i = 0; i <= steps; i++) {
    const s = reverse ? 1 - i / steps : i / steps;
    const radius = 0.4 + 0.6 * s;
    // Bend in the x/y plane, like an elbow.
    const cx = s * 10;
    const cy = Math.sin(s * Math.PI) * 2;
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * Math.PI * 2;
      out.push(cx, cy + Math.cos(a) * radius, Math.sin(a) * radius);
    }
  }
  return Float64Array.from(out);
}

describe("centerlineFromPositions", () => {
  it("follows the bend of the tube", () => {
    const res = centerlineFromPositions(bentTube());
    expect(res).not.toBeNull();
    const mid = res!.points[Math.floor(res!.points.length / 2)];
    // The bend peaks near y = 2, a straight axis would sit near y = 1.27.
    expect(mid.y).toBeGreaterThan(1.7);
    expect(res!.length).toBeGreaterThan(10);
  });

  it("always orders thin end first, thick end last", () => {
    for (const reverse of [false, true]) {
      const res = centerlineFromPositions(bentTube(reverse));
      expect(res).not.toBeNull();
      const radii = res!.radii;
      expect(radii[0]).toBeLessThan(radii[radii.length - 1]);
    }
  });

  it("returns null for degenerate input", () => {
    expect(centerlineFromPositions(new Float64Array(9))).toBeNull();
  });
});
