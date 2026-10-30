import { loadImageEl } from "@/lib/printExport";

/**
 * Turns a motif bitmap into a real vector outline (SVG paths) plus a
 * measured reference image, so a studio can open the design in Illustrator,
 * Procreate or any cutter without needing a 3D scan.
 */

type Edge = "top" | "right" | "bottom" | "left";
type Pt = [number, number];

const MAX_TRACE_W = 420;

function maskFromImage(img: HTMLImageElement, alphaCut = 128, lumaCut = 200) {
  const scale = Math.min(1, MAX_TRACE_W / img.naturalWidth);
  const w = Math.max(8, Math.round(img.naturalWidth * scale));
  const h = Math.max(8, Math.round(img.naturalHeight * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3];
    const luma = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    mask[i] = a >= alphaCut && luma <= lumaCut ? 1 : 0;
  }
  return { mask, w, h };
}

function traceLoops(mask: Uint8Array, w: number, h: number): Pt[][] {
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : mask[y * w + x]);
  const seen = new Set<string>();
  const loops: Pt[][] = [];

  const midpoint = (i: number, j: number, e: Edge): Pt =>
    e === "top"
      ? [i - 0.5, j - 1]
      : e === "right"
        ? [i, j - 0.5]
        : e === "bottom"
          ? [i - 0.5, j]
          : [i - 1, j - 0.5];

  const stateOf = (i: number, j: number) =>
    at(i - 1, j - 1) * 1 + at(i, j - 1) * 2 + at(i, j) * 4 + at(i - 1, j) * 8;

  const crossing = (s: number): Edge[] => {
    const A = s & 1, B = (s >> 1) & 1, C = (s >> 2) & 1, D = (s >> 3) & 1;
    const out: Edge[] = [];
    if (A !== B) out.push("top");
    if (B !== C) out.push("right");
    if (C !== D) out.push("bottom");
    if (D !== A) out.push("left");
    return out;
  };

  const exitEdge = (s: number, entry: Edge): Edge | null => {
    if (s === 5) return entry === "top" ? "left" : entry === "left" ? "top" : entry === "right" ? "bottom" : "right";
    if (s === 10) return entry === "top" ? "right" : entry === "right" ? "top" : entry === "bottom" ? "left" : "bottom";
    const edges = crossing(s);
    if (edges.length !== 2) return null;
    return edges[0] === entry ? edges[1] : edges[0];
  };

  const step = (i: number, j: number, exit: Edge): [number, number, Edge] =>
    exit === "top"
      ? [i, j - 1, "bottom"]
      : exit === "right"
        ? [i + 1, j, "left"]
        : exit === "bottom"
          ? [i, j + 1, "top"]
          : [i - 1, j, "right"];

  for (let j = 0; j <= h; j++) {
    for (let i = 0; i <= w; i++) {
      const s0 = stateOf(i, j);
      if (!crossing(s0).includes("top")) continue;
      if (seen.has(`${i},${j},top`)) continue;

      const pts: Pt[] = [];
      let ci = i;
      let cj = j;
      let entry: Edge = "top";
      let guard = 0;
      while (guard++ < w * h * 4) {
        const key = `${ci},${cj},${entry}`;
        if (seen.has(key)) break;
        seen.add(key);
        pts.push(midpoint(ci, cj, entry));
        const exit = exitEdge(stateOf(ci, cj), entry);
        if (!exit) break;
        [ci, cj, entry] = step(ci, cj, exit);
        if (ci < 0 || cj < 0 || ci > w || cj > h) break;
      }
      if (pts.length > 8) loops.push(pts);
    }
  }
  return loops;
}

function simplify(points: Pt[], tolerance: number): Pt[] {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1;
    let bestD = tolerance;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let k = a + 1; k < b; k++) {
      const [px, py] = points[k];
      const d = Math.abs(dy * px - dx * py + bx * ay - by * ax) / len;
      if (d > bestD) {
        bestD = d;
        best = k;
      }
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return points.filter((_, k) => keep[k] === 1);
}

/**
 * Traces the motif into an SVG sized in real millimetres (1:1), with the
 * outline as vector paths — ready for Illustrator / Procreate / plotters.
 */
