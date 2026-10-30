/**
 * Skin realism for Live Try-On.
 *
 * - Samples the average skin color/brightness around the tattoo placement
 * - Estimates body hair via edge/texture density (approximation)
 * - Computes blend mode, tint and opacity so the motif looks natural
 *   on different skin tones
 * - "Age" filter: simplified fading/contrast reduction over time
 *
 * All of this is a preview, not an exact image of the final result.
 */

export type SkinSample = {
  r: number;
  g: number;
  b: number;
  hex: string;
  /** 0–1, perceived brightness. */
  luminance: number;
  /** 0–1, estimated hairiness based on edge density. */
  hairiness: number;
};

export type RealismStyle = {
  /** Tint color multiplied onto the motif (hex string). */
  tint: string;
  /** Global opacitet 0–1. */
  opacity: number;
  /** true = multiply-blend (dark ink in the skin), false = normal. */
  multiply: boolean;
  /**
   * Ink contrast multiplier (0.82–1). Black ink reads with less stark
   * contrast on darker skin than on very light skin; this is a modest,
   * capped adjustment to the render only — the artwork is untouched.
   */
  contrast: number;
};

export const REALISM_DISCLAIMER =
  "Preview: skin tone, hair, and aging are simulated approximately – not a guaranteed image of the final result.";

/** Max years the age slider supports. */
export const MAX_AGE_YEARS = 15;

const SAMPLE = 40;
let scratch: HTMLCanvasElement | null = null;

function scratchCtx() {
  if (!scratch) {
    scratch = document.createElement("canvas");
    scratch.width = SAMPLE;
    scratch.height = SAMPLE;
  }
  return scratch.getContext("2d", { willReadFrequently: true });
}

/**
 * Samples the skin in a box around (x, y) in normalized coordinates (0–1)
 * on the already-drawn video canvas.
 */
export function sampleSkin(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  spanNorm: number,
): SkinSample | null {
  const ctx = scratchCtx();
  if (!ctx || !source.width || !source.height) return null;

  const boxW = Math.max(24, Math.min(source.width, spanNorm * source.width));
  const boxH = boxW;
  const sx = Math.max(0, Math.min(source.width - boxW, x * source.width - boxW / 2));
  const sy = Math.max(0, Math.min(source.height - boxH, y * source.height - boxH / 2));

  try {
    ctx.clearRect(0, 0, SAMPLE, SAMPLE);
    ctx.drawImage(source, sx, sy, boxW, boxH, 0, 0, SAMPLE, SAMPLE);
  } catch {
    return null;
  }

  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
  } catch {
    return null;
  }

  // Median-like average: skip extremely dark/light pixels
  // (shadows, glare) so the skin tone isn't skewed.
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  const gray = new Float32Array(SAMPLE * SAMPLE);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    gray[p] = lum;
    if (lum < 18 || lum > 245) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  if (!n) return null;
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);

  // Edge density (Sobel-light) → approximation of body hair/texture.
  let edges = 0;
  let count = 0;
  for (let yy = 1; yy < SAMPLE - 1; yy++) {
    for (let xx = 1; xx < SAMPLE - 1; xx++) {
      const i = yy * SAMPLE + xx;
      const gx = gray[i + 1] - gray[i - 1];
      const gy = gray[i + SAMPLE] - gray[i - SAMPLE];
      const mag = Math.abs(gx) + Math.abs(gy);
      if (mag > 22) edges++;
      count++;
    }
  }
  const hairiness = Math.max(0, Math.min(1, (edges / Math.max(1, count)) * 3.2));

  const hex =
    "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

  return {
    r,
    g,
    b,
    hex,
    luminance: (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
    hairiness,
  };
}

/**
 * Samples clean skin in a ring just outside the motif's own area, so the ink
 * itself never pollutes the tone estimate. Falls back to the plain box sample.
 */
export function sampleSkinNearPlacement(
  source: HTMLCanvasElement,
  x: number,
  y: number,
  spanNorm: number,
): SkinSample | null {
  const off = Math.max(0.05, spanNorm * 0.75);
  const patch = Math.max(0.03, spanNorm * 0.35);
  const spots: Array<[number, number]> = [
    [x - off, y],
    [x + off, y],
    [x, y - off],
    [x, y + off],
  ];
  const found: SkinSample[] = [];
  for (const [px, py] of spots) {
    if (px < 0.02 || px > 0.98 || py < 0.02 || py > 0.98) continue;
    const s = sampleSkin(source, px, py, patch);
    if (s) found.push(s);
  }
  if (!found.length) return sampleSkin(source, x, y, spanNorm);

  // Drop the outlier patch (a sleeve, the background, a shadow) by keeping
  // the samples closest to the median luminance.
  const lums = found.map((f) => f.luminance).sort((a, b) => a - b);
  const median = lums[Math.floor(lums.length / 2)];
  const keep = found.filter((f) => Math.abs(f.luminance - median) < 0.18);
  const use = keep.length ? keep : found;
  const avg = (pick: (s: SkinSample) => number) =>
    use.reduce((t, s) => t + pick(s), 0) / use.length;
  const r = Math.round(avg((s) => s.r));
  const g = Math.round(avg((s) => s.g));
  const b = Math.round(avg((s) => s.b));
  return {
    r,
    g,
    b,
    hex: toHex(r, g, b),
    luminance: avg((s) => s.luminance),
    hairiness: avg((s) => s.hairiness),
  };
}

