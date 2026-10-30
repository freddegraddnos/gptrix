export type LockPose = {
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type LockPoseSample = LockPose & {
  confidence: number;
  scaleReliable: boolean;
  timestamp: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const finitePose = (pose: LockPose) =>
  Number.isFinite(pose.x) &&
  Number.isFinite(pose.y) &&
  Number.isFinite(pose.scale) &&
  pose.scale > 0 &&
  Number.isFinite(pose.rotation);

/**
 * The sole temporal filter for a locked AR pose.
 *
 * Measurements arrive on camera frames. Rendering can happen more often, so
 * `poseAt` predicts a few milliseconds ahead from the measured velocity. Scale
 * is filtered in log space, which makes zoom-in and zoom-out symmetrical and
 * prevents negative/overshooting values.
 */
export function createLockPoseController(initial: LockPose) {
  let pose = { ...initial };
  let lastSampleAt = 0;
  let velocity = { x: 0, y: 0, logScale: 0, rotation: 0 };
  // Only predict motion that has been observed on consecutive camera frames.
  // A single bad fit must not propel the tattoo past the skin patch.
  let previousMotion = { x: 0, y: 0, logScale: 0, rotation: 0 };

  const reset = (next: LockPose, timestamp = 0) => {
    pose = { ...next };
    lastSampleAt = timestamp;
    velocity = { x: 0, y: 0, logScale: 0, rotation: 0 };
    previousMotion = { x: 0, y: 0, logScale: 0, rotation: 0 };
  };

  const sample = (next: LockPoseSample): LockPose => {
    if (!finitePose(next)) return { ...pose };
    if (!lastSampleAt) {
      reset(next, next.timestamp);
      return { ...pose };
    }

    const dt = clamp((next.timestamp - lastSampleAt) / 1000, 1 / 120, 0.1);
    lastSampleAt = next.timestamp;
    const trust = clamp(next.confidence, 0, 1);
    const posError = Math.hypot(next.x - pose.x, next.y - pose.y);
    const movement = clamp(posError / 24, 0, 1);
    // At rest, retain enough damping to remove sub-pixel shimmer. As soon as a
    // real displacement appears, follow most of it on this same camera frame.
    const posAlpha = clamp(0.32 + trust * 0.28 + movement * 0.38, 0.32, 0.98);

    const previous = { ...pose };
    if (posError > 0.75) {
      pose.x += (next.x - pose.x) * posAlpha;
      pose.y += (next.y - pose.y) * posAlpha;
    }

    const rotationError = ((next.rotation - pose.rotation + 540) % 360) - 180;
    if (Math.abs(rotationError) > 0.25) {
      const rotationAlpha = clamp(0.24 + trust * 0.34 + Math.abs(rotationError) / 20, 0.24, 0.9);
      pose.rotation += rotationError * rotationAlpha;
    }

    if (next.scaleReliable) {
      const currentLog = Math.log(Math.max(0.001, pose.scale));
      const measuredLog = Math.log(next.scale);
      const scaleError = measuredLog - currentLog;
      // 0.18% is below visible size change at normal motif widths. Larger,
      // coherent zooms become progressively more responsive without a median
      // window that waits several frames before moving.
      if (Math.abs(scaleError) > 0.012) {
        const zoomMotion = clamp(Math.abs(scaleError) / 0.055, 0, 1);
        const scaleAlpha = clamp(0.2 + trust * 0.28 + zoomMotion * 0.46, 0.2, 0.94);
        pose.scale = Math.exp(currentLog + scaleError * scaleAlpha);
      }
    }

    const motion = {
      x: (pose.x - previous.x) / dt,
      y: (pose.y - previous.y) / dt,
      logScale: (Math.log(pose.scale) - Math.log(previous.scale)) / dt,
      rotation: (pose.rotation - previous.rotation) / dt,
    };
    const blend = 0.58;
    velocity = {
      x: Math.sign(motion.x) === Math.sign(previousMotion.x) ? velocity.x * (1 - blend) + motion.x * blend : 0,
      y: Math.sign(motion.y) === Math.sign(previousMotion.y) ? velocity.y * (1 - blend) + motion.y * blend : 0,
      logScale:
        Math.sign(motion.logScale) === Math.sign(previousMotion.logScale)
          ? velocity.logScale * (1 - blend) + motion.logScale * blend : 0,
      rotation:
        Math.sign(motion.rotation) === Math.sign(previousMotion.rotation)
          ? velocity.rotation * (1 - blend) + motion.rotation * blend : 0,
    };
    previousMotion = motion;
    return { ...pose };
  };

  const poseAt = (timestamp: number): LockPose => {
    if (!lastSampleAt) return { ...pose };
    // Prediction only bridges camera-to-display latency. A short cap prevents
    // coasting away when the camera stalls or tracking becomes unavailable.
    const ahead = clamp((timestamp - lastSampleAt) / 1000, 0, 0.032);
    return {
      x: pose.x + velocity.x * ahead,
      y: pose.y + velocity.y * ahead,
      scale: Math.exp(Math.log(pose.scale) + velocity.logScale * ahead),
      rotation: pose.rotation + velocity.rotation * ahead,
    };
  };

  return { reset, sample, poseAt };
}

export type LockPoseController = ReturnType<typeof createLockPoseController>;