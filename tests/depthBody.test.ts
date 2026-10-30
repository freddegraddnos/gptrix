import { describe, expect, it } from "bun:test";

import {
  depthToBytes,
  lambertShade,
  normalizeDepthInMask,
  pseudoDepthFromMask,
  resampleMask,
  smoothDepth,
} from "../src/lib/depthBody";

describe("normalizeDepthInMask", () => {
  it("maps person depth to 0..1 with 1 at the closest point", () => {
    // 4x4 depth, background values would skew the range if not masked out.
    const depth = Float32Array.from([
      0.0, 0.0, 0.0, 0.0, 0.0, 2.0, 3.0, 0.0, 0.0, 4.0, 5.0, 0.0, 0.0, 0.0, 0.0,
      0.0,
    ]);
    const mask = Uint8Array.from([
      0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0,
    ]);
    const out = normalizeDepthInMask(depth, mask);
    expect(out.length).toBe(16);
    for (const v of out) expect(v >= 0 && v <= 1).toBe(true);
    expect(out[10]).toBe(1); // 5 is the closest person pixel
    expect(out[5]).toBeCloseTo((2 - 2) / 3); // 2 is the farthest person pixel
    expect(out[0]).toBe(0); // background stays 0
  });

  it("returns a flat field when no person pixels exist", () => {
    const depth = Float32Array.from([9, 9, 9, 9]);
    const mask = Uint8Array.from([0, 0, 0, 0]);
    const out = normalizeDepthInMask(depth, mask);
    for (const v of out) expect(v).toBe(1);
  });

  it("treats every pixel as person when the mask is null", () => {
    const depth = Float32Array.from([1, 2, 3, 4]);
    const out = normalizeDepthInMask(depth, null);
    expect(out[0]).toBe(0);
    expect(out[3]).toBe(1);
  });
});

describe("depthToBytes", () => {
  it("packs normalised depth into luminance bytes, clamped", () => {
    const bytes = depthToBytes(Float32Array.from([0, 0.5, 1, 1.7, -0.3]));
    expect(Array.from(bytes)).toEqual([0, 128, 255, 255, 0]);
  });

  it("reuses the output buffer when it fits", () => {
    const out = new Uint8Array(2);
    const res = depthToBytes(Float32Array.from([0.25, 0.75]), out);
    expect(res).toBe(out);
    expect(Array.from(res)).toEqual([64, 191]);
  });
});

describe("lambertShade", () => {
  it("is 1 when the surface faces the light", () => {
    expect(lambertShade(0, 0, 1, 0, 0, 2)).toBeCloseTo(1);
  });

  it("is 0 when the surface turns fully away", () => {
    expect(lambertShade(0, 0, 1, 0, 0, -2)).toBe(0);
  });

  it("decreases monotonically as the normal tilts away", () => {
    const toward = lambertShade(0.5, 0, 1, 1, 0, 1);
    const flat = lambertShade(0, 0, 1, 1, 0, 1);
    const away = lambertShade(-0.5, 0, 1, 1, 0, 1);
    expect(toward).toBeGreaterThan(flat);
    expect(flat).toBeGreaterThan(away);
  });
});

describe("pseudoDepthFromMask", () => {
  it("peaks inside a synthetic limb and reads 0 at the silhouette", () => {
    // 32x16 person strip with a bump in the middle columns.
    const w = 32;
    const h = 16;
    const mask = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Wider in the middle rows so the interior has a thickest point.
        mask[y * w + x] = x >= 2 && x <= 29 && y >= 2 && y <= 13 ? 1 : 0;
      }
    }
    const depth = pseudoDepthFromMask(mask, w, h);
    for (const v of depth) expect(v >= 0 && v <= 1).toBe(true);
    const centre = depth[8 * w + 16];
    const edge = depth[8 * w + 2]; // on the silhouette column
    expect(centre).toBe(1); // thickest interior point
    expect(edge).toBeLessThan(0.2);
    expect(centre).toBeGreaterThan(depth[8 * w + 5]);
  });
});

describe("resampleMask", () => {
  it("keeps person pixels aligned onto the depth grid", () => {
    const mask = { data: Uint8Array.from([1, 0, 0, 1]), width: 2, height: 2 };
    const out = resampleMask(mask, 4, 4);
    expect(out.length).toBe(16);
    expect(out[0]).toBe(1); // top-left maps to top-left
    expect(out[15]).toBe(1); // bottom-right maps to bottom-right
    expect(out[5]).toBe(1); // (1,1) maps to mask (1,1)
    expect(out[12]).toBe(0); // (0,3) maps to mask (0,1), which is background
  });
});

describe("smoothDepth", () => {
  it("blends toward the new frame and resets on size change", () => {
    const prev = Float32Array.from([1, 1]);
    const next = Float32Array.from([0, 0]);
    const out = smoothDepth(prev, next, 0.5);
    expect(Array.from(out)).toEqual([0.5, 0.5]);
    const grown = smoothDepth(Float32Array.from([1]), Float32Array.from([0.2, 0.4]));
    expect(grown[0]).toBeCloseTo(0.2, 5);
    expect(grown[1]).toBeCloseTo(0.4, 5);
  });
});
