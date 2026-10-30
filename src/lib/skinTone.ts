/**
 * Sample average RGB from the video frame.
 *
 * `at` is the normalised (0..1) point in the frame to read from — pass the
 * spot the design is sitting on so the swatch comes from the user's actual
 * skin instead of a random corner. Defaults to the centre.
 */
export function sampleVideoSkinTone(
  video: HTMLVideoElement,
  at?: { x: number; y: number; size?: number },
): {
  r: number;
  g: number;
  b: number;
  hex: string;
  luminance: number;
} | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  const size = Math.max(24, Math.min(140, Math.round(at?.size ?? 60)));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fx = Math.min(1, Math.max(0, at?.x ?? 0.5));
  const fy = Math.min(1, Math.max(0, at?.y ?? 0.5));
  const sx = Math.min(
    video.videoWidth - size,
    Math.max(0, video.videoWidth * fx - size / 2),
  );
  const sy = Math.min(
    video.videoHeight - size,
    Math.max(0, video.videoHeight * fy - size / 2),
  );
  ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    n++;
  }
  r = Math.round(r / n);
  g = Math.round(g / n);
  b = Math.round(b / n);
  const hex =
    "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { r, g, b, hex, luminance };
}

/**
 * Broad skin-colour guard for the lock target. It intentionally spans light
 * through dark skin; its job is only to reject neutral walls, cupboards and
 * screens so the tracker cannot arm on the background before a limb arrives.
 */
export function isLikelySkinTone(sample: {
  r: number;
  g: number;
  b: number;
}): boolean {
  const { r, g, b } = sample;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const rgbSkin =
    r > 35 &&
    g > 20 &&
    b > 12 &&
    chroma > 10 &&
    r >= g * 0.88 &&
    r > b * 1.04;
  const chromaSkin = cb >= 72 && cb <= 132 && cr >= 128 && cr <= 178;
  return rgbSkin && chromaSkin;
}

/**
 * Produce CSS filter + opacity values so the tattoo blends realistically
 * with the sampled skin luminance. Darker skin → less contrast, softer ink;
 * lighter skin → more contrast, crisper ink.
 */
export function skinToneStyle(luminance: number | null): {
  filter: string;
  opacity: number;
} {
  if (luminance == null) {
    return { filter: "blur(0.35px)", opacity: 0.9 };
  }
  // 0..255. Normalize to 0..1.
  const l = Math.max(0, Math.min(1, luminance / 255));
  // Ink absorbs more on light skin, less on dark skin.
  const opacity = 0.55 + l * 0.35; // 0.55–0.9
  const brightness = 0.6 + l * 0.4; // 0.6–1.0
  const contrast = 1.35 - l * 0.35; // 1.0–1.35
  const saturate = 0.85;
  return {
    // The sub-pixel blur is what stops the ink from reading as a cut-out
    // sticker: real ink sits under the skin's top layer and never has a
    // razor-sharp edge against it.
    filter: `brightness(${brightness.toFixed(2)}) contrast(${contrast.toFixed(2)}) saturate(${saturate}) blur(0.35px)`,
    opacity: Number(opacity.toFixed(2)),
  };
}

/**
 * Multi-layer ink render.
 *
 * A single multiplied bitmap always reads as a decal. Real ink is three
 * things at once: a dense core, a soft dermal bleed a fraction of a
 * millimetre wide, and skin that still catches light *on top* of the
 * pigment. These values drive those three layers.
 */
