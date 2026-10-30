/**
 * Optical-flow "lock to skin".
 *
 * The moment the user taps Lock we snapshot the real skin patch under the
 * design: OpenCV's `goodFeaturesToTrack` finds corner-like features (pores,
 * hair, small marks, the limb silhouette) inside the placement region. Every
 * following frame those exact points are pushed forward with Lucas-Kanade
 * pyramidal optical flow (`calcOpticalFlowPyrLK`), and a homography between
 * the *locked* point positions and their current positions is fitted with
 * RANSAC (`findHomography`).
 *
 * The tattoo transform is then read straight out of that single homography:
 * translation, scale and rotation all come from one consistent mapping of the
 * real skin patch, instead of being estimated separately. That is what removes
 * lateral drift and keeps the centimetre scale honest when the camera moves
 * closer or further away.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import { loadOpenCV, opencvReady, type CV } from "./opencvLoader";


export type TrackRegion = { cx: number; cy: number; w: number; h: number };

export type FlowResult = {
  /** translation of the design centre, in video px */
  dx: number;
  dy: number;
  /** uniform scale relative to the locked frame */
  scale: number;
  /** rotation in degrees relative to the locked frame */
  rotation: number;
  /** 0..1 — share of features still agreeing with the locked patch */
  confidence: number;
  /** number of RANSAC inliers behind the current pose */
  inliers: number;
  /** 0..1 — share of the originally detected features still being tracked */
  keptRatio: number;
  /** centroid of the tracked features, in video px (NaN when unknown) */
  centerX: number;
  centerY: number;
  /**
   * True when the tracked patch has left the camera frame (or collapsed to
   * almost no surviving features). The caller must treat this as a hard loss:
   * re-learning the patch here would silently latch onto the background.
   */
  offscreen: boolean;
  /** The tracked patch nearly fills the frame and is starting to lose support. */
  tooClose: boolean;
  /** True only when the inlier geometry supports changing the visible size. */
  scaleReliable: boolean;
  /** Camera-frame timestamp used by the single downstream pose controller. */
  timestamp: number;
};


/** Processing resolution — flow is run on a downscaled frame for speed. */
const PROC_WIDTH = 480;
const MAX_POINTS = 220;
const MIN_POINTS = 8;
/**
 * Forward-backward check: a point is only trusted when tracking it back into
 * the previous frame lands within this many proc px of where it started.
 * Points that fail are the ones that slide sideways along an edge — exactly
 * the failure that used to show up as lateral swim.
 */
const FB_THRESH = 1.1;


