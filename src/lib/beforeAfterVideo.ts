/**
 * "Before/After" video: renders a vertical 9:16 video (1080x1920) in three
 * sequences using Canvas + MediaRecorder — same technique as the recording in
 * Live Try-On.
 *
 *  1. NO TATTOO        ~1.5 s
 *  2. INKSIMULATOR transition ~1.0 s
 *  3. REALISTIC TATTOO ~1.5 s
 *
 * The background music is synthesized in WebAudio (fully royalty-free — no
 * external audio files), and the user can choose between a few preset tracks.
 */

import { pickMimeType, extFor, loadWatermark } from "@/lib/videoRecording";

export const VIDEO_W = 1080;
export const VIDEO_H = 1920;
const FPS = 30;

export const PHASE_MS = { before: 1500, transition: 1000, after: 1500 };
export const TOTAL_MS = PHASE_MS.before + PHASE_MS.transition + PHASE_MS.after;

export type TrackId = "none" | "pulse" | "drift" | "ink" | "heartbeat";

export type MusicTrack = {
  id: TrackId;
  label: string;
  hint: string;
};

export const MUSIC_TRACKS: MusicTrack[] = [
  { id: "pulse", label: "Deep Pulse", hint: "Dark pulse, works great on Reels" },
  { id: "drift", label: "Neon Drift", hint: "Floating synth, calm tempo" },
  { id: "ink", label: "Slow Ink", hint: "Low drone, cinematic" },
  { id: "heartbeat", label: "Heartbeat", hint: "Steady heartbeat" },
  { id: "none", label: "No music", hint: "Silent clip" },
];

/* ------------------------------- musik -------------------------------- */

type AudioRig = {
  ctx: AudioContext;
  stream: MediaStream;
  stop: () => void;
};

function buildMusic(id: TrackId): AudioRig | null {
  if (id === "none") return null;
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
  master.gain.value = 0.0001;
  master.connect(dest);

  const now = ctx.currentTime;
  const end = now + TOTAL_MS / 1000;
  // smooth fade in and out
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.32, now + 0.4);
  master.gain.setValueAtTime(0.32, end - 0.5);
  master.gain.exponentialRampToValueAtTime(0.0001, end);

  const nodes: AudioScheduledSourceNode[] = [];

  const tone = (
    freq: number,
    type: OscillatorType,
    gain: number,
    detune = 0,
  ) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    g.gain.value = gain;
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(end + 0.1);
    nodes.push(osc);
    return { osc, g };
  };

  const pulse = (rateHz: number, target: GainNode, depth = 1) => {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.type = "sine";
    lfo.frequency.value = rateHz;
    lg.gain.value = target.gain.value * depth;
    lfo.connect(lg).connect(target.gain);
    lfo.start(now);
    lfo.stop(end + 0.1);
    nodes.push(lfo);
  };

  if (id === "pulse") {
    const bass = tone(55, "sine", 0.5);
    pulse(2, bass.g, 0.8);
    tone(110, "triangle", 0.12);
    const air = tone(440, "sine", 0.05, 6);
    pulse(0.25, air.g, 0.9);
  } else if (id === "drift") {
    tone(146.83, "sine", 0.22);
    const pad = tone(220, "sawtooth", 0.05, -8);
    const filt = ctx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 700;
    pad.g.disconnect();
    pad.g.connect(filt).connect(master);
    const shimmer = tone(660, "sine", 0.035, 5);
    pulse(0.4, shimmer.g, 0.9);
  } else if (id === "ink") {
    tone(65.41, "sine", 0.42);
    tone(98, "sine", 0.16);
    const hum = tone(196, "triangle", 0.05);
    pulse(0.18, hum.g, 0.95);
  } else if (id === "heartbeat") {
    tone(48, "sine", 0.18);
    const beatGain = ctx.createGain();
    beatGain.gain.value = 0;
    beatGain.connect(master);
    const kick = ctx.createOscillator();
    kick.type = "sine";
    kick.frequency.value = 70;
    kick.connect(beatGain);
    kick.start(now);
    kick.stop(end + 0.1);
    nodes.push(kick);
    // two beats per second-pair, ~72 bpm
    for (let t = now + 0.1; t < end; t += 0.83) {
      for (const off of [0, 0.22]) {
        const at = t + off;
        if (at >= end) break;
        beatGain.gain.setValueAtTime(0.0001, at);
        beatGain.gain.exponentialRampToValueAtTime(off ? 0.5 : 0.9, at + 0.02);
        beatGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
      }
    }
  }

  return {
    ctx,
    stream: dest.stream,
    stop: () => {
      for (const n of nodes) {
        try {
          n.stop();
        } catch {
          /* already stopped */
        }
      }
      void ctx.close().catch(() => undefined);
    },
  };
}

