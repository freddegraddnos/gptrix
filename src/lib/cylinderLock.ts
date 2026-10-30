/**
 * Cylinder-anchored "lock to skin".
 *
 * A flat lock (one homography over the whole patch) breaks down as soon as the
 * arm rotates: points near the silhouette move much faster than points near
 * the middle, so the fit reports bogus scale and slides sideways. This tracker
 * anchors the same optical-flow features to the *tapered cylinder* instead.
 *
 * On Lock:
 *   - `goodFeaturesToTrack` snapshots corner-like features (pores, hair, small
 *     marks, the limb edge) inside the tattoo's placement region;
 *   - each feature's pixel position is converted to a surface coordinate on
 *     the cylinder — `u` along the limb's axis, `v` the angle around its
 *     circumference — and it is that (u, v) that is stored, not the pixel.
 *
 * Every following frame:
 *   - the cylinder's pose is refreshed from the current landmarks;
 *   - the features are pushed forward with Lucas-Kanade pyramidal optical flow
 *     (`calcOpticalFlowPyrLK`) to get their observed positions;
 *   - each stored (u, v) is re-projected through the *current* pose to get a
 *     predicted position.
 *
 * The re-projection carries everything geometry knows — points rotating toward
 * the edge of the limb, the silhouette narrowing as the arm turns, the axis
 * shortening as it points at the camera — while the flow observation corrects
 * the small local jitter the landmarks can't see. Scale comes from the axis
 * length and is cross-checked against flow, which is what keeps centimetres
 * honest and kills lateral drift.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadOpenCV, opencvReady, type CV } from "./opencvLoader";
import { radiusAt, type LimbCylinder } from "./limbCylinder";
import { OneEuroPoint } from "./oneEuro";

export type Vec2 = { x: number; y: number };

/** Cylinder pose for one frame, in video pixels. */
export type CylinderPose = {
  /** Axis start (e.g. elbow) and end (e.g. wrist). */
  a: Vec2;
  b: Vec2;
  /** Radii along the axis, from a to b. */
  cylinder: LimbCylinder;
};

export type LockState = "tracking" | "reacquiring";

export type CylinderLockResult = {
  /** Design centre in video pixels. */
  x: number;
  y: number;
  /** Rotation of the limb axis in radians. */
  rotation: number;
  /** Scale relative to the locked frame (1 = same apparent size). */
  scale: number;
  /** 0..1 — share of features still agreeing with the cylinder prediction. */
  confidence: number;
  /** "reacquiring" while the patch is being re-learned after a track loss. */
  state: LockState;
  /** 0..1 render opacity: fades out on loss, back in once re-acquired. */
  opacity: number;
};

/** Surface coordinate: u along the axis (0..1), v around it (radians). */
type Surface = { u: number; v: number };

const PROC_WIDTH = 480;
const MAX_POINTS = 220;
const MIN_POINTS = 8;
/**
 * Below this many surviving points the track is no longer trustworthy: fade
 * out and re-acquire instead of letting the design snap around.
 */
const REACQUIRE_BELOW = 10;
/** Opacity change per frame while fading out / back in (~5 frames each way). */
const FADE_STEP = 0.2;
/** Beyond this angle a point has rotated past the silhouette — drop it. */
const VISIBLE_V = (78 * Math.PI) / 180;
/** How far an observation may sit from its prediction (proc px) and still count. */
const RESIDUAL_TOL = 14;


const sub = (p: Vec2, q: Vec2): Vec2 => ({ x: p.x - q.x, y: p.y - q.y });
const len = (p: Vec2) => Math.hypot(p.x, p.y) || 1e-6;

function median(v: number[]): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Axis frame of a pose: origin, unit direction, unit normal, axis length. */
function frameOf(pose: CylinderPose) {
  const d = sub(pose.b, pose.a);
  const l = len(d);
  const dir = { x: d.x / l, y: d.y / l };
  return { o: pose.a, dir, n: { x: -dir.y, y: dir.x }, length: l };
}

/** Pixel -> surface coordinate on the cylinder. */
function toSurface(p: Vec2, pose: CylinderPose): Surface | null {
  const f = frameOf(pose);
  const rel = sub(p, f.o);
  const u = (rel.x * f.dir.x + rel.y * f.dir.y) / f.length;
  const off = rel.x * f.n.x + rel.y * f.n.y;
  const r = Math.max(1, radiusAt(pose.cylinder, u));
  const s = Math.max(-1, Math.min(1, off / r));
  const v = Math.asin(s);
  if (!isFinite(u) || !isFinite(v)) return null;
  return { u, v };
}

