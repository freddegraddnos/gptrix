import { describe, expect, it } from "vitest";
import { centerlineFromPositions } from "../src/lib/limbCenterline";
import { cylindricalUvFromPositions } from "../src/lib/limbCylindricalUv";

/** Bent tube with ring topology, so it has a real seam. */
function bentTube() {
  const positions: number[] = [];
  const indices: number[] = [];
  const steps = 60;
  const ring = 24;
  for (let i = 0; i <= steps; i++) {
    const s = i / steps;
    const radius = 0.4 + 0.6 * s;
    const cx = s * 10;
    const cy = Math.sin(s * Math.PI) * 2;
    for (let j = 0; j < ring; j++) {
      const a = (j / ring) * Math.PI * 2;
      positions.push(cx, cy + Math.cos(a) * radius, Math.sin(a) * radius);
    }
  }
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < ring; j++) {
      const a = i * ring + j;
      const b = i * ring + ((j + 1) % ring);
      const c = a + ring;
      const d = b + ring;
      indices.push(a, b, c, b, d, c);
    }
  }
  return { positions: Float64Array.from(positions), indices };
}

describe("cylindricalUvFromPositions", () => {
  const tube = bentTube();
  const centerline = centerlineFromPositions(tube.positions)!;
  const res = cylindricalUvFromPositions(tube.positions, tube.indices, centerline)!;

  it("normalises v to exactly 0..1", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < res.uv.length; i += 2) {
      min = Math.min(min, res.uv[i + 1]);
      max = Math.max(max, res.uv[i + 1]);
    }
    expect(min).toBeCloseTo(0, 6);
    expect(max).toBeCloseTo(1, 6);
  });

  it("wraps u around the tube", () => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < res.uv.length; i += 2) {
      min = Math.min(min, res.uv[i]);
      max = Math.max(max, res.uv[i]);
    }
    expect(min).toBeLessThan(0.05);
    expect(max).toBeGreaterThan(1); // seam duplicates sit just above 1
  });

  it("leaves no triangle straddling the seam", () => {
    const u = (i: number) => res.uv[i * 2];
    for (let t = 0; t < res.indices.length; t += 3) {
      const a = u(res.indices[t]);
      const b = u(res.indices[t + 1]);
      const c = u(res.indices[t + 2]);
      expect(Math.max(a, b, c) - Math.min(a, b, c)).toBeLessThanOrEqual(0.5);
    }
    expect(res.seamVertices).toBeGreaterThan(0);
  });

  it("returns null for degenerate input", () => {
    expect(cylindricalUvFromPositions(new Float64Array(3), [0, 0, 0], centerline)).toBeNull();
  });
});
