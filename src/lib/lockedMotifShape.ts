/** Keep the exact rendered geometry for the duration of a Live AR skin lock. */
export type MotifShape = {
  taper: number;
  tilt: number;
  tiltDir: -1 | 1;
  bendDeg: number | null;
  curve: number;
  visibleFraction: number;
};

export type MotifFrame = {
  src: string;
  shape: MotifShape;
  occlusion: number;
  surfacePose: string;
};

export const motifFrameKey = (frame: MotifFrame) =>
  JSON.stringify([frame.src, frame.shape, frame.occlusion]);

export function visibleMotifFrame(
  live: MotifFrame,
  locked: MotifFrame | null,
): MotifFrame {
  return locked ?? live;
}
