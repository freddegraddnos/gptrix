import { useEffect, useRef } from "react";
import type { FlowLock } from "@/lib/flowLock";

/**
 * Hidden computer-vision debug view.
 *
 * Draws the raw state the AR pipeline is actually working from, straight over
 * the camera feed:
 *  - the cylinder proxy used by the body wrap, as a wireframe on the limb
 *  - a dot at every feature point the optical-flow lock is currently tracking
 *  - the skin/limb segmentation mask, tinted translucent
 *  - tracked-point count and FPS as text in the corner
 *
 * This is a diagnostic layer only: it never changes the render, so what you
 * see here is the truth about the tracker, not a second interpretation of it.
 */
export function CVDebugOverlay({
  videoRef,
  stageRef,
  flowRef,
  mirrored,
  transform,
  curve,
  curveConf,
  designWidthPx,
  locked,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stageRef: React.RefObject<HTMLDivElement | null>;
  flowRef: React.RefObject<FlowLock | null>;
  mirrored: boolean;
  transform: { x: number; y: number; scale: number; rotation: number };
  curve: number;
  curveConf: number;
  designWidthPx: number;
  locked: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const state = useRef({ mirrored, transform, curve, curveConf, designWidthPx, locked });
  state.current = { mirrored, transform, curve, curveConf, designWidthPx, locked };

  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let fpsAt = performance.now();
    let fps = 0;

    // Small offscreen buffer for the segmentation pass — cheap enough to run
    // every frame at this resolution.
    const seg = document.createElement("canvas");
    seg.width = 96;
    seg.height = 128;
    const segCtx = seg.getContext("2d", { willReadFrequently: true });

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      const video = videoRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !stage || !video) return;

      const rect = stage.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      frames++;
      const now = performance.now();
      if (now - fpsAt >= 500) {
        fps = Math.round((frames * 1000) / (now - fpsAt));
        frames = 0;
        fpsAt = now;
      }

      const s = state.current;
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // --- 1. Segmentation mask (skin / limb), tinted translucent ----------
      let coverage = 0;
      if (segCtx && vw && vh && video.readyState >= 2) {
        try {
          segCtx.drawImage(video, 0, 0, seg.width, seg.height);
          const img = segCtx.getImageData(0, 0, seg.width, seg.height);
          const d = img.data;
          let hits = 0;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i];
            const g = d[i + 1];
            const b = d[i + 2];
            // YCbCr skin gate — the same broad rule the wrap pipeline assumes
            // when it looks for the limb silhouette.
            const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
            const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
            const y = 0.299 * r + 0.587 * g + 0.114 * b;
            const skin =
              y > 40 && cb > 77 && cb < 133 && cr > 133 && cr < 180 && r > g && r > b;
            if (skin) {
              hits++;
              d[i] = 0;
              d[i + 1] = 242;
              d[i + 2] = 255;
              d[i + 3] = 90;
            } else {
              d[i + 3] = 0;
            }
          }
          coverage = hits / (seg.width * seg.height);
          segCtx.putImageData(img, 0, 0);
          ctx.save();
          if (s.mirrored) {
            ctx.translate(w, 0);
            ctx.scale(-1, 1);
          }
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(seg, 0, 0, w, h);
          ctx.restore();
        } catch {
          /* frame not readable yet */
        }
      }

      // --- 2. Cylinder proxy wireframe -------------------------------------
      const cx = w / 2 + s.transform.x;
      const cy = h / 2 + s.transform.y;
      const halfW = (s.designWidthPx * s.transform.scale) / 2;
      const halfH = halfW * 1.25;
      const bulge = Math.max(0.05, s.curve) * halfW * 0.55;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((s.transform.rotation * Math.PI) / 180);
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(138,91,242,0.85)";

      // End caps: ellipses whose width is the cylinder's projected roundness.
      for (const y of [-halfH, halfH]) {
        ctx.beginPath();
        ctx.ellipse(0, y, halfW, bulge, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Silhouette edges.
      ctx.beginPath();
      ctx.moveTo(-halfW, -halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.moveTo(halfW, -halfH);
      ctx.lineTo(halfW, halfH);
      ctx.stroke();
      // Longitudinal rings, spaced by the cylindrical projection so the
      // spacing itself shows how much foreshortening is being applied.
      ctx.strokeStyle = "rgba(138,91,242,0.35)";
      for (let i = 1; i <= 6; i++) {
        const u = -1 + (2 * i) / 7; // -1..1 across the cylinder
        const x = u * halfW;
        const depth = Math.sqrt(Math.max(0, 1 - u * u));
        ctx.beginPath();
        ctx.moveTo(x, -halfH);
        ctx.lineTo(x, halfH);
        ctx.stroke();
        // Depth tick at the top cap.
        ctx.beginPath();
        ctx.moveTo(x, -halfH);
        ctx.lineTo(x, -halfH - depth * bulge);
        ctx.stroke();
      }
      ctx.restore();

      // --- 3. Tracked feature points ---------------------------------------
      const flow = flowRef.current;
      const pts = flow?.points() ?? null;
      let count = 0;
      if (pts && vw && vh) {
        const sc = Math.max(w / vw, h / vh);
        const offX = (w - vw * sc) / 2;
        const offY = (h - vh * sc) / 2;
        ctx.fillStyle = "rgba(255,64,129,0.95)";
        for (let i = 0; i < pts.length; i += 2) {
          let px = pts[i] * sc + offX;
          const py = pts[i + 1] * sc + offY;
          if (s.mirrored) px = w - px;
          ctx.beginPath();
          ctx.arc(px, py, 1.8, 0, Math.PI * 2);
          ctx.fill();
          count++;
        }
        // The locked search region.
        const reg = flow?.region;
        if (reg) {
          const rw = reg.w * sc;
          const rh = reg.h * sc;
          let rx = reg.cx * sc + offX;
          const ry = reg.cy * sc + offY;
          if (s.mirrored) rx = w - rx;
          ctx.strokeStyle = "rgba(255,64,129,0.6)";
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(rx - rw / 2, ry - rh / 2, rw, rh);
          ctx.setLineDash([]);
        }
      }

      // --- 4. Text readout ---------------------------------------------------
      const lines = [
        `FPS ${fps}`,
        `PTS ${count}${flow ? (flow.ready ? " (flow)" : " (warming)") : " (unlocked)"}`,
        `LOCK ${s.locked ? "on" : "off"}`,
        `CURVE ${s.curve.toFixed(2)} conf ${s.curveConf.toFixed(2)}`,
        `MASK ${(coverage * 100).toFixed(0)}% skin`,
        `SCALE ${s.transform.scale.toFixed(3)} ROT ${s.transform.rotation.toFixed(1)}`,
        `VIDEO ${vw}x${vh}${s.mirrored ? " mirrored" : ""}`,
      ];
      ctx.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline = "top";
      const boxW = 190;
      const boxH = lines.length * 14 + 10;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(8, 92, boxW, boxH);
      ctx.strokeStyle = "rgba(138,91,242,0.5)";
      ctx.strokeRect(8, 92, boxW, boxH);
      ctx.fillStyle = "rgba(138,91,242,0.95)";
      lines.forEach((l, i) => ctx.fillText(l, 15, 98 + i * 14));
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [videoRef, stageRef, flowRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-40"
    />
  );
}