/**
 * Subtle scene-light grade from the sampled skin's colour cast: warmer under
 * tungsten, cooler in shade. Clamped to a narrow range so the tattoo looks lit
 * by the same light without visibly recolouring the artwork.
 */
export function sceneColorGrade(
  skin: SkinSample | null,
): { r: number; g: number; b: number } {
  if (!skin) return { r: 1, g: 1, b: 1 };
  const mean = (skin.r + skin.g + skin.b) / 3 || 1;
  // Ratios of neutrally lit skin — deviations from these are the light's cast.
  const NEUTRAL = [1.14, 0.96, 0.9];
  const clampGrade = (v: number) => Math.max(0.95, Math.min(1.05, v));
  const ch = [skin.r, skin.g, skin.b].map((c, i) =>
    clampGrade(1 + ((c / mean / NEUTRAL[i]) - 1) * 0.35),
  );
  return { r: ch[0], g: ch[1], b: ch[2] };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function toHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Computes tint/opacity/blend based on skin tone, hairiness, and age.
 *
 * @param ageYears 0 = freshly done, MAX_AGE_YEARS = several years old
 */
export function realismStyle(
  skin: SkinSample | null,
  ageYears = 0,
  opts: { hairResponse?: boolean; toneMatch?: boolean } = {},
): RealismStyle {
  const hairResponse = opts.hairResponse ?? true;
  const toneMatch = opts.toneMatch ?? true;

  const l = skin ? clamp01(skin.luminance) : 0.62;
  const age = clamp01(ageYears / MAX_AGE_YEARS);

  // Ink shows strongest against light skin, weaker against dark skin.
  let opacity = 0.5 + l * 0.42; // 0.5–0.92
  // Multiply works well until the skin gets really dark – then the motif
  // becomes invisible, so we switch to normal blend with lower opacity.
  const multiply = l > 0.3;
  if (!multiply) opacity = Math.min(opacity + 0.08, 0.72);

  // Light tone matching: pull the tint toward the skin's hue so the motif
  // doesn't look like a cold sticker on warm skin.
  let tintR = 255;
  let tintG = 255;
  let tintB = 255;
  if (toneMatch && skin) {
    const avg = (skin.r + skin.g + skin.b) / 3 || 1;
    const k = 0.18;
    tintR = 255 * (1 - k) + 255 * (skin.r / avg) * k;
    tintG = 255 * (1 - k) + 255 * (skin.g / avg) * k;
    tintB = 255 * (1 - k) + 255 * (skin.b / avg) * k;
  }

  // Hair: slightly lower opacity where the texture is edge-rich.
  if (hairResponse && skin) {
    opacity *= 1 - skin.hairiness * 0.22;
  }

  // Aging: the ink fades, loses contrast, and shifts toward blue-green.
  if (age > 0) {
    opacity *= 1 - age * 0.3;
    tintR *= 1 - age * 0.1;
    tintG *= 1 - age * 0.02;
    tintB *= 1 + age * 0.05;
    if (skin) {
      // A faded tattoo approaches the skin tone.
      const m = age * 0.18;
      tintR = tintR * (1 - m) + skin.r * m;
      tintG = tintG * (1 - m) + skin.g * m;
      tintB = tintB * (1 - m) + skin.b * m;
    }
  }

  // Darker skin: black ink sits closer to the surrounding tone, so both the
  // layer's opacity and its contrast come down a little. Modest and capped.
  const darkness = clamp01((0.62 - l) / 0.5); // 0 on light skin, 1 on very dark
  opacity *= 1 - darkness * 0.12;
  const contrast = 1 - darkness * 0.18;

  return {
    tint: toHex(tintR, tintG, tintB),
    opacity: Number(clamp01(opacity).toFixed(3)),
    multiply,
    contrast: Number(Math.max(0.82, Math.min(1, contrast)).toFixed(3)),
  };
}

/** Label for the age slider. */
export function ageLabel(years: number): string {
  if (years <= 0) return "Freshly done";
  if (years < 1) return "A few months";
  if (years < 2) return "~1 year";
  return `~${Math.round(years)} years`;
}
