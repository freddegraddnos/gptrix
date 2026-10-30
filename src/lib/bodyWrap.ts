/**
 * Cylindrical body wrap.
 *
 * A limb (arm, leg, neck) is a cylinder, not a flat wall, so a decal painted on
 * it compresses toward the silhouette edges, bows slightly along the surface,
 * disappears where the skin turns away from the camera and loses light on the
 * side that faces away from the lamp.
 *
 * Rendering is split into cached stages so the expensive parts never run twice:
 *  1. decode        — the source bitmap is cached per URL
 *  2. geometry      — the per-column warp is cached per (src, curve, size)
 *  3. occlusion     — the alpha falloff mask is cached per (curve, occlusion)
 *  4. shading       — cheap gradient fills, the only stage that reruns when the
 *                     room light changes
 * Output is encoded to an object URL with `toBlob`, which is markedly faster
 * than a base64 `toDataURL` on mobile.
 */

/**
 * The measured shape of the limb *along* its axis, from the surface scan and
 * the live pose. The cylindrical warp alone treats every body part as a
 * straight tube of constant thickness; these three numbers make the decal
 * follow a real forearm: thinner toward the wrist, foreshortened when the limb
 * leans away from the camera, and bowed when the joint is bent.
 */
export type LimbShape = {
  /** 1 = a straight tube, 0.8 = the far end reads 20 % thinner. */
  taper?: number;
  /** 0..1 foreshortening along the axis. */
  tilt?: number;
  /** Which end is nearer the camera: 1 = the top of the design. */
  tiltDir?: -1 | 1;
  /** Joint angle in degrees, 180 = straight. Below ~165 the design bows. */
  bendDeg?: number | null;
};

export type WrapOptions = LimbShape & {
  /** 0 = flat, 1 = strongly curved (roughly a 150 deg wrap). */
  curve: number;
  /** Extra vertical bow, defaults to curve. */
  bow?: number;
  /** Shading strength, 0 disables the light falloff. */
  shade?: number;
  /**
   * Dominant light direction, -1..1 on each axis (x: left→right,
   * y: above→below). Defaults to soft light from slightly above.
   */
  light?: { x: number; y: number; strength?: number };
  /**
   * How hard the decal disappears where the limb turns away from the camera.
   * 0 = no occlusion, 1 = full silhouette cut-off. Defaults to 0.85.
   */
  occlusion?: number;
  /** Longest working edge in px. Defaults to a device-appropriate size. */
  maxSize?: number;
  /**
   * How much of the design still fits inside the scanned limb's silhouette,
   * 0..1. A 20 cm design on a 10 cm forearm reads 0.5: the rest of it has
   * wrapped around the far side of the limb, so it must never be painted
   * outside the body part. 1 (the default) leaves the design untouched.
   */
  visibleFraction?: number;
};

