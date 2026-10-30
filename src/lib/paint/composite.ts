/**
 * Tree compositor.
 *
 * Rules it implements:
 *  - Siblings are drawn bottom-first with their own opacity + blend mode.
 *  - A group renders into its own buffer first, then lands as one unit, so its
 *    opacity and blend mode apply to the flattened group (like Procreate).
 *  - A clipped node is masked by the alpha of the sibling directly below it
 *    (and consecutive clipped nodes share that same base).
 */
import { filterString } from "./adjust";
import type { AdjustmentLayer, BlendMode, ImageLayer, LayerNode } from "./types";

export const BLEND_OPS: Record<BlendMode, GlobalCompositeOperation> = {
  normal: "source-over",
  multiply: "multiply",
  screen: "screen",
  overlay: "overlay",
  add: "lighter",
};

/** Reusable full-size buffers; nesting depth stays small so the pool does too. */
export class CanvasPool {
  private free: HTMLCanvasElement[] = [];

  constructor(
    private readonly width: number,
    private readonly height: number,
  ) {}

  acquire(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
    const canvas =
      this.free.pop() ??
      (() => {
        const c = document.createElement("canvas");
        c.width = this.width;
        c.height = this.height;
        return c;
      })();
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.width, this.height);
    return { canvas, ctx };
  }

  release(canvas: HTMLCanvasElement) {
    this.free.push(canvas);
  }
}

export interface CompositeEnv {
  pool: CanvasPool;
  /** Lets the engine swap in a live stroke preview for the active layer. */
  canvasFor: (layer: ImageLayer) => HTMLCanvasElement;
}

function isVisible(node: LayerNode) {
  return node.visible && node.opacity > 0;
}

/** Node content only — its own opacity/blend are applied by the caller. */
function renderContent(ctx: CanvasRenderingContext2D, node: LayerNode, env: CompositeEnv) {
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  if (node.kind === "layer") {
    ctx.drawImage(env.canvasFor(node), 0, 0);
  } else if (node.kind === "group") {
    compositeNodes(ctx, node.children, env);
  }
  ctx.restore();
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  opacity: number,
  blendMode: BlendMode,
) {
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = BLEND_OPS[blendMode];
  ctx.drawImage(source, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
}

/**
 * Applies an adjustment layer in place: whatever is already on `ctx` is the
 * "below" content, so it is re-drawn through the CSS filter. Nothing else in
 * the document is touched, which is what makes the layer non-destructive.
 *
 * `ctx` must own its buffer (identity transform), which `compositeNodes`
 * guarantees by rendering any stack containing an adjustment into a pool
 * buffer first.
 */
function applyAdjustment(
  ctx: CanvasRenderingContext2D,
  node: AdjustmentLayer,
  env: CompositeEnv,
) {
  const filter = filterString(node.settings);
  if (filter === "none") return;

  const snap = env.pool.acquire();
  snap.ctx.drawImage(ctx.canvas, 0, 0);
  const filtered = env.pool.acquire();
  filtered.ctx.filter = filter;
  filtered.ctx.drawImage(snap.canvas, 0, 0);
  filtered.ctx.filter = "none";

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.filter = "none";
  if (node.opacity >= 1) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "copy";
    ctx.drawImage(filtered.canvas, 0, 0);
  } else {
    ctx.globalAlpha = node.opacity;
    ctx.globalCompositeOperation = "source-over";
    ctx.drawImage(filtered.canvas, 0, 0);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  env.pool.release(filtered.canvas);
  env.pool.release(snap.canvas);
}

/**
 * A stack holding a visible adjustment layer needs its own buffer, because the
 * adjustment has to read back the pixels below it — and the caller's context
 * may be the on-screen canvas with the viewport transform applied.
 */
export function compositeNodes(
  ctx: CanvasRenderingContext2D,
  nodes: LayerNode[],
  env: CompositeEnv,
) {
  const hasAdjust = nodes.some((n) => n.kind === "adjust" && isVisible(n));
  if (!hasAdjust) {
    compositeStack(ctx, nodes, env);
    return;
  }
  const buf = env.pool.acquire();
  compositeStack(buf.ctx, nodes, env);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(buf.canvas, 0, 0);
  env.pool.release(buf.canvas);
}

function compositeStack(
  ctx: CanvasRenderingContext2D,
  nodes: LayerNode[],
  env: CompositeEnv,
) {
  let i = 0;
  while (i < nodes.length) {
    const base = nodes[i]!;

    // Collect the clipped stack riding on top of this base.
    const clipStack: LayerNode[] = [];
    let j = i + 1;
    while (j < nodes.length && nodes[j]!.clipped) {
      clipStack.push(nodes[j]!);
      j++;
    }
    i = j;

    // A hidden base hides its clipped stack too.
    if (!isVisible(base)) continue;

    const visibleClips = clipStack.filter(isVisible);

    if (visibleClips.length === 0) {
      if (base.kind === "adjust") {
        applyAdjustment(ctx, base, env);
      } else if (base.kind === "layer") {
        drawUnit(ctx, env.canvasFor(base), base.opacity, base.blendMode);
      } else {
        const unit = env.pool.acquire();
        renderContent(unit.ctx, base, env);
        drawUnit(ctx, unit.canvas, base.opacity, base.blendMode);
        env.pool.release(unit.canvas);
      }
      continue;
    }

    // An adjustment layer has no pixels to clip to, so anything riding on it
    // simply draws normally on top of the adjusted result.
    if (base.kind === "adjust") {
      applyAdjustment(ctx, base, env);
      for (const clip of visibleClips) {
        if (clip.kind === "adjust") {
          applyAdjustment(ctx, clip, env);
          continue;
        }
        const buf = env.pool.acquire();
        renderContent(buf.ctx, clip, env);
        drawUnit(ctx, buf.canvas, clip.opacity, clip.blendMode);
        env.pool.release(buf.canvas);
      }
      continue;
    }

    // Base content becomes both the paint and the mask for the clipped stack.
    const flat = env.pool.acquire();
    renderContent(flat.ctx, base, env);
    const mask = env.pool.acquire();
    mask.ctx.drawImage(flat.canvas, 0, 0);

    for (const clip of visibleClips) {
      // A clipped adjustment only ever sees the base's own pixels, so applying
      // it to the flattened base is exactly the masked result.
      if (clip.kind === "adjust") {
        applyAdjustment(flat.ctx, clip, env);
        continue;
      }
      const buf = env.pool.acquire();
      renderContent(buf.ctx, clip, env);
      buf.ctx.globalCompositeOperation = "destination-in";
      buf.ctx.drawImage(mask.canvas, 0, 0);
      buf.ctx.globalCompositeOperation = "source-over";
      drawUnit(flat.ctx, buf.canvas, clip.opacity, clip.blendMode);
      env.pool.release(buf.canvas);
    }

    drawUnit(ctx, flat.canvas, base.opacity, base.blendMode);
    env.pool.release(mask.canvas);
    env.pool.release(flat.canvas);
  }
}
