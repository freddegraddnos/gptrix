/**
 * MediaPipe AR engine core: Pose (limb tracking) + Selfie Segmentation (skin mask).
 * Browser-only — call createMpEngine() from an effect.
 */
const POSE_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/";

export type MpLandmark = { x: number; y: number; z: number; visibility?: number };
export type MpFrame = {
  pose: MpLandmark[] | null;
  mask: CanvasImageSource | null;
  width: number;
  height: number;
};

export type MpEngine = {
  start: (video: HTMLVideoElement, facing?: "environment" | "user") => Promise<void>;
  stop: () => void;
  latest: () => MpFrame;
};

export async function createMpEngine(onFrame?: (f: MpFrame) => void): Promise<MpEngine> {
  const loadScript = (url: string) => new Promise<void>((res, rej) => {
    if (document.querySelector(`script[src="${url}"]`)) return res();
    const el = document.createElement("script");
    el.src = url; el.crossOrigin = "anonymous";
    el.onload = () => res(); el.onerror = () => rej(new Error("Failed to load " + url));
    document.head.appendChild(el);
  });
  await loadScript(POSE_ROOT + "pose.js");
  const { Pose } = window as unknown as { Pose: typeof import("@mediapipe/pose").Pose };
  if (!Pose) throw new Error("MediaPipe scripts unavailable");

  const pose = new Pose({ locateFile: (f: string) => POSE_ROOT + f });
  pose.setOptions({ modelComplexity: 1, smoothLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5, enableSegmentation: true, smoothSegmentation: true });

  const frame: MpFrame = { pose: null, mask: null, width: 0, height: 0 };
  // Body mask comes from Pose (enableSegmentation): the legacy Selfie Segmentation build clashes with Pose in one page.
  pose.onResults((r) => { frame.pose = (r.poseLandmarks as MpLandmark[] | undefined) ?? null; frame.mask = r.segmentationMask ?? null; });

  await pose.initialize();

  // Own camera loop (instead of camera_utils): flexible constraints for portrait phones,
  // inline/muted playback for iOS Safari, and graceful fallback for Android/desktop.
  let stream: MediaStream | null = null;
  let raf = 0;
  let running = false;
  return {
    async start(video, facing = "environment") {
      const ask = (c: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(c);
      stream = await ask({
        video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      }).catch(() => ask({ video: true, audio: false }));
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "");
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await new Promise<void>((res) => {
        if (video.readyState >= 1) return res();
        video.onloadedmetadata = () => res();
      });
      await video.play().catch((e: Error) => { if (e.name !== "AbortError") throw e; });
      running = true;
      let busy = false;
      const tick = async () => {
        if (!running) return;
        if (!busy && video.readyState >= 2 && video.videoWidth) {
          busy = true;
          frame.width = video.videoWidth;
          frame.height = video.videoHeight;
          try { await pose.send({ image: video }); } catch { /* skip frame */ }
          busy = false;
          if (running) onFrame?.(frame);
        }
        raf = requestAnimationFrame(() => void tick());
      };
      void tick();
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      void pose.close();
    },
    latest: () => frame,
  };
}