export function inkRenderStyle(
  luminance: number | null,
  light: { x: number; y: number; strength: number } | null,
): {
  base: { filter: string; opacity: number };
  bleed: { filter: string; opacity: number };
  /** CSS gradient painted over the ink as the skin's own sheen. */
  sheen: string;
  sheenOpacity: number;
  /** Skin grain re-asserted over the pigment. */
  grain: string;
  grainOpacity: number;
  /**
   * Pigment colour gradient. Healed ink is never flat black — it drifts
   * blue-grey where it is dense and warm brown where the skin tone shows
   * through, and it fades on the shadowed side of the limb.
   */
  pigment: string;
  pigmentOpacity: number;
  /** Colour stops the canvas capture uses for the same pigment gradient. */
  pigmentStops: Array<{ at: number; color: string }>;
  /** Angle (deg) of the pigment gradient, following the light direction. */
  pigmentAngle: number;
  /** Healed fade: the light side of the design loses a little density. */
  fade: string;
  fadeOpacity: number;
} {
  const base = skinToneStyle(luminance);
  const l = luminance == null ? 0.5 : Math.max(0, Math.min(1, luminance / 255));
  // Ink sitting in the dermis loses its hardest edge and cools slightly.
  const bleed = {
    filter: `blur(2.4px) brightness(${(0.75 + l * 0.3).toFixed(2)}) saturate(0.6)`,
    opacity: Number((0.16 + (1 - l) * 0.12).toFixed(2)),
  };
  const lx = light?.x ?? 0;
  const ly = light?.y ?? -0.35;
  const strength = light?.strength ?? 0.35;
  // Highlight sits on the lit side; the far side keeps a faint shadow.
  const hx = Math.round(50 - lx * 30);
  const hy = Math.round(50 + ly * 30);
  // Pigment colour: cool blue-black where the ink packs densest, warm
  // sepia where it thins out into the skin. Darker skin pushes the whole
  // range warmer and greyer, exactly like healed ink reads in person.
  const cool = `rgba(${Math.round(24 + l * 10)}, ${Math.round(34 + l * 14)}, ${Math.round(66 + l * 26)}, 1)`;
  const mid = `rgba(${Math.round(48 + l * 18)}, ${Math.round(44 + l * 16)}, ${Math.round(52 + l * 18)}, 1)`;
  const warm = `rgba(${Math.round(86 + (1 - l) * 24)}, ${Math.round(62 + (1 - l) * 16)}, ${Math.round(50 + (1 - l) * 12)}, 1)`;
  const pigmentStops = [
    { at: 0, color: cool },
    { at: 0.55, color: mid },
    { at: 1, color: warm },
  ];
  // Gradient runs away from the light, so the shaded side keeps the cold,
  // dense pigment and the lit side warms up.
  const pigmentAngle = Math.round(
    ((Math.atan2(ly, lx) * 180) / Math.PI + 450) % 360,
  );
  return {
    base,
    bleed,
    sheen: `radial-gradient(120% 120% at ${hx}% ${hy}%, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.25) 35%, rgba(0,0,0,0.28) 100%)`,
    sheenOpacity: Number((0.1 + strength * 0.22 + l * 0.06).toFixed(2)),
    grain:
      "repeating-radial-gradient(circle at 30% 40%, rgba(255,255,255,0.5) 0px, rgba(255,255,255,0) 1.1px, rgba(0,0,0,0.35) 1.7px, rgba(0,0,0,0) 2.6px)",
    grainOpacity: 0.14,
    pigment: `linear-gradient(${pigmentAngle}deg, ${cool} 0%, ${mid} 55%, ${warm} 100%)`,
    // Enough colour to kill the flat-black look, never enough to read as a
    // coloured sticker.
    pigmentOpacity: Number((0.5 + (1 - l) * 0.16).toFixed(2)),
    pigmentStops,
    pigmentAngle,
    fade: `linear-gradient(${(pigmentAngle + 180) % 360}deg, rgba(255,255,255,${(0.16 + strength * 0.16).toFixed(2)}) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0) 100%)`,
    fadeOpacity: Number((0.35 + strength * 0.2).toFixed(2)),
  };
}

/**
 * Bakes the pigment colour gradient and the healed fade into an offscreen
 * copy of the motif, so a captured photo or recording carries the same ink
 * colour as the live AR view instead of flat black lines.
 */
export function tintMotifCanvas(
  src: CanvasImageSource,
  w: number,
  h: number,
  layers: ReturnType<typeof inkRenderStyle>,
): HTMLCanvasElement | null {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0, width, height);

  const rad = ((layers.pigmentAngle - 90) * Math.PI) / 180;
  const dx = (Math.cos(rad) * width) / 2;
  const dy = (Math.sin(rad) * height) / 2;
  const grad = ctx.createLinearGradient(
    width / 2 - dx,
    height / 2 - dy,
    width / 2 + dx,
    height / 2 + dy,
  );
  for (const stop of layers.pigmentStops) grad.addColorStop(stop.at, stop.color);

  ctx.save();
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = layers.pigmentOpacity;
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const fade = ctx.createLinearGradient(
    width / 2 + dx,
    height / 2 + dy,
    width / 2 - dx,
    height / 2 - dy,
  );
  fade.addColorStop(0, "rgba(255,255,255,0.22)");
  fade.addColorStop(0.5, "rgba(255,255,255,0.05)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.globalAlpha = layers.fadeOpacity;
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // Restore the motif's own alpha so only the ink is tinted.
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(src, 0, 0, width, height);
  ctx.globalCompositeOperation = "source-over";
  return canvas;
}
