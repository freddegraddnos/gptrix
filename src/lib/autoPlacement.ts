/**
 * Automatic placement measurement for booking photos. Browser-only.
 *
 * Scale comes from the customer's own body: when both the try-on photo (with
 * motif) and the clean photo exist, the pixels that differ are the motif. Its
 * known width in cm on that exact photo gives px/cm at the skin, so distances
 * to the customer's real joints are measured, not looked up from averages.
 * Works on any body area where pose joints are visible.
 */
const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

export type AutoPlacement = { annotated: string; summary: string; verified: boolean };

const JOINTS: Record<number, string> = {
  0: "nose",
  11: "left shoulder",
  12: "right shoulder",
  13: "left elbow",
  14: "right elbow",
  15: "left wrist",
  16: "right wrist",
  23: "left hip",
  24: "right hip",
  25: "left knee",
  26: "right knee",
  27: "left ankle",
  28: "right ankle",
  31: "left foot",
  32: "right foot",
};

// Fallback only (no motif reference in the photo): typical segment lengths.
const FALLBACK: Record<string, { a: [number, number]; b: [number, number]; cm: number }> = {
  Forearm: { a: [13, 14], b: [15, 16], cm: 26 },
  "Upper arm": { a: [11, 12], b: [13, 14], cm: 30 },
  Thigh: { a: [23, 24], b: [25, 26], cm: 43 },
  Calf: { a: [25, 26], b: [27, 28], cm: 40 },
};

let landmarker: Promise<any> | null = null;
function getLandmarker() {
  landmarker ??= (async () => {
    const vision = await import("@mediapipe/tasks-vision");
    const fs = await vision.FilesetResolver.forVisionTasks(WASM);
    return vision.PoseLandmarker.createFromOptions(fs, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: "IMAGE",
      numPoses: 1,
    });
  })();
  return landmarker;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

type P = { x: number; y: number };

/** Motif pixels = where the try-on photo differs from the clean photo. */
function motifPoints(withT: HTMLImageElement, clean: HTMLImageElement, w: number, h: number): P[] {
  if (Math.abs(withT.width / withT.height - clean.width / clean.height) > 0.02) return [];
  const read = (img: HTMLImageElement) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const x = c.getContext("2d", { willReadFrequently: true })!;
    x.drawImage(img, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
  };
  const a = read(withT);
  const b = read(clean);
  const pts: P[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
      if (d > 60) pts.push({ x, y });
    }
  // Too few/too many differing pixels = not a clean motif-only difference.
  const frac = pts.length / (w * h);
  return frac > 0.0015 && frac < 0.5 ? pts : [];
}

/** Width of the point cloud across its principal axis pair (largest extent). */
function extent(pts: P[]) {
  let mx = 0, my = 0;
  for (const p of pts) { mx += p.x; my += p.y; }
  mx /= pts.length; my /= pts.length;
  let xx = 0, yy = 0, xy = 0;
  for (const p of pts) { const dx = p.x - mx, dy = p.y - my; xx += dx * dx; yy += dy * dy; xy += dx * dy; }
  const ang = 0.5 * Math.atan2(2 * xy, xx - yy);
  const u = { x: Math.cos(ang), y: Math.sin(ang) };
  const v = { x: -u.y, y: u.x };
  const range = (d: P) => {
    const s = pts.map((p) => (p.x - mx) * d.x + (p.y - my) * d.y).sort((q, r) => q - r);
    // Robust: 2nd–98th percentile.
    return s[Math.floor(s.length * 0.98)] - s[Math.floor(s.length * 0.02)];
  };
  return { cx: mx, cy: my, width: Math.max(range(u), range(v)) };
}

