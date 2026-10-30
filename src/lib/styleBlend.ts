/**
 * How densely each tattoo style sits in the skin.
 *
 * Real ink is not equally opaque: a solid blackwork fill blocks nearly all of
 * the skin underneath, while fine line, dotwork and watercolour work is thin
 * enough that the skin's own luminance reads straight through it.
 *
 * - `skinStrength` weights the multiply / soft-light shading blend
 *   (0 = flat sticker, 1 = the skin's shading dominates)
 * - `opacityScale` nudges the layer's overall opacity, capped and modest
 */
export type StyleBlend = {
  skinStrength: number;
  opacityScale: number;
};

const DEFAULT_BLEND: StyleBlend = { skinStrength: 0.85, opacityScale: 1 };

/** Keys are lowercased style names, so both style vocabularies match. */
const BLEND_BY_STYLE: Record<string, StyleBlend> = {
  blackwork: { skinStrength: 0.55, opacityScale: 1.06 },
  tribal: { skinStrength: 0.58, opacityScale: 1.05 },
  traditional: { skinStrength: 0.68, opacityScale: 1.02 },
  "neo-traditional": { skinStrength: 0.72, opacityScale: 1.0 },
  japanese: { skinStrength: 0.7, opacityScale: 1.02 },
  lettering: { skinStrength: 0.65, opacityScale: 1.03 },
  realism: { skinStrength: 0.85, opacityScale: 0.98 },
  geometric: { skinStrength: 0.8, opacityScale: 1.0 },
  minimal: { skinStrength: 0.92, opacityScale: 0.95 },
  minimalist: { skinStrength: 0.92, opacityScale: 0.95 },
  botanical: { skinStrength: 0.9, opacityScale: 0.95 },
  dotwork: { skinStrength: 0.95, opacityScale: 0.92 },
  fineline: { skinStrength: 1.0, opacityScale: 0.9 },
  "fine line": { skinStrength: 1.0, opacityScale: 0.9 },
  watercolor: { skinStrength: 1.0, opacityScale: 0.88 },
  watercolour: { skinStrength: 1.0, opacityScale: 0.88 },
};

/** Blend settings for a style tag; unknown or untagged designs get the default. */
export function styleBlend(style?: string | null): StyleBlend {
  if (!style) return DEFAULT_BLEND;
  return BLEND_BY_STYLE[style.trim().toLowerCase()] ?? DEFAULT_BLEND;
}
