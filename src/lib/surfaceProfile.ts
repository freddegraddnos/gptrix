/**
 * Surface Scan (light 3D).
 *
 * The AR camera already measures curvature, limb axis, tilt, scene light and
 * skin tone — but each reading is a snapshot that the next one throws away.
 * This module turns those snapshots into an accumulation: sweep the phone
 * slowly around a forearm and every usable reading is bucketed by the angle it
 * was seen from, so the profile only completes once the surface has actually
 * been observed from several sides.
 *
 * The result is not a mesh. It is a tapered-cylinder description of the body
 * part — radius (as wrap curvature), which way it runs, how far it leans, how
 * wide it is in centimetres, where the light comes from and what the skin
 * reads as. That is exactly what the wrap and ink pipelines already consume.
 */

export type SurfaceSample = {
  /** 0..1 wrap curvature for this frame. */
  curve: number;
  /** 0..1 trust in the curvature reading. */
  curveConf: number;
  /** How much of the sampled strip the limb filled, 0..1. */
  limbFraction: number;
  /** Limb direction in screen degrees (0 = runs vertically). */
  axisDeg: number;
  /** 0..1 foreshortening along the axis. */
  tilt: number;
  /** Which end is nearer the camera. */
  tiltDir: -1 | 1;
  /** 0..1 trust in the axis reading. */
  axisConf: number;
  /** On-screen limb width in CSS px, when it could be measured. */
  limbWidthPx?: number;
  light?: { x: number; y: number; strength: number; luminance: number };
  /** Mean skin luminance, 0..255. */
  skinLuma?: number;
};

export type SurfaceProfile = {
  curve: number;
  axisDeg: number;
  tilt: number;
  tiltDir: -1 | 1;
  /** Estimated on-skin width of the scanned limb in cm, when measurable. */
  widthCm: number | null;
  light: { x: number; y: number; strength: number };
  skinLuma: number | null;
  /** How many usable readings went into the profile. */
  samples: number;
  /** 0..1 angular coverage reached when the scan finished. */
  coverage: number;
  scannedAt: string;
  /**
   * Narrowing along the limb: 1 = a straight tube, 0.8 = the far end reads
   * 20% thinner (a forearm toward the wrist, a calf toward the ankle).
   * Written by scans that swept along the limb; absent on older profiles.
   */
  taper?: number;
  /** 0..1 trust in the whole profile — coverage, sample count and agreement. */
  quality?: number;
  /** How much the curvature readings disagreed, 0..1. Lower is a better fit. */
  curveSpread?: number;
};


export type ScanFeedback = {
  coverage: number;
  samples: number;
  /** Short, actionable coaching line, or null when the sweep looks good. */
  hint: string | null;
  /** Live 0..1 fit quality, using the same mix as the finished profile. */
  quality: number;
  /** How many distinct viewing angles have been banked so far. */
  angles: number;
  /** How many distinct angles a complete sweep aims for. */
  targetAngles: number;
  /** True once stopping early would still produce a usable profile. */
  usable: boolean;
};



/** Distinct angle buckets needed for a complete sweep. */
const TARGET_BUCKETS = 8;
/** Angular width of one bucket, in degrees of measured limb axis. */
const BUCKET_DEG = 12;
/** A reading below this trust level teaches the profile nothing. */
const MIN_CONF = 0.35;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function weightedMedian(
  values: Array<{ v: number; w: number }>,
): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, e) => s + e.w, 0);
  if (total <= 0) return sorted[Math.floor(sorted.length / 2)].v;
  let acc = 0;
  for (const e of sorted) {
    acc += e.w;
    if (acc >= total / 2) return e.v;
  }
  return sorted[sorted.length - 1].v;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

export type SurfaceScan = {
  /** Feed one reading. Returns live coverage + a coaching hint. */
  add(sample: SurfaceSample): ScanFeedback;
  feedback(): ScanFeedback;
  /** True once the sweep has seen enough distinct angles. */
  complete(): boolean;
  /** Build the profile, or null when too little was measured. */
  finalize(pxPerCm: number): SurfaceProfile | null;
  reset(): void;
};

type TimedSample = SurfaceSample & { at: number };

