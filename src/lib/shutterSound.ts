// Optional mechanical shutter sound for photo capture. Off by default —
// the user enables it from the AR menu. WebAudio only, no assets.

const KEY = "inkvision.shutterSound.v1";

export function isShutterSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setShutterSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* storage unavailable — sound just stays session-local */
  }
}

let ctx: AudioContext | null = null;

/** Short mechanical camera click — two filtered noise bursts. */
export function playShutter(): void {
  if (!isShutterSoundEnabled()) return;
  try {
    ctx ??= new (window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext!)();
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime;

    const click = (when: number, freq: number, gain: number, dur: number) => {
      const len = Math.max(1, Math.floor(ctx!.sampleRate * dur));
      const buf = ctx!.createBuffer(1, len, ctx!.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
      }
      const src = ctx!.createBufferSource();
      src.buffer = buf;
      const bp = ctx!.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = freq;
      bp.Q.value = 1.2;
      const g = ctx!.createGain();
      g.gain.setValueAtTime(gain, when);
      g.gain.exponentialRampToValueAtTime(0.001, when + dur);
      src.connect(bp).connect(g).connect(ctx!.destination);
      src.start(when);
    };

    // Open + close of a focal-plane shutter, ~90ms apart.
    click(t0, 2600, 0.28, 0.045);
    click(t0 + 0.09, 1800, 0.2, 0.05);
  } catch {
    /* audio is a nicety */
  }
}
