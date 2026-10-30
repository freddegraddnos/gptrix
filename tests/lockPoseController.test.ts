import { describe, expect, test } from "bun:test";
import { createLockPoseController } from "../src/lib/lockPoseController";

const start = { x: 0, y: 0, scale: 1, rotation: 0 };

describe("lock pose controller", () => {
  test("does not breathe on sub-pixel static noise", () => {
    const controller = createLockPoseController(start);
    controller.reset(start, 1);
    for (let i = 1; i <= 120; i++) {
      controller.sample({
        x: i % 2 ? 0.1 : -0.1,
        y: i % 3 ? 0.08 : -0.08,
        scale: i % 2 ? 1.001 : 0.999,
        rotation: 0.03,
        confidence: 0.9,
        scaleReliable: true,
        timestamp: 1 + i * 33.3,
      });
    }
    const pose = controller.poseAt(4_100);
    expect(Math.abs(pose.x)).toBeLessThan(0.22);
    expect(Math.abs(pose.scale - 1)).toBeLessThan(0.002);
  });

  test("catches a fast pan and zoom without a multi-frame gate", () => {
    const controller = createLockPoseController(start);
    controller.reset(start, 1);
    controller.sample({
      x: 70,
      y: 20,
      scale: 1.25,
      rotation: 3,
      confidence: 0.9,
      scaleReliable: true,
      timestamp: 34,
    });
    const pose = controller.poseAt(50);
    expect(pose.x).toBeGreaterThan(55);
    expect(pose.scale).toBeGreaterThan(1.18);
  });

  test("holds scale when geometry says it is unreliable", () => {
    const controller = createLockPoseController(start);
    controller.reset(start, 1);
    controller.sample({
      x: 12,
      y: 4,
      scale: 1.8,
      rotation: 0,
      confidence: 0.8,
      scaleReliable: false,
      timestamp: 34,
    });
    const pose = controller.poseAt(34);
    expect(pose.x).toBeGreaterThan(0);
    expect(pose.scale).toBe(1);
  });

  test("reset preserves an exact re-anchor pose", () => {
    const controller = createLockPoseController(start);
    const anchor = { x: 45, y: -18, scale: 1.37, rotation: 8 };
    controller.reset(anchor, 500);
    expect(controller.poseAt(500)).toEqual(anchor);
  });

  test("holds shape and placement against realistic stationary camera noise", () => {
    const controller = createLockPoseController(start);
    controller.reset(start, 1);
    for (let i = 1; i <= 100; i++) {
      controller.sample({
        x: i % 2 ? 0.65 : -0.65,
        y: i % 3 ? 0.55 : -0.55,
        scale: i % 2 ? 1.009 : 0.991,
        rotation: i % 2 ? 0.2 : -0.2,
        confidence: 0.85,
        scaleReliable: true,
        timestamp: 1 + i * 33,
      });
    }
    const pose = controller.poseAt(3400);
    expect(Math.hypot(pose.x, pose.y)).toBeLessThan(0.5);
    expect(pose.scale).toBe(1);
    expect(pose.rotation).toBe(0);
  });

  test("does not extrapolate a one-frame tracking jump", () => {
    const controller = createLockPoseController(start);
    controller.reset(start, 1);
    controller.sample({ x: 50, y: 20, scale: 1.2, rotation: 4, confidence: 0.9, scaleReliable: true, timestamp: 34 });
    const measured = controller.poseAt(34);
    expect(controller.poseAt(66)).toEqual(measured);
    controller.sample({ x: 70, y: 30, scale: 1.3, rotation: 6, confidence: 0.9, scaleReliable: true, timestamp: 67 });
    expect(controller.poseAt(83).x).toBeGreaterThan(controller.poseAt(67).x);
    controller.reset(measured, 100);
    expect(controller.poseAt(132)).toEqual(measured);
  });

  test("treats rotation across 180 degrees as a small turn", () => {
    const controller = createLockPoseController({ ...start, rotation: 179 });
    controller.reset({ ...start, rotation: 179 }, 1);
    controller.sample({ ...start, rotation: -179, confidence: 0.9, scaleReliable: true, timestamp: 34 });
    expect(controller.poseAt(34).rotation).toBeGreaterThan(179);
  });
});