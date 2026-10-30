import { clamp } from "./color";
import { PressureTracker } from "./pressure";
import type { StrokePoint } from "./types";

/**
 * Stroke "feel" layer: pressure curves, stabilisation (StreamLine) and taper.
 *
 * This sits between the raw pointer samples and the stroke renderer, so the
 * brushes and the engine keep working exactly as before — the shaper only
 * decides *where* a sample lands and *how hard* it is.
 *
 * All the numbers that decide how the app feels live here as named constants
 * so they can be re-tuned without rewriting logic.
 */

export type PressureCurve = "soft" | "normal" | "hard";

export interface FeelSettings {
  /** Pressure response: soft = light touch goes far, hard = needs real force. */
  curve: PressureCurve;
  /** 0..1 — how much the stroke is smoothed / lags behind the pointer. */
  streamline: number;
  /** 0..1 — length of the thin ramp at the start and end of a stroke. */
  taper: number;
  /** Pressure drives stroke width. */
  sizeFromPressure: boolean;
  /** Pressure drives stroke opacity. */
  opacityFromPressure: boolean;
}

export const DEFAULT_FEEL: FeelSettings = {
  curve: "normal",
  streamline: 0.35,
  taper: 0.5,
  sizeFromPressure: true,
  opacityFromPressure: true,
};

/** Exponents applied to normalised pressure, per curve preset. */
const CURVE_EXPONENT: Record<PressureCurve, number> = {
  soft: 0.6,
  normal: 1,
  hard: 1.9,
};

/** Opacity reacts a little softer than width — that's the Procreate feel. */
const ALPHA_CURVE_BIAS = 0.75;

/** Strongest smoothing keeps 88% of the previous position per sample. */
const MAX_SMOOTHING = 0.88;

/** Taper ramps over this many brush-widths of travel at full taper. */
const TAPER_WIDTHS = 1.6;

/** Tail steps emitted on release, which produce the taper-out. */
const TAIL_STEPS = 5;

export function applyCurve(pressure: number, curve: PressureCurve): number {
  return clamp(Math.pow(clamp(pressure, 0, 1), CURVE_EXPONENT[curve]), 0.02, 1);
}

/**
 * Turns raw pointer samples into shaped stroke points.
 *
 * `move()` and `finish()` return zero or more points because stabilisation can
 * swallow a sample and the release flush can emit several.
 */
export class StrokeShaper {
  private readonly pressure = new PressureTracker();
  private feel: FeelSettings = DEFAULT_FEEL;
  private brushSize = 24;

  private x = 0;
  private y = 0;
  private rawX = 0;
  private rawY = 0;
  private travelled = 0;
  private lastPressure = 0.5;

  begin(
    clientX: number,
    clientY: number,
    docX: number,
    docY: number,
    rawPressure: number,
    pointerType: string,
    feel: FeelSettings,
    brushSize: number,
  ): StrokePoint {
    this.feel = feel;
    this.brushSize = brushSize;
    this.x = docX;
    this.y = docY;
    this.rawX = docX;
    this.rawY = docY;
    this.travelled = 0;
    const p = this.pressure.begin(clientX, clientY, rawPressure, pointerType);
    this.lastPressure = p;
    return this.shape(docX, docY, p);
  }

  move(
    clientX: number,
    clientY: number,
    docX: number,
    docY: number,
    rawPressure: number,
    pointerType: string,
  ): StrokePoint[] {
    const p = this.pressure.next(clientX, clientY, rawPressure, pointerType);
    this.lastPressure = p;
    this.rawX = docX;
    this.rawY = docY;

    const keep = MAX_SMOOTHING * clamp(this.feel.streamline, 0, 1);
    const nx = this.x + (docX - this.x) * (1 - keep);
    const ny = this.y + (docY - this.y) * (1 - keep);
    const step = Math.hypot(nx - this.x, ny - this.y);
    if (step < 0.01) return [];

    this.travelled += step;
    this.x = nx;
    this.y = ny;
    return [this.shape(nx, ny, p)];
  }

  /**
   * Release: walk the remaining stabiliser lag out to the real pointer while
   * fading pressure, which is what makes the stroke end in a point.
   */
  finish(): StrokePoint[] {
    const out: StrokePoint[] = [];
    const dx = this.rawX - this.x;
    const dy = this.rawY - this.y;
    const taper = clamp(this.feel.taper, 0, 1);
    for (let i = 1; i <= TAIL_STEPS; i++) {
      const t = i / TAIL_STEPS;
      const fade = 1 - taper * t;
      const px = this.x + dx * t;
      const py = this.y + dy * t;
      out.push(this.shape(px, py, this.lastPressure * fade, taper === 0 ? 1 : fade));
    }
    this.pressure.end();
    return out;
  }

  /** Applies curves, taper-in and the size/opacity toggles to one sample. */
  private shape(x: number, y: number, pressure: number, tailScale = 1): StrokePoint {
    const taper = clamp(this.feel.taper, 0, 1);
    const rampLength = this.brushSize * TAPER_WIDTHS * taper;
    const rampIn = rampLength > 0 ? clamp(this.travelled / rampLength, 0, 1) : 1;
    const ramp = Math.min(rampIn === 1 ? 1 : 0.15 + 0.85 * rampIn, tailScale);

    const curved = applyCurve(pressure, this.feel.curve);
    const width = this.feel.sizeFromPressure ? curved * ramp : ramp;
    const alphaRaw = this.feel.opacityFromPressure
      ? Math.pow(curved, ALPHA_CURVE_BIAS)
      : 1;

    return {
      x,
      y,
      pressure: clamp(width, 0.02, 1),
      pressureAlpha: clamp(alphaRaw * (0.35 + 0.65 * ramp), 0.02, 1),
    };
  }
}