export async function buildMotifSvg(opts: {
  imageUrl: string;
  widthMm: number;
  title?: string;
}): Promise<{ svg: string; widthMm: number; heightMm: number }> {
  const img = await loadImageEl(opts.imageUrl);
  const { mask, w, h } = maskFromImage(img);
  const widthMm = Math.max(5, opts.widthMm);
  const heightMm = (img.naturalHeight / img.naturalWidth) * widthMm;
  const loops = traceLoops(mask, w, h).map((l) => simplify(l, 0.75));

  const sx = widthMm / w;
  const sy = heightMm / h;
  const d = loops
    .map(
      (loop) =>
        "M " +
        loop
          .map(([x, y]) => `${(x * sx).toFixed(2)} ${(y * sy).toFixed(2)}`)
          .join(" L ") +
        " Z",
    )
    .join(" ");

  const title = (opts.title ?? "InkSimulator motif").replace(/[<>&]/g, "");
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm.toFixed(2)}mm" height="${heightMm.toFixed(2)}mm" viewBox="0 0 ${widthMm.toFixed(2)} ${heightMm.toFixed(2)}">
  <title>${title} — ${Math.round(widthMm)} × ${Math.round(heightMm)} mm</title>
  <desc>Exported from InkSimulator at 1:1 scale. Units are millimetres.</desc>
  <g fill="#000000" fill-rule="evenodd">
    <path d="${d}" />
  </g>
</svg>`;
  return { svg, widthMm, heightMm };
}

/**
 * Reference bitmap of the motif with millimetre dimension lines, so the
 * artist can eyeball the exact size at a glance.
 */
export async function buildMeasuredPng(opts: {
  imageUrl: string;
  widthMm: number;
  title?: string;
}): Promise<Blob> {
  const img = await loadImageEl(opts.imageUrl);
  const widthMm = Math.max(5, opts.widthMm);
  const heightMm = (img.naturalHeight / img.naturalWidth) * widthMm;

  const pad = 120;
  const boxW = 900;
  const boxH = Math.round((heightMm / widthMm) * boxW);
  const c = document.createElement("canvas");
  c.width = boxW + pad * 2;
  c.height = boxH + pad * 2;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, pad, pad, boxW, boxH);

  ctx.strokeStyle = "#0A0A0B";
  ctx.fillStyle = "#0A0A0B";
  ctx.lineWidth = 3;
  ctx.font = '600 30px "Space Grotesk", Helvetica, Arial, sans-serif';
  ctx.textAlign = "center";

  // horizontal dimension
  const hy = pad + boxH + 52;
  ctx.beginPath();
  ctx.moveTo(pad, hy);
  ctx.lineTo(pad + boxW, hy);
  ctx.moveTo(pad, hy - 12);
  ctx.lineTo(pad, hy + 12);
  ctx.moveTo(pad + boxW, hy - 12);
  ctx.lineTo(pad + boxW, hy + 12);
  ctx.stroke();
  ctx.fillText(`${Math.round(widthMm)} mm`, pad + boxW / 2, hy + 40);

  // vertical dimension
  const vx = pad - 52;
  ctx.beginPath();
  ctx.moveTo(vx, pad);
  ctx.lineTo(vx, pad + boxH);
  ctx.moveTo(vx - 12, pad);
  ctx.lineTo(vx + 12, pad);
  ctx.moveTo(vx - 12, pad + boxH);
  ctx.lineTo(vx + 12, pad + boxH);
  ctx.stroke();
  ctx.save();
  ctx.translate(vx - 18, pad + boxH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(`${Math.round(heightMm)} mm`, 0, 0);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.font = '700 34px "Space Grotesk", Helvetica, Arial, sans-serif';
  ctx.fillText(opts.title ?? "InkSimulator motif", pad - 52, 60);
  ctx.font = "400 24px Helvetica, Arial, sans-serif";
  ctx.fillStyle = "#6B7280";
  ctx.fillText("Measurements in millimetres · 1:1 vector + PDF included", pad - 52, 94);

  return await new Promise<Blob>((resolve) =>
    c.toBlob((b) => resolve(b as Blob), "image/png"),
  );
}
