/** Movement patterns and max lengths for the ScanMyBody recording. */
import { BODY_PARTS, type BodyPart } from "./bodyParts";

export type ScanPattern = "orbit" | "raster";

export type ScanPlan = {
  pattern: ScanPattern;
  /** Total max length in seconds for PHASE 1 + PHASE 2. */
  maxSeconds: number;
  /** Seconds allotted for the calibration phase. */
  calibrationSeconds: number;
  /** Number of rows for row-by-row sweeps. */
  rows: number;
  label: string;
  instruction: string;
};

const SMALL = new Set(["hand", "ankle"]);
const LARGE = new Set(["back", "chest"]);

export function getScanPlan(part: BodyPart): ScanPlan {
  const raster = part.placement === "surface";
  const maxSeconds = LARGE.has(part.id) ? 55 : SMALL.has(part.id) ? 20 : 30;
  return {
    pattern: raster ? "raster" : "orbit",
    maxSeconds,
    calibrationSeconds: 5,
    rows: raster ? (LARGE.has(part.id) ? 4 : 3) : 0,
    label: raster ? "Row-by-row sweep" : "Circular sweep around the body part",
    instruction: raster
      ? "Sweep the camera slowly from left to right, move down a bit, and sweep back. Let the rows overlap."
      : "Move slowly and evenly one full lap around the body part while keeping the camera at the same distance.",
  };
}

export const scanBodyParts = BODY_PARTS;