export async function measurePlacement(
  src: string,
  bodyArea: string,
  sizeCm: number,
  calibrated: boolean,
  cleanSrc?: string | null,
): Promise<AutoPlacement | null> {
  if (!(sizeCm > 0)) return null;
  const img = await loadImage(src);
  const clean = cleanSrc && cleanSrc !== src ? await loadImage(cleanSrc).catch(() => null) : null;
  const lm = await getLandmarker();
  const marks = lm.detect(clean ?? img)?.landmarks?.[0] as
    | { x: number; y: number; visibility?: number }[]
    | undefined;
  if (!marks) return null;

  const scale = Math.min(1, 1400 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);

  // Diff at reduced resolution, then map back to canvas pixels.
  const dw = 320;
  const dh = Math.round((dw * c.height) / c.width);
  const k = c.width / dw;
  const pts = clean ? motifPoints(img, clean, dw, dh).map((p) => ({ x: p.x * k, y: p.y * k })) : [];

  const joints = Object.entries(JOINTS)
    .map(([i, name]) => ({ name, m: marks[Number(i)] }))
    .filter((j) => j.m && (j.m.visibility ?? 1) > 0.5 && j.m.x >= 0 && j.m.x <= 1 && j.m.y >= 0 && j.m.y <= 1)
    .map((j) => ({ name: j.name, x: j.m.x * c.width, y: j.m.y * c.height }));

  const u = c.width / 400;
  ctx.lineWidth = 3 * u;
  ctx.font = `bold ${14 * u}px monospace`;
  const label = (t: string, x: number, y: number) => {
    const w = ctx.measureText(t).width + 12 * u;
    x = Math.min(Math.max(4, x), c.width - w - 4);
    ctx.fillStyle = "rgba(22,22,22,0.85)";
    ctx.fillRect(x, y - 16 * u, w, 22 * u);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(t, x + 6 * u, y);
  };

  let lines: string[] = [];
  let ownBody = false;

  if (pts.length > 50 && joints.length) {
    // Own-body scale from the motif itself.
    const e = extent(pts);
    const pxPerCm = e.width / sizeCm;
    if (pxPerCm > 0.5) {
      ownBody = true;
      const sample = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 1500)) === 0);
      const near = joints
        .map((j) => {
          let best = Infinity, bp: P = { x: e.cx, y: e.cy };
          for (const p of sample) {
            const d = Math.hypot(p.x - j.x, p.y - j.y);
            if (d < best) { best = d; bp = p; }
          }
          return { ...j, px: best, from: bp };
        })
        .filter((j) => j.px > 2)
        .sort((a, b) => a.px - b.px)
        .slice(0, 2);
      ctx.strokeStyle = "#8b5cf6";
      ctx.strokeRect(e.cx - e.width / 2, e.cy - e.width / 2, e.width, e.width);
      label(`${sizeCm} cm`, e.cx - e.width / 2, e.cy - e.width / 2 - 6 * u);
      ctx.strokeStyle = "#ffffff";
      ctx.setLineDash([8 * u, 6 * u]);
      for (const j of near) {
        const cm = j.px / pxPerCm;
        ctx.beginPath();
        ctx.moveTo(j.from.x, j.from.y);
        ctx.lineTo(j.x, j.y);
        ctx.stroke();
        label(`${cm.toFixed(1)} cm → ${j.name}`, (j.from.x + j.x) / 2 + 10 * u, (j.from.y + j.y) / 2);
        lines.push(`${cm.toFixed(1)} cm from the ${j.name}`);
      }
      ctx.setLineDash([]);
    }
  }

  if (!ownBody) {
    const seg = FALLBACK[bodyArea];
    if (!seg) return null;
    const v = (i: number) => marks[i]?.visibility ?? 0;
    const side = v(seg.a[0]) + v(seg.b[0]) >= v(seg.a[1]) + v(seg.b[1]) ? 0 : 1;
    const A = marks[seg.a[side]], B = marks[seg.b[side]];
    if (!A || !B) return null;
    const a = { x: A.x * c.width, y: A.y * c.height };
    const b = { x: B.x * c.width, y: B.y * c.height };
    const segPx = Math.hypot(b.x - a.x, b.y - a.y);
    if (segPx < 10) return null;
    const ux = (b.x - a.x) / segPx, uy = (b.y - a.y) / segPx;
    const motifPx = Math.min(segPx, (sizeCm * segPx) / seg.cm);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const m1 = { x: mid.x + (ux * motifPx) / 2, y: mid.y + (uy * motifPx) / 2 };
    const dist = Math.max(0, (seg.cm - Math.min(sizeCm, seg.cm)) / 2);
    const jn = JOINTS[seg.b[side]];
    ctx.strokeStyle = "#8b5cf6";
    ctx.beginPath();
    ctx.moveTo(mid.x - (ux * motifPx) / 2, mid.y - (uy * motifPx) / 2);
    ctx.lineTo(m1.x, m1.y);
    ctx.stroke();
    label(`${sizeCm} cm`, mid.x + 10 * u, mid.y);
    label(`~${dist.toFixed(1)} cm → ${jn}`, (m1.x + b.x) / 2 + 10 * u, (m1.y + b.y) / 2);
    lines = [`~${dist.toFixed(1)} cm from the ${jn}`];
  }

  const verified = ownBody && calibrated;
  const tag = ownBody
    ? calibrated
      ? "Measured on customer's body"
      : "Measured on customer's body — camera not calibrated"
    : "Rough estimate — average limb length, no motif in photo";
  label(tag, 8 * u, 24 * u);

  return {
    annotated: c.toDataURL("image/jpeg", 0.88),
    summary: `Motif ${sizeCm} cm · ${lines.join(" · ")} (${tag})`,
    verified,
  };
}