const MAX_ANGLE = (75 * Math.PI) / 180;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Mobile GPUs choke on 1024px decals; 512 is indistinguishable on screen. */
export function defaultWorkSize(): number {
  if (typeof window === "undefined") return 768;
  const small = window.innerWidth < 820;
  const weak = (navigator as { deviceMemory?: number }).deviceMemory
    ? ((navigator as { deviceMemory?: number }).deviceMemory as number) <= 4
    : false;
  return small || weak ? 512 : 768;
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

// --- Stage 1: decoded source images -----------------------------------------

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();

function decodeUrl(
  src: string,
  useCors: boolean,
): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    if (useCors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/**
 * Decodes a motif so it can be warped on a canvas.
 *
 * Library motifs are same-origin, but gallery, uploaded, drawn, text and
 * AI-generated motifs come from storage URLs. If such a host answers without
 * CORS headers the `crossOrigin` decode fails and the motif would silently
 * stay flat, so fall back to fetching the bytes and decoding a local blob —
 * that keeps the canvas untainted and every motif wrappable.
 */
function loadImage(src: string): Promise<HTMLImageElement | null> {
  const hit = imageCache.get(src);
  if (hit) return hit;
  const p = (async (): Promise<HTMLImageElement | null> => {
    const direct = await decodeUrl(src, true);
    if (direct) return direct;
    if (/^(data:|blob:)/.test(src)) return decodeUrl(src, false);
    try {
      const res = await fetch(src, { mode: "cors", credentials: "omit" });
      if (!res.ok) return null;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const img = await decodeUrl(url, false);
      // Keep the blob alive for the lifetime of the decoded bitmap.
      if (!img) URL.revokeObjectURL(url);
      return img;
    } catch {
      return null;
    }
  })();
  imageCache.set(src, p);
  if (imageCache.size > 24) imageCache.delete(imageCache.keys().next().value!);
  return p;
}

// --- Stage 2: geometry ------------------------------------------------------

const geoCache = new Map<string, HTMLCanvasElement>();

/** Warps an already-loaded image onto a virtual cylinder (geometry only). */
export function warpGeometry(
  img: HTMLImageElement | HTMLCanvasElement,
  curve: number,
  bow: number | undefined,
  maxSize: number,
  visibleFraction = 1,
): HTMLCanvasElement {
  const sw = "naturalWidth" in img ? img.naturalWidth || img.width : img.width;
  const sh =
    "naturalHeight" in img ? img.naturalHeight || img.height : img.height;
  const fit = Math.min(1, maxSize / Math.max(1, Math.max(sw, sh)));
  const w = Math.max(1, Math.round(sw * fit));
  const h = Math.max(1, Math.round(sh * fit));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Never wider than the scanned body part: the surplus has curved around the
  // far side of the limb and simply is not visible from here.
  const vf = Math.max(0.2, Math.min(1, visibleFraction));

  const k = clamp01(curve);
  if (k <= 0.001) {
    const flatW = Math.max(1, Math.round(w * vf));
    ctx.drawImage(img, Math.round((w - flatW) / 2), 0, flatW, h);
    return canvas;
  }

  const theta = MAX_ANGLE * k;
  const sinT = Math.sin(theta);
  const bowPx = (bow ?? k) * h * 0.07;
  // A decal measured along a cylinder projects to a narrower width on camera.
  // Keeping the old full-width destination made the mathematical warp look
  // almost identical to a flat image, especially on forearms.
  const projectedRatio = Math.max(0.68, sinT / theta) * vf;
  const projectedW = Math.max(1, Math.round(w * projectedRatio));
  const projectedLeft = Math.round((w - projectedW) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Sample the source column that belongs on each destination column.
  const step = 1;
  for (let dx = 0; dx < projectedW; dx += step) {
    const u = ((dx + step / 2) / projectedW) * 2 - 1; // -1 .. 1 across the silhouette
    const a = Math.asin(Math.max(-1, Math.min(1, u * sinT))); // surface angle
    const sx = ((a / theta + 1) / 2) * sw;
    const u2 = ((dx + step) / projectedW) * 2 - 1;
    const a2 = Math.asin(Math.max(-1, Math.min(1, u2 * sinT)));
    const sxNext = ((a2 / theta + 1) / 2) * sw;
    const sliceW = Math.max(0.5, sxNext - sx);

    // The centre of the limb is closer to the camera: bow the slice and scale
    // it up a touch so the decal appears to sit on a rounded surface.
    const depth = Math.cos(a);
    const dy = -bowPx * (depth - Math.cos(theta));
    const dh = h * (1 + (depth - 1) * 0.12 * k);

    ctx.drawImage(
      img,
      Math.max(0, Math.min(sw - 0.5, sx)),
      0,
      Math.min(sliceW, sw),
      sh,
      projectedLeft + dx,
      dy + (h - dh) / 2,
      step + 0.6,
      dh,
    );
  }
  return canvas;
}

// --- Stage 2b: shape along the limb axis ------------------------------------

/** True when the measured shape differs enough from a straight tube to matter. */
export function hasLimbShape(shape: LimbShape): boolean {
  const taper = shape.taper ?? 1;
  const tilt = shape.tilt ?? 0;
  const bend = shape.bendDeg ?? 180;
  return Math.abs(1 - taper) > 0.03 || tilt > 0.06 || bend < 168;
}

/**
 * Converts a measured limb width into the wrap curvature a design of a given
 * width actually needs: a 12 cm design on a 9 cm wrist bends far harder around
 * the silhouette than the same design on a thigh.
 */
export function curveForCoverage(
  designWidthCm: number,
  limbWidthCm: number,
): number | null {
  if (!(designWidthCm > 0) || !(limbWidthCm > 0)) return null;
  // The visible face of a cylinder is its diameter; the surface arc across it
  // is longer. Coverage above 1 means the design already reaches the edges.
  const coverage = Math.max(0.05, Math.min(0.995, designWidthCm / limbWidthCm));
  return clamp01(Math.asin(coverage) / MAX_ANGLE);
}

/**
 * Reshapes an already-wrapped bitmap along the limb's long axis: taper, tilt
 * (foreshortening) and joint bend. Row-based, so it composes cleanly with the
 * column-based cylinder warp.
 */
export function shapeAlongLimb(
  geo: HTMLCanvasElement,
  shape: LimbShape,
): HTMLCanvasElement {
  if (!hasLimbShape(shape)) return geo;
  const w = geo.width;
  const h = geo.height;
  const out = makeCanvas(w, h);
  const ctx = out.getContext("2d");
  if (!ctx) return geo;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const taper = Math.max(0.35, Math.min(1.6, shape.taper ?? 1));
  const tilt = clamp01(shape.tilt ?? 0);
  const dir = shape.tiltDir === -1 ? -1 : 1;
  const bend = Math.max(60, Math.min(180, shape.bendDeg ?? 180));
  // A bent joint pushes the middle of the design sideways along the outer side.
  const bendAmp = ((180 - bend) / 120) * w * 0.16;

  for (let y = 0; y < h; y++) {
    // t runs along the limb, 0 = the end nearest the camera.
    const t = dir === 1 ? (y + 0.5) / h : 1 - (y + 0.5) / h;

    // Perspective: the far end of a leaning limb is compressed on screen, so
    // more of the source has to fit into the same destination row.
    const k = tilt * 0.65;
    const srcT = k > 0.001 ? (t * (1 + k)) / (1 + k * t) : t;
    const sy = Math.max(0, Math.min(h - 1, (dir === 1 ? srcT : 1 - srcT) * h));

    // Taper: the far end is narrower, so its rows are squeezed horizontally.
    // A leaning limb also shrinks with distance, on top of the taper.
    const scale = (1 + (taper - 1) * t) * (1 - tilt * 0.22 * t);
    const rowW = Math.max(1, w * scale);
    const offset = bendAmp * Math.sin(Math.PI * t);


    ctx.drawImage(
      geo,
      0,
      sy,
      w,
      1,
      (w - rowW) / 2 + offset,
      y,
      rowW,
      1.02,
    );
  }
  return out;
}

// --- Stage 3: occlusion mask ------------------------------------------------

const maskCache = new Map<string, HTMLCanvasElement>();

/**
 * A 1px-tall alpha strip: opaque where the surface has rotated away from the
 * camera. Stretched vertically at draw time, so the per-pixel loop runs once
 * per curvature setting instead of once per frame.
 */
function occlusionMask(
  width: number,
  curve: number,
  occ: number,
): HTMLCanvasElement | null {
  const key = `${width}|${curve.toFixed(2)}|${occ.toFixed(2)}`;
  const hit = maskCache.get(key);
  if (hit) return hit;

  const c = makeCanvas(width, 1);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  const theta = MAX_ANGLE * curve;
  const sinT = Math.sin(theta);
  const cosT = Math.cos(theta);
  const line = ctx.createImageData(width, 1);
  for (let x = 0; x < width; x++) {
    const u = ((x + 0.5) / width) * 2 - 1;
    const a = Math.asin(Math.max(-1, Math.min(1, u * sinT)));
    // Visibility ~ cos(angle) normalised over the visible arc.
    const grazing = clamp01((Math.cos(a) - cosT) / (1 - cosT || 1));
    // Smoothstep keeps the fade soft rather than a hard cut.
    const vis = grazing * grazing * (3 - 2 * grazing);
    line.data[x * 4 + 3] = Math.round(clamp01(occ * curve * (1 - vis)) * 255);
  }
  ctx.putImageData(line, 0, 0);
  maskCache.set(key, c);
  if (maskCache.size > 32) maskCache.delete(maskCache.keys().next().value!);
  return c;
}

// --- Stage 4: composite -----------------------------------------------------

/** Applies occlusion + directional shading to a warped geometry canvas. */
export function shadeWrapped(
  geo: HTMLCanvasElement,
  {
    curve,
    shade = 0.55,
    light,
    occlusion = 0.85,
    visibleFraction = 1,
  }: WrapOptions,
  out?: HTMLCanvasElement,
): HTMLCanvasElement {
  const w = geo.width;
  const h = geo.height;
  const canvas = out ?? makeCanvas(w, h);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(geo, 0, 0);

  const k = clamp01(curve);
  const occ = clamp01(occlusion);
  if (occ > 0.01 && k > 0.02) {
    const mask = occlusionMask(w, k, occ);
    if (mask) {
      // The silhouette fade has to sit on the band the warp actually painted,
      // otherwise a design clamped to the limb keeps hard outer edges.
      const vf = Math.max(0.2, Math.min(1, visibleFraction));
      const theta = MAX_ANGLE * k;
      const band = Math.max(
        1,
        Math.round(w * Math.max(0.68, Math.sin(theta) / theta) * vf),
      );
      const left = Math.round((w - band) / 2);
      ctx.globalCompositeOperation = "destination-out";
      ctx.drawImage(mask, 0, 0, w, 1, left, 0, band, h);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  if (shade > 0 && k > 0.001) {
    const lx = Math.max(-1, Math.min(1, light?.x ?? 0));
    const ly = Math.max(-1, Math.min(1, light?.y ?? -0.35));
    const power = clamp01(light?.strength ?? 0.45);
    const s = shade * k * (0.55 + power * 0.9);
    const dark = (v: number) => `rgba(0,0,0,${clamp01(v).toFixed(3)})`;

    ctx.globalCompositeOperation = "source-atop";

    // Horizontal term follows the cylinder; the lit side is pushed toward lx.
    const g = ctx.createLinearGradient(0, 0, w, 0);
    const leftShade = 0.42 * s * (1 + lx * 0.85);
    const rightShade = 0.42 * s * (1 - lx * 0.85);
    const litStop = clamp01(0.5 + lx * 0.28);
    g.addColorStop(0, dark(leftShade));
    g.addColorStop(clamp01(litStop - 0.28), dark(leftShade * 0.32));
    g.addColorStop(litStop, "rgba(255,255,255,0)");
    g.addColorStop(clamp01(litStop + 0.28), dark(rightShade * 0.32));
    g.addColorStop(1, dark(rightShade));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Vertical term: light from above darkens the lower half and vice versa.
    if (Math.abs(ly) > 0.05) {
      const vg = ctx.createLinearGradient(0, 0, 0, h);
      vg.addColorStop(0, dark(0.22 * s * (1 + ly)));
      vg.addColorStop(clamp01(0.5 + ly * 0.25), "rgba(255,255,255,0)");
      vg.addColorStop(1, dark(0.22 * s * (1 - ly)));
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }

    // Soft sheen on the lit side — skin scatters a little light back.
    const hx = w * clamp01(0.5 + lx * 0.3);
    const hy = h * clamp01(0.5 + ly * 0.3);
    const sheen = ctx.createRadialGradient(
      hx,
      hy,
      0,
      hx,
      hy,
      Math.max(w, h) * 0.55,
    );
    sheen.addColorStop(0, `rgba(255,255,255,${(0.1 * power * shade).toFixed(3)})`);
    sheen.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = sheen;
    ctx.fillRect(0, 0, w, h);

    ctx.globalCompositeOperation = "source-over";
  }

  return canvas;
}

/** Backwards-compatible one-shot warp (geometry + occlusion + shading). */
export function wrapImageOnCylinder(
  img: HTMLImageElement | HTMLCanvasElement,
  opts: WrapOptions,
): HTMLCanvasElement {
  const geo = shapeAlongLimb(
    warpGeometry(
      img,
      opts.curve,
      opts.bow,
      opts.maxSize ?? defaultWorkSize(),
      opts.visibleFraction,
    ),
    opts,
  );
  return shadeWrapped(geo, opts);
}

function encode(canvas: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      if (typeof canvas.toBlob === "function") {
        canvas.toBlob(
          (blob) => resolve(blob ? URL.createObjectURL(blob) : null),
          "image/png",
        );
        return;
      }
      resolve(canvas.toDataURL("image/png"));
    } catch {
      resolve(null);
    }
  });
}

const outCanvas = new WeakMap<object, HTMLCanvasElement>();
const OUT_KEY = {};

/**
 * Loads a URL and composites it (geometry + occlusion + shading) into the
 * shared work canvas. Returns the canvas itself so that photo capture and
 * video recording can draw the *exact* bitmap the live preview shows instead
 * of re-deriving it — no re-decode, no second pipeline, no drift.
 */
export async function wrapSourceToCanvas(
  src: string,
  opts: WrapOptions,
): Promise<HTMLCanvasElement | null> {
  const img = await loadImage(src);
  if (!img) return null;
  const size = opts.maxSize ?? defaultWorkSize();
  const shapeKey = `${(opts.taper ?? 1).toFixed(2)}|${(opts.tilt ?? 0).toFixed(2)}|${opts.tiltDir ?? 1}|${Math.round(opts.bendDeg ?? 180)}|${(opts.visibleFraction ?? 1).toFixed(2)}`;
  const key = `${src}|${opts.curve.toFixed(2)}|${opts.bow ?? "d"}|${size}|${shapeKey}`;
  let geo = geoCache.get(key);
  if (!geo) {
    try {
      geo = shapeAlongLimb(
        warpGeometry(img, opts.curve, opts.bow, size, opts.visibleFraction),
        opts,
      );
    } catch {
      return null;
    }
    geoCache.set(key, geo);
    if (geoCache.size > 8) geoCache.delete(geoCache.keys().next().value!);
  }
  let out = outCanvas.get(OUT_KEY);
  if (!out) {
    out = makeCanvas(geo.width, geo.height);
    outCanvas.set(OUT_KEY, out);
  }
  try {
    return shadeWrapped(geo, opts, out);
  } catch {
    return null;
  }
}

/**
 * Loads a URL and returns the wrapped bitmap as an object URL (null on
 * failure). Revoke the previous URL when you replace it.
 */
export async function wrapSourceToDataUrl(
  src: string,
  opts: WrapOptions,
): Promise<{ url: string; canvas: HTMLCanvasElement } | null> {
  const canvas = await wrapSourceToCanvas(src, opts);
  if (!canvas) return null;
  const url = await encode(canvas);
  return url ? { url, canvas } : null;
}

