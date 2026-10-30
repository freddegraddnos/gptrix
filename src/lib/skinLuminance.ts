/**
 * Blurred grayscale luminance map of the live camera frame.
 *
 * The tattoo is composited *through* this map: skin creases, hair, veins,
 * muscle definition and the room's own light/shadow modulate the ink's
 * brightness. Only luminance is used — hue and black density come from the
 * design itself, so the ink never picks up a skin-coloured cast.
 *
 * The map is also smoothed over the last few frames with an exponential
 * moving average: phone cameras constantly hunt exposure and white balance,
 * and without smoothing that flicker feeds straight into the ink's shading.
 *
 * Cheap on purpose: the map is downscaled hard (its detail budget is roughly
 * "shadow shapes", not pores) and blurred by the 2D canvas filter, so it costs
 * one small drawImage per frame.
 */

/** Width of the luminance map in pixels; height follows the source aspect. */
const MAP_WIDTH = 160;
/** Blur radius in map pixels — softens noise without losing crease shadows. */
const BLUR_PX = 2.5;
/** EMA weight of the newest frame (lower = steadier, slightly laggier). */
const EMA_ALPHA = 0.3;

export class SkinLuminanceMap {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D | null;
  /** Latest raw frame, before it is averaged into the map. */
  private frame: HTMLCanvasElement;
  private frameCtx: CanvasRenderingContext2D | null;
  private primed = false;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = MAP_WIDTH;
    this.canvas.height = MAP_WIDTH;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: false });
    this.frame = document.createElement("canvas");
    this.frame.width = MAP_WIDTH;
    this.frame.height = MAP_WIDTH;
    this.frameCtx = this.frame.getContext("2d", { willReadFrequently: false });
  }

  /**
   * Re-samples the map from the current frame.
   * @returns true when the map holds a usable frame
   */
  update(source: CanvasImageSource, width: number, height: number): boolean {
    const ctx = this.ctx;
    const fctx = this.frameCtx;
    if (!ctx || !fctx || !width || !height) return false;
    const h = Math.max(2, Math.round((MAP_WIDTH * height) / width));
    if (this.canvas.height !== h) {
      this.canvas.height = h;
      this.frame.height = h;
      this.primed = false;
    }
    try {
      fctx.clearRect(0, 0, this.frame.width, this.frame.height);
      fctx.filter = `grayscale(1) blur(${BLUR_PX}px)`;
      fctx.drawImage(source, 0, 0, this.frame.width, this.frame.height);
      fctx.filter = "none";

      // Exponential moving average over the last few frames.
      if (!this.primed) {
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "copy";
        ctx.drawImage(this.frame, 0, 0);
        ctx.globalCompositeOperation = "source-over";
        this.primed = true;
      } else {
        ctx.globalAlpha = EMA_ALPHA;
        ctx.drawImage(this.frame, 0, 0);
        ctx.globalAlpha = 1;
      }
      return true;
    } catch {
      return false;
    }
  }
}
