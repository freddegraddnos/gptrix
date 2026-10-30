import { useCallback, useEffect, useRef } from "react";
import { hsvToRgb, rgbToHsv } from "@/lib/paint/color";
import type { RGB } from "@/lib/paint/types";

const SIZE = 192;

/** HSV wheel: hue around the circle, saturation from centre to rim. */
export function ColorWheel({
  color,
  onChange,
}: {
  color: RGB;
  onChange: (color: RGB) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);
  const { h, s, v } = rgbToHsv(color);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, SIZE, SIZE);

    const r = SIZE / 2;
    const image = ctx.createImageData(SIZE * dpr, SIZE * dpr);
    for (let py = 0; py < SIZE * dpr; py++) {
      for (let px = 0; px < SIZE * dpr; px++) {
        const x = px / dpr - r;
        const y = py / dpr - r;
        const dist = Math.hypot(x, y);
        const idx = (py * SIZE * dpr + px) * 4;
        if (dist > r) continue;
        const hue = (Math.atan2(y, x) * 180) / Math.PI + 90;
        const sat = Math.min(1, dist / r);
        // The wheel is always drawn at full value; brightness is applied as a
        // CSS filter so a dark colour doesn't black out the whole picker.
        const rgb = hsvToRgb(hue, sat, 1);
        image.data[idx] = rgb.r;
        image.data[idx + 1] = rgb.g;
        image.data[idx + 2] = rgb.b;
        image.data[idx + 3] = dist > r - 1 ? Math.round((r - dist) * 255) : 255;
      }
    }
    ctx.putImageData(image, 0, 0);
  }, []);

  const pick = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const r = rect.width / 2;
      const x = clientX - rect.left - r;
      const y = clientY - rect.top - r;
      const dist = Math.hypot(x, y);
      const hue = (Math.atan2(y, x) * 180) / Math.PI + 90;
      const sat = Math.min(1, dist / r);
      // If the current colour is near-black the wheel would appear to do
      // nothing, so a wheel pick lifts the value into a usable range.
      onChange(hsvToRgb(hue, sat, v < 0.2 ? 1 : v));
    },
    [onChange, v],
  );

  const markerAngle = ((h - 90) * Math.PI) / 180;
  const markerX = SIZE / 2 + Math.cos(markerAngle) * s * (SIZE / 2 - 2);
  const markerY = SIZE / 2 + Math.sin(markerAngle) * s * (SIZE / 2 - 2);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <canvas
          ref={canvasRef}
          className="rounded-full"
          style={{
            width: SIZE,
            height: SIZE,
            touchAction: "none",
            filter: `brightness(${(0.4 + 0.6 * v).toFixed(3)})`,
          }}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) pick(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          onPointerCancel={() => {
            draggingRef.current = false;
          }}
        />
        <span
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
          style={{ left: markerX, top: markerY }}
        />
      </div>

      <label className="w-full">
        <span className="sr-only">Ljushet</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(v * 100)}
          onChange={(e) => onChange(hsvToRgb(h, s, Number(e.target.value) / 100))}
          className="h-3 w-full cursor-pointer appearance-none rounded-full border border-border [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-foreground [&::-webkit-slider-thumb]:bg-transparent"
          style={{
            background: `linear-gradient(to right, #000, rgb(${hsvToRgb(h, s, 1).r},${hsvToRgb(h, s, 1).g},${hsvToRgb(h, s, 1).b}))`,
          }}
        />
      </label>
    </div>
  );
}
