/**
 * Pure stencil line engine (no DOM). Runs inside a Web Worker.
 * gray → CLAHE → bilateral denoise → XDoG/Canny (+hatching) → speck removal
 * → morphological close → skeletonize → dilate to thickness → 1-bit RGBA.
 */
export type StencilStyle = "lineart" | "outline" | "simple" | "detailed";

export interface EngineParams {
  style: StencilStyle;
  detail: number; // 0..100
  thicknessMm: number;
  widthMm: number; // final print width of the image
  contrast: number; // -50..50
  noise: number; // 0..100 speck cleanup
  invert: boolean;
  removeBg: boolean;
  mirror: boolean;
}

export const MIN_LINE_MM = 0.3;

export function toGray(rgba: Uint8ClampedArray, w: number, h: number, mirror: boolean): Float32Array {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const sx = mirror ? w - 1 - x : x;
      const i = (y * w + sx) * 4;
      const a = rgba[i + 3] / 255;
      const l = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
      g[y * w + x] = l * a + 255 * (1 - a);
    }
  return g;
}

export function clahe(src: Float32Array, w: number, h: number, clip = 2.5, tiles = 8): Float32Array {
  const tx = Math.max(1, Math.min(tiles, Math.floor(w / 16)));
  const ty = Math.max(1, Math.min(tiles, Math.floor(h / 16)));
  const tw = w / tx, th = h / ty;
  const luts: Float32Array[] = [];
  for (let j = 0; j < ty; j++)
    for (let i = 0; i < tx; i++) {
      const hist = new Float32Array(256);
      const x0 = Math.floor(i * tw), x1 = Math.floor((i + 1) * tw);
      const y0 = Math.floor(j * th), y1 = Math.floor((j + 1) * th);
      const n = Math.max(1, (x1 - x0) * (y1 - y0));
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) hist[Math.max(0, Math.min(255, src[y * w + x] | 0))]++;
      const limit = (clip * n) / 256;
      let excess = 0;
      for (let k = 0; k < 256; k++) if (hist[k] > limit) { excess += hist[k] - limit; hist[k] = limit; }
      const add = excess / 256;
      const lut = new Float32Array(256);
      let acc = 0;
      for (let k = 0; k < 256; k++) { acc += hist[k] + add; lut[k] = (acc / n) * 255; }
      luts.push(lut);
    }
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, Math.min(ty - 1, y / th - 0.5));
    const j0 = Math.floor(fy), j1 = Math.min(ty - 1, j0 + 1), wy = fy - j0;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, Math.min(tx - 1, x / tw - 0.5));
      const i0 = Math.floor(fx), i1 = Math.min(tx - 1, i0 + 1), wx = fx - i0;
      const v = Math.max(0, Math.min(255, src[y * w + x] | 0));
      const a = luts[j0 * tx + i0][v], b = luts[j0 * tx + i1][v];
      const c = luts[j1 * tx + i0][v], d = luts[j1 * tx + i1][v];
      out[y * w + x] = (a * (1 - wx) + b * wx) * (1 - wy) + (c * (1 - wx) + d * wx) * wy;
    }
  }
  return out;
}

export function bilateral(src: Float32Array, w: number, h: number, r = 2, sr = 25): Float32Array {
  const out = new Float32Array(w * h);
  const ss = r * r * 0.5 + 0.5;
  const rangeLut = new Float32Array(256);
  for (let k = 0; k < 256; k++) rangeLut[k] = Math.exp(-(k * k) / (2 * sr * sr));
  const n = 2 * r + 1;
  const spatial = new Float32Array(n * n);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) spatial[(dy + r) * n + dx + r] = Math.exp(-(dx * dx + dy * dy) / (2 * ss));
  const q = new Uint8Array(w * h);
  for (let i = 0; i < q.length; i++) { const v = src[i]; q[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = q[y * w + x];
      let sum = 0, wsum = 0;
      for (let dy = -r; dy <= r; dy++) {
        let yy = y + dy; if (yy < 0) yy = 0; else if (yy >= h) yy = h - 1;
        const row = yy * w, srow = (dy + r) * n + r;
        for (let dx = -r; dx <= r; dx++) {
          let xx = x + dx; if (xx < 0) xx = 0; else if (xx >= w) xx = w - 1;
          const v = q[row + xx];
          const diff = v > c ? v - c : c - v;
          const wt = spatial[srow + dx] * rangeLut[diff];
          sum += v * wt; wsum += wt;
        }
      }
      out[y * w + x] = sum / wsum;
    }
  return out;
}