/* ------------------------------ rendering ------------------------------ */

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read the image"));
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  zoom: number,
) {
  const ar = img.width / img.height;
  const target = VIDEO_W / VIDEO_H;
  let dw: number;
  let dh: number;
  if (ar > target) {
    dh = VIDEO_H;
    dw = VIDEO_H * ar;
  } else {
    dw = VIDEO_W;
    dh = VIDEO_W / ar;
  }
  dw *= zoom;
  dh *= zoom;
  ctx.drawImage(img, (VIDEO_W - dw) / 2, (VIDEO_H - dh) / 2, dw, dh);
}

function vignette(ctx: CanvasRenderingContext2D) {
  const g = ctx.createRadialGradient(
    VIDEO_W / 2,
    VIDEO_H / 2,
    VIDEO_H * 0.25,
    VIDEO_W / 2,
    VIDEO_H / 2,
    VIDEO_H * 0.75,
  );
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  accent: boolean,
  alpha: number,
  slide: number,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const y = VIDEO_H * 0.16 + slide;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const size = 92;
  ctx.font = `800 ${size}px "Space Grotesk", system-ui, sans-serif`;
  const w = ctx.measureText(text).width + 90;
  const h = size + 46;
  const x = VIDEO_W / 2 - w / 2;
  ctx.fillStyle = accent ? "rgba(138,91,242,0.18)" : "rgba(10,10,12,0.6)";
  ctx.strokeStyle = accent ? "rgba(138,91,242,0.95)" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = 4;
  const r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y - h / 2);
  ctx.arcTo(x + w, y - h / 2, x + w, y + h / 2, r);
  ctx.arcTo(x + w, y + h / 2, x, y + h / 2, r);
  ctx.arcTo(x, y + h / 2, x, y - h / 2, r);
  ctx.arcTo(x, y - h / 2, x + w, y - h / 2, r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = accent ? "#8A5BF2" : "#ffffff";
  ctx.fillText(text, VIDEO_W / 2, y + 2);
  ctx.restore();
}

function drawCaption(ctx: CanvasRenderingContext2D, caption: string) {
  if (!caption.trim()) return;
  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 54px system-ui, sans-serif`;
  const words = caption.trim().split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > VIDEO_W * 0.82 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const baseY = VIDEO_H * 0.83 - (lines.length - 1) * 34;
  ctx.shadowColor = "rgba(0,0,0,0.85)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "#ffffff";
  lines.slice(0, 3).forEach((l, i) => {
    ctx.fillText(l, VIDEO_W / 2, baseY + i * 68);
  });
  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement | null,
) {
  ctx.save();
  const y = VIDEO_H - 110;
  const size = 76;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  ctx.font = `700 42px "Space Grotesk", system-ui, sans-serif`;
  const label = "INKSIMULATOR";
  const tw = ctx.measureText(label).width;
  const totalW = size + 22 + tw;
  const x = VIDEO_W / 2 - totalW / 2;
  ctx.globalAlpha = 0.9;
  if (logo) ctx.drawImage(logo, x, y - size / 2, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, x + size + 22, y - 8);
  ctx.font = `600 28px system-ui, sans-serif`;
  ctx.fillStyle = "rgba(176,140,255,0.95)";
  ctx.fillText("inksimulator.com", x + size + 22, y + 32);
  ctx.restore();
}

function drawTransition(
  ctx: CanvasRenderingContext2D,
  t: number,
  logo: HTMLImageElement | null,
) {
  // t: 0 → 1 during the transition. Wipe from the top + logo pulsing in.
  ctx.save();
  ctx.fillStyle = "#08080a";
  const wipe = Math.min(1, t / 0.45);
  ctx.fillRect(0, 0, VIDEO_W, VIDEO_H * ease(wipe));
  if (t > 0.65) {
    // wipe out from the bottom towards the after image happens in the main loop
  }
  const appear = Math.min(1, Math.max(0, (t - 0.15) / 0.35));
  const fade = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
  const alpha = ease(appear) * fade;
  if (alpha > 0) {
    const scale = 0.85 + ease(appear) * 0.15;
    const size = 300 * scale;
    ctx.globalAlpha = alpha;
    if (logo) {
      ctx.drawImage(
        logo,
        VIDEO_W / 2 - size / 2,
        VIDEO_H / 2 - size / 2 - 60,
        size,
        size,
      );
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 96px "Space Grotesk", system-ui, sans-serif`;
    ctx.fillText("INKSIMULATOR", VIDEO_W / 2, VIDEO_H / 2 + 180);
    ctx.fillStyle = "rgba(176,140,255,0.95)";
    ctx.font = `600 36px system-ui, sans-serif`;
    ctx.fillText("REALISTIC TATTOO PREVIEW", VIDEO_W / 2, VIDEO_H / 2 + 258);
  }
  ctx.restore();
}

