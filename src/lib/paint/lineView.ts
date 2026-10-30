/**
 * Stencil view ("Stencilvy"): a temporary display mode that shows only the
 * layers marked as line layers, as pure black shapes on white paper.
 *
 * Nothing here touches the layers themselves — colour and opacity are ignored,
 * only the alpha channel (the shape) is used, and the thickness slider grows or
 * shrinks the drawn lines for display/export only.
 *
 * Framework-agnostic, like the rest of src/lib/paint.
 */

export interface LineViewSettings {
  /**
   * Line thickness for the stencil view, in document pixels.
   * 0 keeps the original weight, positive grows it, negative thins it.
   */
  thickness: number;
}

export const DEFAULT_LINE_VIEW: LineViewSettings = { thickness: 0 };

/** Thickness slider range, in document pixels. */
export const LINE_THICKNESS_MIN = -8;
export const LINE_THICKNESS_MAX = 12;

function createCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Offsets on a ring of `r` px, used to dilate (or erode) the alpha mask. */
function ring(r: number): [number, number][] {
  const out: [number, number][] = [];
  const steps = Math.max(8, Math.round(r * 6));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    out.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return out;
}

/**
 * Flattens the given layer canvases into a pure black-on-transparent mask,
 * with the thickness adjustment applied. `scale` renders at a multiple of the
 * document resolution for high-resolution export.
 */
export function renderLineMask(
  sources: HTMLCanvasElement[],
  width: number,
  height: number,
  settings: LineViewSettings,
  scale = 1,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  // 1. Union of every line layer's alpha.
  const mask = createCanvas(w, h);
  const mctx = mask.getContext("2d")!;
  mctx.imageSmoothingEnabled = true;
  for (const src of sources) mctx.drawImage(src, 0, 0, w, h);

  const grow = settings.thickness * scale;

  // 2. Thicker: stamp the mask around a ring. Thinner: erode by keeping only
  //    pixels whose neighbourhood is also inked (destination-in on the ring).
  if (grow > 0.4) {
    for (const [dx, dy] of ring(grow)) mctx.drawImage(mask, dx, dy, w, h);
  } else if (grow < -0.4) {
    const eroded = createCanvas(w, h);
    const ectx = eroded.getContext("2d")!;
    ectx.drawImage(mask, 0, 0);
    ectx.globalCompositeOperation = "destination-in";
    for (const [dx, dy] of ring(-grow)) ectx.drawImage(mask, dx, dy, w, h);
    ectx.globalCompositeOperation = "source-over";
    mctx.clearRect(0, 0, w, h);
    mctx.drawImage(eroded, 0, 0);
  }

  // 3. Ignore colour and opacity: firm up the alpha, then tint pure black.
  const out = createCanvas(w, h);
  const octx = out.getContext("2d")!;
  for (let i = 0; i < 3; i++) octx.drawImage(mask, 0, 0);
  octx.globalCompositeOperation = "source-in";
  octx.fillStyle = "#000000";
  octx.fillRect(0, 0, w, h);
  octx.globalCompositeOperation = "source-over";
  return out;
}

/** Draws the stencil view (white paper + black lines) into a context. */
export function drawLineView(
  ctx: CanvasRenderingContext2D,
  sources: HTMLCanvasElement[],
  width: number,
  height: number,
  settings: LineViewSettings,
) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  if (sources.length > 0) {
    ctx.drawImage(renderLineMask(sources, width, height, settings), 0, 0);
  }
  ctx.restore();
}

/** Flattened stencil-view canvas: opaque white paper with black lines. */
export function renderLineViewCanvas(
  sources: HTMLCanvasElement[],
  width: number,
  height: number,
  settings: LineViewSettings,
  scale = 2,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = createCanvas(w, h);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  if (sources.length > 0) {
    ctx.drawImage(renderLineMask(sources, width, height, settings, scale), 0, 0);
  }
  return out;
}