export function gaussian(src: Float32Array, w: number, h: number, sigma: number): Float32Array {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const k = new Float32Array(2 * r + 1);
  let s = 0;
  for (let i = -r; i <= r; i++) { k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma)); s += k[i + r]; }
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += src[y * w + Math.min(w - 1, Math.max(0, x + i))] * k[i + r];
      tmp[y * w + x] = a;
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let a = 0;
      for (let i = -r; i <= r; i++) a += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * k[i + r];
      out[y * w + x] = a;
    }
  return out;
}

/** XDoG → binary ink mask (1 = ink). */
export function xdog(src: Float32Array, w: number, h: number, sigma: number, k = 1.6, p = 20, eps = 0, phi = 10): Uint8Array {
  const g1 = gaussian(src, w, h, sigma), g2 = gaussian(src, w, h, sigma * k);
  const m = new Uint8Array(w * h);
  // Edge-only XDoG response: ink on the dark side of an edge, never solid fills
  // (filled areas would collapse under skeletonization).
  for (let i = 0; i < m.length; i++) {
    const d = (p * (g1[i] - g2[i])) / 255;
    const e = 1 + Math.tanh(phi * (d + eps));
    m[i] = e < 0.5 ? 1 : 0;
  }
  return m;
}

export function canny(src: Float32Array, w: number, h: number, sigma: number, lo: number, hi: number): Uint8Array {
  const g = gaussian(src, w, h, sigma);
  const mag = new Float32Array(w * h), dir = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx = -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] + g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1];
      const gy = -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] + g[i + w - 1] + 2 * g[i + w] + g[i + w + 1];
      mag[i] = Math.hypot(gx, gy);
      const a = ((Math.atan2(gy, gx) * 180) / Math.PI + 180) % 180;
      dir[i] = a < 22.5 || a >= 157.5 ? 0 : a < 67.5 ? 1 : a < 112.5 ? 2 : 3;
    }
  const nms = new Float32Array(w * h);
  const off = [[1, 0], [1, 1], [0, 1], [-1, 1]];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const [dx, dy] = off[dir[i]];
      if (mag[i] >= mag[i + dy * w + dx] && mag[i] >= mag[i - dy * w - dx]) nms[i] = mag[i];
    }
  const out = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < out.length; i++) if (nms[i] >= hi) { out[i] = 1; stack.push(i); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = yy * w + xx;
        if (!out[j] && nms[j] >= lo) { out[j] = 1; stack.push(j); }
      }
  }
  return out;
}

/** Hatching: few parallel diagonal lines inside grouped dark tonal zones. */
export function hatch(src: Float32Array, w: number, h: number, levels: number[], spacing: number): Uint8Array {
  const smooth = gaussian(src, w, h, Math.max(2, spacing / 2));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const v = smooth[y * w + x];
      for (let l = 0; l < levels.length; l++) {
        if (v >= levels[l]) break;
        const t = l % 2 === 0 ? x + y : x - y + h;
        if (((t % spacing) + spacing) % spacing === 0) { out[y * w + x] = 1; break; }
      }
    }
  return out;
}

export function removeSpecks(m: Uint8Array, w: number, h: number, minArea: number): Uint8Array {
  if (minArea <= 1) return m;
  const out = new Uint8Array(m);
  const seen = new Uint8Array(m.length);
  const stack: number[] = [], comp: number[] = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    comp.length = 0; stack.push(s); seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!; comp.push(i);
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
          const j = yy * w + xx;
          if (m[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
    }
    if (comp.length < minArea) for (const i of comp) out[i] = 0;
  }
  return out;
}

function morph(m: Uint8Array, w: number, h: number, r: number, dilate: boolean): Uint8Array {
  if (r <= 0) return m;
  const r2 = r * r + r;
  const offs: number[][] = [];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r2) offs.push([dx, dy]);
  const out = new Uint8Array(m.length);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let hit = !dilate;
      for (const [dx, dy] of offs) {
        const xx = x + dx, yy = y + dy;
        const v = xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : m[yy * w + xx];
        if (dilate && v) { hit = true; break; }
        if (!dilate && !v) { hit = false; break; }
      }
      out[y * w + x] = hit ? 1 : 0;
    }
  return out;
}
export const dilate = (m: Uint8Array, w: number, h: number, r: number) => morph(m, w, h, r, true);
export const erode = (m: Uint8Array, w: number, h: number, r: number) => morph(m, w, h, r, false);
export const close = (m: Uint8Array, w: number, h: number, r: number) => erode(dilate(m, w, h, r), w, h, r);

