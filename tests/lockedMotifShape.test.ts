import { describe, expect, test } from "bun:test";
import { motifFrameKey, visibleMotifFrame, type MotifFrame } from "../src/lib/lockedMotifShape";

const initial: MotifFrame = {
  src: "tattoo-a",
  shape: { curve: 0.58, taper: 0.82, tilt: 0.25, tiltDir: 1, bendDeg: 14, visibleFraction: 0.9 },
  occlusion: 0.85,
  surfacePose: "perspective(500px) rotateX(6deg)",
};

describe("Live AR locked motif frame", () => {
  test("freezes geometry, image, occlusion and surface pose against later readings", () => {
    const locked = structuredClone(initial);
    const changed: MotifFrame = {
      src: "tattoo-b",
      shape: { curve: 0, taper: 1.4, tilt: 0, tiltDir: -1, bendDeg: null, visibleFraction: 1 },
      occlusion: 0,
      surfacePose: "perspective(800px) rotateX(0deg)",
    };
    const frame = visibleMotifFrame(changed, locked);
    expect(frame).toEqual(initial);
    expect(motifFrameKey(frame)).toBe(motifFrameKey(initial));
    expect(visibleMotifFrame(changed, null)).toEqual(changed);
  });

  test("a late bake for an older shape cannot be selected for a new shape", () => {
    const older = motifFrameKey(initial);
    expect(motifFrameKey({ ...initial, shape: { ...initial.shape, curve: 0.7 } })).not.toBe(older);
    expect(motifFrameKey({ ...initial, src: "tattoo-b" })).not.toBe(older);
    expect(motifFrameKey({ ...initial, occlusion: 0.3 })).not.toBe(older);
    // Light and unrelated UI updates must not trigger a new motif bake.
    expect(motifFrameKey({ ...initial, surfacePose: "perspective(510px) rotateX(6deg)" })).toBe(older);
  });
});
