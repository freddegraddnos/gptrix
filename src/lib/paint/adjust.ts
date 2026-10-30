/**
 * Layer adjustments: brightness/contrast, saturation, hue and gaussian blur.
 *
 * These are all expressible as canvas filters, which run on the GPU-backed 2D
 * pipeline instead of a JavaScript pixel loop — that is what keeps a live
 * preview smooth on a 300 dpi A3 document. The engine drives them: it keeps the
 * untouched layer pixels aside, re-renders the filtered result on every slider
 * move, and only records history when the artist confirms.
 */

export interface AdjustSettings {
  /** -100..100, percent away from the original. */
  brightness: number;
  /** -100..100. */
  contrast: number;
  /** -100..100. */
  saturation: number;
  /** -180..180 degrees. */
  hue: number;
  /** 0..50 document pixels of gaussian blur. */
  blur: number;
}

export const NO_ADJUST: AdjustSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  blur: 0,
};

export function isNeutral(a: AdjustSettings): boolean {
  return (
    a.brightness === 0 && a.contrast === 0 && a.saturation === 0 && a.hue === 0 && a.blur === 0
  );
}

/** CSS filter string for the settings, in the order Procreate applies them. */
export function filterString(a: AdjustSettings): string {
  const parts: string[] = [];
  if (a.brightness !== 0) parts.push(`brightness(${(100 + a.brightness) / 100})`);
  if (a.contrast !== 0) parts.push(`contrast(${(100 + a.contrast) / 100})`);
  if (a.saturation !== 0) parts.push(`saturate(${(100 + a.saturation) / 100})`);
  if (a.hue !== 0) parts.push(`hue-rotate(${a.hue}deg)`);
  if (a.blur > 0) parts.push(`blur(${a.blur}px)`);
  return parts.length ? parts.join(" ") : "none";
}

/**
 * Draws `source` into `ctx` with the adjustment applied, optionally clipped to
 * a selection path so an adjustment can be limited to part of the layer.
 */
export function drawAdjusted(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  settings: AdjustSettings,
  width: number,
  height: number,
  clip: Path2D | null,
) {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, width, height);
  // Unclipped area keeps the original pixels; only the selection is adjusted.
  if (clip) {
    ctx.drawImage(source, 0, 0);
    ctx.save();
    ctx.clip(clip);
    ctx.clearRect(0, 0, width, height);
    ctx.filter = filterString(settings);
    ctx.drawImage(source, 0, 0);
    ctx.restore();
  } else {
    ctx.filter = filterString(settings);
    ctx.drawImage(source, 0, 0);
  }
  ctx.filter = "none";
  ctx.restore();
}