/** Zhang–Suen thinning to 1px centerlines. */
export function skeletonize(src: Uint8Array, w: number, h: number): Uint8Array {
  const m = new Uint8Array(src);
  for (let x = 0; x < w; x++) { m[x] = 0; m[(h - 1) * w + x] = 0; }
  for (let y = 0; y < h; y++) { m[y * w] = 0; m[y * w + w - 1] = 0; }
  const del: number[] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++)
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!m[i]) continue;
          const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1];
          const p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1];
          const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (b < 2 || b > 6) continue;
          const a = (+(!p2 && p3)) + (+(!p3 && p4)) + (+(!p4 && p5)) + (+(!p5 && p6)) + (+(!p6 && p7)) + (+(!p7 && p8)) + (+(!p8 && p9)) + (+(!p9 && p2));
          if (a !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(i);
        }
      for (const i of del) m[i] = 0;
      if (del.length) changed = true;
    }
  }
  return m;
}

/** Map UI sliders/preset to pipeline parameters. Thickness clamped to ≥ 0.3 mm. */
export function mapParams(p: EngineParams, w: number) {
  const pxPerMm = w / p.widthMm;
  const d = p.detail / 100;
  const lineMm = Math.max(MIN_LINE_MM, p.thicknessMm);
  const linePx = Math.max(1, lineMm * pxPerMm);
  const scale = Math.max(1, w / 800);
  const preset = {
    lineart: { sigma: 1, p: 20, eps: 0.5, hatchLevels: [] as number[] },
    outline: { sigma: 2.4 - d * 1.0, p: 18, eps: 0.9 - d * 0.5, hatchLevels: [] as number[] },
    simple: { sigma: 1.8 - d * 0.8, p: 22, eps: 0.7 - d * 0.4, hatchLevels: [70 + d * 30] },
    detailed: { sigma: 1.2 - d * 0.6, p: 28, eps: 0.5 - d * 0.3, hatchLevels: [60 + d * 20, 100 + d * 30, 140 + d * 30] },
  }[p.style];
  return {
    pxPerMm, linePx,
    sigma: Math.max(0.5, preset.sigma) * scale,
    p: preset.p, eps: preset.eps,
    hatchLevels: preset.hatchLevels.map((l) => l + p.contrast),
    hatchSpacing: Math.max(4, Math.round((p.style === "detailed" ? 2.0 : 3.0) * pxPerMm)),
    minArea: Math.round((4 + (p.noise / 100) * 60 * (1 - d * 0.5)) * scale * scale),
    closeR: Math.max(1, Math.round(0.25 * pxPerMm)),
    clip: 2 + p.contrast / 25,
  };
}

/** Otsu threshold on a 0..255 gray buffer. */
export function otsu(g: Float32Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < g.length; i++) hist[Math.max(0, Math.min(255, g[i] | 0))]++;
  let sum = 0; for (let k = 0; k < 256; k++) sum += k * hist[k];
  let wB = 0, sumB = 0, best = 0, t = 128;
  for (let k = 0; k < 256; k++) {
    wB += hist[k]; if (!wB) continue;
    const wF = g.length - wB; if (!wF) break;
    sumB += k * hist[k];
    const mB = sumB / wB, mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) * (mB - mF);
    if (v > best) { best = v; t = k; }
  }
  return t;
}

/**
 * Line-art mode: keep the drawn strokes themselves (no edge detection, no
 * thinning) so straight lines stay straight and keep their width. Jagged
 * edges are smoothed by blurring the mask and re-thresholding.
 */