export function createSurfaceScan(): SurfaceScan {
  let samples: TimedSample[] = [];
  /** Best reading seen per angle bucket — the profile is fitted to these. */
  const buckets = new Map<number, TimedSample>();
  let hint: string | null = null;
  let lastAxis: number | null = null;
  let lastAt = 0;
  let startedAt = 0;

  const coverage = () => clamp(buckets.size / TARGET_BUCKETS, 0, 1);
  /** Same mix as the finished profile, so the live number never jumps. */
  const liveQuality = () => {
    const fit = [...buckets.values()];
    if (!fit.length) return 0;
    const c = mean(fit.map((s) => s.curve)) ?? 0;
    const spread = clamp(
      Math.sqrt(mean(fit.map((s) => (s.curve - c) ** 2)) ?? 0) * 2,
      0,
      1,
    );
    return (
      Math.round(
        clamp(
          0.45 * coverage() +
            0.3 * clamp(samples.length / 24, 0, 1) +
            0.25 * (1 - spread),
          0,
          1,
        ) * 100,
      ) / 100
    );
  };
  const feedback = (): ScanFeedback => ({
    coverage: coverage(),
    samples: samples.length,
    hint,
    quality: liveQuality(),
    angles: buckets.size,
    targetAngles: TARGET_BUCKETS,
    usable: samples.length >= 3,
  });



  return {
    add(sample) {
      const now = Date.now();
      if (!startedAt) startedAt = now;
      const dark = (sample.light?.luminance ?? 1) < 0.22;
      const blown = (sample.light?.luminance ?? 0) > 0.94;
      const weak = sample.curveConf < MIN_CONF || sample.axisConf < MIN_CONF;
      // A limb that fills almost nothing (too far) or the whole strip (too
      // close) gives a curvature reading that cannot be trusted as geometry.
      const tooFar = sample.limbFraction > 0 && sample.limbFraction < 0.18;
      const tooClose = sample.limbFraction > 0.92;

      // Swinging the phone faster than the estimators can follow produces
      // readings that disagree with each other; say so instead of banking them.
      const fast =
        lastAxis != null &&
        now - lastAt < 400 &&
        Math.abs(sample.axisDeg - lastAxis) > 22;

      lastAxis = sample.axisDeg;
      lastAt = now;

      if (dark) hint = "Too dark — find more light on the skin";
      else if (blown) hint = "Too bright — turn away from the lamp";
      else if (fast) hint = "Slow down — sweep gently around the limb";
      else if (tooFar) hint = "Come closer — fill more of the frame";
      else if (tooClose) hint = "Back off a little — show both edges";
      else if (weak) hint = "Show both edges of the arm in frame";
      else if (coverage() > 0.5 && coverage() < 1)
        hint = "Keep turning — show the other side of the limb";
      else hint = null;

      if (dark || blown || fast || weak || tooFar || tooClose)
        return feedback();

      const timed: TimedSample = { ...sample, at: now };
      samples.push(timed);
      // Keep the strongest reading per angle so one shaky frame cannot skew
      // the fit, and a long hold at one angle cannot outvote the sweep.
      const key = Math.round(sample.axisDeg / BUCKET_DEG);
      const score = sample.curveConf + sample.axisConf;
      const held = buckets.get(key);
      if (!held || held.curveConf + held.axisConf < score)
        buckets.set(key, timed);
      return feedback();
    },

    feedback,

    complete() {
      // Enough angles, enough readings, and at least a couple of seconds of
      // sweeping — a snap decision from one pose is not a surface scan.
      return (
        buckets.size >= TARGET_BUCKETS &&
        samples.length >= 12 &&
        Date.now() - startedAt > 2000
      );
    },


    finalize(pxPerCm) {
      // A short sweep is still worth keeping: the profile records how much it
      // measured through `quality`, and `anchorStrength` scales how hard a
      // partial scan is allowed to steer the live placement. Stopping early
      // therefore gives a gentle, correct nudge instead of nothing at all.
      if (samples.length < 3) return null;
      // Fit on the per-angle representatives when the sweep produced them,
      // so every side of the limb weighs the same regardless of how long the
      // phone lingered there.
      const fit = buckets.size >= 3 ? [...buckets.values()] : samples;


      const curve = weightedMedian(
        fit.map((s) => ({ v: s.curve, w: s.curveConf })),
      );
      const axisDeg = weightedMedian(
        fit.map((s) => ({ v: s.axisDeg, w: s.axisConf })),
      );
      const tilt = weightedMedian(
        fit.map((s) => ({ v: s.tilt, w: s.axisConf })),
      );
      if (curve == null || axisDeg == null || tilt == null) return null;

      // How much the curvature readings disagreed. A tight spread means the
      // limb really is that round; a wide one means the profile should be
      // trusted less and the live estimator left more freedom.
      const curveSpread = clamp(
        Math.sqrt(
          (mean(fit.map((s) => (s.curve - curve) ** 2)) ?? 0),
        ) * 2,
        0,
        1,
      );

      // The widest reading across the sweep is the one taken square-on to the
      // limb; narrower ones are the same limb seen at an angle.
      const widthSamples = samples.filter((s) => (s.limbWidthPx ?? 0) > 0);
      const widths = widthSamples
        .map((s) => s.limbWidthPx!)
        .sort((a, b) => b - a);
      const widthPx = widths.length
        ? mean(widths.slice(0, Math.max(1, Math.round(widths.length * 0.2))))
        : null;

      // Taper: a sweep that travelled along the limb sees it narrow. Compare
      // the square-on widths from the first and last third of the sweep,
      // which is what makes a forearm read as a cone instead of a pipe.
      let taper: number | undefined;
      if (widthSamples.length >= 8) {
        const byTime = [...widthSamples].sort((a, b) => a.at - b.at);
        const cut = Math.max(2, Math.round(byTime.length / 3));
        const head = mean(byTime.slice(0, cut).map((s) => s.limbWidthPx!));
        const tailArr = byTime.slice(-cut).map((s) => s.limbWidthPx!);
        const tail = mean(tailArr);
        if (head && tail && head > 0) {
          const t = clamp(tail / head, 0.6, 1.4);
          // Only record a taper worth rendering.
          if (Math.abs(t - 1) > 0.06) taper = Math.round(t * 100) / 100;
        }
      }

      // Light: average the direction as a vector weighted by how strong each
      // reading was, so a single dim frame cannot drag the highlight around.
      const lit = samples.filter((s) => s.light);
      let lx = 0;
      let ly = 0;
      let lw = 0;
      for (const s of lit) {
        const w = 0.2 + s.light!.strength;
        lx += s.light!.x * w;
        ly += s.light!.y * w;
        lw += w;
      }

      const tiltDirs = samples.reduce((s, x) => s + x.tiltDir, 0);
      const cov = coverage();
      const quality =
        Math.round(
          clamp(
            0.45 * cov +
              0.3 * clamp(samples.length / 24, 0, 1) +
              0.25 * (1 - curveSpread),
            0,
            1,
          ) * 100,
        ) / 100;

      return {
        curve: Math.round(clamp(curve, 0, 1) * 100) / 100,
        axisDeg: Math.round(axisDeg * 10) / 10,
        tilt: Math.round(clamp(tilt, 0, 1) * 100) / 100,
        tiltDir: tiltDirs >= 0 ? 1 : -1,
        widthCm:
          widthPx && pxPerCm > 0
            ? Math.round((widthPx / pxPerCm) * 10) / 10
            : null,
        light: {
          x: lw ? lx / lw : 0,
          y: lw ? ly / lw : -0.35,
          strength: mean(lit.map((s) => s.light!.strength)) ?? 0.35,
        },
        skinLuma: mean(
          samples.filter((s) => s.skinLuma != null).map((s) => s.skinLuma!),
        ),
        samples: samples.length,
        coverage: cov,
        scannedAt: new Date().toISOString(),
        taper,
        quality,
        curveSpread: Math.round(curveSpread * 100) / 100,
      };
    },

    reset() {
      samples = [];
      buckets.clear();
      hint = null;
      lastAxis = null;
      lastAt = 0;
      startedAt = 0;
    },

  };
}