export function createFlowLock(video: HTMLVideoElement, region: TrackRegion) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  let cv: CV | null = opencvReady();
  let disposed = false;
  let k = 1; // video px -> proc px

  // OpenCV Mats kept alive between frames.
  let prevGray: any = null;
  let basePts: Float32Array | null = null; // locked positions (proc px)
  let curPts: Float32Array | null = null; // tracked positions (proc px)

  const base = { x: region.cx, y: region.cy }; // video px
  let out: FlowResult = {
    dx: 0,
    dy: 0,
    scale: 1,
    rotation: 0,
    confidence: 0,
    inliers: 0,
    keptRatio: 1,
    centerX: region.cx,
    centerY: region.cy,
    offscreen: false,
    tooClose: false,
    scaleReliable: false,
    timestamp: 0,
  };

  let started = false;
  let detectedPointCount = 0;

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

  /** Detect fresh features inside `rect` (proc px) and make them the anchor. */
  const detect = (gray: any, cx: number, cy: number, w: number, h: number) => {
    if (!cv) return false;
    const mask = cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1);
    const x0 = Math.max(0, Math.round(cx - w / 2));
    const y0 = Math.max(0, Math.round(cy - h / 2));
    const x1 = Math.min(gray.cols, Math.round(cx + w / 2));
    const y1 = Math.min(gray.rows, Math.round(cy + h / 2));
    if (x1 - x0 < 8 || y1 - y0 < 8) {
      mask.delete();
      return false;
    }
    const roiW = x1 - x0;
    const roiH = y1 - y0;
    const roi = mask.roi(new cv.Rect(x0, y0, roiW, roiH));
    roi.setTo(new cv.Scalar(255));
    roi.delete();

    const corners = new cv.Mat();
    try {
      // Low quality level on purpose: smooth skin still yields faint corners.
      // At extreme close range the ROI covers most of the frame. Keeping the
      // usual 4 px spacing there leaves too few points after the outer ones
      // move beyond the camera edge, so allow a denser skin feature set.
      const coverage = Math.max(roiW / gray.cols, roiH / gray.rows);
      const minDistance = coverage > 0.65 ? 2.5 : coverage > 0.45 ? 3.2 : 4;
      cv.goodFeaturesToTrack(
        gray,
        corners,
        MAX_POINTS,
        0.006,
        minDistance,
        mask,
        5,
      );
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
    const pts = new Float32Array(corners.data32F.slice(0, n * 2));
    corners.delete();
    basePts = pts;
    curPts = new Float32Array(pts);
    detectedPointCount = n;
    return true;
  };

  /** Accumulated transform baked in when features are re-detected. */
  let baked = { dx: 0, dy: 0, scale: 1, rotation: 0 };
  /**
   * Latest *measured* pose, before rate limiting and filtering. Re-anchoring
   * used to bake the smoothed value, which is deliberately behind the
   * measurement — every relearn therefore threw that lag away permanently and
   * the reference ratcheted further from reality. Baking the measurement keeps
   * the chain honest: smoothing then only affects what is drawn, never the
   * reference the next segment is measured against.
   */
  let measured = { dx: 0, dy: 0, scale: 1, rotation: 0 };
  let baseCenterProc = { x: 0, y: 0 };
  let closeRiskFrames = 0;


  const start = () => {
    if (!cv || started) return;
    const gray = grab();
    if (!gray) return;
    const cx = region.cx * k;
    const cy = region.cy * k;
    const ok = detect(gray, cx, cy, region.w * k, region.h * k);
    if (!ok) {
      gray.delete();
      return;
    }
    baseCenterProc = { x: cx, y: cy };
    prevGray = gray;
    started = true;
    out = { ...out, confidence: 1 };
  };

  // Kick the runtime off; the caller keeps polling `update()` meanwhile.
  if (cv) start();
  else
    void loadOpenCV().then((ok) => {
      if (disposed || !ok) return;
      cv = opencvReady();
      if (cv) start();
    });

  const reanchor = (gray: any, cx: number, cy: number) => {
    // Relearn first, then commit the accumulated pose. A failed close-range
    // detection must not change the reference beneath the surviving points.
    const nextBaked = { ...measured };

    // Keep the search local even when accumulated zoom is very large. Once it
    // becomes the full frame it starts learning cupboards and walls alongside
    // the skin, which is especially damaging just before a close-up loss.
    const size = Math.min(
      gray.cols * 0.9,
      gray.rows * 0.9,
      Math.max(40, region.w * k * measured.scale),
    );
    if (detect(gray, cx, cy, size, size)) {
      baked = nextBaked;
      baseCenterProc = { x: cx, y: cy };
      return true;
    }
    return false;
  };

  return {
    /** True once OpenCV is up and a feature snapshot exists. */
    get ready() {
      return started;
    },
    get pointCount() {
      return basePts ? basePts.length / 2 : 0;
    },
    /** Currently tracked feature positions, in video pixels (debug view). */
    points(): Float32Array | null {
      if (!curPts || !k) return null;
      const out = new Float32Array(curPts.length);
      for (let i = 0; i < curPts.length; i++) out[i] = curPts[i] / k;
      return out;
    },
    /** The locked search region, in video pixels (debug view). */
    get region(): TrackRegion {
      return region;
    },
    /**
     * Recording mode. While the clip is running the overlay must chase the
     * camera instead of easing behind it, so the filters get a much higher
     * speed coefficient (less smoothing the faster you pan).
     */
    setFast(_on: boolean) {
      // Kept for API compatibility. Responsiveness now lives in the single
      // timestamped pose controller instead of changing tracker internals.
    },


    update(): FlowResult | null {
      if (disposed) return null;
      if (!cv || !started || !prevGray || !basePts || !curPts) return null;
      const gray = grab();
      if (!gray) return out;

      const p0 = matFrom(curPts);
      const p1 = new cv.Mat();
      const status = new cv.Mat();
      const err = new cv.Mat();
      // Four pyramid levels instead of three: a fast pan moves features
      // further between frames than a 3-level pyramid can follow, which is
      // what made the lock feel slow while filming.
      const win = new cv.Size(21, 21);
      const crit = new cv.TermCriteria(
        cv.TermCriteria_EPS | cv.TermCriteria_COUNT,
        20,
        0.03,
      );
      const back = new cv.Mat();
      const bStatus = new cv.Mat();
      const bErr = new cv.Mat();
      try {
        cv.calcOpticalFlowPyrLK(
          prevGray,
          gray,
          p0,
          p1,
          status,
          err,
          win,
          4,
          crit,
        );
        // Track the result back where it came from; disagreement means the
        // point slid and must not vote on the pose.
        cv.calcOpticalFlowPyrLK(
          gray,
          prevGray,
          p1,
          back,
          bStatus,
          bErr,
          win,
          4,
          crit,
        );
      } catch {
        p0.delete();
        p1.delete();
        status.delete();
        err.delete();
        back.delete();
        bStatus.delete();
        bErr.delete();
        gray.delete();
        return out;
      }

      const n = curPts.length / 2;
      const keptBase: number[] = [];
      const keptCur: number[] = [];
      // Close-up motion covers more processing pixels per frame. Loosen only
      // the forward/back check, and cap it, so genuine zoom survives without
      // giving ordinary-distance edge sliding a free pass.
      const fbThresh = FB_THRESH * Math.min(2.5, Math.max(1, measured.scale));
      for (let i = 0; i < n; i++) {
        if (!status.data[i]) continue;
        const x = p1.data32F[i * 2];
        const y = p1.data32F[i * 2 + 1];
        if (!isFinite(x) || !isFinite(y)) continue;
        if (x < 0 || y < 0 || x >= gray.cols || y >= gray.rows) continue;
        if (bStatus.data[i]) {
          const fbx = back.data32F[i * 2] - curPts[i * 2];
          const fby = back.data32F[i * 2 + 1] - curPts[i * 2 + 1];
          if (Math.hypot(fbx, fby) > fbThresh) continue;
        }
        keptBase.push(basePts[i * 2], basePts[i * 2 + 1]);
        keptCur.push(x, y);
      }
      p0.delete();
      p1.delete();
      status.delete();
      err.delete();
      back.delete();
      bStatus.delete();
      bErr.delete();


      const kept = keptCur.length / 2;
      const keptRatio = detectedPointCount
        ? Math.min(1, kept / detectedPointCount)
        : 0;

      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (let i = 0; i < keptCur.length; i += 2) {
        minX = Math.min(minX, keptCur[i]);
        maxX = Math.max(maxX, keptCur[i]);
        minY = Math.min(minY, keptCur[i + 1]);
        maxY = Math.max(maxY, keptCur[i + 1]);
      }
      const featureCoverage = kept
        ? Math.max((maxX - minX) / gray.cols, (maxY - minY) / gray.rows)
        : 0;
      const projectedCoverage =
        (region.w * k * Math.max(1, measured.scale)) /
        Math.max(1, Math.min(gray.cols, gray.rows));
      const nearFrame = featureCoverage > 0.68 || projectedCoverage > 0.78;

      /** Centroid of whatever is still tracked, in proc px. */
      let centroid: { x: number; y: number } | null = null;
      if (kept) {
        let sx = 0;
        let sy = 0;
        for (let i = 0; i < keptCur.length; i += 2) {
          sx += keptCur[i];
          sy += keptCur[i + 1];
        }
        centroid = { x: sx / kept, y: sy / kept };
      }
      // Predicted centre when nothing survives: where the patch was last seen.
      const predX = baseCenterProc.x + (measured.dx - baked.dx) * k;
      const predY = baseCenterProc.y + (measured.dy - baked.dy) * k;

      const cX = centroid?.x ?? predX;
      const cY = centroid?.y ?? predY;
      // A patch whose centre has reached the very edge of the frame is on its
      // way out of view. Re-detecting there only learns the background.
      const marginX = gray.cols * 0.04;
      const marginY = gray.rows * 0.04;
      const inFrame =
        cX > marginX &&
        cY > marginY &&
        cX < gray.cols - marginX &&
        cY < gray.rows - marginY;
      // A close hand legitimately loses its outer features at the frame edge.
      // Do not call that offscreen while a broad, coherent patch still spans
      // the image; the existing skin check remains the final loss safeguard.
      const offscreen = (!inFrame && !nearFrame) || keptRatio < 0.12;

      const report = (extra: Partial<FlowResult>): FlowResult => {
        out = {
          ...out,
          keptRatio,
          centerX: cX / k,
          centerY: cY / k,
          offscreen,
          tooClose: closeRiskFrames >= 2,
          scaleReliable: false,
          timestamp: performance.now(),
          ...extra,
        };
        return out;
      };

      if (kept < MIN_POINTS || offscreen) {
        // Lost the patch. Only relearn it when the last known centre is still
        // comfortably inside the frame — otherwise the tracker would happily
        // latch onto the wall behind the hand and keep reporting a confident
        // match while the skin is long gone.
        if (!offscreen && reanchor(gray, predX, predY)) {
          prevGray.delete();
          prevGray = gray;
          return report({
            confidence: Math.max(0.2, out.confidence * 0.6),
            inliers: 0,
          });
        }
        gray.delete();
        return report({
          confidence: offscreen ? 0 : out.confidence * 0.7,
          inliers: 0,
        });
      }


      // Independent, purely geometric size measurement over the *same* subset
      // of points: how far they spread around their own centroid now versus
      // when they were learned. RANSAC can be talked into a wrong scale by a
      // coherent group of bad matches; this cannot, so it is used to veto a
      // fitted scale that has started to drift away from the actual geometry.
      const spreadOf = (pts: number[]) => {
        const m = pts.length / 2;
        if (m < 3) return 0;
        let sx = 0;
        let sy = 0;
        for (let i = 0; i < pts.length; i += 2) {
          sx += pts[i];
          sy += pts[i + 1];
        }
        const mx = sx / m;
        const my = sy / m;
        let acc = 0;
        for (let i = 0; i < pts.length; i += 2) {
          acc += (pts[i] - mx) ** 2 + (pts[i + 1] - my) ** 2;
        }
        return Math.sqrt(acc / m);
      };
      const baseSpread = spreadOf(keptBase);
      const curSpread = spreadOf(keptCur);
      const pairLogRatios: number[] = [];
      const minPairDistance = Math.max(5, region.w * k * 0.12);
      // Bound pair work on high-feature frames; evenly spaced points retain
      // the patch's spatial coverage without an O(220²) cost per camera frame.
      const pointCount = keptBase.length / 2;
      const pairStride = Math.max(1, Math.floor(pointCount / 32));
      for (let i = 0; i < pointCount; i += pairStride) {
        for (let j = i + pairStride; j < pointCount; j += pairStride) {
          const bdx = keptBase[i * 2] - keptBase[j * 2];
          const bdy = keptBase[i * 2 + 1] - keptBase[j * 2 + 1];
          const bd = Math.hypot(bdx, bdy);
          if (bd < minPairDistance) continue;
          const cdx = keptCur[i * 2] - keptCur[j * 2];
          const cdy = keptCur[i * 2 + 1] - keptCur[j * 2 + 1];
          const cd = Math.hypot(cdx, cdy);
          if (cd > 0) pairLogRatios.push(Math.log(cd / bd));
        }
      }
      pairLogRatios.sort((a, b) => a - b);
      const middle = Math.floor(pairLogRatios.length / 2);
      const medianLog = pairLogRatios.length
        ? pairLogRatios.length % 2
          ? pairLogRatios[middle]
          : (pairLogRatios[middle - 1] + pairLogRatios[middle]) / 2
        : 0;
      const deviations = pairLogRatios
        .map((value) => Math.abs(value - medianLog))
        .sort((a, b) => a - b);
      const pairMad = deviations.length
        ? deviations[Math.floor(deviations.length / 2)]
        : Infinity;
      const pairScale = pairLogRatios.length >= 3 ? Math.exp(medianLog) : 0;
      const geomScale = pairScale || (baseSpread > 1 && curSpread > 0 ? curSpread / baseSpread : 0);

      basePts = Float32Array.from(keptBase);
      curPts = Float32Array.from(keptCur);


      // --- one similarity transform for translation + scale + rotation -----
      // A homography has eight degrees of freedom; skin under a phone only
      // has four that matter (shift, zoom, twist). The spare perspective
      // terms were absorbing noise and leaking it back out as sideways swim,
      // so the pose is fitted as a 4-DOF similarity instead — same RANSAC,
      // far less lateral wander. Homography stays as the fallback for builds
      // where `estimateAffinePartial2D` is not compiled in.
      const src = matFrom(basePts);
      const dst = matFrom(curPts);
      const inliers = new cv.Mat();
      let M: any = null;
      let H: any = null;
      try {
        if (typeof (cv as any).estimateAffinePartial2D === "function") {
          M = (cv as any).estimateAffinePartial2D(
            src,
            dst,
            inliers,
            cv.RANSAC,
            2.5,
            2000,
            0.995,
            10,
          );
          if (M && M.empty?.()) {
            M.delete();
            M = null;
          }
        }
      } catch {
        M = null;
      }
      if (!M) {
        try {
          H = cv.findHomography(src, dst, cv.RANSAC, 3, inliers);
        } catch {
          H = null;
        }
      }

      let ratio = 0;
      let inlierCount = 0;
      if (inliers.rows) {
        for (let i = 0; i < inliers.rows; i++) if (inliers.data[i]) inlierCount++;
        ratio = inlierCount / inliers.rows;
      }

      if (nearFrame && (keptRatio < 0.58 || ratio < 0.58)) {
        closeRiskFrames = Math.min(8, closeRiskFrames + 1);
      } else {
        closeRiskFrames = Math.max(0, closeRiskFrames - 1);
      }

      let pose: { cx: number; cy: number; s: number; rot: number } | null = null;
      const c0 = baseCenterProc;
      if (M && M.rows === 2) {
        const m = M.data64F;
        const a = m[0];
        const b = m[3];
        pose = {
          cx: m[0] * c0.x + m[1] * c0.y + m[2],
          cy: m[3] * c0.x + m[4] * c0.y + m[5],
          s: Math.hypot(a, b),
          rot: (Math.atan2(b, a) * 180) / Math.PI,
        };
      } else if (H && !H.empty() && H.rows === 3) {
        const h = H.data64F;
        const map = (x: number, y: number) => {
          const w = h[6] * x + h[7] * y + h[8] || 1e-6;
          return {
            x: (h[0] * x + h[1] * y + h[2]) / w,
            y: (h[3] * x + h[4] * y + h[5]) / w,
          };
        };
        const r = Math.max(12, region.w * k * 0.35);
        const c = map(c0.x, c0.y);
        const ex = map(c0.x + r, c0.y);
        const ey = map(c0.x, c0.y + r);
        const sx = Math.hypot(ex.x - c.x, ex.y - c.y) / r;
        const sy = Math.hypot(ey.x - c.x, ey.y - c.y) / r;
        pose = {
          cx: c.x,
          cy: c.y,
          s: (sx + sy) / 2,
          rot: (Math.atan2(ex.y - c.y, ex.x - c.x) * 180) / Math.PI,
        };
      }

      if (
        pose &&
        isFinite(pose.s) &&
        pose.s > 0.3 &&
        pose.s < 12 &&
        isFinite(pose.cx) &&
        isFinite(pose.cy) &&
        ratio > 0.35
      ) {
        // Measured pose, expressed relative to the locked frame in video px.
        // `pose - c0` is already the displacement of the newly anchored
        // segment in video pixels. Multiplying it by the previously baked
        // scale applied zoom twice after every re-anchor and made the decal
        // drift sideways when the phone changed distance.
        const mDx = baked.dx + (pose.cx - c0.x) / k;
        const mDy = baked.dy + (pose.cy - c0.y) / k;
        // Keep the internal reference finite. This is deliberately looser
        // than the visible range, but prevents a long close-up/re-anchor chain
        // from making the next detection window numerically meaningless.
        const measuredScale = Math.min(12, Math.max(0.2, baked.scale * pose.s));
        const mRot = baked.rotation + pose.rot;

        const trust = Math.min(1, Math.max(0, ratio));
        // Scale has one authority: robust pair-distance geometry over the
        // RANSAC inliers. Median log-ratios are symmetric for zoom in/out and
        // cannot be dominated by one distant point. MAD rejects anisotropic
        // constellations (edge sliding/perspective) before size is changed.
        const geomAgrees =
          geomScale > 0 && Math.abs(pose.s / geomScale - 1) < 0.18;
        const scaleSupported =
          inlierCount >= Math.max(6, Math.ceil(kept * 0.45)) &&
          ratio >= 0.54 &&
          pairLogRatios.length >= 3 &&
          pairMad < 0.075 &&
          geomAgrees;

        measured = {
          dx: mDx,
          dy: mDy,
          scale: scaleSupported ? measuredScale : measured.scale,
          rotation: mRot,
        };

        // Return raw, validated camera-frame measurements. Temporal filtering
        // happens exactly once in lockPoseController.
        report({
          dx: measured.dx,
          dy: measured.dy,
          scale: measured.scale,
          rotation: measured.rotation,
          confidence: trust,
          inliers: inlierCount,
          tooClose: closeRiskFrames >= 2,
          scaleReliable: scaleSupported,
          timestamp: performance.now(),
        });
      } else {
        // A failed fit is unknown motion, never permission to keep reporting
        // the previous frame as a strong match. Decaying here lets the caller
        // freeze and re-acquire instead of leaving the tattoo behind while the
        // confidence meter incorrectly remains high.
        report({ confidence: out.confidence * 0.68, inliers: 0 });
      }

      M?.delete();
      H?.delete();
      src.delete();
      dst.delete();
      inliers.delete();


      // Top the feature set back up when attrition thins it out — but never
      // while the patch is drifting out of view.
      // Relearn before a close-up exhausts the original feature set. Baking a
      // large relative zoom into a fresh anchor also removes the old 3.5x
      // ceiling: total scale can keep growing while each local fit stays sane.
      const largeLocalZoom = !!pose && pose.s > 2;
      const needsFeatureTopUp = keptRatio < 0.6;
      if (
        !offscreen &&
        (largeLocalZoom ||
          needsFeatureTopUp ||
          kept < Math.max(MIN_POINTS, detectedPointCount * 0.45))
      ) {
        reanchor(
          gray,
          baseCenterProc.x + (measured.dx - baked.dx) * k,
          baseCenterProc.y + (measured.dy - baked.dy) * k,

        );
      }


      prevGray.delete();
      prevGray = gray;
      return out;
    },
    dispose() {
      disposed = true;
      prevGray?.delete();
      prevGray = null;
      basePts = null;
      curPts = null;
    },
  };
}

export type FlowLock = ReturnType<typeof createFlowLock>;
