/**
 * Computes the placement (anchor point, rotation, possible bend angle and width)
 * based on MediaPipe landmarks for the body part the user chose.
 */
import type { BodyPart } from "@/lib/bodyParts";

export type Landmark = { x: number; y: number; z?: number; visibility?: number };

/** Pose Landmarker index (BlazePose 33). */
export const POSE = {
  shoulderL: 11,
  shoulderR: 12,
  elbowL: 13,
  elbowR: 14,
  wristL: 15,
  wristR: 16,
  hipL: 23,
  hipR: 24,
  kneeL: 25,
  kneeR: 26,
  ankleL: 27,
  ankleR: 28,
  footL: 31,
  footR: 32,
} as const;

/** Landmark chains per body part, one per body side. */
export type Side = "left" | "right";

type Chain = { side: Side; indices: number[] };

export type PlacementKind = "joint" | "surface" | "hand" | "free";

export type Placement = {
  kind: PlacementKind;
  /** Normalized coordinates (0–1) for the center of the motif. */
  x: number;
  y: number;
  /** Rotation in radians, along the direction of the body part. */
  rotation: number;
  /** Width (normalized) of the reference area, for scaling. */
  span: number;
  /** Bend angle in degrees at the joint (e.g. elbow/knee), when available. */
  bendDeg: number | null;
  /**
   * The two landmarks defining the limb's long axis (cylinder centerline):
   * wrist + elbow for a forearm, the two nearest knuckle joints for a finger.
   * Null for flat surfaces (chest, back) and free placement.
   */
  axis: { a: Landmark; b: Landmark } | null;
  /** Landmarks used, for debug drawing. */
  points: Landmark[];
  side: Side | null;
};

const chainsFor = (partId: string): Chain[] => {
  switch (partId) {
    case "forearm":
      return [
        { side: "left", indices: [POSE.shoulderL, POSE.elbowL, POSE.wristL] },
        { side: "right", indices: [POSE.shoulderR, POSE.elbowR, POSE.wristR] },
      ];
    case "upperarm":
      return [
        { side: "left", indices: [POSE.shoulderL, POSE.elbowL] },
        { side: "right", indices: [POSE.shoulderR, POSE.elbowR] },
      ];
    case "calf":
      return [
        { side: "left", indices: [POSE.hipL, POSE.kneeL, POSE.ankleL] },
        { side: "right", indices: [POSE.hipR, POSE.kneeR, POSE.ankleR] },
      ];
    case "thigh":
      return [
        { side: "left", indices: [POSE.hipL, POSE.kneeL] },
        { side: "right", indices: [POSE.hipR, POSE.kneeR] },
      ];
    case "ankle":
      return [
        { side: "left", indices: [POSE.kneeL, POSE.ankleL, POSE.footL] },
        { side: "right", indices: [POSE.kneeR, POSE.ankleR, POSE.footR] },
      ];
    default:
      return [];
  }
};

/** Shoulder/neck/chest/back: shoulders + hips as a stable reference area. */
const TORSO = [POSE.shoulderL, POSE.shoulderR, POSE.hipR, POSE.hipL];

const vis = (p?: Landmark) => (p?.visibility ?? 1) || 0;
const dist = (a: Landmark, b: Landmark) => Math.hypot(b.x - a.x, b.y - a.y);
const angle = (a: Landmark, b: Landmark) => Math.atan2(b.y - a.y, b.x - a.x);

function bendDegrees(a: Landmark, b: Landmark, c: Landmark): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const mag = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (!mag) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

function pickChain(chains: Chain[], marks: Landmark[]): Chain | null {
  let best: Chain | null = null;
  let bestScore = 0;
  for (const c of chains) {
    const pts = c.indices.map((i) => marks[i]);
    if (pts.some((p) => !p)) continue;
    const score = pts.reduce((s, p) => s + vis(p), 0) / pts.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0.4 ? best : best;
}

/** Free placement: simple reference area in the middle of the image. */
export const freePlacement = (): Placement => ({
  kind: "free",
  x: 0.5,
  y: 0.5,
  rotation: 0,
  span: 0.25,
  bendDeg: null,
  axis: null,
  points: [{ x: 0.5, y: 0.5 }],
  side: null,
});

/** Hand Landmarker: palm + fingers (index 0 wrist, 5/17 knuckles, 9 middle). */
export function handPlacement(marks: Landmark[]): Placement | null {
  const wrist = marks[0];
  const indexMcp = marks[5];
  const pinkyMcp = marks[17];
  const middleMcp = marks[9];
  if (!wrist || !indexMcp || !pinkyMcp || !middleMcp) return null;
  const palm = {
    x: (wrist.x + middleMcp.x) / 2,
    y: (wrist.y + middleMcp.y) / 2,
  };
  return {
    kind: "hand",
    x: palm.x,
    y: palm.y,
    rotation: angle(wrist, middleMcp) + Math.PI / 2,
    span: dist(indexMcp, pinkyMcp) * 1.6,
    bendDeg: null,
    // Finger/hand: the nearest knuckle joints give the local cylinder axis.
    axis: marks[10]
      ? { a: middleMcp, b: marks[10] }
      : { a: wrist, b: middleMcp },
    points: [wrist, indexMcp, middleMcp, pinkyMcp],
    side: null,
  };
}

/** Pose Landmarker: chain or torso surface depending on body part. */
export function posePlacement(
  part: BodyPart,
  marks: Landmark[],
): Placement | null {
  if (part.id === "other") return freePlacement();

  if (part.placement === "surface") {
    const pts = TORSO.map((i) => marks[i]);
    if (pts.some((p) => !p)) return null;
    const [sl, sr, hr, hl] = pts as Landmark[];
    const shoulderMid = { x: (sl.x + sr.x) / 2, y: (sl.y + sr.y) / 2 };
    const hipMid = { x: (hl.x + hr.x) / 2, y: (hl.y + hr.y) / 2 };
    let anchor = { x: shoulderMid.x, y: shoulderMid.y };
    if (part.id === "chest" || part.id === "back") {
      anchor = {
        x: shoulderMid.x * 0.65 + hipMid.x * 0.35,
        y: shoulderMid.y * 0.65 + hipMid.y * 0.35,
      };
    } else if (part.id === "shoulder") {
      anchor = vis(sl) >= vis(sr) ? { x: sl.x, y: sl.y } : { x: sr.x, y: sr.y };
    } else if (part.id === "neck") {
      anchor = {
        x: shoulderMid.x,
        y: shoulderMid.y - dist(shoulderMid, hipMid) * 0.18,
      };
    }
    return {
      kind: "surface",
      x: anchor.x,
      y: anchor.y,
      rotation: angle(sl, sr),
      span: dist(sl, sr),
      bendDeg: null,
      axis: null,
      points: [sl, sr, hr, hl],
      side: null,
    };
  }

  const chain = pickChain(chainsFor(part.id), marks);
  if (!chain) return null;
  const pts = chain.indices.map((i) => marks[i]) as Landmark[];

  // The segment the motif attaches to is the last one in the chain.
  const a = pts[pts.length - 2];
  const b = pts[pts.length - 1];

  // Wrist/foot is anchored at the ankle, others at the middle of the segment.
  const anchor =
    part.id === "ankle"
      ? { x: pts[1].x, y: pts[1].y }
      : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };


  return {
    kind: "joint",
    x: anchor.x,
    y: anchor.y,
    rotation: angle(a, b),
    span: dist(a, b),
    axis: { a, b },
    bendDeg: pts.length >= 3 ? bendDegrees(pts[0], pts[1], pts[2]) : null,
    points: pts,
    side: chain.side,
  };
}
