/**
 * One Euro Filter (Casiez, Roussel, Vogel — CHI 2012).
 *
 * Adaptive low-pass: heavy smoothing when a signal is nearly still (kills
 * jitter), almost none when it moves fast (kills lag). Exactly what tracked
 * feature points need — a fixed EMA either shivers or drags.
 */

class LowPass {
  private y: number | null = null;
  filter(x: number, alpha: number): number {
    this.y = this.y === null ? x : alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  get value(): number | null {
    return this.y;
  }
  reset() {
    this.y = null;
  }
}

export type OneEuroOptions = {
  /** Minimum cutoff frequency (Hz). Lower = smoother when still. */
  minCutoff?: number;
  /** Speed coefficient. Higher = more responsive when moving fast. */
  beta?: number;
  /** Cutoff for the derivative estimate (Hz). */
  dCutoff?: number;
};

const alphaFor = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuroFilter {
  private x = new LowPass();
  private dx = new LowPass();
  private last: number | null = null;
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;

  constructor(opts: OneEuroOptions = {}) {
    this.minCutoff = opts.minCutoff ?? 1.0;
    this.beta = opts.beta ?? 0.02;
    this.dCutoff = opts.dCutoff ?? 1.0;
  }

  /** @param dt seconds since the previous sample */
  filter(value: number, dt: number): number {
    const step = dt > 0 && isFinite(dt) ? Math.min(dt, 0.1) : 1 / 60;
    const prev = this.last ?? value;
    const derivative = (value - prev) / step;
    const edx = this.dx.filter(derivative, alphaFor(this.dCutoff, step));
    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    this.last = value;
    return this.x.filter(value, alphaFor(cutoff, step));
  }

  /** Retune responsiveness live (higher = follows fast motion sooner). */
  setBeta(beta: number) {
    this.beta = beta;
  }

  reset() {
    this.x.reset();
    this.dx.reset();
    this.last = null;
  }

}

/** Two independent One Euro filters, for a 2D point. */
export class OneEuroPoint {
  private fx: OneEuroFilter;
  private fy: OneEuroFilter;
  constructor(opts?: OneEuroOptions) {
    this.fx = new OneEuroFilter(opts);
    this.fy = new OneEuroFilter(opts);
  }
  filter(x: number, y: number, dt: number) {
    return { x: this.fx.filter(x, dt), y: this.fy.filter(y, dt) };
  }
  reset() {
    this.fx.reset();
    this.fy.reset();
  }
}