/**
 * How hard the live reading is pulled back toward a scanned profile. With a
 * profile the live estimators still run, they just orbit the measured surface
 * instead of drifting freely.
 */
export function anchorToProfile(
  live: number,
  profileValue: number,
  strength = 0.72,
): number {
  return profileValue * strength + live * (1 - strength);
}

/**
 * How much a given profile deserves to be trusted over the live reading. A
 * thorough, self-consistent sweep pins the surface hard; a rushed one only
 * nudges it, so a mediocre scan can never make the placement worse.
 */
export function anchorStrength(
  profile: SurfaceProfile | null,
  base = 0.72,
): number {
  if (!profile) return 0;
  const q = profile.quality ?? Math.max(0.4, profile.coverage);
  return base * (0.55 + 0.45 * clamp(q, 0, 1));
}

/**
 * Perspective distance, in px, for the CSS surface pose. A limb that measured
 * as strongly tapered converges faster, so it gets a nearer vanishing point;
 * a straight tube keeps the flat default.
 */
export function perspectivePx(profile: SurfaceProfile | null): number {
  const taper = profile?.taper;
  if (!taper) return 680;
  const amount = clamp(Math.abs(1 - taper) / 0.35, 0, 1);
  return Math.round(680 - 260 * amount);
}


/** "3 minutes ago" style label for the profile chip. */
export function formatScannedAt(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}