const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export type BeforeAfterOptions = {
  before: HTMLImageElement;
  after: HTMLImageElement;
  caption?: string;
  track?: TrackId;
  onProgress?: (pct: number) => void;
};

export type BeforeAfterResult = { blob: Blob; ext: string; mime: string };

/** Renders the entire clip and returns a finished video file. */
export async function renderBeforeAfterVideo(
  opts: BeforeAfterOptions,
): Promise<BeforeAfterResult> {
  const mime = pickMimeType();
  if (!mime) throw new Error("Your browser does not support video recording.");

  const logo = await loadWatermark();
  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas could not be initialized.");

  const stream = canvas.captureStream(FPS);
  const music = buildMusic(opts.track ?? "none");
  if (music) {
    for (const track of music.stream.getAudioTracks()) stream.addTrack(track);
  }

  const recorder = new MediaRecorder(stream, {
    mimeType: mime,
    videoBitsPerSecond: 6_000_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime }));
  });

  recorder.start(100);
  const start = performance.now();

  await new Promise<void>((resolve) => {
    const frame = () => {
      const elapsed = performance.now() - start;
      const t = Math.min(elapsed, TOTAL_MS);
      opts.onProgress?.(Math.round((t / TOTAL_MS) * 100));

      ctx.fillStyle = "#08080a";
      ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

      if (t < PHASE_MS.before) {
        const p = t / PHASE_MS.before;
        drawCover(ctx, opts.before, 1.02 + p * 0.03);
        vignette(ctx);
        drawLabel(ctx, "NO TATTOO", false, Math.min(1, p * 6), (1 - ease(Math.min(1, p * 4))) * -40);
        drawCaption(ctx, opts.caption ?? "");
        drawFooter(ctx, logo);
      } else if (t < PHASE_MS.before + PHASE_MS.transition) {
        const p = (t - PHASE_MS.before) / PHASE_MS.transition;
        // during the second half the after image starts to appear
        if (p < 0.55) {
          drawCover(ctx, opts.before, 1.05);
        } else {
          drawCover(ctx, opts.after, 1.05);
        }
        vignette(ctx);
        drawTransition(ctx, p, logo);
        drawFooter(ctx, logo);
      } else {
        const p = Math.min(1, (t - PHASE_MS.before - PHASE_MS.transition) / PHASE_MS.after);
        drawCover(ctx, opts.after, 1.05 - p * 0.03);
        vignette(ctx);
        drawLabel(ctx, "REALISTIC TATTOO", true, Math.min(1, p * 6), (1 - ease(Math.min(1, p * 4))) * 40);
        drawCaption(ctx, opts.caption ?? "");
        drawFooter(ctx, logo);
      }

      if (elapsed >= TOTAL_MS) {
        resolve();
        return;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  // Let the last frame make it into the stream
  await new Promise((r) => setTimeout(r, 180));
  recorder.stop();
  const blob = await done;
  music?.stop();
  for (const track of stream.getTracks()) track.stop();
  opts.onProgress?.(100);

  return { blob, ext: extFor(mime), mime };
}

/* --------------------------- handoff ------------------------------- */

export const BEFORE_AFTER_KEY = "inkvision.beforeafter.v1";

export type BeforeAfterHandoff = {
  before: string;
  after: string;
  caption?: string;
};

export function stashBeforeAfter(data: BeforeAfterHandoff) {
  try {
    sessionStorage.setItem(BEFORE_AFTER_KEY, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function takeBeforeAfter(): BeforeAfterHandoff | null {
  try {
    const raw = sessionStorage.getItem(BEFORE_AFTER_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(BEFORE_AFTER_KEY);
    return JSON.parse(raw) as BeforeAfterHandoff;
  } catch {
    return null;
  }
}