/** Surface coordinate -> pixel through a pose. `depth` is cos(v): 1 = facing us. */
function toPixel(s: Surface, pose: CylinderPose): { p: Vec2; depth: number } {
  const f = frameOf(pose);
  const r = Math.max(1, radiusAt(pose.cylinder, s.u));
  const along = s.u * f.length;
  const across = r * Math.sin(s.v);
  return {
    p: {
      x: f.o.x + f.dir.x * along + f.n.x * across,
      y: f.o.y + f.dir.y * along + f.n.y * across,
    },
    depth: Math.cos(s.v),
  };
}

export function createCylinderLock(
  video: HTMLVideoElement,
  /** Placement region in video px — where the design currently sits. */
  region: { cx: number; cy: number; w: number; h: number },
  pose: CylinderPose,
) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  let cv: CV | null = opencvReady();
  let disposed = false;
  let started = false;
  let k = 1; // video px -> proc px

  let prevGray: any = null;
  let curPts: Float32Array | null = null; // observed positions, proc px
  let surfaces: Surface[] = []; // locked (u, v) per point
  /** One Euro filter per tracked point — jitter out, no lag in. */
  let filters: OneEuroPoint[] = [];
  let lastStamp = 0;
  let centre: Surface | null = null; // the design's own surface anchor
  let lockedAxisLen = 1; // video px at lock time
  let lockedRot = 0;

  let state: LockState = "tracking";
  let opacity = 1;
  let smooth = { x: region.cx, y: region.cy, rotation: 0, scale: 1 };
  let out: CylinderLockResult | null = null;


  const grab = (): any | null => {
    if (!cv || !ctx) return null;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;
    k = Math.min(1, PROC_WIDTH / vw);
    const w = Math.max(2, Math.round(vw * k));
    const h = Math.max(2, Math.round(vh * k));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    try {
      ctx.drawImage(video, 0, 0, w, h);
    } catch {
      return null;
    }
    const rgba = cv.imread(canvas);
    const gray = new cv.Mat();
    cv.cvtColor(rgba, gray, cv.COLOR_RGBA2GRAY);
    rgba.delete();
    return gray;
  };

  const matFrom = (pts: Float32Array) => {
    const m = new cv!.Mat(pts.length / 2, 1, cv!.CV_32FC2);
    m.data32F.set(pts);
    return m;
  };

  /** Detect features in a region (proc px) and bind them to the cylinder. */
  const detect = (gray: any, at: CylinderPose, r: typeof region) => {
    if (!cv) return false;
    const mask = cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
    const x0 = Math.max(0, Math.round((r.cx - r.w / 2) * k));
    const y0 = Math.max(0, Math.round((r.cy - r.h / 2) * k));
    const x1 = Math.min(gray.cols, Math.round((r.cx + r.w / 2) * k));
    const y1 = Math.min(gray.rows, Math.round((r.cy + r.h / 2) * k));
    if (x1 - x0 < 8 || y1 - y0 < 8) {
      mask.delete();
      return false;
    }
    const roi = mask.roi(new cv.Rect(x0, y0, x1 - x0, y1 - y0));
    roi.setTo(new cv.Scalar(255));
    roi.delete();

    const corners = new cv.Mat();
    try {
      // Low quality level on purpose: smooth skin still yields faint corners.
      cv.goodFeaturesToTrack(gray, corners, MAX_POINTS, 0.006, 4, mask, 5);
    } catch {
      mask.delete();
      corners.delete();
      return false;
    }
    mask.delete();
    const n = corners.rows;
    if (n < MIN_POINTS) {
      corners.delete();
      return false;
    }

    const pts: number[] = [];
    const surf: Surface[] = [];
    for (let i = 0; i < n; i++) {
      const px = corners.data32F[i * 2];
      const py = corners.data32F[i * 2 + 1];
      // Bind in video pixels: the pose lives in video space.
      const s = toSurface({ x: px / k, y: py / k }, at);
      if (!s || Math.abs(s.v) > VISIBLE_V) continue;
      pts.push(px, py);
      surf.push(s);
    }
    corners.delete();
    if (surf.length < MIN_POINTS) return false;

    curPts = Float32Array.from(pts);
    surfaces = surf;
    // Fresh filters: a re-detected point has no history worth keeping.
    filters = surf.map(
      () => new OneEuroPoint({ minCutoff: 0.9, beta: 0.03, dCutoff: 1.0 }),
    );
    lastStamp = 0;
    return true;
  };

  const start = () => {
    if (!cv || started) return;
    const gray = grab();
    if (!gray) return;
    if (!detect(gray, pose, region)) {
      gray.delete();
      return;
    }
    centre = toSurface({ x: region.cx, y: region.cy }, pose);
    const f = frameOf(pose);
    lockedAxisLen = f.length;
    lockedRot = Math.atan2(f.dir.y, f.dir.x);
    smooth = { x: region.cx, y: region.cy, rotation: 0, scale: 1 };
    prevGray = gray;
    started = true;
  };

  if (cv) start();
  else
    void loadOpenCV().then((ok) => {
      if (disposed || !ok) return;
      cv = opencvReady();
      if (cv) start();
    });

  return {
    /** True once OpenCV is up and the surface snapshot exists. */
    get ready() {
      return started;
    },
    /** "reacquiring" while the patch is being re-learned. */
    get state(): LockState {
      return state;
    },
    /** Current fade opacity, 0..1. */
    get opacity() {
      return opacity;
    },
    get pointCount() {
      return curPts ? curPts.length / 2 : 0;
    },
    /** Tracked feature positions in video px (debug view). */
    points(): Float32Array | null {
      if (!curPts) return null;
      const p = new Float32Array(curPts.length);
      for (let i = 0; i < curPts.length; i++) p[i] = curPts[i] / k;
      return p;
    },

    /**
     * One frame of tracking.
     * @param now the cylinder pose rebuilt from this frame's landmarks
     */
    update(now: CylinderPose): CylinderLockResult | null {
      if (disposed || !cv || !started || !prevGray || !curPts || !centre)
        return out;
      const gray = grab();
      if (!gray) return out;
      const t = performance.now();
      const dt = lastStamp ? (t - lastStamp) / 1000 : 1 / 60;
      lastStamp = t;

      // --- 1. observe: optical flow ---------------------------------------
      const p0 = matFrom(curPts);
      const p1 = new cv.Mat();
      const status = new cv.Mat();
      const err = new cv.Mat();
      try {
        cv.calcOpticalFlowPyrLK(
          prevGray,
          gray,
          p0,
          p1,
          status,
          err,
          new cv.Size(21, 21),
          3,
          new cv.TermCriteria(
            cv.TermCriteria_EPS | cv.TermCriteria_COUNT,
            20,
            0.03,
          ),
        );
      } catch {
        p0.delete();
        p1.delete();
        status.delete();
        err.delete();
        gray.delete();
        return out;
      }

      // --- 2. predict: re-project each stored (u, v) through the new pose --
      const keptPts: number[] = [];
      const keptSurf: Surface[] = [];
      const keptFilters: OneEuroPoint[] = [];
      const resX: number[] = [];
      const resY: number[] = [];
      const flowScale: number[] = [];
      const nowFrame = frameOf(now);
      const predCentre = toPixel(centre, now).p;

      for (let i = 0; i < surfaces.length; i++) {
        const s = surfaces[i];
        const pred = toPixel(s, now);
        // Rotated past the silhouette: geometry says we cannot see it.
        if (pred.depth < Math.cos(VISIBLE_V)) continue;
        if (!status.data[i]) continue;
        const rawX = p1.data32F[i * 2];
        const rawY = p1.data32F[i * 2 + 1];
        if (!isFinite(rawX) || !isFinite(rawY)) continue;
        if (rawX < 0 || rawY < 0 || rawX >= gray.cols || rawY >= gray.rows)
          continue;

        // One Euro: strong smoothing while the point is nearly still, almost
        // none while it travels, so jitter goes without adding lag.
        const filter =
          filters[i] ??
          new OneEuroPoint({ minCutoff: 0.9, beta: 0.03, dCutoff: 1.0 });
        const f = filter.filter(rawX, rawY, dt);
        const ox = f.x;
        const oy = f.y;

        const dx = ox - pred.p.x * k;
        const dy = oy - pred.p.y * k;
        // Reject observations that disagree wildly: those are flow failures,
        // not real motion the cylinder missed.
        if (Math.hypot(dx, dy) > RESIDUAL_TOL * 3) continue;

        keptPts.push(ox, oy);
        keptSurf.push(s);
        keptFilters.push(filter);
        resX.push(dx);
        resY.push(dy);
        // Cross-check of the geometric scale, weighted toward central points
        // where foreshortening is mildest.
        const dObs = Math.hypot(ox / k - predCentre.x, oy / k - predCentre.y);
        const dPred = Math.hypot(
          pred.p.x - predCentre.x,
          pred.p.y - predCentre.y,
        );
        if (dPred > 6 && pred.depth > 0.6) flowScale.push(dObs / dPred);
      }

      p0.delete();
      p1.delete();
      status.delete();
      err.delete();

      const kept = keptSurf.length;
      if (kept < Math.max(MIN_POINTS, REACQUIRE_BELOW)) {
        // Too few survivors (fast motion, motion blur, limb left the frame).
        // Rather than let the design snap to a bad fit, fade it out, re-detect
        // the limb from the current landmark pose and sample a fresh patch.
        state = "reacquiring";
        opacity = Math.max(0, opacity - FADE_STEP);
        const w = Math.max(40, region.w * smooth.scale);
        const relearned = detect(gray, now, {
          cx: predCentre.x,
          cy: predCentre.y,
          w,
          h: w,
        });
        if (relearned) centre = toSurface(predCentre, now) ?? centre;
        prevGray.delete();
        prevGray = gray;
        const rot = Math.atan2(nowFrame.dir.y, nowFrame.dir.x) - lockedRot;
        // Hold the geometric prediction steady while faded — no snapping.
        smooth = {
          x: predCentre.x,
          y: predCentre.y,
          rotation: rot,
          scale: nowFrame.length / lockedAxisLen,
        };
        out = {
          ...smooth,
          confidence: Math.max(0.15, (out?.confidence ?? 0.5) * 0.7),
          state,
          opacity,
        };
        return out;
      }

      curPts = Float32Array.from(keptPts);
      surfaces = keptSurf;
      filters = keptFilters;
      // Enough points again: fade the design back in.
      state = "tracking";
      opacity = Math.min(1, opacity + FADE_STEP);

      // --- 3. fuse: geometry for pose, flow for the residual jitter --------
      // A median residual is immune to the handful of points that slid onto
      // the background or a sleeve.
      const mx = median(resX) / k;
      const my = median(resY) / k;
      const agree =
        resX.filter((_, i) => Math.hypot(resX[i], resY[i]) < RESIDUAL_TOL)
          .length / kept;

      const geomScale = nowFrame.length / lockedAxisLen;
      const obsScale = flowScale.length >= 4 ? median(flowScale) : 1;
      // Flow only nudges the geometric scale; it never owns it.
      const targetScale =
        geomScale * (1 + Math.max(-0.25, Math.min(0.25, obsScale - 1)) * 0.5);
      const targetRot = Math.atan2(nowFrame.dir.y, nowFrame.dir.x) - lockedRot;
      const targetX = predCentre.x + mx;
      const targetY = predCentre.y + my;

      const a = 0.3 + 0.4 * agree;
      let dRot = targetRot - smooth.rotation;
      while (dRot > Math.PI) dRot -= Math.PI * 2;
      while (dRot < -Math.PI) dRot += Math.PI * 2;
      smooth = {
        x: smooth.x + (targetX - smooth.x) * a,
        y: smooth.y + (targetY - smooth.y) * a,
        rotation: smooth.rotation + dRot * a,
        scale: smooth.scale + (targetScale - smooth.scale) * (a * 0.6),
      };

      out = {
        x: smooth.x,
        y: smooth.y,
        rotation: smooth.rotation,
        scale: smooth.scale,
        confidence: Math.max(0, Math.min(1, agree)),
        state,
        opacity,
      };

      // Top the feature set back up when attrition thins it out (points keep
      // rotating out of view as the arm turns).
      if (kept < MAX_POINTS * 0.35) {
        const w = Math.max(40, region.w * smooth.scale);
        if (detect(gray, now, { cx: smooth.x, cy: smooth.y, w, h: w }))
          centre = toSurface({ x: smooth.x, y: smooth.y }, now) ?? centre;
      }

      prevGray.delete();
      prevGray = gray;
      return out;
    },

    dispose() {
      disposed = true;
      prevGray?.delete();
      prevGray = null;
      curPts = null;
      surfaces = [];
      filters = [];
    },
  };
}

export type CylinderLock = ReturnType<typeof createCylinderLock>;
