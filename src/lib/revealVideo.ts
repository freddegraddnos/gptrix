/**
 * "Tattoo Reveal" — countdown + reveal animation rendered on a canvas and
 * recorded automatically with MediaRecorder (same technique as Live Try-On
 * and the Before/After video), so the user doesn't need to screen-record.
 *
 *  1. "YOUR INKSIMULATOR" + countdown 3 … 2 … 1   (~2.4 s)
 *  2. REVEAL — the tattoo animates in          (~1.2 s)
 *  3. Hold with caption + InkSimulator logo       (~1.6 s)
 */

import { pickMimeType, extFor, loadWatermark } from "@/lib/videoRecording";

export const REVEAL_W = 1080;
export const REVEAL_H = 1920;
const FPS = 30;

export const COUNT_STEP_MS = 800;
export const PHASES = {
  countdown: COUNT_STEP_MS * 3,
  reveal: 1200,
  hold: 1600,
};
export const REVEAL_TOTAL_MS =
  PHASES.countdown + PHASES.reveal + PHASES.hold;

export type RevealStyle = "wipe" | "fade" | "glow";

export const REVEAL_STYLES: { id: RevealStyle; label: string; hint: string }[] = [
  { id: "wipe", label: "Wipe", hint: "Wipes in from the left" },
  { id: "fade", label: "Fade", hint: "Soft fade-in with a slight zoom" },
  { id: "glow", label: "Glow", hint: "Flash of neon, the motif snaps in" },
];

export type RevealPlacement = {
  /** 0–1 of image width/height */
  x: number;
  y: number;
  /** motivbredd som andel av bildbredden */
  scale: number;
  /** grader */
  rotation: number;
};

export const DEFAULT_PLACEMENT: RevealPlacement = {
  x: 0.5,
  y: 0.5,
  scale: 0.42,
  rotation: 0,
};

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeOutBack = (t: number) => {
  const c = 1.70158;
  const p = Math.min(1, Math.max(0, t)) - 1;
  return 1 + (c + 1) * p * p * p + c * p * p;
};

export function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

/* --------------------------------- audio -------------------------------- */

type AudioRig = { stream: MediaStream; stop: () => void };

function buildRevealAudio(): AudioRig | null {
  const Ctor =
    typeof window !== "undefined"
      ? window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      : undefined;
  if (!Ctor) return null;
  const ctx = new Ctor();
  const dest = ctx.createMediaStreamDestination();
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(dest);
  // audible even without recording
  master.connect(ctx.destination);

  const now = ctx.currentTime;

  const blip = (at: number, freq: number, dur: number, gain: number) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, at);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(master);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  // countdown: three clicks, last one brighter
  for (let i = 0; i < 3; i++) {
    const at = now + (i * COUNT_STEP_MS) / 1000;
    blip(at, i === 2 ? 880 : 620, 0.18, 0.35);
  }

  // reveal: whoosh (brus genom bandpass) + bass drop
  const revealAt = now + PHASES.countdown / 1000;
  const len = Math.floor(ctx.sampleRate * 0.9);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(400, revealAt);
  bp.frequency.exponentialRampToValueAtTime(4200, revealAt + 0.5);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.45, revealAt);
  ng.gain.exponentialRampToValueAtTime(0.0001, revealAt + 0.85);
  noise.connect(bp).connect(ng).connect(master);
  noise.start(revealAt);

  const sub = ctx.createOscillator();
  const sg = ctx.createGain();
  sub.type = "sine";
  sub.frequency.setValueAtTime(160, revealAt);
  sub.frequency.exponentialRampToValueAtTime(45, revealAt + 0.6);
  sg.gain.setValueAtTime(0.0001, revealAt);
  sg.gain.exponentialRampToValueAtTime(0.7, revealAt + 0.05);
  sg.gain.exponentialRampToValueAtTime(0.0001, revealAt + 1.1);
  sub.connect(sg).connect(master);
  sub.start(revealAt);
  sub.stop(revealAt + 1.2);

  return {
    stream: dest.stream,
    stop: () => {
      try {
        noise.stop();
      } catch {
        /* already stopped */
      }
      void ctx.close().catch(() => undefined);
    },
  };
}

/* ------------------------------ draw functions --------------------------- */

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  zoom = 1,
) {
  const ar = img.width / img.height;
  const target = REVEAL_W / REVEAL_H;
  let dw: number;
  let dh: number;
  if (ar > target) {
    dh = REVEAL_H;
    dw = REVEAL_H * ar;
  } else {
    dw = REVEAL_W;
    dh = REVEAL_W / ar;
  }
  dw *= zoom;
  dh *= zoom;
  ctx.drawImage(img, (REVEAL_W - dw) / 2, (REVEAL_H - dh) / 2, dw, dh);
}