export function lineArtMask(g: Float32Array, w: number, h: number, p: EngineParams, pxPerMm: number, minArea: number): Uint8Array {
  const t = Math.max(20, Math.min(235, otsu(g) + p.contrast));
  let mask: Uint8Array = new Uint8Array(w * h);
  for (let i = 0; i < mask.length; i++) mask[i] = g[i] < t ? 1 : 0;
  mask = removeSpecks(mask, w, h, minArea);
  // Fill pinholes inside strokes.
  const inv = new Uint8Array(mask.length);
  for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  const holes = removeSpecks(inv, w, h, Math.max(4, Math.round(minArea / 2)));
  for (let i = 0; i < mask.length; i++) mask[i] = holes[i] ? 0 : 1;
  // Smooth stair-steps: blur then threshold at the midpoint keeps width.
  const f = new Float32Array(mask.length);
  for (let i = 0; i < f.length; i++) f[i] = mask[i] * 255;
  const b = gaussian(f, w, h, Math.max(1, Math.min(3, 0.15 * pxPerMm)));
  for (let i = 0; i < mask.length; i++) mask[i] = b[i] >= 127.5 ? 1 : 0;
  // Never thinner than the minimum printable line.
  const minPx = MIN_LINE_MM * pxPerMm;
  if (minPx > 2) mask = close(mask, w, h, Math.round(minPx / 4));
  return mask;
}

function toRgba(mask: Uint8Array, removeBg: boolean): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.length * 4);
  for (let i = 0; i < mask.length; i++) {
    const ink = mask[i] === 1;
    const v = ink ? 0 : 255;
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v;
    out[i * 4 + 3] = ink || !removeBg ? 255 : 0;
  }
  return out;
}

/** True when an image is mostly near-black on near-white (existing line art). */
export function looksLikeLineArt(rgba: Uint8ClampedArray): boolean {
  let extreme = 0, n = 0;
  for (let i = 0; i < rgba.length; i += 16) {
    const a = rgba[i + 3] / 255;
    const l = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 255 * (1 - a);
    if (l < 70 || l > 200) extreme++;
    n++;
  }
  return n > 0 && extreme / n > 0.9;
}

export function runStencil(rgba: Uint8ClampedArray, w: number, h: number, p: EngineParams): Uint8ClampedArray {
  const m = mapParams(p, w);
  if (p.style === "lineart") {
    const g0 = toGray(rgba, w, h, p.mirror);
    if (p.invert) for (let i = 0; i < g0.length; i++) g0[i] = 255 - g0[i];
    return toRgba(lineArtMask(g0, w, h, p, m.pxPerMm, Math.max(4, Math.round(m.minArea / 2))), p.removeBg);
  }
  let g = toGray(rgba, w, h, p.mirror);
  if (p.invert) for (let i = 0; i < g.length; i++) g[i] = 255 - g[i];
  g = bilateral(g, w, h, Math.max(1, Math.round(w / 600)), 22);
  const eq = clahe(g, w, h, Math.max(1, m.clip));
  // Blend so flat areas (skin, paper) are not amplified into dotted noise.
  for (let i = 0; i < g.length; i++) g[i] = g[i] * 0.4 + eq[i] * 0.6;
  let mask: Uint8Array;
  if (p.style === "outline") {
    const x = xdog(g, w, h, m.sigma, 1.6, m.p, m.eps);
    const c = canny(g, w, h, m.sigma, 20 + (1 - p.detail / 100) * 30, 50 + (1 - p.detail / 100) * 60);
    mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = x[i] | c[i];
  } else {
    mask = xdog(g, w, h, m.sigma, 1.6, m.p, m.eps);
  }
  mask = removeSpecks(mask, w, h, m.minArea);
  mask = close(mask, w, h, m.closeR);
  mask = skeletonize(mask, w, h);
  if (p.style !== "outline" && m.hatchLevels.length) {
    // Hatching is already 1px; add after thinning so it never fills in.
    const hm = removeSpecks(hatch(g, w, h, m.hatchLevels, m.hatchSpacing), w, h, m.hatchSpacing * 2);
    for (let i = 0; i < mask.length; i++) mask[i] |= hm[i];
  }
  mask = removeSpecks(mask, w, h, Math.max(3, Math.round(m.minArea / 4)));
  // Thicken, then blur + re-threshold so pixel stair-steps become smooth curves.
  mask = dilate(mask, w, h, Math.max(1, Math.round((m.linePx - 1) / 2)));
  {
    const f = new Float32Array(mask.length);
    for (let i = 0; i < f.length; i++) f[i] = mask[i] * 255;
    const b = gaussian(f, w, h, Math.max(1, Math.min(3, m.linePx * 0.4)));
    for (let i = 0; i < mask.length; i++) mask[i] = b[i] >= 110 ? 1 : 0;
  }
  return toRgba(mask, p.removeBg);
}
