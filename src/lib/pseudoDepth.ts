/**
 * Pseudo-depth from a person mask: 0 at the silhouette edge, rising to 1 at
 * the thickest interior point (two-pass chamfer distance transform).
 */
export function pseudoDepth(
  mask: Uint8Array,
  w: number,
  h: number,
  isPerson: (v: number) => boolean,
  out?: Float32Array,
): { depth: Float32Array; max: number } {
  const d = out && out.length === w * h ? out : new Float32Array(w * h);
  const INF = 1e9;
  for (let i = 0; i < w * h; i++) d[i] = isPerson(mask[i]) ? INF : 0;
  const D1 = 1;
  const D2 = Math.SQRT2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + D1);
      else v = Math.min(v, D1);
      if (y > 0) {
        v = Math.min(v, d[i - w] + D1);
        if (x > 0) v = Math.min(v, d[i - w - 1] + D2);
        if (x < w - 1) v = Math.min(v, d[i - w + 1] + D2);
      } else v = Math.min(v, D1);
      d[i] = v;
    }
  }
  let max = 0;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (d[i] === 0) continue;
      let v = d[i];
      if (x < w - 1) v = Math.min(v, d[i + 1] + D1);
      else v = Math.min(v, D1);
      if (y < h - 1) {
        v = Math.min(v, d[i + w] + D1);
        if (x < w - 1) v = Math.min(v, d[i + w + 1] + D2);
        if (x > 0) v = Math.min(v, d[i + w - 1] + D2);
      } else v = Math.min(v, D1);
      d[i] = v;
      if (v > max) max = v;
    }
  }
  return { depth: d, max };
}

/**
 * Walks from (cx, cy) along ±(nx, ny) until leaving the mask.
 * Returns the half-width in mask pixels (average of both sides).
 */
export function halfWidthAt(
  mask: Uint8Array,
  w: number,
  h: number,
  isPerson: (v: number) => boolean,
  cx: number,
  cy: number,
  nx: number,
  ny: number,
): number {
  const walk = (sign: number) => {
    for (let s = 1; s < w; s++) {
      const x = Math.round(cx + nx * s * sign);
      const y = Math.round(cy + ny * s * sign);
      if (x < 0 || y < 0 || x >= w || y >= h) return s;
      if (!isPerson(mask[y * w + x])) return s;
    }
    return w;
  };
  return (walk(1) + walk(-1)) / 2;
}

/** Makes light parts of a motif transparent so only ink multiplies onto skin. */
export function inkOnly(img: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const l = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) / 255;
    const ink = Math.max(0, Math.min(1, (0.9 - l) / 0.25));
    p[i + 3] = Math.round(p[i + 3] * ink);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}
