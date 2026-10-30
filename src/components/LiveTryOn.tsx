import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bug,
  Camera,
  Circle,
  Download,
  Info,
  Loader2,
  Lock,
  RefreshCw,
  RotateCcw,
  Share2,
  Sparkles,
  Square,

  SwitchCamera,
  Unlock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BODY_PARTS,
  SELF_FILM_TIP,
  type BodyPart,
} from "@/lib/bodyParts";
import {
  freePlacement,
  handPlacement,
  posePlacement,
  type Landmark,
  type Placement,
} from "@/lib/livePlacement";
import { SkinLuminanceMap } from "@/lib/skinLuminance";
import {
  PersonSegmenter,
  buildOcclusionMask,
  type SegMask,
} from "@/lib/personSegmentation";
import {
  DEFAULT_ADJUST,
  TattooOverlay,
  modeForKind,
  type ManualAdjust,
} from "@/lib/tattooOverlay";
import {
  MAX_AGE_YEARS,
  REALISM_DISCLAIMER,
  ageLabel,
  realismStyle,
  sampleSkinNearPlacement,
  sceneColorGrade,
  type SkinSample,
} from "@/lib/skinRealism";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { TATTOOS } from "@/lib/tattoos";
import {
  convexHull,
  hullIntersectsCircle,
  inflateHull,
  pathHull,
  type Pt,
} from "@/lib/handOcclusion";

import { listMyMotifs, subscribeMyMotifs, type MyMotif } from "@/lib/myMotifs";
import { styleBlend } from "@/lib/styleBlend";
import {
  createFrameNormalizer,
  logConfidence,
  resultConfidence,
  type FrameNormalizer,
} from "@/lib/frameNormalize";
import {
  measureLimbCylinder,
  measureSegmentedLimb,
  offsetAlongChain,
  type LimbCylinder,
} from "@/lib/limbCylinder";
import {
  createCylinderLock,
  type CylinderLock,
  type CylinderLockResult,
} from "@/lib/cylinderLock";
import {
  reRenderStabilizedClip,
  smoothTrack,
  type TrackSample,
} from "@/lib/exportStabilize";




import {
  MAX_RECORD_SECONDS,
  downloadBlob,
  drawWatermark,
  extFor,
  loadWatermark,
  pickMimeType,
  recorderSupported,
  shareSupported,
} from "@/lib/videoRecording";



/** Draws selected landmarks, anchor point, and direction in debug mode. */
function drawDebugPlacement(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  p: Placement,
) {
  const r = Math.max(3, canvas.width / 180);
  ctx.fillStyle = "rgba(34,211,238,0.95)";
  for (const pt of p.points) {
    ctx.beginPath();
    ctx.arc(pt.x * canvas.width, pt.y * canvas.height, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const cx = p.x * canvas.width;
  const cy = p.y * canvas.height;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = Math.max(2, canvas.width / 400);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
  ctx.stroke();
  const len = Math.max(p.span * canvas.width * 0.5, r * 6);
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(p.rotation) * len, cy + Math.sin(p.rotation) * len);
  ctx.stroke();
}


type Facing = "environment" | "user";

type Phase =
  | "select"
  | "idle"
  | "requesting"
  | "loading-models"
  | "ready"
  | "error";

const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const HAND_MODEL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
];

const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [11, 23],
  [12, 24],
  [23, 24],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [27, 31],
  [28, 32],
];

function describeError(err: unknown): string {
  const e = err as { name?: string; message?: string };
  if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
    return "Camera permission denied. Allow the camera in your browser settings (on iPhone: the AA icon in the address bar → Website Settings → Camera) and then press Start Camera again.";
  }
  if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") {
    return "No camera found on the device, or the selected camera is unavailable. Try switching camera.";
  }
  if (e?.name === "NotReadableError") {
    return "The camera is already in use by another app. Close that app and try again.";
  }
  return (
    e?.message ??
    "Could not start the camera. Make sure the page runs over HTTPS."
  );
}

