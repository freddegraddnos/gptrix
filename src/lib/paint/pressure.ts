import { clamp } from "./color";

/**
 * Normalises pointer pressure.
 *
 * Real styluses report a meaningful `pressure`. Mice and most touch screens
 * report a constant 0.5 (or 0), so we synthesise pressure from stroke speed:
 * fast movement = thin/light, slow movement = thick/dark. The result is
 * smoothed so the stroke doesn't flicker between samples.
 */
export class PressureTracker {
  private smoothed = 0.5;
  private lastX = 0;
  private lastY = 0;
  private lastT = 0;
  private started = false;
  private usesRealPressure = false;

  begin(x: number, y: number, pressure: number, pointerType: string) {
    this.usesRealPressure = pointerType === "pen" && pressure > 0 && pressure !== 0.5;
    this.smoothed = this.usesRealPressure ? clamp(pressure, 0.02, 1) : 0.45;
    this.lastX = x;
    this.lastY = y;
    this.lastT = performance.now();
    this.started = true;
    return this.smoothed;
  }

  next(x: number, y: number, pressure: number, pointerType: string): number {
    if (!this.started) return this.begin(x, y, pressure, pointerType);

    if (pointerType === "pen" && pressure > 0) {
      this.usesRealPressure = true;
      this.smoothed = this.smoothed * 0.4 + clamp(pressure, 0.02, 1) * 0.6;
      this.lastX = x;
      this.lastY = y;
      return this.smoothed;
    }

    const now = performance.now();
    const dt = Math.max(1, now - this.lastT);
    const dist = Math.hypot(x - this.lastX, y - this.lastY);
    this.lastX = x;
    this.lastY = y;
    this.lastT = now;

    // px/ms; ~0.15 is a slow deliberate line, ~2.5 is a fast flick.
    const speed = dist / dt;
    const target = clamp(1 - (speed - 0.15) / 2.2, 0.28, 1);
    this.smoothed = this.smoothed * 0.72 + target * 0.28;
    return this.smoothed;
  }

  end() {
    this.started = false;
  }
}