function drawMotif(
  ctx: CanvasRenderingContext2D,
  motif: HTMLImageElement,
  p: RevealPlacement,
  opts: { alpha: number; scale: number; clipX?: number; glow?: number },
) {
  const w = REVEAL_W * p.scale * opts.scale;
  const h = (w * motif.height) / motif.width;
  ctx.save();
  if (opts.clipX !== undefined) {
    ctx.beginPath();
    ctx.rect(0, 0, REVEAL_W * opts.clipX, REVEAL_H);
    ctx.clip();
  }
  ctx.translate(REVEAL_W * p.x, REVEAL_H * p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.globalAlpha = opts.alpha;
  if (opts.glow) {
    ctx.shadowColor = "rgba(34,211,238,0.9)";
    ctx.shadowBlur = 80 * opts.glow;
  }
  ctx.globalCompositeOperation = "multiply";
  ctx.drawImage(motif, -w / 2, -h / 2, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = opts.alpha * 0.35;
  ctx.drawImage(motif, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawHeadline(ctx: CanvasRenderingContext2D, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 30;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 118px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText("YOUR", REVEAL_W / 2, REVEAL_H * 0.17);
  ctx.fillStyle = "#8A5BF2";
  ctx.fillText("INKSIMULATOR", REVEAL_W / 2, REVEAL_H * 0.17 + 130);
  ctx.restore();
}

function drawCount(ctx: CanvasRenderingContext2D, n: number, t: number) {
  const pop = easeOutBack(Math.min(1, t / 0.35));
  const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, fade);
  ctx.translate(REVEAL_W / 2, REVEAL_H / 2);
  ctx.scale(0.7 + pop * 0.6, 0.7 + pop * 0.6);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // ring
  ctx.strokeStyle = "rgba(34,211,238,0.9)";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.arc(0, 0, 190, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - t));
  ctx.stroke();
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 40;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 260px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText(String(n), 0, 14);
  ctx.restore();
}

function drawRevealWord(ctx: CanvasRenderingContext2D, t: number) {
  const alpha = t < 0.2 ? t / 0.2 : t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#8A5BF2";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 30;
  ctx.font = `800 96px "Space Grotesk", system-ui, sans-serif`;
  ctx.fillText("REVEAL", REVEAL_W / 2, REVEAL_H * 0.17);
  ctx.restore();
}

function drawCaption(ctx: CanvasRenderingContext2D, caption: string, alpha: number) {
  if (!caption.trim()) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 56px system-ui, sans-serif`;
  const words = caption.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > REVEAL_W * 0.82 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const baseY = REVEAL_H * 0.84 - (lines.length - 1) * 34;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffffff";
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, REVEAL_W / 2, baseY + i * 70));
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, logo: HTMLImageElement | null) {
  ctx.save();
  const y = REVEAL_H - 110;
  const size = 76;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 42px "Space Grotesk", system-ui, sans-serif`;
  const label = "INKSIMULATOR";
  const tw = ctx.measureText(label).width;
  const totalW = size + 22 + tw;
  const x = REVEAL_W / 2 - totalW / 2;
  ctx.globalAlpha = 0.9;
  if (logo) ctx.drawImage(logo, x, y - size / 2, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x + size + 22, y - 8);
  ctx.font = `600 28px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(34,211,238,0.95)";
  ctx.fillText("inksimulator.com", x + size + 22, y + 32);
  ctx.restore();
}

/* -------------------------------- execution ------------------------------- */

export type RevealPhase = "countdown" | "reveal" | "hold" | "done";

export type RevealOptions = {
  /** Visible canvas — set to size REVEAL_W x REVEAL_H and scaled with CSS. */
  canvas: HTMLCanvasElement;
  photo: HTMLImageElement;
  motif: HTMLImageElement;
  placement: RevealPlacement;
  style?: RevealStyle;
  caption?: string;
  sound?: boolean;
  record?: boolean;
  onPhase?: (phase: RevealPhase, count: number) => void;
  onProgress?: (pct: number) => void;
};

export type RevealResult = { blob: Blob; ext: string; mime: string } | null;

/** Plays the full reveal sequence live and records it at the same time. */
export async function runReveal(opts: RevealOptions): Promise<RevealResult> {
  const {
    canvas,
    photo,
    motif,
    placement,
    style = "wipe",
    caption = "",
    sound = true,
    record = true,
  } = opts;

  canvas.width = REVEAL_W;
  canvas.height = REVEAL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas could not be initialized.");

  const logo = await loadWatermark();

  const mime = record ? pickMimeType() : null;
  const audio = sound ? buildRevealAudio() : null;

  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  const chunks: BlobPart[] = [];
  let done: Promise<Blob> | null = null;

  if (record && mime) {
    stream = canvas.captureStream(FPS);
    if (audio) {
      for (const t of audio.stream.getAudioTracks()) stream.addTrack(t);
    }
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 6_000_000,
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    done = new Promise<Blob>((resolve) => {
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mime }));
    });
    recorder.start(100);
  }

  const start = performance.now();
  let lastPhase: RevealPhase | null = null;
  let lastCount = -1;

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed, REVEAL_TOTAL_MS);
      opts.onProgress?.(Math.round((t / REVEAL_TOTAL_MS) * 100));

      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, REVEAL_W, REVEAL_H);

      if (t < PHASES.countdown) {
        // ---------- countdown ----------
        const idx = Math.floor(t / COUNT_STEP_MS);
        const local = (t % COUNT_STEP_MS) / COUNT_STEP_MS;
        drawCover(ctx, photo, 1 + 0.02 * (t / PHASES.countdown));
        ctx.fillStyle = "rgba(4,4,6,0.45)";
        ctx.fillRect(0, 0, REVEAL_W, REVEAL_H);
        drawHeadline(ctx, 1);
        drawCount(ctx, 3 - idx, local);
        if (lastPhase !== "countdown" || lastCount !== 3 - idx) {
          lastPhase = "countdown";
          lastCount = 3 - idx;
          opts.onPhase?.("countdown", 3 - idx);
        }
      } else if (t < PHASES.countdown + PHASES.reveal) {
        // ---------- reveal ----------
        const p = (t - PHASES.countdown) / PHASES.reveal;
        const e = ease(p);
        drawCover(ctx, photo, 1.02 - 0.02 * e);
        if (style === "wipe") {
          drawMotif(ctx, motif, placement, {
            alpha: 1,
            scale: 1,
            clipX: e,
            glow: 1 - e,
          });
          // light streak along the wipe edge
          const x = REVEAL_W * e;
          const g = ctx.createLinearGradient(x - 70, 0, x + 20, 0);
          g.addColorStop(0, "rgba(34,211,238,0)");
          g.addColorStop(1, "rgba(34,211,238,0.5)");
          ctx.save();
          ctx.globalAlpha = 1 - p * 0.6;
          ctx.fillStyle = g;
          ctx.fillRect(x - 70, 0, 90, REVEAL_H);
          ctx.restore();
        } else if (style === "fade") {
          drawMotif(ctx, motif, placement, {
            alpha: e,
            scale: 1.12 - 0.12 * e,
          });
        } else {
          drawMotif(ctx, motif, placement, {
            alpha: Math.min(1, e * 1.4),
            scale: easeOutBack(p),
            glow: 1 - e,
          });
          if (p < 0.25) {
            ctx.save();
            ctx.globalAlpha = (0.25 - p) * 1.6;
            ctx.fillStyle = "#e6feff";
            ctx.fillRect(0, 0, REVEAL_W, REVEAL_H);
            ctx.restore();
          }
        }
        drawRevealWord(ctx, p);
        if (lastPhase !== "reveal") {
          lastPhase = "reveal";
          opts.onPhase?.("reveal", 0);
        }
      } else {
        // ---------- hold ----------
        const p = (t - PHASES.countdown - PHASES.reveal) / PHASES.hold;
        drawCover(ctx, photo, 1 + 0.015 * p);
        drawMotif(ctx, motif, placement, { alpha: 1, scale: 1 });
        drawCaption(ctx, caption, Math.min(1, p * 4));
        drawFooter(ctx, logo);
        if (lastPhase !== "hold") {
          lastPhase = "hold";
          opts.onPhase?.("hold", 0);
        }
      }

      if (elapsed >= REVEAL_TOTAL_MS) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  opts.onPhase?.("done", 0);

  let result: RevealResult = null;
  if (recorder && done && mime) {
    // small tail so the last frame makes it in
    await new Promise((r) => setTimeout(r, 250));
    recorder.stop();
    const blob = await done;
    result = { blob, ext: extFor(mime), mime };
  }
  for (const t of stream?.getTracks() ?? []) t.stop();
  audio?.stop();
  opts.onProgress?.(100);
  return result;
}

/** Draws a static preview (placement mode). */
export function drawPreview(
  canvas: HTMLCanvasElement,
  photo: HTMLImageElement,
  motif: HTMLImageElement | null,
  placement: RevealPlacement,
  showMotif: boolean,
) {
  canvas.width = REVEAL_W;
  canvas.height = REVEAL_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#08080a";
  ctx.fillRect(0, 0, REVEAL_W, REVEAL_H);
  drawCover(ctx, photo);
  if (motif && showMotif) {
    drawMotif(ctx, motif, placement, { alpha: 0.9, scale: 1 });
  }
}

/** Captures the last frame as PNG (for sharing as a still image). */
export function snapshot(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL("image/png");
}