export default function LiveTryOn({
  initialMotifId,
}: {
  initialMotifId?: string;
} = {}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<{
    kind: "hand" | "pose";
    detectForVideo: (v: HTMLVideoElement | HTMLCanvasElement, t: number) => any;
    close?: () => void;
  } | null>(null);
  const rafRef = useRef<number | null>(null);
  const placementRef = useRef<Placement | null>(null);
  const fpsRef = useRef({ frames: 0, last: 0 });
  const debugRef = useRef(false);
  const bodyPartRef = useRef<BodyPart | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  /** Re-paints the real hand over the tattoo when a second hand covers it. */
  const occluderCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<TattooOverlay | null>(null);
  const skinLumaRef = useRef<SkinLuminanceMap | null>(null);
  const segmenterRef = useRef<PersonSegmenter | null>(null);
  const segMaskRef = useRef<SegMask | null>(null);
  const occMaskRef = useRef<HTMLCanvasElement | null>(null);
  const segFrameRef = useRef(0);
  const occScratchRef = useRef<HTMLCanvasElement | null>(null);
  const adjustRef = useRef<ManualAdjust>({ ...DEFAULT_ADJUST });
  const skinRef = useRef<SkinSample | null>(null);
  const realismRef = useRef({ age: 0, hair: true, tone: true });
  const frameCountRef = useRef(0);
  /** Per-style ink density: weights the shading blend and layer opacity. */
  const blendRef = useRef(styleBlend(null));
  const handSetsRef = useRef<Landmark[][]>([]);
  const realismOpenRef = useRef(false);
  /** CLAHE pass that keeps model confidence stable across skin tones. */
  const normalizerRef = useRef<FrameNormalizer | null>(null);
  /** Latest tapered-cylinder fit of the limb (radii in canvas pixels). */
  const cylinderRef = useRef<LimbCylinder | null>(null);
  const lockedCylinderRef = useRef<LimbCylinder | null>(null);
  const lockedSegmentsRef = useRef<{ segments: ReturnType<typeof measureSegmentedLimb>; offset: number } | null>(null);


  const lockedRef = useRef(false);
  const frozenRef = useRef<Placement | null>(null);
  /** Cylinder-anchored feature tracker, created the moment Lock is tapped. */
  const cylLockRef = useRef<CylinderLock | null>(null);
  const lockPendingRef = useRef(false);
  /** Placement the lock tracker produces each frame. */
  const lockedPlacementRef = useRef<Placement | null>(null);
  const lockStatusRef = useRef<CylinderLockResult | null>(null);
  const reacquiringRef = useRef(false);

  const gestureRef = useRef<{
    pointers: Map<number, { x: number; y: number }>;
    startDist: number;
    startAngle: number;
    startAdjust: ManualAdjust;
    startCenter: { x: number; y: number };
  }>({
    pointers: new Map(),
    startDist: 0,
    startAngle: 0,
    startAdjust: { ...DEFAULT_ADJUST },
    startCenter: { x: 0, y: 0 },
  });

  const logoRef = useRef<HTMLImageElement | null>(null);
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false);
  const recordTimerRef = useRef<number | null>(null);
  /**
   * Raw camera pass recorded next to the live composite, plus the
   * cylinder-space track for every frame. Together they let the export pass
   * re-render the clip with a wide, non-causal smoothing window.
   */
  const rawRecorderRef = useRef<MediaRecorder | null>(null);
  const rawChunksRef = useRef<Blob[]>([]);
  const samplesRef = useRef<TrackSample[]>([]);
  const recordStartRef = useRef(0);
  const recordMimeRef = useRef<string | null>(null);
  const maskScratchRef = useRef<HTMLCanvasElement | null>(null);
  const exportLumaRef = useRef<SkinLuminanceMap | null>(null);
  const exportCancelRef = useRef({ cancelled: false });


  const [bodyPart, setBodyPart] = useState<BodyPart | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [phase, setPhase] = useState<Phase>("select");
  const [error, setError] = useState<string | null>(null);
  const [secure, setSecure] = useState(true);
  const [debug, setDebug] = useState(false);
  const [locked, setLocked] = useState(false);
  /** True while the lock is re-learning the skin patch after a track loss. */
  const [reacquiring, setReacquiring] = useState(false);
  /** Live tracking-quality signal shown as a thin bar by the lock button. */
  const [quality, setQuality] = useState<{
    level: "good" | "fair" | "poor";
    hint: string | null;
  }>({ level: "good", hint: null });
  const qualityRef = useRef(quality);
  const [motifId, setMotifId] = useState<string>(initialMotifId ?? TATTOOS[0].id);
  const [recording, setRecording] = useState(false);
  const [remaining, setRemaining] = useState(MAX_RECORD_SECONDS);
  const [clip, setClip] = useState<{
    url: string;
    file: File;
  } | null>(null);
  /**
   * The unstabilized, live-composited take. Kept next to the stabilized clip
   * so the user can A/B them before downloading.
   */
  const [liveClip, setLiveClip] = useState<{
    url: string;
    file: File;
  } | null>(null);
  const [compareView, setCompareView] = useState<"stabilized" | "live">(
    "stabilized",
  );
  const reviewVideoRef = useRef<HTMLVideoElement | null>(null);
  const reviewTimeRef = useRef(0);
  const [recordNote, setRecordNote] = useState<string | null>(null);
  /** 0–1 progress of the post-recording stabilization pass, null when idle. */
  const [stabilizing, setStabilizing] = useState<number | null>(null);


  const [hud, setHud] = useState<{ fps: number; placement: Placement | null }>({
    fps: 0,
    placement: null,
  });

  const [realismOpen, setRealismOpen] = useState(false);
  const [ageYears, setAgeYears] = useState(0);
  const [hairResponse, setHairResponse] = useState(true);
  const [toneMatch, setToneMatch] = useState(true);
  const [skinInfo, setSkinInfo] = useState<SkinSample | null>(null);

  useEffect(() => {
    realismRef.current = { age: ageYears, hair: hairResponse, tone: toneMatch };
  }, [ageYears, hairResponse, toneMatch]);

  useEffect(() => {
    realismOpenRef.current = realismOpen;
  }, [realismOpen]);


  useEffect(() => {
    bodyPartRef.current = bodyPart;
  }, [bodyPart]);


  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  useEffect(() => {
    lockedRef.current = locked;
    if (!locked) {
      frozenRef.current = null;
      lockedCylinderRef.current = null;
      lockedSegmentsRef.current = null;
      lockedPlacementRef.current = null;
      reacquiringRef.current = false;
      setReacquiring(false);
      const oc = overlayCanvasRef.current;
      if (oc) oc.style.opacity = "1";
      lockStatusRef.current = null;
      lockPendingRef.current = false;
      cylLockRef.current?.dispose();
      cylLockRef.current = null;
    } else {
      frozenRef.current = placementRef.current;
      lockedCylinderRef.current = cylinderRef.current
        ? { ...cylinderRef.current, radii: [...cylinderRef.current.radii] }
        : null;
      lockedPlacementRef.current = placementRef.current;
      // The tracker itself is built inside the render loop, where the current
      // frame and the freshly measured cylinder are available.
      lockPendingRef.current = true;
    }
  }, [locked]);

  useEffect(
    () => () => {
      cylLockRef.current?.dispose();
      cylLockRef.current = null;
    },
    [],
  );


  useEffect(() => {
    setSecure(window.isSecureContext || location.hostname === "localhost");
  }, []);

  useEffect(() => {
    void loadWatermark().then((img) => {
      logoRef.current = img;
    });
  }, []);

  /** Three.js overlay is initialized once the camera layout is mounted. */
  useEffect(() => {
    if (phase === "select") return;
    const canvas = overlayCanvasRef.current;
    if (!canvas || overlayRef.current) return;
    overlayRef.current = new TattooOverlay(canvas);
    return () => {
      overlayRef.current?.dispose();
      overlayRef.current = null;
    };
  }, [phase]);

  const [myMotifs, setMyMotifs] = useState<MyMotif[]>([]);
  useEffect(() => {
    setMyMotifs(listMyMotifs());
    return subscribeMyMotifs(() => setMyMotifs(listMyMotifs()));
  }, []);

  useEffect(() => {
    const src =
      myMotifs.find((m) => m.id === motifId)?.src ??
      TATTOOS.find((t) => t.id === motifId)?.src;
    if (src) void overlayRef.current?.setTexture(src);
    const style =
      (myMotifs.find((m) => m.id === motifId) as { style?: string } | undefined)
        ?.style ?? TATTOOS.find((t) => t.id === motifId)?.style;
    blendRef.current = styleBlend(style);
  }, [motifId, phase, myMotifs]);






  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /** The placement actually driving the overlay this frame. */
  const activePlacement = useCallback(
    () =>
      lockedRef.current
        ? (lockedPlacementRef.current ??
          frozenRef.current ??
          placementRef.current)
        : placementRef.current,
    [],
  );

  /**
   * Logs one frame of the cylinder-space track while recording. Live rendering
   * stays causal; this log is what the export pass re-runs afterwards with a
   * wider, non-causal window. The occluder layer is stored as a small alpha
   * map so hands and sleeves still cover the re-placed tattoo on export.
   */
  const captureTrackSample = useCallback((canvas: HTMLCanvasElement) => {
    const samples = samplesRef.current;
    if (samples.length > 60 * MAX_RECORD_SECONDS) return;
    let mask: TrackSample["mask"] = null;
    const occ = occluderCanvasRef.current;
    if (occ && occ.width) {
      const mw = 192;
      const mh = Math.max(1, Math.round((occ.height / occ.width) * mw));
      const scratch = (maskScratchRef.current ??=
        document.createElement("canvas"));
      if (scratch.width !== mw || scratch.height !== mh) {
        scratch.width = mw;
        scratch.height = mh;
      }
      const sctx = scratch.getContext("2d", { willReadFrequently: true });
      if (sctx) {
        sctx.clearRect(0, 0, mw, mh);
        sctx.drawImage(occ, 0, 0, mw, mh);
        const data = sctx.getImageData(0, 0, mw, mh).data;
        const alpha = new Uint8Array(mw * mh);
        let any = false;
        for (let i = 0; i < alpha.length; i++) {
          const a = data[i * 4 + 3];
          alpha[i] = a;
          if (a > 8) any = true;
        }
        if (any) mask = { w: mw, h: mh, alpha };
      }
    }
    samples.push({
      t: performance.now() - recordStartRef.current,
      placement: activePlacement(),
      cylinder: cylinderRef.current,
      adjust: { ...adjustRef.current },
      mask,
    });
    void canvas;
  }, [activePlacement]);


  const loop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!video || !canvas || !ctx) return;

    if (video.readyState >= 2 && video.videoWidth) {
      if (canvas.width !== video.videoWidth) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
      ctx.save();
      if (facing === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const part = bodyPartRef.current;
      let placement: Placement | null = null;
      try {
        const tracker = landmarkerRef.current;
        const normalizer = normalizerRef.current;
        // Equalize local contrast before the model sees the frame.
        const input = normalizer?.frame() ?? video;
        const res = tracker?.detectForVideo(input, performance.now());
        if (debugRef.current)
          logConfidence(
            resultConfidence(res),
            normalizer?.luminance ?? 128,
            !!normalizer?.active,
          );
        const sets: Landmark[][] = res?.landmarks ?? [];
        const marks = sets[0];
        // Every hand except the one carrying the placement is a potential
        // occluder — the Hand Landmarker already returns both.
        handSetsRef.current = tracker?.kind === "hand" ? sets : [];

        if (part?.placement === "free") {
          placement = freePlacement();
        } else if (marks && part) {
          placement =
            tracker?.kind === "hand"
              ? handPlacement(marks)
              : posePlacement(part, marks);
        }

        if (debugRef.current) {
          // The whole skeleton faint, selected landmarks clear.
          const connections =
            tracker?.kind === "pose" ? POSE_CONNECTIONS : HAND_CONNECTIONS;
          if (marks) {
            ctx.strokeStyle = "rgba(255,255,255,0.25)";
            ctx.lineWidth = Math.max(1, canvas.width / 640);
            for (const [a, b] of connections) {
              const p1 = marks[a];
              const p2 = marks[b];
              if (!p1 || !p2) continue;
              ctx.beginPath();
              ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
              ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
              ctx.stroke();
            }
          }
          if (placement) drawDebugPlacement(ctx, canvas, placement);
        }
      } catch {
        /* detection hiccup — keep rendering video */
      }
      ctx.restore();
      placementRef.current = placement;

      // --- Cylinder-anchored lock ------------------------------------------
      // While locked the design no longer follows the raw landmarks. Feature
      // points snapshotted at lock time are stored as (u, v) on the limb's
      // cylinder; every frame the cylinder pose is refreshed from the current
      // landmarks, the points are pushed forward with optical flow, and the
      // two are fused: geometry supplies scale/rotation through limb rotation,
      // flow removes the residual jitter and lateral drift.
      if (lockedRef.current) {
        const base = frozenRef.current;
        const axis = placement?.axis ?? base?.axis ?? null;
        const mirrored = facing === "user";
        const toRaw = (x: number) => (mirrored ? canvas.width - x : x);
        if (axis && base) {
          const a = {
            x: axis.a.x * canvas.width,
            y: axis.a.y * canvas.height,
          };
          const b = {
            x: axis.b.x * canvas.width,
            y: axis.b.y * canvas.height,
          };
          const cyl = measureLimbCylinder(canvas, a, b);
          const pose = {
            a: { x: toRaw(a.x), y: a.y },
            b: { x: toRaw(b.x), y: b.y },
            cylinder: cyl,
          };
          if (lockPendingRef.current) {
            const w = Math.max(48, base.span * canvas.width);
            cylLockRef.current?.dispose();
            cylLockRef.current = createCylinderLock(
              video,
              {
                cx: toRaw(base.x * canvas.width),
                cy: base.y * canvas.height,
                w,
                h: w,
              },
              pose,
            );
            lockPendingRef.current = false;
          }
          const res = cylLockRef.current?.update(pose) ?? null;
          lockStatusRef.current = res;
          if (res) {
            // Fade rather than snap while the patch is being re-acquired.
            const layer = overlayCanvasRef.current;
            if (layer) layer.style.opacity = String(res.opacity);

            const busy = res.state === "reacquiring";
            if (busy !== reacquiringRef.current) {
              reacquiringRef.current = busy;
              setReacquiring(busy);
            }
          }
          if (res && res.confidence > 0.15) {
            lockedPlacementRef.current = {
              ...base,
              x: toRaw(res.x) / canvas.width,
              y: res.y / canvas.height,
              rotation: base.rotation + res.rotation,
              span: base.span * res.scale,
              axis: base.axis,
              bendDeg: base.bendDeg,
            };
          }
        }
      }

      // Three.js overlay on top of the video.
      const overlay = overlayRef.current;
      const oc = overlayCanvasRef.current;
      if (overlay && oc) {
        if (oc.width !== canvas.width || oc.height !== canvas.height) {
          oc.width = canvas.width;
          oc.height = canvas.height;
          overlay.setSize(canvas.width, canvas.height);
        }
        const active = lockedRef.current
          ? (lockedPlacementRef.current ?? frozenRef.current ?? placement)
          : placement;

        if (active) overlay.setMode(modeForKind(active.kind));

        // Skin tone + hair are sampled every 8th frame (cheap enough for 30–60 fps).
        frameCountRef.current += 1;
        if (active && frameCountRef.current % 8 === 0) {
          const sample = sampleSkinNearPlacement(
            canvas,
            active.x,
            active.y,
            active.span,
          );
          if (sample) {
            const prev = skinRef.current;
            // Smooth transition so the tone doesn't flicker between frames.
            skinRef.current = prev
              ? {
                  ...sample,
                  r: prev.r + (sample.r - prev.r) * 0.3,
                  g: prev.g + (sample.g - prev.g) * 0.3,
                  b: prev.b + (sample.b - prev.b) * 0.3,
                  luminance:
                    prev.luminance + (sample.luminance - prev.luminance) * 0.3,
                  hairiness:
                    prev.hairiness + (sample.hairiness - prev.hairiness) * 0.3,
                }
              : sample;
          }
        }
        const r = realismRef.current;
        const blend = blendRef.current;
        const realism = realismStyle(skinRef.current, r.age, {
          hairResponse: r.hair,
          toneMatch: r.tone,
        });
        // Dense styles (blackwork) keep close to full opacity; thin styles
        // (fine line, watercolour) sit lighter in the skin.
        overlay.setRealism({
          ...realism,
          grade: sceneColorGrade(skinRef.current),
          opacity: Math.max(0, Math.min(1, realism.opacity * blend.opacityScale)),
        });

        // Quality signal for the lock button: lock confidence from the
        // cylinder tracker plus scene brightness from the frame normalizer.
        // Phones hunt exposure, so only re-render when the bucket changes.
        {
          const lum = normalizerRef.current?.luminance ?? 128;
          const conf = lockStatusRef.current?.confidence ?? 1;
          const dim = lum < 55;
          const level: "good" | "fair" | "poor" = dim
            ? conf < 0.55
              ? "poor"
              : "fair"
            : conf > 0.55
              ? "good"
              : conf > 0.3
                ? "fair"
                : "poor";
          const hint = dim
            ? "More light helps"
            : conf <= 0.3
              ? "Hold still – weak grip"
              : conf <= 0.55
                ? "Tracking is shaky"
                : null;
          const prevQ = qualityRef.current;
          if (prevQ.level !== level || prevQ.hint !== hint) {
            const next = { level, hint };
            qualityRef.current = next;
            setQuality(next);
          }
        }

        // Tapered-cylinder fit: the limb axis comes from the landmarks, the
        // radius from the limb's visible width in this frame, so the wrap
        // updates live as the arm moves toward or away from the camera.
        if (active?.axis) {
          cylinderRef.current = measureLimbCylinder(
            canvas,
            {
              x: active.axis.a.x * canvas.width,
              y: active.axis.a.y * canvas.height,
            },
            {
              x: active.axis.b.x * canvas.width,
              y: active.axis.b.y * canvas.height,
            },
          );
        } else {
          cylinderRef.current = null;
        }
        // Sample the skin continuously for the tracker, but do not feed those
        // changing radii into the motif mesh while locked.
        overlay.setCylinder(lockedRef.current ? lockedCylinderRef.current : cylinderRef.current, lockedRef.current);

        // Sleeve-style designs can span more than one segment (forearm →
        // upper arm across the elbow). Fit one cylinder per segment from the
        // chain's landmarks and let the overlay blend them at the seam.
        if (active?.kind === "joint" && active.points.length >= 3) {
          const chain = active.points.map((p) => ({
            x: p.x * canvas.width,
            y: p.y * canvas.height,
          }));
          if (!lockedRef.current) {
            const offset = offsetAlongChain(chain, {
              x: active.x * canvas.width,
              y: active.y * canvas.height,
            });
            const segments = measureSegmentedLimb(canvas, chain);
            lockedSegmentsRef.current = { segments, offset };
            overlay.setSegments(segments, offset);
          } else {
            // A newly locked joint keeps the last displayed segment geometry.
            const frozen = lockedSegmentsRef.current;
            overlay.setSegments(frozen?.segments ?? null, frozen?.offset ?? 0);
          }
        } else {
          overlay.setSegments(null);
        }

        overlay.setAdjust(adjustRef.current);

        // Shading-aware compositing: the ink is blended through a blurred
        // grayscale of the skin underneath, so creases, hair, veins and the
        // room's own light show through instead of a flat sticker.
        const lumaMap = (skinLumaRef.current ??= new SkinLuminanceMap());
        const hasLuma = lumaMap.update(canvas, canvas.width, canvas.height);
        // Blend weight comes from the design's style category: solid fills
        // let little skin luminance through, fine line and watercolour a lot.
        overlay.setSkinLuminance(
          hasLuma ? lumaMap.canvas : null,
          blendRef.current.skinStrength,
        );

        overlay.update(active, canvas.width, canvas.height, lockedRef.current);



      }

      // --- Second-hand occlusion -------------------------------------------
      // The tattoo must vanish behind a hand that passes in front of it. The
      // occluding hand's own 21 landmarks give a convex hull that is accurate
      // enough; we repaint the live video inside that hull on a layer above
      // the tattoo, so the design is masked locally while the general
      // segmentation (background, hair, sleeves) keeps doing its job.
      const occ = occluderCanvasRef.current;
      const octx = occ?.getContext("2d");
      if (occ && octx) {
        if (occ.width !== canvas.width || occ.height !== canvas.height) {
          occ.width = canvas.width;
          occ.height = canvas.height;
        }
        octx.clearRect(0, 0, occ.width, occ.height);
        const active = placementRef.current;
        const sets = handSetsRef.current;
        if (active && sets.length > 1) {
          const mirrored = facing === "user";
          const toPx = (l: Landmark): Pt => ({
            x: (mirrored ? 1 - l.x : l.x) * canvas.width,
            y: l.y * canvas.height,
          });
          const cx = active.x * canvas.width;
          const cy = active.y * canvas.height;
          const radius = Math.max(24, active.span * canvas.width * 0.75);
          // sets[0] carries the placement; the rest can occlude it.
          for (let i = 1; i < sets.length; i++) {
            const marks = sets[i];
            if (!marks || marks.length < 5) continue;
            const hull = inflateHull(
              convexHull(marks.map(toPx)),
              Math.max(6, canvas.width / 90),
            );
            if (!hullIntersectsCircle(hull, cx, cy, radius)) continue;
            octx.save();
            pathHull(octx, hull);
            octx.clip();
            // Soft edge so the cut does not read as a hard paper mask.
            octx.filter = "blur(1.5px)";
            octx.save();
            if (mirrored) {
              octx.translate(occ.width, 0);
              octx.scale(-1, 1);
            }
            octx.drawImage(video, 0, 0, occ.width, occ.height);
            octx.restore();
            octx.restore();
          }
        }

        // --- Segmentation occlusion ---------------------------------------
        // Person segmentation tells us what is actually in front of the arm.
        // Anything inside the tattoo region that isn't bare skin of the
        // person — a sleeve, a watch, hair, an object, background showing
        // through — is repainted from the live frame above the tattoo layer.
        if (active) {
          const seg = (segmenterRef.current ??= new PersonSegmenter());
          void seg.ensure(WASM_BASE);
          segFrameRef.current += 1;
          if (segFrameRef.current % 2 === 0) {
            segMaskRef.current =
              seg.segment(video, performance.now()) ?? segMaskRef.current;
          }
          const mask = buildOcclusionMask(
            canvas,
            segMaskRef.current,
            {
              x: active.x * canvas.width,
              y: active.y * canvas.height,
              radius: Math.max(24, active.span * canvas.width * 0.75),
            },
            facing === "user",
            (occMaskRef.current ??= document.createElement("canvas")),
          );
          if (mask) {
            const scratch = (occScratchRef.current ??=
              document.createElement("canvas"));
            if (
              scratch.width !== occ.width ||
              scratch.height !== occ.height
            ) {
              scratch.width = occ.width;
              scratch.height = occ.height;
            }
            const sctx = scratch.getContext("2d");
            if (sctx) {
              sctx.clearRect(0, 0, scratch.width, scratch.height);
              sctx.globalCompositeOperation = "source-over";
              sctx.drawImage(canvas, 0, 0, scratch.width, scratch.height);
              sctx.globalCompositeOperation = "destination-in";
              // Soft edge: the mask is low-res on purpose, the blur hides it.
              sctx.filter = "blur(2px)";
              sctx.drawImage(mask, 0, 0, scratch.width, scratch.height);
              sctx.filter = "none";
              sctx.globalCompositeOperation = "source-over";
              octx.drawImage(scratch, 0, 0);
            }
          }
        }
      }

      // Log this frame's cylinder-space track for the export pass.
      if (recordingRef.current) captureTrackSample(canvas);

      // InkSimulator logo in the corner (also visible in the recording).

      drawWatermark(ctx, canvas.width, canvas.height, logoRef.current);

      // While recording, video + overlay + logo are composited into a canvas.
      const comp = compositeRef.current;
      if (recordingRef.current && comp) {
        const cctx = comp.getContext("2d");
        if (cctx) {
          if (comp.width !== canvas.width || comp.height !== canvas.height) {
            comp.width = canvas.width;
            comp.height = canvas.height;
          }
          cctx.drawImage(canvas, 0, 0);
          if (oc) cctx.drawImage(oc, 0, 0, comp.width, comp.height);
          const occLayer = occluderCanvasRef.current;
          if (occLayer)
            cctx.drawImage(occLayer, 0, 0, comp.width, comp.height);
        }
      }
    }



    // FPS counter (shown only in debug mode).
    const now = performance.now();
    fpsRef.current.frames += 1;
    if (now - fpsRef.current.last >= 500) {
      const fps = Math.round(
        (fpsRef.current.frames * 1000) / (now - fpsRef.current.last),
      );
      fpsRef.current = { frames: 0, last: now };
      if (debugRef.current) {
        setHud({
          fps,
          placement: placementRef.current,
        });
      }
      if (realismOpenRef.current) setSkinInfo(skinRef.current);

    }

    rafRef.current = requestAnimationFrame(loop);
  }, [facing, captureTrackSample]);


  const start = useCallback(
    async (mode: Facing, part: BodyPart) => {
      setError(null);
      stopStream();
      try {
        setPhase("requesting");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
        streamRef.current = stream;
        const video = videoRef.current!;
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        video.muted = true;
        await video.play();
        normalizerRef.current?.dispose();
        normalizerRef.current = createFrameNormalizer(video);

        if (landmarkerRef.current?.kind !== part.tracker) {
          setPhase("loading-models");
          landmarkerRef.current?.close?.();
          landmarkerRef.current = null;
          const vision = await import("@mediapipe/tasks-vision");
          const fileset = await vision.FilesetResolver.forVisionTasks(
            WASM_BASE,
          );
          const instance =
            part.tracker === "pose"
              ? await vision.PoseLandmarker.createFromOptions(fileset, {
                  baseOptions: {
                    modelAssetPath: POSE_MODEL,
                    delegate: "GPU",
                  },
                  runningMode: "VIDEO",
                  numPoses: 1,
                  // Slightly below the defaults: with CLAHE the frames are
                  // cleaner, and a lower bar keeps darker skin and dim rooms
                  // from being held to a stricter standard than bright scenes.
                  minPoseDetectionConfidence: 0.4,
                  minPosePresenceConfidence: 0.4,
                  minTrackingConfidence: 0.4,
                })
              : await vision.HandLandmarker.createFromOptions(fileset, {
                  baseOptions: {
                    modelAssetPath: HAND_MODEL,
                    delegate: "GPU",
                  },
                  runningMode: "VIDEO",
                  numHands: 2,
                  minHandDetectionConfidence: 0.4,
                  minHandPresenceConfidence: 0.4,
                  minTrackingConfidence: 0.4,
                });

          landmarkerRef.current = Object.assign(instance as any, {
            kind: part.tracker,
          });
        }

        setPhase("ready");
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        stopStream();
        setError(describeError(err));
        setPhase("error");
      }
    },
    [loop, stopStream],
  );

  useEffect(
    () => () => {
      stopStream();
      normalizerRef.current?.dispose();
      normalizerRef.current = null;
      segmenterRef.current?.close();
      segmenterRef.current = null;
    },
    [stopStream],
  );

  const switchCamera = () => {
    const next: Facing = facing === "environment" ? "user" : "environment";
    setFacing(next);
    if ((phase === "ready" || phase === "error") && bodyPart)
      void start(next, bodyPart);
  };

  const backToSelect = () => {
    stopStream();
    setError(null);
    setPhase("select");
  };

  /* ---------- Touch gestures for size / rotation / position ---------- */
  const pointerScale = () => {
    const c = canvasRef.current;
    const rect = c?.getBoundingClientRect();
    if (!c || !rect || !rect.width) return 1;
    return c.width / rect.width;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (lockedRef.current) return;
    const g = gestureRef.current;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...g.pointers.values()];
    g.startAdjust = { ...adjustRef.current };
    if (pts.length === 1) {
      g.startCenter = pts[0];
    } else if (pts.length === 2) {
      g.startCenter = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      g.startDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      g.startAngle = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    if (lockedRef.current || !g.pointers.has(e.pointerId)) return;
    g.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...g.pointers.values()];
    const k = pointerScale();
    if (pts.length === 1) {
      adjustRef.current = {
        ...g.startAdjust,
        offsetX: g.startAdjust.offsetX + (pts[0].x - g.startCenter.x) * k,
        offsetY: g.startAdjust.offsetY + (pts[0].y - g.startCenter.y) * k,
      };
    } else if (pts.length >= 2) {
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) || 1;
      const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
      const center = {
        x: (pts[0].x + pts[1].x) / 2,
        y: (pts[0].y + pts[1].y) / 2,
      };
      adjustRef.current = {
        scale: Math.min(
          4,
          Math.max(0.25, g.startAdjust.scale * (dist / g.startDist)),
        ),
        rotation: g.startAdjust.rotation - (ang - g.startAngle),
        offsetX: g.startAdjust.offsetX + (center.x - g.startCenter.x) * k,
        offsetY: g.startAdjust.offsetY + (center.y - g.startCenter.y) * k,
      };
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gestureRef.current;
    g.pointers.delete(e.pointerId);
    g.startAdjust = { ...adjustRef.current };
    const pts = [...g.pointers.values()];
    if (pts.length === 1) g.startCenter = pts[0];
  };

  const resetAdjust = () => {
    adjustRef.current = { ...DEFAULT_ADJUST };
  };

  /* ---------------------- Recording ---------------------- */

  /**
   * Post-recording pass. Live preview must place every frame from what the
   * tracker knew at that instant; once the clip exists we can look forward as
   * well as back, so the whole cylinder-space track is re-smoothed with a wide
   * non-causal window and the tattoo is re-rendered over the raw frames. Takes
   * a few seconds, which export can afford and live preview cannot.
   */
  const runStabilization = useCallback(
    async (raw: Blob, mime: string, width: number, height: number) => {
      const overlay = overlayRef.current;
      const oc = overlayCanvasRef.current;
      const samples = smoothTrack(samplesRef.current);
      samplesRef.current = [];
      if (!overlay || !oc || samples.length < 8) return;

      // The live loop and the export pass share the overlay renderer.
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      const prevOpacity = oc.style.opacity;
      oc.style.opacity = "1";
      exportCancelRef.current = { cancelled: false };
      setStabilizing(0);

      try {
        const blob = await reRenderStabilizedClip({
          raw,
          mime,
          width,
          height,
          samples,
          signal: exportCancelRef.current,
          onProgress: (p) => setStabilizing(p),
          drawFrame: (video, sample, ctx) => {
            const w = ctx.canvas.width;
            const h = ctx.canvas.height;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(video, 0, 0, w, h);

            const placement = sample?.placement ?? null;
            if (placement) {
              if (oc.width !== w || oc.height !== h) {
                oc.width = w;
                oc.height = h;
                overlay.setSize(w, h);
              }
              overlay.setMode(modeForKind(placement.kind));
              overlay.setCylinder(sample?.cylinder ?? null);
              overlay.setSegments(null);
              overlay.setAdjust(sample!.adjust);
              const luma = (exportLumaRef.current ??= new SkinLuminanceMap());
              const hasLuma = luma.update(ctx.canvas, w, h);
              overlay.setSkinLuminance(
                hasLuma ? luma.canvas : null,
                blendRef.current.skinStrength,
              );
              overlay.update(placement, w, h);
              ctx.drawImage(oc, 0, 0, w, h);
            }

            // Hands, sleeves and hair recorded live still occlude the ink.
            const mask = sample?.mask;
            if (mask) {
              const mc = (maskScratchRef.current ??=
                document.createElement("canvas"));
              if (mc.width !== mask.w || mc.height !== mask.h) {
                mc.width = mask.w;
                mc.height = mask.h;
              }
              const mctx = mc.getContext("2d");
              const scratch = (occScratchRef.current ??=
                document.createElement("canvas"));
              if (scratch.width !== w || scratch.height !== h) {
                scratch.width = w;
                scratch.height = h;
              }
              const sctx = scratch.getContext("2d");
              if (mctx && sctx) {
                const img = mctx.createImageData(mask.w, mask.h);
                for (let i = 0; i < mask.alpha.length; i++) {
                  img.data[i * 4] = 255;
                  img.data[i * 4 + 1] = 255;
                  img.data[i * 4 + 2] = 255;
                  img.data[i * 4 + 3] = mask.alpha[i];
                }
                mctx.putImageData(img, 0, 0);
                sctx.clearRect(0, 0, w, h);
                sctx.globalCompositeOperation = "source-over";
                sctx.drawImage(video, 0, 0, w, h);
                sctx.globalCompositeOperation = "destination-in";
                sctx.filter = "blur(2px)";
                sctx.drawImage(mc, 0, 0, w, h);
                sctx.filter = "none";
                sctx.globalCompositeOperation = "source-over";
                ctx.drawImage(scratch, 0, 0, w, h);
              }
            }
          },
        });

        if (blob) {
          const file = new File(
            [blob],
            `inksimulator-${Date.now()}-stabilized.${extFor(mime)}`,
            { type: mime },
          );
          // Keep the live take around for the before/after comparison.
          setClip((prev) => {
            if (prev) setLiveClip(prev);
            return { url: URL.createObjectURL(blob), file };
          });
          setCompareView("stabilized");
          reviewTimeRef.current = 0;
        }

      } catch {
        /* keep the live-composited clip as it is */
      } finally {
        oc.style.opacity = prevOpacity;
        setStabilizing(null);
        if (!rafRef.current && streamRef.current)
          rafRef.current = requestAnimationFrame(loop);
      }
    },
    [loop],
  );

  const stopRecording = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    const rawRec = rawRecorderRef.current;
    if (rawRec && rawRec.state !== "inactive") rawRec.stop();
    recordingRef.current = false;
    setRecording(false);
  }, []);


  const startRecording = useCallback(() => {
    setRecordNote(null);
    if (!recorderSupported()) {
      setRecordNote(
        "Video recording is not supported in this browser. Try Chrome or Safari (iOS 16+).",
      );
      return;
    }
    const source = canvasRef.current;
    if (!source || !source.width) {
      setRecordNote("The camera is not running yet – start the camera first.");
      return;
    }
    const mime = pickMimeType();
    if (!mime) {
      setRecordNote(
        "The browser lacks support for the video formats we can record in.",
      );
      return;
    }

    if (clip) URL.revokeObjectURL(clip.url);
    if (liveClip) URL.revokeObjectURL(liveClip.url);
    setLiveClip(null);
    setCompareView("stabilized");
    setClip(null);


    const comp = compositeRef.current ?? document.createElement("canvas");
    compositeRef.current = comp;
    comp.width = source.width;
    comp.height = source.height;
    const cctx = comp.getContext("2d");
    cctx?.drawImage(source, 0, 0);

    try {
      const stream = comp.captureStream(30);
      const rec = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 6_000_000,
      });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onerror = () => {
        stopRecording();
        setRecordNote("The recording was interrupted due to an error.");
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        chunksRef.current = [];
        if (!blob.size) {
          setRecordNote("The recording was empty – try again.");
          return;
        }
        const file = new File(
          [blob],
          `inksimulator-${Date.now()}.${extFor(mime)}`,
          { type: mime },
        );
        setClip({ url: URL.createObjectURL(blob), file });
      };
      recorderRef.current = rec;
      rec.start(250);

      // Second, raw pass: the un-composited camera frames. Kept only in memory
      // and used by the export pass to re-render the tattoo with the wider,
      // non-causal smoothing window.
      samplesRef.current = [];
      recordStartRef.current = performance.now();
      recordMimeRef.current = mime;
      try {
        const rawStream = source.captureStream(30);
        const rawRec = new MediaRecorder(rawStream, {
          mimeType: mime,
          videoBitsPerSecond: 5_000_000,
        });
        rawChunksRef.current = [];
        rawRec.ondataavailable = (e) => {
          if (e.data.size) rawChunksRef.current.push(e.data);
        };
        rawRec.onstop = () => {
          rawStream.getTracks().forEach((t) => t.stop());
          const rawBlob = new Blob(rawChunksRef.current, { type: mime });
          rawChunksRef.current = [];
          void runStabilization(rawBlob, mime, source.width, source.height);
        };
        rawRecorderRef.current = rawRec;
        rawRec.start(250);
      } catch {
        rawRecorderRef.current = null;
      }

      recordingRef.current = true;

      setRecording(true);
      setRemaining(MAX_RECORD_SECONDS);
      recordTimerRef.current = window.setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) {
            stopRecording();
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    } catch {
      setRecordNote("Could not start the recording in this browser.");
    }
  }, [clip, liveClip, stopRecording, runStabilization]);

  useEffect(
    () => () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive")
        recorderRef.current.stop();
      if (rawRecorderRef.current && rawRecorderRef.current.state !== "inactive")
        rawRecorderRef.current.stop();
      exportCancelRef.current.cancelled = true;
    },
    [],
  );


  /** The take currently being previewed (stabilized unless the user compares). */
  const shownClip = compareView === "live" && liveClip ? liveClip : clip;

  const shareClip = async () => {
    if (!shownClip) return;
    if (!shareSupported(shownClip.file)) {
      setRecordNote(
        "Sharing is not supported here – we will download the file instead so you can share it manually.",
      );
      downloadBlob(shownClip.file, shownClip.file.name);
      return;
    }
    try {
      await navigator.share({
        files: [shownClip.file],
      });
    } catch (err) {
      if ((err as { name?: string })?.name !== "AbortError")
        setRecordNote("Sharing could not be opened. Try saving the file instead.");
    }
  };

  const saveClip = () => {
    if (!shownClip) return;
    downloadBlob(shownClip.file, shownClip.file.name);
    setRecordNote(
      "The video is downloading. On mobile you will find it in Downloads – save it from there to your camera roll.",
    );
  };

  /** Switch takes without losing the playhead, so the diff is easy to see. */
  const switchCompare = (view: "stabilized" | "live") => {
    reviewTimeRef.current = reviewVideoRef.current?.currentTime ?? 0;
    setCompareView(view);
  };

  const discardClip = () => {
    if (clip) URL.revokeObjectURL(clip.url);
    if (liveClip) URL.revokeObjectURL(liveClip.url);
    setLiveClip(null);
    setCompareView("stabilized");
    setClip(null);

    setRecordNote(null);
  };

  const busy = phase === "requesting" || phase === "loading-models";




  if (phase === "select") {
    return (
      <div className="min-h-[100dvh] w-full bg-background px-6 py-10">
        <div className="mx-auto flex max-w-md flex-col gap-6">
          <div className="space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              Where do you want to try the tattoo?
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose a body part so we can adjust the tracking and placement.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {BODY_PARTS.map((part) => (
              <Button
                key={part.id}
                variant={bodyPart?.id === part.id ? "default" : "secondary"}
                className="h-auto whitespace-normal py-3 text-sm"
                onClick={() => setBodyPart(part)}
              >
                {part.label}
              </Button>
            ))}
          </div>

          {bodyPart && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{bodyPart.hint}</p>
              {bodyPart.hardToSelfFilm && (
                <p className="flex gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {SELF_FILM_TIP}
                </p>
              )}
            </div>
          )}

          <Button
            size="lg"
            disabled={!bodyPart}
            onClick={() => setPhase("idle")}
          >
            Continue to the camera
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <canvas
        ref={overlayCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <canvas
        ref={occluderCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {phase === "ready" && (
        <div
          className="absolute inset-0 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      )}


      {phase !== "ready" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/90 px-6 text-center">
          {busy ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {phase === "requesting"
                  ? "Waiting for camera permission…"
                  : "Downloading AI models (only happens the first time)…"}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">
                Live Try-On · {bodyPart?.label}
              </h1>
              <p className="max-w-sm text-sm text-muted-foreground">
                {bodyPart?.hint}
              </p>
              {bodyPart?.hardToSelfFilm && (
                <p className="flex max-w-sm gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-xs">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {SELF_FILM_TIP}
                </p>
              )}
              {!secure && (
                <p className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  The camera requires HTTPS. Open the page via a secure address.
                </p>
              )}
              {error && (
                <p className="max-w-sm rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}
              <Button
                size="lg"
                onClick={() => bodyPart && void start(facing, bodyPart)}
              >
                {phase === "error" ? (
                  <RefreshCw className="mr-2 h-4 w-4" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                {phase === "error" ? "Try again" : "Start camera"}
              </Button>
              <Button variant="ghost" size="sm" onClick={switchCamera}>
                <SwitchCamera className="mr-2 h-4 w-4" />
                {facing === "environment" ? "Back camera" : "Front camera"}
              </Button>
              <Button variant="ghost" size="sm" onClick={backToSelect}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Change body part
              </Button>
            </>
          )}
        </div>
      )}

      {phase === "ready" && debug && (
        <div className="absolute left-4 top-4 rounded-md bg-background/80 px-3 py-2 font-mono text-[11px] leading-relaxed text-foreground">
          <div>FPS: {hud.fps}</div>
          <div>Del: {bodyPart?.label}</div>
          <div>Tracking: {bodyPart?.tracker}</div>
          <div>Mode: {hud.placement?.kind ?? "no match"}</div>
          {hud.placement && (
            <>
              <div>Side: {hud.placement.side ?? "–"}</div>
              <div>
                Rotation: {Math.round((hud.placement.rotation * 180) / Math.PI)}
                °
              </div>
              <div>
                Bend:{" "}
                {hud.placement.bendDeg === null
                  ? "–"
                  : `${Math.round(hud.placement.bendDeg)}°`}
              </div>
              <div>Width: {hud.placement.span.toFixed(3)}</div>
            </>
          )}
        </div>
      )}

      {phase === "ready" && recording && (
        <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full bg-destructive/90 px-3 py-1.5 text-xs font-semibold text-destructive-foreground">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
          REC · {remaining}s
        </div>
      )}

      {phase === "ready" && recordNote && !clip && (
        <div className="absolute inset-x-4 top-16 rounded-md border border-primary/40 bg-background/90 px-3 py-2 text-xs">
          {recordNote}
        </div>
      )}

      {clip && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-background/95 p-6">
          <h2 className="text-lg font-semibold">
            {stabilizing === null ? "Your recording" : "Polishing your clip"}
          </h2>
          {stabilizing !== null && (
            <div className="w-full max-w-sm space-y-2">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.round(stabilizing * 100)}%` }}
                />
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Re-tracking the clip with look-ahead smoothing for a steadier
                placement than live preview can do · {Math.round(stabilizing * 100)}%
              </p>
            </div>
          )}

          <video
            key={compareView}
            ref={reviewVideoRef}
            src={(shownClip ?? clip).url}
            className="max-h-[55vh] w-full max-w-sm rounded-xl border border-white/10"
            controls
            autoPlay
            loop
            playsInline
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              const t = reviewTimeRef.current;
              if (t > 0 && t < v.duration) v.currentTime = t;
            }}
          />

          {liveClip && (
            <div className="w-full max-w-sm space-y-1.5">
              <div className="flex rounded-full border border-white/10 bg-muted/40 p-1">
                {(["stabilized", "live"] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => switchCompare(view)}
                    className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                      compareView === view
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {view === "stabilized" ? "After · stabilized" : "Before · live"}
                  </button>
                ))}
              </div>
              <p className="text-center text-xs text-muted-foreground">
                {compareView === "stabilized"
                  ? "Re-tracked after recording with look-ahead smoothing."
                  : "The raw live take, exactly as it was previewed."}
              </p>
            </div>
          )}

          {recordNote && (
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              {recordNote}
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <Button size="lg" className="rounded-full" onClick={saveClip}>
              <Download className="mr-2 h-4 w-4" />
              Save to camera roll
            </Button>
            <Button
              size="lg"
              variant="secondary"
              className="rounded-full"
              onClick={() => void shareClip()}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Share
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="rounded-full"
              onClick={discardClip}
            >
              Close
            </Button>
          </div>
        </div>
      )}


      {phase === "ready" && realismOpen && (
        <div className="absolute inset-x-3 bottom-[13.5rem] z-10 space-y-3 rounded-2xl border border-white/10 bg-background/90 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Skin realism</h3>
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setRealismOpen(false)}
            >
              Close
            </button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span>Aging: {ageLabel(ageYears)}</span>
              <span className="text-muted-foreground">
                0–{MAX_AGE_YEARS} years
              </span>
            </div>
            <Slider
              value={[ageYears]}
              min={0}
              max={MAX_AGE_YEARS}
              step={1}
              onValueChange={(v) => setAgeYears(v[0] ?? 0)}
            />
            <p className="text-[11px] text-muted-foreground">
              Approximate visualization of fading and contrast loss – not an
              exact forecast.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 text-xs">
            <span>Skin tone matching</span>
            <Switch checked={toneMatch} onCheckedChange={setToneMatch} />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs">
            <span>Hair adaptation (approximation)</span>
            <Switch checked={hairResponse} onCheckedChange={setHairResponse} />
          </label>

          {skinInfo && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span
                className="h-4 w-4 rounded-full border border-white/20"
                style={{ backgroundColor: skinInfo.hex }}
              />
              Sampled skin tone {skinInfo.hex} · hairiness{" "}
              {Math.round(skinInfo.hairiness * 100)}%
            </div>
          )}

          <p className="text-[11px] text-muted-foreground">
            {REALISM_DISCLAIMER}
          </p>
        </div>
      )}

      {phase === "ready" && (
        <div className="absolute inset-x-0 bottom-0 space-y-3 p-4 pb-8">
          <p className="text-center text-[11px] text-white/70">
            {locked
              ? "Locked – the motif stays at the last position."
              : "Drag to move · pinch to resize · twist to rotate"}
          </p>



          <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              ...myMotifs.map((m) => ({ id: m.id, name: m.name, src: m.src })),
              ...TATTOOS.slice(0, 16).map((t) => ({ id: t.id, name: t.name, src: t.src })),
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { if (!lockedRef.current) setMotifId(t.id); }}
                className={`h-14 w-14 shrink-0 rounded-xl border bg-artwork p-1 ${
                  motifId === t.id ? "border-primary" : "border-white/15"
                }`}
                aria-label={t.name}
              >
                <img
                  src={t.src}
                  alt={t.name}
                  className="h-full w-full object-contain"
                />
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button
              variant={recording ? "destructive" : "default"}
              size="lg"
              className="rounded-full"
              onClick={() => (recording ? stopRecording() : startRecording())}
            >
              {recording ? (
                <Square className="mr-2 h-4 w-4 fill-current" />
              ) : (
                <Circle className="mr-2 h-4 w-4 fill-current" />
              )}
              {recording ? `Stop (${remaining}s)` : "Record"}
            </Button>

            <div className="flex flex-col items-center gap-1">
              <div
                className="h-1 w-24 overflow-hidden rounded-full bg-white/15"
                role="meter"
                aria-label="Tracking quality"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={
                  quality.level === "good" ? 100 : quality.level === "fair" ? 55 : 25
                }
              >
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    quality.level === "good"
                      ? "bg-emerald-400"
                      : quality.level === "fair"
                        ? "bg-amber-400"
                        : "bg-red-400"
                  }`}
                  style={{
                    width:
                      quality.level === "good"
                        ? "100%"
                        : quality.level === "fair"
                          ? "55%"
                          : "25%",
                  }}
                />
              </div>
              <Button
                variant={locked ? "default" : "secondary"}
                size="lg"
                className={`rounded-full ${reacquiring ? "animate-pulse" : ""}`}
                onClick={() => setLocked((l) => !l)}
              >
                {locked ? (
                  <Lock
                    className={`mr-2 h-4 w-4 ${reacquiring ? "animate-pulse" : ""}`}
                  />
                ) : (
                  <Unlock className="mr-2 h-4 w-4" />
                )}
                {reacquiring ? "Re-anchoring" : locked ? "Unlock" : "Lock"}
              </Button>
              <span
                className={`h-3 text-[10px] leading-3 ${
                  quality.hint ? "text-amber-300" : "text-transparent"
                }`}
              >
                {quality.hint ?? "·"}
              </span>
            </div>
            <Button
              variant="secondary"
              size="lg"
              className="rounded-full"
              onClick={resetAdjust}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              variant={realismOpen ? "default" : "secondary"}
              size="lg"
              className="rounded-full"
              onClick={() => setRealismOpen((o) => !o)}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Realism
            </Button>

            <Button
              variant="secondary"
              size="lg"
              className="rounded-full"
              onClick={switchCamera}
            >
              <SwitchCamera className="mr-2 h-4 w-4" />
              Flip
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="rounded-full"
              onClick={backToSelect}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {bodyPart?.label}
            </Button>
            <Button
              variant={debug ? "default" : "ghost"}
              size="lg"
              className="rounded-full"
              onClick={() => setDebug((d) => !d)}
            >
              <Bug className="mr-2 h-4 w-4" />
              Debug
            </Button>
          </div>
        </div>
      )}


    </div>
  );
}
