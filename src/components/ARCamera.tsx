import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { removeColor, hexToRgb, rgbToHex } from "@/lib/transparency";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import {
  Upload,
  MoreVertical,
  X,
  RotateCcw,
  Undo2,
  Image as ImageIcon,
  SwitchCamera,
  Download,
  Send,
  Share2,
  Save,
  Sparkles,
  Wand2,
  Loader2,
  Check,
  Ruler,
  Video,
  Camera,
  Square,
  ImageDown,
  Link2,
  Lock,
  Unlock,
  Type,
  Layers,
  Box,
  Waves,
  Sun,
  ThumbsUp,
  ArrowLeft,
  Volume2,
  Search,
  ScanLine,
  PenTool,
  HeartHandshake,
  ChevronUp,
} from "lucide-react";
import { TATTOOS, STYLES, type Tattoo, type TattooStyle } from "@/lib/tattoos";
import { listHiddenMotifs, subscribeHiddenMotifs } from "@/lib/hiddenMotifs";
import {
  curveForCoverage,
  hasLimbShape,
  wrapSourceToCanvas,
  wrapSourceToDataUrl,
} from "@/lib/bodyWrap";
import { ScaleCalibrator } from "@/components/ScaleCalibrator";
import {
  createDistanceMonitor,
  screenRegionToVideo,
} from "@/lib/scaleCalibration";
import {
  NEUTRAL_LIGHT,
  estimateLight,
  lightChanged,
  smoothLight,
  type LightEstimate,
} from "@/lib/lightEstimate";
import { estimateCurvature } from "@/lib/curveEstimate";
import { estimateLimbAxis } from "@/lib/limbAxis";
import { setPxPerCm, useAccess } from "@/lib/access";
import { useAuth } from "@/hooks/useAuth";
import { saveProject } from "@/hooks/useProjects";
import { stashPendingTryOn } from "@/lib/pendingBooking";
import { TextTattooTool } from "@/components/TextTattooTool";
import { CropTool } from "@/components/CropTool";

import {
  saveMyMotif,
  listMyMotifs,
  subscribeMyMotifs,
  type MyMotif,
} from "@/lib/myMotifs";
import { toast } from "sonner";

import { createRegionTracker } from "@/lib/arTracker";
import { motifFrameKey, visibleMotifFrame, type MotifFrame } from "@/lib/lockedMotifShape";
import { createFlowLock, type FlowLock } from "@/lib/flowLock";
import {
  createLockPoseController,
  type LockPoseController,
} from "@/lib/lockPoseController";
import { loadOpenCV, opencvStatus } from "@/lib/opencvLoader";
import {
  sampleVideoSkinTone,
  isLikelySkinTone,
  skinToneStyle,
  inkRenderStyle,
  tintMotifCanvas,
} from "@/lib/skinTone";
import { loadWatermark, drawWatermark } from "@/lib/videoRecording";
import { ShareHub } from "@/components/ShareHub";
import { SocialIcon } from "@/components/SocialIcon";
import {
  composeShareImage,
  dataUrlToBlob,
  canShareFiles,
  saveToCameraRoll,
  shareFile,
  shareLink,
  socialLinkTargets,
  copyToClipboard,
  arMotifShareUrl,
  postToApp,
  POST_TARGETS,
  type PostTarget,
} from "@/lib/share";
import { trackMotifShare } from "@/lib/analytics";
import { cameraTechVisible, cvDebugVisible, setCvDebug as setCvDebugFlag } from "@/lib/debug";
import { CVDebugOverlay } from "@/components/CVDebugOverlay";
import { TroubleshootNote } from "@/components/TroubleshootNote";
import { PrintExportDialog } from "@/components/PrintExportDialog";
import { MatchingShareDialog } from "@/components/MatchingShareDialog";
import { SurfaceScanSheet } from "@/components/SurfaceScanSheet";
import {
  anchorStrength,
  anchorToProfile,
  createSurfaceScan,
  formatScannedAt,
  perspectivePx,
  type SurfaceProfile,
  type SurfaceScan,
} from "@/lib/surfaceProfile";

import {
  clearSurfaceProfile,
  loadSurfaceProfile,
  saveSurfaceProfile,
} from "@/lib/surfaceProfileStore";
import { saveTryon } from "@/hooks/useTryonHistory";
import { useBookmarks } from "@/hooks/useBookmarks";
import { BookmarkStar } from "@/components/BookmarkStar";
import { TryOnStartMenu } from "@/components/TryOnStartMenu";





type Transform = { x: number; y: number; scale: number; rotation: number };

const DEFAULT_TRANSFORM: Transform = { x: 0, y: 0, scale: 1, rotation: 0 };
// Baseline: at scale=1, the tattoo is 200px wide.
const BASE_WIDTH_PX = 200;

/** Scale that renders a motif at its realistic on-skin width. */
const scaleForWidthCm = (widthCm: number, pxPerCm: number) =>
  (widthCm * pxPerCm) / BASE_WIDTH_PX;

// Motifs load smaller than 1:1 so they are easier to drag, pinch and scale on a phone screen.
const INITIAL_PREVIEW_SCALE = 0.55;

/**
 * Curvature presets. A forearm reads flat at 0.45, so the arm default sits a
 * touch higher; a thin wrist wraps hardest and a calf sits between the two.
 */
const CURVE_PRESETS = { flat: 0, arm: 0.58, wrist: 0.7, leg: 0.35 } as const;

const CURVE_COACH_KEY = "inkvision.coach.curve";

/**
 * Snap the measured curvature onto the nearest body preset so a limb reads as
 * a limb and a palm or a back reads as a flat surface, instead of every
 * placement drifting into the same half-wrapped middle ground.
 */
function snapCurve(sample: {
  curve: number;
  confidence: number;
  limbFraction: number;
}): number {
  // A confident flat reading must not banana-warp the back of a hand.
  if (sample.curve < 0.22 && sample.confidence > 0.5) return CURVE_PRESETS.flat;
  // Wrist only when the limb really is thin in frame.
  if (sample.curve > 0.62 && sample.limbFraction < 0.45) return CURVE_PRESETS.wrist;
  if (sample.curve < 0.3) return 0.15;
  return Math.max(CURVE_PRESETS.leg, Math.min(CURVE_PRESETS.wrist, sample.curve * 1.15));
}


export function ARCamera({
  initialTattooId,
  initialWidthCm,
  initialRotation,
  customImageUrl,
  motifName,
  motifId,
  motifPriceOre,
  onBuy,
  onCameraLive,
}: {
  initialTattooId?: string;
  initialWidthCm?: number;
  initialRotation?: number;
  customImageUrl?: string;
  motifName?: string;
  motifId?: string;
  motifPriceOre?: number;
  onBuy?: () => void;
  /** Fires while the live camera owns the screen, so the app nav can hide. */
  onCameraLive?: (live: boolean) => void;
}) {
  const { pxPerCm } = useAccess();
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  // Nothing is placed on skin until the user picks a starting point, so the
  // first frame never flashes a default motif they did not choose.
  const [started, setStarted] = useState(
    !!initialTattooId || !!customImageUrl || !!initialWidthCm,
  );
  // The upload/text helper sentence appears once, the first time it is useful.
  const [showCustomHelp, setShowCustomHelp] = useState(false);
  // A custom motif (sketch, upload, AI) can arrive one render after mount —
  // the /ar route resolves it from storage in an effect. Start the camera as
  // soon as it lands so the start menu never flashes and the sketch is kept.
  useEffect(() => {
    if (customImageUrl && !started) setStarted(true);
  }, [customImageUrl, started]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  // The home page opens /ar?start=design|upload|text so the chosen path
  // continues straight into the camera instead of showing the menu twice.
  const startIntent = (useSearch({ strict: false }) as { start?: string }).start;
  const startIntentDone = useRef(false);
  const startIntentNavigate = useNavigate();
  useEffect(() => {
    if (startIntentDone.current) return;
    if (startIntent !== "design" && startIntent !== "upload" && startIntent !== "text") return;
    startIntentDone.current = true;
    setStarted(true);
    if (startIntent === "upload") {
      setShowCustomHelp(true);
      window.setTimeout(() => uploadInputRef.current?.click(), 500);
    } else if (startIntent === "text") {
      setShowCustomHelp(true);
      setTextOpen(true);
    }
    // Drop the marker from the address so coming back to the camera (or the
    // camera button in the bottom bar) never re-opens the same tool.
    startIntentNavigate({
      to: "/ar",
      search: (s: Record<string, unknown>) => ({ ...s, start: undefined }),
      replace: true,
    });
  }, [startIntent, startIntentNavigate]);

  const [cameraReady, setCameraReady] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [customLabel, setCustomLabel] = useState<string | null>(null);
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const [pendingCrop, setPendingCrop] = useState<string | null>(null);
  const [stripStyle, setStripStyle] = useState<TattooStyle | "All">("All");
  const [stripQuery, setStripQuery] = useState("");
  const [stripSearchOpen, setStripSearchOpen] = useState(false);
  const [myMotifs, setMyMotifs] = useState<MyMotif[]>([]);

  const [textOpen, setTextOpen] = useState(false);
  const [hiddenMotifIds, setHiddenMotifIds] = useState<string[]>([]);
  useEffect(() => {
    setHiddenMotifIds(listHiddenMotifs());
    return subscribeHiddenMotifs(() => setHiddenMotifIds(listHiddenMotifs()));
  }, []);
  const visibleTattoos = useMemo(
    () => TATTOOS.filter((t) => !hiddenMotifIds.includes(t.id)),
    [hiddenMotifIds],
  );
  const [locked, setLocked] = useState(false);
  const [lockToast, setLockToast] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(
    initialTattooId ?? TATTOOS[0].id,
  );
  const defaultTransform = useCallback((): Transform => {
    const motif = TATTOOS.find((t) => t.id === selectedId);
    return {
      ...DEFAULT_TRANSFORM,
      scale: motif
        ? scaleForWidthCm(motif.widthCm, pxPerCm) * INITIAL_PREVIEW_SCALE
        : INITIAL_PREVIEW_SCALE,
    };
  }, [selectedId, pxPerCm]);

  const [transform, setTransform] = useState<Transform>(() => ({
    ...DEFAULT_TRANSFORM,
    scale:
      scaleForWidthCm(
        (TATTOOS.find((t) => t.id === (initialTattooId ?? TATTOOS[0].id)) ??
          TATTOOS[0]).widthCm,
        pxPerCm,
      ) * INITIAL_PREVIEW_SCALE,
  }));
  // Keep both representations of one photo in a single state update. Opening
  // the review sheet with only half of the capture was unreliable on mobile.
  const [captured, setCaptured] = useState<{
    dataUrl: string;
    previewUrl: string;
    baseDataUrl?: string;
  } | null>(null);
  const capturedRef = useRef(captured);
  capturedRef.current = captured;
  useEffect(
    () => () => {
      const current = capturedRef.current;
      if (current?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(current.previewUrl);
      }
    },
    [],
  );

  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  // Darkroom: three taps on the locked pill strips the HUD down to skin + ink.
  const [darkroom, setDarkroom] = useState(false);
  const pillTapRef = useRef<{ n: number; at: number }>({ n: 0, at: 0 });

  const [capturedVideo, setCapturedVideo] = useState<{
    url: string;
    blob: Blob;
    ext: string;
  } | null>(null);

  // My own designs live in one shared store, so uploads and text made
  // anywhere in the app appear right here in the strip.
  useEffect(() => {
    setMyMotifs(listMyMotifs());
    return subscribeMyMotifs(() => setMyMotifs(listMyMotifs()));
  }, []);

  // Apply a shared AR link's size/rotation once the calibration is known.

  const sharedApplied = useRef(false);
  useEffect(() => {
    if (sharedApplied.current) return;
    if (initialWidthCm == null && initialRotation == null) return;
    sharedApplied.current = true;
    setTransform((t) => ({
      ...t,
      scale:
        initialWidthCm && initialWidthCm > 0
          ? (initialWidthCm * pxPerCm) / BASE_WIDTH_PX
          : t.scale,
      rotation: initialRotation ?? t.rotation,
    }));
  }, [initialWidthCm, initialRotation, pxPerCm]);

  const [skinTone, setSkinTone] = useState<{ hex: string; luminance: number } | null>(
    null,
  );
  const [skinToast, setSkinToast] = useState(false);

  // "Live Preview" is shown once, then the badge is just the design name.
  const [liveHint, setLiveHint] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem("inkvision.hint.livepreview")) {
        setLiveHint(true);
        const id = window.setTimeout(() => {
          setLiveHint(false);
          localStorage.setItem("inkvision.hint.livepreview", "1");
        }, 4000);
        return () => window.clearTimeout(id);
      }
    } catch {
      /* storage blocked — just skip the hint */
    }
    return undefined;
  }, []);
  // Small 3-step undo for nudges (position / size / rotation). Not history.
  const [undoStack, setUndoStack] = useState<Transform[]>([]);
  const pushUndo = useCallback((prev: Transform) => {
    setUndoStack((s) => [...s, prev].slice(-3));
  }, []);
  const [shareOpen, setShareOpen] = useState(false);
  const [matchingOpen, setMatchingOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const galleryTouchY = useRef<number | null>(null);
  const [galleryQuery, setGalleryQuery] = useState("");
  const [galleryStyle, setGalleryStyle] = useState<TattooStyle | "All">("All");
  const filteredGalleryTattoos = useMemo(() => {
    const q = galleryQuery.trim().toLowerCase();
    return visibleTattoos
      .filter((tattoo) => galleryStyle === "All" || tattoo.style === galleryStyle)
      .filter(
        (tattoo) =>
          !q ||
          [tattoo.name, tattoo.artist, tattoo.style, tattoo.type]
            .join(" ")
            .toLowerCase()
            .includes(q),
      );
  }, [galleryQuery, galleryStyle, visibleTattoos]);
  const {
    ids: bookmarkIds,
    toggle: toggleBookmark,
    signedIn: bookmarksSignedIn,
  } = useBookmarks();
  const [menuOpen, setMenuOpen] = useState(false);
  // Off by default; read from storage after mount to avoid hydration mismatch.
  const [shutterSound, setShutterSound] = useState(false);
  useEffect(() => {
    void import("@/lib/shutterSound").then((m) => setShutterSound(m.isShutterSoundEnabled()));
  }, []);
  const navigate = useNavigate();
  const { user } = useAuth();
  const showTech = cameraTechVisible();

  // --- Hidden CV debug view -------------------------------------------------
  // Five taps on the Live Preview badge (or the localStorage flag) draws the
  // raw tracker state over the feed: cylinder proxy, tracked points, mask,
  // point count and FPS.
  const [cvDebug, setCvDebug] = useState(false);
  useEffect(() => setCvDebug(cvDebugVisible()), []);
  const tapRef = useRef<{ n: number; t: number }>({ n: 0, t: 0 });
  const onBadgeTap = useCallback(() => {
    const now = Date.now();
    const st = tapRef.current;
    st.n = now - st.t > 600 ? 1 : st.n + 1;
    st.t = now;
    if (st.n >= 5) {
      st.n = 0;
      setCvDebug((v) => {
        const next = !v;
        setCvDebugFlag(next);
        toast(next ? "CV debug view on" : "CV debug view off");
        return next;
      });
    }
  }, []);



  const sessionIdRef = useRef<string>(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()),
  );



  const activeTattoo = TATTOOS.find((t) => t.id === selectedId) ?? TATTOOS[0];
  const activeSrc = customImage ?? customImageUrl ?? activeTattoo.src;
  const displayName = customImage
    ? (customLabel ?? "Custom design")
    : customImageUrl
      ? (motifName ?? "Marketplace")
      : activeTattoo.name;
  // --- Distance-aware 1:1 scale --------------------------------------------
  // `distRel` is how much closer/further the camera is compared to the frame
  // the calibration was taken in. Multiplying px/cm by it keeps the centimetre
  // readout honest at any distance.
  const [distRel, setDistRel] = useState(1);
  const [scaleHold, setScaleHold] = useState(false);
  const [calibOpen, setCalibOpen] = useState(false);
  const [calibToast, setCalibToast] = useState<string | null>(null);
  const livePxPerCm = pxPerCm * distRel;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const pxPerCmRef = useRef(pxPerCm);
  pxPerCmRef.current = pxPerCm;
  const distRelRef = useRef(distRel);
  distRelRef.current = distRel;
  const scaleHoldRef = useRef(scaleHold);
  scaleHoldRef.current = scaleHold;
  const transformRef = useRef(transform);
  // During lock the imperative renderer owns the hot pose. Do not let an
  // unrelated React render overwrite it with the last sparse state snapshot.
  if (!lockedRef.current) transformRef.current = transform;
  const trackedLiveTransformRef = useRef(transform);
  const facingRef = useRef(facing);
  facingRef.current = facing;
  /**
   * A real tattoo cannot change physical size. While the lock is engaged the
   * tracker's scale is a *distance* signal, so the centimetre reading is frozen
   * at the value that was true when the lock engaged. Cleared on unlock.
   */
  const [lockedWidthCm, setLockedWidthCm] = useState<number | null>(null);
  const liveWidthCm = (BASE_WIDTH_PX * transform.scale) / livePxPerCm;
  // Small deadband so the last decimal does not flicker on tracker noise.
  const shownCmRef = useRef(liveWidthCm);
  if (
    lockedWidthCm == null &&
    Math.abs(liveWidthCm - shownCmRef.current) > 0.06
  ) {
    shownCmRef.current = liveWidthCm;
  }
  const widthCm = (lockedWidthCm ?? shownCmRef.current).toFixed(1);
  const skinStyle = skinToneStyle(skinTone?.luminance ?? null);



  // --- Body curvature: bend the flat motif around a virtual limb ------------
  // The camera reads the limb's roundness itself; the slider is only a manual
  // override for the rare case where the automatic reading is off.
  const [curve, setCurve] = useState<number>(CURVE_PRESETS.flat);
  const curveRef = useRef(curve);
  curveRef.current = curve;
  const [autoCurve, setAutoCurve] = useState(false);
  const [curveConf, setCurveConf] = useState(0);
  const [curveOpen, setCurveOpen] = useState(false);
  // Set when the detector cannot see both sides of the limb, so we hold the
  // last good wrap instead of slamming the design back to flat.
  const [curveHint, setCurveHint] = useState(false);
  const [curveCoach, setCurveCoach] = useState(false);
  // Surface pose read from the camera: which way the limb runs and how far it
  // leans away. Applied on top of the user's own rotation so the design lies
  // along the skin instead of standing up as a flat sticker.
  const [surface, setSurface] = useState<{
    axisDeg: number;
    tilt: number;
    tiltDir: -1 | 1;
  }>({ axisDeg: 0, tilt: 0, tiltDir: 1 });
  const surfaceRef = useRef(surface);
  surfaceRef.current = surface;
  // Shape of the body part *along* its axis: how much it narrows toward the
  // far end and how much the joint is bent. The cylindrical wrap alone treats
  // every limb as a straight tube of constant thickness.
  const [limbShape, setLimbShape] = useState<{
    widthRatio: number;
    bendDeg: number | null;
  }>({ widthRatio: 1, bendDeg: null });

  // --- Surface Scan (light 3D) ---------------------------------------------
  // A slow sweep around the limb accumulates curvature, axis, lean, light and
  // skin tone from many angles into one profile, which then anchors the live
  // readings instead of letting each frame decide on its own.
  const [scanOpen, setScanOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanCoverage, setScanCoverage] = useState(0);
  const [scanSamples, setScanSamples] = useState(0);
  const [scanHint, setScanHint] = useState<string | null>(null);
  const [scanQuality, setScanQuality] = useState(0);
  /** Distinct angles banked so far, and whether stopping now is worthwhile. */
  const [scanAngles, setScanAngles] = useState(0);
  const [scanTargetAngles, setScanTargetAngles] = useState(8);
  const [scanUsable, setScanUsable] = useState(false);


  const [scanResult, setScanResult] = useState<SurfaceProfile | null>(null);
  const [profile, setProfile] = useState<SurfaceProfile | null>(null);
  const profileRef = useRef<SurfaceProfile | null>(null);
  profileRef.current = profile;
  const scanRef = useRef<SurfaceScan | null>(null);
  /** Last angle count, so a new angle can be acknowledged with a tick. */
  const lastScanAngles = useRef(0);



  const [occlusion, setOcclusion] = useState(0.85);
  const [autoLight, setAutoLight] = useState(true);
  const [light, setLight] = useState<LightEstimate>(NEUTRAL_LIGHT);
  // Layered ink render (core, dermal bleed, skin sheen, skin grain).
  const inkStyle = useMemo(
    () => inkRenderStyle(skinTone?.luminance ?? null, light),
    [skinTone?.luminance, light],
  );
  const skinToneRef = useRef<number | null>(null);
  skinToneRef.current = skinTone?.luminance ?? null;
  const lightRef = useRef<LightEstimate>(light);
  lightRef.current = light;
  const [wrappedSrc, setWrappedSrc] = useState<string | null>(null);


  // One-time nudge on the curvature icon the first time a design is on skin.
  useEffect(() => {
    if (!cameraReady) return;
    try {
      if (localStorage.getItem(CURVE_COACH_KEY)) return;
    } catch {
      return;
    }
    const id = window.setTimeout(() => setCurveCoach(true), 1200);
    return () => window.clearTimeout(id);
  }, [cameraReady]);

  const dismissCurveCoach = () => {
    setCurveCoach(false);
    try {
      localStorage.setItem(CURVE_COACH_KEY, "1");
    } catch {
      /* private mode */
    }
  };

  // Warm the vision runtime as soon as the camera runs, so Lock is instant.
  useEffect(() => {
    if (!cameraReady) return;
    void loadOpenCV();
  }, [cameraReady]);



  // Measure the limb curvature straight from the video under the design.
  useEffect(() => {
    if (!autoCurve || !cameraReady) return;
    const id = window.setInterval(() => {
      // The surface geometry is part of the locked placement. Re-estimating it
      // behind the optical-flow lock changed the bitmap's projected width and
      // looked exactly like random resizing/blinking.
      if (lockPhaseRef.current !== "idle") return;
      const v = videoRef.current;
      const stage = stageRef.current;
      if (!v || !stage || document.hidden) return;
      const rect = stage.getBoundingClientRect();
      const t = transformRef.current;
      const sample = estimateCurvature(
        v,
        rect,
        { x: rect.width / 2 + t.x, y: rect.height / 2 + t.y },
        BASE_WIDTH_PX * t.scale,
        facingRef.current === "user",
      );
      if (!sample) return;
      setCurveConf(sample.confidence);
      // Without both silhouette edges the reading is a guess: hold the last
      // wrap and ask for a better angle instead of flattening the design.
      if (!sample.edgesInFrame) {
        setCurveHint(true);
        return;
      }
      setCurveHint(false);
      if (sample.confidence < 0.35) return;
      // With a scanned profile the live reading orbits the measured surface
      // instead of re-deciding the limb shape on every pass.
      const measured = snapCurve(sample);
      const target = profileRef.current
        ? anchorToProfile(
            measured,
            profileRef.current.curve,
            anchorStrength(profileRef.current),
          )
        : measured;

      // Ease toward the measurement so the wrap never pops between frames,
      // with a dead band so the tattoo does not breathe while you hold still.
      setCurve((prev) => {
        if (Math.abs(target - prev) < 0.03) return prev;
        const next = prev + (target - prev) * (0.09 + 0.16 * sample.confidence);
        return Math.abs(next - prev) < 0.01 ? prev : Math.round(next * 100) / 100;
      });
    }, 800);
    return () => window.clearInterval(id);
  }, [autoCurve, cameraReady]);

  // Read the limb's direction and lean from the frame, so a design on a
  // diagonal forearm follows the arm instead of standing straight up.
  useEffect(() => {
    if (!autoCurve || !cameraReady) return;
    const id = window.setInterval(() => {
      // Do not let a noisy silhouette reading rotate/tilt an already locked
      // tattoo independently of the skin tracker.
      if (lockPhaseRef.current !== "idle") return;
      const v = videoRef.current;
      const stage = stageRef.current;
      if (!v || !stage || document.hidden) return;
      const rect = stage.getBoundingClientRect();
      const t = transformRef.current;
      const sample = estimateLimbAxis(
        v,
        rect,
        { x: rect.width / 2 + t.x, y: rect.height / 2 + t.y },
        BASE_WIDTH_PX * t.scale,
        facingRef.current === "user",
      );
      if (!sample || sample.confidence < 0.4) return;
      const prof = profileRef.current;
      const pull = anchorStrength(prof, 0.55);
      const targetAxis = prof
        ? anchorToProfile(sample.axisDeg, prof.axisDeg, pull)
        : sample.axisDeg;
      const targetTilt = prof
        ? anchorToProfile(sample.tilt, prof.tilt, pull)
        : sample.tilt;

      // Ease toward the reading; a dead band keeps the design from drifting
      // while you hold still.
      setSurface((prev) => {
        const ease = 0.1 + 0.2 * sample.confidence;
        const axisDeg = prev.axisDeg + (targetAxis - prev.axisDeg) * ease;
        const tilt = prev.tilt + (targetTilt - prev.tilt) * ease;
        if (
          Math.abs(axisDeg - prev.axisDeg) < 0.4 &&
          Math.abs(tilt - prev.tilt) < 0.02
        )
          return prev;
        return {
          axisDeg: Math.round(axisDeg * 10) / 10,
          tilt: Math.round(tilt * 100) / 100,
          tiltDir: prof ? prof.tiltDir : sample.tiltDir,
        };
      });

      // Taper and joint bend change slowly; ease them the same way.
      setLimbShape((prev) => {
        const ease = 0.12 + 0.2 * sample.confidence;
        const targetRatio = prof?.taper
          ? anchorToProfile(sample.widthRatio, prof.taper, pull)
          : sample.widthRatio;
        const widthRatio = prev.widthRatio + (targetRatio - prev.widthRatio) * ease;
        const bendTarget = sample.bendDeg;
        const bendDeg =
          bendTarget == null
            ? prev.bendDeg
            : prev.bendDeg == null
              ? bendTarget
              : prev.bendDeg + (bendTarget - prev.bendDeg) * ease;
        if (
          Math.abs(widthRatio - prev.widthRatio) < 0.02 &&
          Math.abs((bendDeg ?? 180) - (prev.bendDeg ?? 180)) < 1.5
        )
          return prev;
        return {
          widthRatio: Math.round(widthRatio * 100) / 100,
          bendDeg: bendDeg == null ? null : Math.round(bendDeg),
        };
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [autoCurve, cameraReady]);

  // Reset the pose when the automatic reading is switched off.
  useEffect(() => {
    if (!autoCurve && lockPhaseRef.current === "idle") {
      setSurface({ axisDeg: 0, tilt: 0, tiltDir: 1 });
      setLimbShape({ widthRatio: 1, bendDeg: null });
    }
  }, [autoCurve]);

  // Restore the last accepted surface profile, so a returning session — or a
  // simple motif switch — starts with the scanned shape already applied
  // instead of asking for another scan.
  useEffect(() => {
    const saved = loadSurfaceProfile(user?.id ?? null);
    if (!saved || lockPhaseRef.current !== "idle") return;
    setProfile(saved);
    setSurface({
      axisDeg: saved.axisDeg,
      tilt: saved.tilt,
      tiltDir: saved.tiltDir,
    });
    setLimbShape({ widthRatio: saved.taper ?? 1, bendDeg: null });
    setLight((prev) => ({ ...prev, ...saved.light }));
    if (saved.skinLuma != null) {
      setSkinTone((prev) => prev ?? { hex: "#c68642", luminance: saved.skinLuma! });
    }
  }, [user?.id]);

  /** Applies a profile to the live wrap, pose and light in one go. */
  const applyProfile = useCallback((p: SurfaceProfile) => {
    if (lockPhaseRef.current !== "idle") return;
    setProfile(p);
    setCurve(p.curve);
    setSurface({ axisDeg: p.axisDeg, tilt: p.tilt, tiltDir: p.tiltDir });
    setLimbShape({ widthRatio: p.taper ?? 1, bendDeg: null });
    setLight((prev) => ({ ...prev, ...p.light }));
    if (p.skinLuma != null) {
      setSkinTone((prev) => prev ?? { hex: "#c68642", luminance: p.skinLuma! });
    }
  }, []);

  const startSurfaceScan = useCallback(() => {
    scanRef.current = createSurfaceScan();
    setScanResult(null);
    setScanCoverage(0);
    setScanSamples(0);
    setScanHint(null);
    setScanQuality(0);
    setScanAngles(0);
    lastScanAngles.current = 0;

    setScanUsable(false);
    setScanning(true);
  }, []);


  const stopSurfaceScan = useCallback(
    (finalize: boolean) => {
      setScanning(false);
      const scan = scanRef.current;
      if (!scan) return;
      if (finalize) {
        const result = scan.finalize(pxPerCm);
        setScanResult(result);
        if (!result)
          setScanHint("Too few readings — sweep a couple of seconds longer");
      }
      scanRef.current = null;
    },
    [pxPerCm],
  );

  /** Stop early and keep whatever the sweep managed to measure. */
  const finishSurfaceScan = useCallback(() => {
    try {
      navigator.vibrate?.(18);
    } catch {
      /* haptics are a nicety */
    }
    stopSurfaceScan(true);
  }, [stopSurfaceScan]);

  /** Throw the sweep away without changing the current placement. */
  const cancelSurfaceScan = useCallback(() => {
    stopSurfaceScan(false);
  }, [stopSurfaceScan]);


  // The sweep itself: the same estimators the live view uses, run tighter and
  // fed into the accumulator instead of straight onto the design.
  useEffect(() => {
    if (!scanning || !cameraReady) return;
    const id = window.setInterval(() => {
      const scan = scanRef.current;
      const v = videoRef.current;
      const stage = stageRef.current;
      if (!scan || !v || !stage || document.hidden) return;
      const rect = stage.getBoundingClientRect();
      const t = transformRef.current;
      const center = { x: rect.width / 2 + t.x, y: rect.height / 2 + t.y };
      const widthPx = BASE_WIDTH_PX * t.scale;
      const mirrored = facingRef.current === "user";

      const curveSample = estimateCurvature(v, rect, center, widthPx, mirrored);
      const axisSample = estimateLimbAxis(v, rect, center, widthPx, mirrored);
      if (!curveSample || !axisSample) return;

      const lightSample = estimateLight(v);
      const tone = sampleVideoSkinTone(v, {
        x: mirrored
          ? 1 - (0.5 + t.x / rect.width)
          : 0.5 + t.x / rect.width,
        y: 0.5 + t.y / rect.height,
      });

      const fb = scan.add({
        curve: curveSample.curve,
        curveConf: curveSample.edgesInFrame ? curveSample.confidence : 0,
        limbFraction: curveSample.limbFraction,
        axisDeg: axisSample.axisDeg,
        tilt: axisSample.tilt,
        tiltDir: axisSample.tiltDir,
        axisConf: axisSample.confidence,
        // The curvature strip is sampled 2.1x wider than the design.
        limbWidthPx: curveSample.edgesInFrame
          ? curveSample.limbFraction * widthPx * 2.1
          : undefined,
        light: lightSample ?? undefined,
        skinLuma: tone?.luminance,
      });

      setScanCoverage(fb.coverage);
      setScanSamples(fb.samples);
      setScanHint(fb.hint);
      setScanQuality(fb.quality);
      setScanAngles(fb.angles);
      setScanTargetAngles(fb.targetAngles);
      setScanUsable(fb.usable);
      // A soft tick each time a genuinely new angle lands, so the sweep is
      // something you feel working rather than a number you stare at.
      if (fb.angles > lastScanAngles.current) {
        lastScanAngles.current = fb.angles;
        try {
          navigator.vibrate?.(8);
        } catch {
          /* haptics are a nicety */
        }
      }



      if (scan.complete()) {
        try {
          navigator.vibrate?.([30, 60, 30]);
        } catch {
          /* haptics are a nicety */
        }
        stopSurfaceScan(true);
      }
    }, 150);
    return () => window.clearInterval(id);
  }, [scanning, cameraReady, stopSurfaceScan]);


  /**
   * CSS transform that lays the design down on the measured surface. A
   * scanned limb that narrows toward one end gets a nearer vanishing point,
   * so the design converges the way the real body part does.
   */
  const surfacePose = useMemo(
    () =>
      `perspective(${perspectivePx(profile)}px) rotateX(${(
        surface.tiltDir * surface.tilt * 22
      ).toFixed(1)}deg)`,
    [surface, profile],

  );




  // Re-read the scene light on an idle callback and ease toward it, so the
  // motif's shading follows the room without stealing frames from the camera.
  useEffect(() => {
    if (!autoLight || !cameraReady) return;
    const idle: (cb: () => void) => number =
      typeof (window as unknown as { requestIdleCallback?: unknown })
        .requestIdleCallback === "function"
        ? (cb) =>
            (
              window as unknown as {
                requestIdleCallback: (c: () => void, o?: object) => number;
              }
            ).requestIdleCallback(cb, { timeout: 500 })
        : (cb) => window.setTimeout(cb, 0);
    const id = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || document.hidden || lockPhaseRef.current !== "idle") return;
      idle(() => {
        if (lockPhaseRef.current !== "idle") return;
        const next = estimateLight(v);
        if (!next) return;
        setLight((prev) => {
          const eased = smoothLight(prev, next, 0.25);
          // Skip the state update — and therefore the re-render — when the
          // room light has barely moved.
          return lightChanged(prev, eased) ? eased : prev;
        });
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [autoLight, cameraReady]);

  // Re-bake only when the motif geometry changes. Replacing the blob URL on
  // every light sample made Mobile Safari briefly drop the image (and all CSS
  // masks that use it), which appeared as a regular blink in the camera. Live
  // light still updates through inkStyle without replacing the bitmap.
  const wrappedUrlRef = useRef<string | null>(null);
  // The exact bitmap the live <img> shows. Photo + video capture draw this
  // canvas, so size, occlusion and shading can never drift from the preview.
  const wrappedCanvasRef = useRef<HTMLCanvasElement | null>(null);
  /**
   * The measured body part translated into wrap parameters: how the limb
   * narrows toward its far end, how far it leans away, how bent the joint is,
   * and how far a design of this width actually reaches around the limb.
   */
  const wrapShape = useMemo(() => {
    const dir = surface.tiltDir;
    // shapeAlongLimb reads taper as far-end / near-end.
    const ratio = dir === 1 ? limbShape.widthRatio : 1 / (limbShape.widthRatio || 1);
    const designCm = Number(widthCm);
    const coverageCurve =
      profile?.widthCm && designCm > 0
        ? curveForCoverage(designCm, profile.widthCm)
        : null;
    // Never make the wrap weaker than the live reading — only sharper when the
    // design is wide relative to the measured limb.
    const shapedCurve =
      coverageCurve != null ? Math.max(curve, coverageCurve * 0.85) : curve;
    // A design wider than the scanned body part has wrapped around it — the
    // surplus sits on the far side and must not be painted past the silhouette.
    const visibleFraction =
      profile?.widthCm && designCm > profile.widthCm
        ? Math.max(0.35, profile.widthCm / designCm)
        : 1;
    return {
      taper: Math.max(0.5, Math.min(1.6, ratio)),
      tilt: surface.tilt,
      tiltDir: dir,
      bendDeg: limbShape.bendDeg,
      curve: Math.min(1, shapedCurve),
      visibleFraction,
    };
  }, [surface, limbShape, profile, widthCm, curve]);

  const liveMotifFrame: MotifFrame = { src: activeSrc, shape: wrapShape, occlusion, surfacePose };
  const frozenMotifFrameRef = useRef<MotifFrame | null>(null);
  // React re-renders for tracking and camera light; none may recompute the
  // wrapped bitmap or 3D surface perspective while the skin is locked.
  const motifFrame = visibleMotifFrame(liveMotifFrame, frozenMotifFrameRef.current);
  const frameKey = motifFrameKey(motifFrame);
  const wrappedFrameKeyRef = useRef<string | null>(null);
  const activeShape = motifFrame.shape;
  const activeWrap = activeShape.curve > 0.01 || hasLimbShape(activeShape) || activeShape.visibleFraction < 0.999;
  const readyWrappedSrc = wrappedFrameKeyRef.current === frameKey ? wrappedSrc : null;

  useEffect(() => {
    let alive = true;
    const release = (url = wrappedUrlRef.current) => {
      if (url?.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
      if (wrappedUrlRef.current === url) wrappedUrlRef.current = null;
    };
    if (!activeWrap) {
      release();
      wrappedCanvasRef.current = null;
      wrappedFrameKeyRef.current = null;
      setWrappedSrc(null);
      return;
    }
    const id = window.setTimeout(() => {
      void wrapSourceToDataUrl(motifFrame.src, {
        curve: activeShape.curve,
        // Round limbs need their edges to recede a little harder than the flat
        // default bow, otherwise the decal still reads as a sticker.
        bow: Math.min(1, activeShape.curve * 1.25),
        taper: activeShape.taper,
        tilt: activeShape.tilt,
        tiltDir: activeShape.tiltDir,
        bendDeg: activeShape.bendDeg,
        visibleFraction: activeShape.visibleFraction,
        occlusion: motifFrame.occlusion,
        // Keep bitmap shading neutral and stable. Directional room light is
        // rendered by the persistent pigment/sheen layers below.
        light: { x: 0, y: -0.35, strength: 0.35 },
      }).then((res) => {
        if (!alive || !res) {
          if (res?.url.startsWith("blob:")) URL.revokeObjectURL(res.url);
          return;
        }
        const previous = wrappedUrlRef.current;
        let committed = false;
        const commit = () => {
          if (committed) return;
          committed = true;
          if (!alive) {
            if (res.url.startsWith("blob:")) URL.revokeObjectURL(res.url);
            return;
          }
          wrappedUrlRef.current = res.url;
          wrappedCanvasRef.current = res.canvas;
          wrappedFrameKeyRef.current = frameKey;
          setWrappedSrc(res.url);
          // Keep the previous decoded source alive through the paint where
          // React swaps the two <img>s and their masks.
          if (previous && previous !== res.url) {
            window.setTimeout(() => release(previous), 250);
          }
        };

        // Decode before exposing the URL to React. Without this, Safari can
        // paint one transparent frame while the new object URL is decoded.
        const preload = new Image();
        preload.onload = commit;
        preload.onerror = commit;
        preload.src = res.url;
        if (typeof preload.decode === "function") {
          void preload.decode().then(commit).catch(() => undefined);
        }
      });
    }, 90);
    return () => {
      alive = false;
      window.clearTimeout(id);
    };
  }, [frameKey, activeWrap]);

  // Free the last object URL when the camera unmounts.
  useEffect(
    () => () => {
      if (wrappedUrlRef.current?.startsWith("blob:")) {
        URL.revokeObjectURL(wrappedUrlRef.current);
      }
    },
    [],
  );
  // The bake runs whenever the scan measured *any* shape — curvature, taper,
  // lean or joint bend — so a motif on an almost flat but leaning surface is
  // shaped too instead of falling back to the flat sticker.
  const wrapActive = activeWrap;
  const renderSrc = (wrapActive && readyWrappedSrc) || motifFrame.src;



  const sampleSkin = () => {
    const v = videoRef.current;
    if (!v) return;
    // Read the pixels the design is actually sitting on, not a fixed corner.
    const stage = stageRef.current?.getBoundingClientRect();
    const t = transformRef.current;
    let at: { x: number; y: number; size?: number } | undefined;
    if (stage && stage.width > 0 && stage.height > 0) {
      let fx = 0.5 + t.x / stage.width;
      const fy = 0.5 + t.y / stage.height;
      // The front camera is mirrored on screen; the raw frame is not.
      if (facingRef.current === "user") fx = 1 - fx;
      at = {
        x: fx,
        y: fy,
        size: Math.max(
          28,
          Math.min(120, (BASE_WIDTH_PX * t.scale * v.videoWidth) / stage.width / 3),
        ),
      };
    }
    const s = sampleVideoSkinTone(v, at);
    if (!s) return;
    setSkinTone({ hex: s.hex, luminance: s.luminance });
    setSkinToast(true);
    setTimeout(() => setSkinToast(false), 1600);
  };

  // Start camera — prefer 720p on small screens to save GPU/battery,
  // cap frame rate to 30fps, and pause when the tab is hidden.
  useEffect(() => {
    if (!started) return;
    let stream: MediaStream | null = null;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("The camera is not supported in this browser.");
        }
        const isSmall = typeof window !== "undefined" && window.innerWidth < 640;
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: isSmall ? 1280 : 1920 },
            height: { ideal: isSmall ? 720 : 1080 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        setCameraError(
          err instanceof Error
            ? err.message
            : "Could not start the camera. Grant the app camera permission.",
        );
      }
    }
    void start();

    const onVis = () => {
      const v = videoRef.current;
      if (!v) return;
      if (document.hidden) v.pause();
      else void v.play().catch(() => {});
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [facing, started]);

  // Tell the page when the live camera owns the screen.
  useEffect(() => {
    onCameraLive?.(started && cameraReady && !cameraError);
    return () => onCameraLive?.(false);
  }, [started, cameraReady, cameraError, onCameraLive]);

  // A camera that never opens must not spin forever — fall back to the
  // photo flow instead.
  useEffect(() => {
    if (!started || cameraReady || cameraError) return;
    const id = window.setTimeout(
      () =>
        setCameraError(
          "The camera did not start. It may be blocked, or in use by another app.",
        ),
      9000,
    );
    return () => window.clearTimeout(id);
  }, [started, cameraReady, cameraError]);

  // Show the flip button only when the device actually has more than one camera.
  useEffect(() => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    navigator.mediaDevices
      .enumerateDevices()
      .then((d) => {
        setHasMultipleCameras(
          d.filter((x) => x.kind === "videoinput").length > 1,
        );
      })
      .catch(() => undefined);
  }, [cameraReady]);

  const flipCamera = () => {
    setCameraReady(false);
    setCameraError(null);
    // Only the feed changes: size in cm, the wrap and any active lock all
    // stay exactly as they were.
    setFacing((f) => (f === "environment" ? "user" : "environment"));
    if (lockedRef.current) {
      // Same placement, fresh skin patch to track on the new feed.
      window.setTimeout(() => reanchorLockRef.current?.(), 600);
    }
  };

  // Gesture handling: 1-finger pan, 2-finger pinch/rotate
  const pointers = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureStart = useRef<{
    dist: number;
    angle: number;
    transform: Transform;
    midX: number;
    midY: number;
  } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (locked) return;
    if (pointers.current.size === 0) pushUndo({ ...transform });
    (e.target as Element).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      gestureStart.current = {
        dist: Math.hypot(dx, dy),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
        transform: { ...transform },
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
      };
    } else {
      gestureStart.current = null;
    }
  }, [transform, locked, pushUndo]);

  // --- Time-smoothed gesture transform -------------------------------------
  // Gestures write to a *target*; a rAF loop eases the rendered transform
  // toward it so drags/rotations glide instead of jumping between samples.
  const pendingTransform = useRef<Transform | null>(null); // = target
  const rafId = useRef<number | null>(null);
  const lastTick = useRef<number>(0);
  const smoothRef = useRef<Transform>(transform);
  useEffect(() => {
    if (pendingTransform.current == null) smoothRef.current = transform;
  }, [transform]);

  const SMOOTH_MS = 105; // higher = smoother / more damped

  const stopSmoothing = useCallback((snap: boolean) => {
    if (rafId.current != null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    const target = pendingTransform.current;
    pendingTransform.current = null;
    if (snap && target) {
      smoothRef.current = target;
      setTransform(target);
    }
  }, []);

  const tick = useCallback((now: number) => {
    const target = pendingTransform.current;
    if (!target) {
      rafId.current = null;
      return;
    }
    const dt = Math.min(64, Math.max(1, now - (lastTick.current || now)));
    lastTick.current = now;
    const a = 1 - Math.exp(-dt / SMOOTH_MS);
    const cur = smoothRef.current;
    const next: Transform = {
      x: cur.x + (target.x - cur.x) * a,
      y: cur.y + (target.y - cur.y) * a,
      scale: cur.scale + (target.scale - cur.scale) * a,
      rotation: cur.rotation + (target.rotation - cur.rotation) * a,
    };
    const settled =
      Math.abs(target.x - next.x) < 0.15 &&
      Math.abs(target.y - next.y) < 0.15 &&
      Math.abs(target.scale - next.scale) < 0.0015 &&
      Math.abs(target.rotation - next.rotation) < 0.05;
    const out = settled ? target : next;
    smoothRef.current = out;
    setTransform(out);
    if (settled && !pointers.current.size && !resizeRef.current) {
      pendingTransform.current = null;
      rafId.current = null;
      return;
    }
    rafId.current = requestAnimationFrame(tick);
  }, []);

  const scheduleTransform = useCallback((next: Transform) => {
    pendingTransform.current = next;
    if (rafId.current != null) return;
    lastTick.current = 0;
    rafId.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => {
    if (rafId.current != null) cancelAnimationFrame(rafId.current);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    // While locked the placement is frozen — only the tracker may move it.
    if (locked) {
      pointers.current.clear();
      gestureStart.current = null;
      return;
    }
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      const base = pendingTransform.current ?? transform;
      scheduleTransform({ ...base, x: base.x + dx, y: base.y + dy });
    } else if (pointers.current.size === 2 && gestureStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
      const start = gestureStart.current;
      const scale = Math.max(
        0.3,
        Math.min(4, start.transform.scale * (dist / start.dist)),
      );
      const rotation = start.transform.rotation + (angle - start.angle);
      const base = pendingTransform.current ?? start.transform;
      scheduleTransform({ ...base, scale, rotation });
    }
  }, [scheduleTransform, transform, locked]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gestureStart.current = null;
    // Let the easing settle on the final target instead of snapping.
    if (pendingTransform.current && rafId.current == null) {
      lastTick.current = 0;
      rafId.current = requestAnimationFrame(tick);
    }
    if (pointers.current.size === 0) queueReanchorRef.current?.();
  }, [tick]);
  const queueReanchorRef = useRef<(() => void) | null>(null);

  // Hand ownership of the transform to the tracker the moment we lock.
  useEffect(() => {
    if (locked) stopSmoothing(true);
  }, [locked, stopSmoothing]);



  // --- Drag a corner handle to resize the design ---------------------------
  const resizeRef = useRef<{
    id: number;
    dist: number;
    scale: number;
  } | null>(null);

  const motifCenter = useCallback(() => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: rect.left + rect.width / 2 + transform.x,
      y: rect.top + rect.height / 2 + transform.y,
    };
  }, [transform.x, transform.y]);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      const c = motifCenter();
      if (!c) return;
      (e.target as Element).setPointerCapture(e.pointerId);
      pushUndo({ ...transform });
      resizeRef.current = {
        id: e.pointerId,
        dist: Math.max(1, Math.hypot(e.clientX - c.x, e.clientY - c.y)),
        scale: transform.scale,
      };
    },
    [motifCenter, transform, pushUndo],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const start = resizeRef.current;
      if (!start || start.id !== e.pointerId) return;
      e.stopPropagation();
      const c = motifCenter();
      if (!c) return;
      const dist = Math.hypot(e.clientX - c.x, e.clientY - c.y);
      const scale = Math.max(
        0.3,
        Math.min(4, start.scale * (dist / start.dist)),
      );
      scheduleTransform({ ...(pendingTransform.current ?? transform), scale });
    },
    [motifCenter, scheduleTransform, transform],
  );

  const onResizePointerUp = useCallback((e: React.PointerEvent) => {
    if (resizeRef.current?.id !== e.pointerId) return;
    e.stopPropagation();
    resizeRef.current = null;
    if (pendingTransform.current && rafId.current == null) {
      lastTick.current = 0;
      rafId.current = requestAnimationFrame(tick);
    }
  }, [tick]);




  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingCrop(url);
    e.target.value = "";
  };

  /* Stable handlers for the memoised motif strip — the AR view re-renders per
     tracking frame, and unstable props made the tiles flicker. */
  const stripFnsRef = useRef({ onUpload, defaultTransform });
  stripFnsRef.current = { onUpload, defaultTransform };
  const handleStripUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => stripFnsRef.current.onUpload(e),
    [],
  );
  const pickMyMotif = useCallback((m: MyMotif) => {
    if (lockPhaseRef.current !== "idle") return;
    setCustomImage(m.src);
    setCustomLabel(m.name);
    setTransform(stripFnsRef.current.defaultTransform());
  }, []);
  const pickTattoo = useCallback((t: Tattoo) => {
    if (lockPhaseRef.current !== "idle") return;
    setCustomImage(null);
    setSelectedId(t.id);
    setTransform(stripFnsRef.current.defaultTransform());
  }, []);
  const toggleStripSearch = useCallback(() => {
    setStripSearchOpen((v) => {
      if (v) setStripQuery("");
      return !v;
    });
  }, []);
  const openTextTool = useCallback(() => {
    setShowCustomHelp(true);
    setTextOpen(true);
  }, []);
  const openGallerySheet = useCallback(() => setGalleryOpen(true), []);
  const markCustomHelp = useCallback(() => setShowCustomHelp(true), []);

  const commitUpload = (url: string) => {
    if (lockPhaseRef.current !== "idle") return;
    setCustomImage(url);
    setCustomLabel("Custom image");
    setPendingUpload(null);
    setTransform(defaultTransform());
    // One shared design model: an upload made here shows up under My Designs
    // in the library, in Photo Try-On and in Live Try-On as well.
    try {
      saveMyMotif({ name: "Upload", src: url, source: "upload" });
      toast.success("Saved to your designs");
    } catch {
      /* ignore */
    }
  };


  // --- Lock the design onto the skin -----------------------------------------
  // Tapping Lock snapshots the real skin patch under the design (corner
  // features from OpenCV's goodFeaturesToTrack). Every frame those exact
  // points are pushed forward with Lucas-Kanade optical flow and a RANSAC
  // homography maps the locked positions onto the current ones — position,
  // scale and rotation all come out of that single transform.
  //
  // The lock is *armed* before it engages: it only takes hold once enough
  // RANSAC inliers agree, so a lock never silently latches onto noise.
  const lockedBase = useRef<Transform | null>(null);
  const flowRef = useRef<FlowLock | null>(null);
  const fallbackRef = useRef<ReturnType<typeof createRegionTracker> | null>(
    null,
  );
  const trackRaf = useRef<number | null>(null);
  const trackVideoFrame = useRef<number | null>(null);
  const [lockPhase, setLockPhase] = useState<
    "idle" | "arming" | "locked" | "lost"
  >("idle");
  const lockPhaseRef = useRef(lockPhase);
  lockPhaseRef.current = lockPhase;
  const [lockCoach, setLockCoach] = useState<string | null>(null);
  const [tooClose, setTooClose] = useState(false);
  const [lockStill, setLockStill] = useState<string | null>(null);
  // Lock confirmation and a shutter tap can happen almost simultaneously.
  // Serialize still composition so mobile Safari never has two readers waiting
  // on the same live video frame.
  const stillCaptureQueueRef = useRef<Promise<void>>(Promise.resolve());
  const composeStillQueued = () => {
    const job = stillCaptureQueueRef.current
      .catch(() => undefined)
      .then(() => composeStill());
    stillCaptureQueueRef.current = job.then(
      () => undefined,
      () => undefined,
    );
    return job;
  };
  const savePlacementLocal = useCallback(async () => {
    const freshStill = lockStill ? null : await composeStillQueued();
    const still = lockStill ?? freshStill?.dataUrl ?? null;
    if (freshStill) URL.revokeObjectURL(freshStill.previewUrl);
    try {
      const key = "inkvision.placements.v1";
      const prev = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
      const entry = {
        id: crypto.randomUUID(),
        motifId: motifId ?? (customImage ? undefined : activeTattoo.id),
        name: displayName,
        src: renderSrc,
        widthCm: Number(widthCm),
        rotation: transform.rotation,
        transform,
        still,
        savedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify([entry, ...prev].slice(0, 60)));
      toast.success("Saved to My designs");
    } catch {
      toast.error("Could not save on this device");
    }
    if (user) {
      void saveTryon({
        userId: user.id,
        motifId: motifId ?? (customImage ? undefined : activeTattoo.id),
        motifName: displayName,
        widthCm: Number(widthCm),
        rotation: transform.rotation,
        transform,
        sessionId: sessionIdRef.current,
        previewDataUrl: still ?? undefined,
      }).catch((e) => console.warn("tryon save failed", e));
    }
  }, [lockStill, motifId, customImage, activeTattoo.id, displayName, renderSrc, widthCm, transform, user]);
  const [printOpen, setPrintOpen] = useState(false);
  const [videoGate, setVideoGate] = useState(false);

  /** Tiny haptic cue — never more than one per state change. */
  const haptic = useCallback((pattern: number | number[]) => {
    try {
      navigator.vibrate?.(pattern);
    } catch {
      /* haptics are a nicety */
    }
  }, []);

  const stopTracking = useCallback(() => {
    if (trackRaf.current != null) cancelAnimationFrame(trackRaf.current);
    trackRaf.current = null;
    const video = videoRef.current;
    if (trackVideoFrame.current != null) {
      if (video && typeof video.cancelVideoFrameCallback === "function") {
        video.cancelVideoFrameCallback(trackVideoFrame.current);
      } else {
        cancelAnimationFrame(trackVideoFrame.current);
      }
    }
    trackVideoFrame.current = null;
    flowRef.current?.dispose();
    flowRef.current = null;
    fallbackRef.current = null;
    lockedBase.current = null;
    poseControllerRef.current = null;
    setTooClose(false);
  }, []);

  /** Build the tracking region (video px) under the design's current pose. */
  const lockRegion = useCallback(() => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage || !video.videoWidth) return null;
    const rect = stage.getBoundingClientRect();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const s = Math.max(rect.width / vw, rect.height / vh);
    const t = transformRef.current;
    const centerX = rect.width / 2 + t.x;
    const centerY = rect.height / 2 + t.y;
    const toVideoX = (px: number) => (px - (rect.width - vw * s) / 2) / s;
    const toVideoY = (py: number) => (py - (rect.height - vh * s) / 2) / s;
    // Keep anchors close to the ink. The old 1.9x square often included more
    // wall/cupboard than arm, so OpenCV correctly followed the wrong object.
    const sizePx = Math.max(96, BASE_WIDTH_PX * t.scale * 1.28);
    return {
      cx: facingRef.current === "user" ? vw - toVideoX(centerX) : toVideoX(centerX),
      cy: toVideoY(centerY),
      w: sizePx / s,
      h: sizePx / s,
    };
  }, []);

  // Pose bookkeeping shared with the tracking loop.
  const poseOffset = useRef({ dx: 0, dy: 0, scale: 1, rotation: 0 });
  const poseControllerRef = useRef<LockPoseController | null>(null);
  /** Mirrors `recording` for the tracking loop, which never re-subscribes. */
  const recordingRef = useRef(false);

  const lowFrames = useRef(0);
  const goodFrames = useRef(0);
  const armStart = useRef(0);
  /**
   * Persistent relative scale of the lock. Lives outside the tracking loop so
   * a re-anchor can reset it in the same breath as the tracker itself —
   * otherwise the fresh tracker's 1.0 reference met a stale multiplier and the
   * tattoo visibly changed size on its own.
   */
  const relScaleRef = useRef(1);

  const applyTrackedTransform = useCallback((next: Transform) => {
    transformRef.current = next;
    trackedLiveTransformRef.current = next;
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.style.transform = `translate3d(-50%, -50%, 0) translate3d(${next.x}px, ${next.y}px, 0) rotate(${next.rotation}deg) scale(${next.scale})`;
    }
  }, []);


  // Preserve the tracker API hook; response is now identical in preview and
  // recording because the single pose controller owns temporal filtering.
  useEffect(() => {
    recordingRef.current = recording;
    flowRef.current?.setFast(recording);
  }, [recording]);


  // Late-bound so callbacks defined earlier (flip camera) can reanchor.
  const reanchorLockRef = useRef<(() => boolean) | null>(null);

  /** Relearn the skin patch under the design without leaving locked mode. */
  const reanchorLock = useCallback(() => {
    const video = videoRef.current;
    const region = lockRegion();
    if (!video || !region) return false;
    // Never relearn the patch on something that is not skin: that is exactly
    // how the lock used to "keep following" the kitchen after the wrist had
    // left the frame.
    const tone = sampleVideoSkinTone(video, {
      x: region.cx / video.videoWidth,
      y: region.cy / video.videoHeight,
      size: Math.min(region.w, region.h) * 0.55,
    });
    if (!tone || !isLikelySkinTone(tone)) return false;
    flowRef.current?.dispose();
    flowRef.current = createFlowLock(video, region);
    flowRef.current.setFast(recordingRef.current);
    const legacy = createRegionTracker(video, region);
    fallbackRef.current = legacy.ok ? legacy : null;

    lockedBase.current = { ...transformRef.current };
    poseOffset.current = { dx: 0, dy: 0, scale: 1, rotation: 0 };
    relScaleRef.current = 1;
    poseControllerRef.current?.reset(transformRef.current, performance.now());
    lowFrames.current = 0;
    goodFrames.current = 0;
    return true;

  }, [lockRegion]);

  const startLock = useCallback(() => {
    const video = videoRef.current;
    const region = lockRegion();
    if (!video || !region) {
      setLockToast("Wait until the camera has started");
      setTimeout(() => setLockToast(null), 1800);
      return;
    }

    if (wrapActive && (!readyWrappedSrc || !wrappedCanvasRef.current)) {
      setLockToast("Preparing the design — tap Lock again in a moment");
      setTimeout(() => setLockToast(null), 1800);
      return;
    }

    const targetTone = sampleVideoSkinTone(video, {
      x: region.cx / video.videoWidth,
      y: region.cy / video.videoHeight,
      size: Math.min(region.w, region.h) * 0.55,
    });
    if (!targetTone || !isLikelySkinTone(targetTone)) {
      setLockToast("Place the design on visible skin before locking");
      setTimeout(() => setLockToast(null), 2600);
      haptic([25, 45, 25]);
      return;
    }

    lockedBase.current = { ...transformRef.current };
    poseOffset.current = { dx: 0, dy: 0, scale: 1, rotation: 0 };
    relScaleRef.current = 1;
    poseControllerRef.current = createLockPoseController(transformRef.current);
    lowFrames.current = 0;
    goodFrames.current = 0;

    armStart.current = performance.now();
    flowRef.current = createFlowLock(video, region);
    flowRef.current.setFast(recordingRef.current);
    // Kept as a fallback for devices where the OpenCV runtime cannot load.
    const legacy = createRegionTracker(video, region);
    fallbackRef.current = legacy.ok ? legacy : null;
    // Freeze the measured wrap at the start of arming, not several frames
    // later when React's `locked` state finally catches up.
    frozenMotifFrameRef.current = motifFrame;
    lockPhaseRef.current = "arming";
    setLockPhase("arming");
    const engineReady = opencvStatus() === "ready";
    setLockCoach(
      engineReady
        ? "Hold still — locking onto the skin…"
        : "Preparing the tracker — hold still…",
    );
    // Make sure the runtime is actually on its way; the warm-up may have been
    // skipped (offline at the time, camera started before the effect ran).
    if (!engineReady) void loadOpenCV();

    /**
     * How long arming may run before giving up. The vision runtime is a ~10 MB
     * download on first use, so a cold start gets a much longer budget than a
     * warm one — this is what used to make Lock look broken on the first tap.
     */
    const armBudget = () => {
      if (flowRef.current?.ready) return 4000;
      const s = opencvStatus();
      if (s === "loading") return 30000;
      if (s === "failed") return fallbackRef.current ? 3000 : 1200;
      return 6000;
    };

    let lastStateSync = 0;
    let trackerSource: "flow" | "fallback" | null = null;
    let armSolidFrames = 0;
    /** Throttles the silent re-anchor attempted before declaring a loss. */
    let lastAutoReanchor = 0;
    /** Throttles the "is the design still on skin?" pixel probe. */
    let lastSkinCheck = 0;
    /** Consecutive probes that found no skin under the design. */
    let noSkinChecks = 0;



    const step = () => {
      const base = lockedBase.current;
      if (!base) return;
      const stageEl = stageRef.current;
      const v = videoRef.current;
      if (!stageEl || !v || !v.videoWidth || document.hidden) return;

      const flow = flowRef.current;
      let dx = 0;
      let dy = 0;
      let scale = 1;
      let rotation = 0;
      let confidence = 0;
      let inliers = 0;
      /** True when the tracked skin patch has left the camera frame. */
      let offscreen = false;
      let closeRangeRisk = false;
      let scaleReliable = false;
      let sampleTimestamp = performance.now();


      /** Arming may never hang: every path that bails checks the budget. */
      const armingExpired = () =>
        lockPhaseRef.current === "arming" &&
        performance.now() - armStart.current > armBudget();

      // Pick an engine while arming, then keep that same coordinate system for
      // the entire lock session. Hot-swapping references was a source of size
      // jumps even when both trackers were individually correct.
      const useFlow =
        lockPhaseRef.current === "arming"
          ? Boolean(flow?.ready)
          : trackerSource === "flow";
      // A re-anchor creates a fresh flow tracker that may need a moment to
      // initialise. Hold the last pose during that moment; never cross into
      // the fallback tracker's unrelated coordinate system.
      if (
        lockPhaseRef.current !== "arming" &&
        trackerSource === "flow" &&
        !flow?.ready
      ) {
        return;
      }
      if (useFlow && flow?.ready) {
        const res = flow.update();
        if (!res) {
          if (armingExpired()) abortArming();
          return;
        }
        dx = res.dx;
        dy = res.dy;
        scale = res.scale;
        rotation = res.rotation;
        confidence = res.confidence;
        inliers = res.inliers;
        offscreen = res.offscreen;
        closeRangeRisk = res.tooClose;
        scaleReliable = res.scaleReliable;
        sampleTimestamp = res.timestamp;
        setTooClose((current) =>
          current === closeRangeRisk ? current : closeRangeRisk,
        );

        if (lockPhaseRef.current === "arming") trackerSource = "flow";
      } else {
        const res = fallbackRef.current?.update();
        if (!res) {
          if (armingExpired()) abortArming();
          return;
        }
        dx = res.dx;
        dy = res.dy;
        scale = res.scale;
        confidence = res.confidence;
        // The legacy tracker has no RANSAC set; treat confidence as the gate.
        inliers = res.confidence > 0.45 ? 12 : 0;
        scaleReliable = res.confidence >= 0.62;
        // While the flow engine is still downloading, the coarse fallback is
        // good enough to engage the lock — it hands over as soon as it is up.
        if (lockPhaseRef.current === "arming") trackerSource = "fallback";
      }

      const solid = inliers >= 8 && confidence > 0.45;

      // --- Arming: do not engage until the patch really holds --------------
      if (lockPhaseRef.current === "arming") {
        const elapsed = performance.now() - armStart.current;
        armSolidFrames = solid ? armSolidFrames + 1 : 0;
        if (armSolidFrames >= 4 && elapsed >= 400) {
          // Whatever moved during arming is absorbed, so engaging never jumps.
          poseOffset.current = { dx, dy, scale, rotation };
          relScaleRef.current = 1;

          lockedBase.current = { ...transformRef.current };
          poseControllerRef.current?.reset(transformRef.current, sampleTimestamp);
          lowFrames.current = 0;
          goodFrames.current = 0;
          // Freeze the physical size: from here the tracker only reports how
          // far away the skin is, never that the tattoo grew or shrank.
          setLockedWidthCm(
            (BASE_WIDTH_PX * transformRef.current.scale) /
              (pxPerCmRef.current * (distRelRef.current || 1)),
          );
          lockPhaseRef.current = "locked";
          setLockPhase("locked");
          setLocked(true);

          setLockCoach(null);
          haptic(12);
          // Post-lock sheet: capture a still of the exact locked placement
          // and quietly check whether any studios are in radius.
          setLockStill(null);
          void composeStillQueued().then((shot) => {
            if (!shot) return;
            setLockStill(shot.dataUrl);
            URL.revokeObjectURL(shot.previewUrl);
          });
          
        } else if (elapsed > armBudget()) {
          abortArming();
        }
        return;
      }


      // --- Confidence bookkeeping -----------------------------------------
      if (solid) {
        goodFrames.current += 1;
        lowFrames.current = 0;
      } else if (confidence < 0.3) {
        lowFrames.current += 1;
        goodFrames.current = 0;
      }

      // --- Is the design still sitting on visible skin? --------------------
      // Optical flow alone cannot answer this: when the wrist leaves the frame
      // the tracker happily reports a confident match on whatever is behind
      // it. A few times a second we therefore look at the actual pixels under
      // the design and ask whether they still read as skin.
      const nowT = performance.now();
      if (nowT - lastSkinCheck > 220) {
        lastSkinCheck = nowT;
        const reg = lockRegion();
        const tone = reg
          ? sampleVideoSkinTone(v, {
              x: reg.cx / v.videoWidth,
              y: reg.cy / v.videoHeight,
              size: Math.min(reg.w, reg.h) * 0.5,
            })
          : null;
        if (!tone || !isLikelySkinTone(tone)) noSkinChecks += 1;
        else noSkinChecks = 0;
      }
      // ~0.5 s without skin, or the patch having left the frame, is a loss.
      const hardLoss = offscreen || noSkinChecks >= 3;

      if (lockPhaseRef.current === "locked" && (hardLoss || lowFrames.current > 20)) {
        // A soft dip (weak match, but the skin is still there) is worth a
        // silent re-anchor first: most "it stopped following" moments are just
        // the skin having rotated out of the original view. A hard loss is not
        // — re-learning there would latch onto the background.
        if (!hardLoss) {
          const now = performance.now();
          if (now - lastAutoReanchor > 1500 && reanchorLock()) {
            lastAutoReanchor = now;
            return;
          }
        }
        // Freeze the last good pose instead of jumping anywhere.
        lockPhaseRef.current = "lost";
        setLockPhase("lost");
        // Clear, unmistakable buzz — you feel the drop without looking.
        haptic([45, 70, 45, 70, 130]);
        toast.warning(
          hardLoss
            ? "Tracking lost — bring the area back into view"
            : "Tracking lost — hold the same angle",
        );
        return;
      }

      if (lockPhaseRef.current === "lost") {
        // Come back only when the design is over skin again and the tracker
        // agrees — otherwise the overlay would resume on the background.
        if (!hardLoss && goodFrames.current > 20) {
          if (reanchorLock()) {
            noSkinChecks = 0;
            lockPhaseRef.current = "locked";
            setLockPhase("locked");
            haptic(20);
          }
        }
        return;
      }


      // A weak match means "unknown", not "moved" — hold the last good pose.
      if (confidence < 0.3) return;

      const o = poseOffset.current;
      const r = stageEl.getBoundingClientRect();
      const sc = Math.max(r.width / v.videoWidth, r.height / v.videoHeight);
      const mirrored = facingRef.current === "user";
      const measuredRelScale = o.scale ? scale / o.scale : scale;
      if (scaleReliable) relScaleRef.current = measuredRelScale;

      const measuredPose = {
        x: base.x + (mirrored ? -(dx - o.dx) : dx - o.dx) * sc,
        y: base.y + (dy - o.dy) * sc,
        scale: Math.min(12, Math.max(0.3, base.scale * relScaleRef.current)),

        rotation:
          base.rotation +
          (mirrored ? -(rotation - o.rotation) : rotation - o.rotation),
      };
      poseControllerRef.current?.sample({
        ...measuredPose,
        confidence,
        scaleReliable,
        timestamp: sampleTimestamp,
      });
    };

    const renderLoop = (t: number) => {
      trackRaf.current = requestAnimationFrame(renderLoop);
      if (lockPhaseRef.current !== "locked") return;
      const next = poseControllerRef.current?.poseAt(t);
      if (!next) return;
      applyTrackedTransform(next);
      // Keep React out of the camera hot path. A sparse snapshot is enough for
      // labels and persistence; capture/recording read transformRef directly.
      if (t - lastStateSync > 250) {
        lastStateSync = t;
        setTransform({ ...next });
      }
    };

    const requestCameraFrame = () => {
      const video = videoRef.current;
      if (!video) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        trackVideoFrame.current = video.requestVideoFrameCallback(() => {
          trackVideoFrame.current = null;
          step();
          if (flowRef.current || fallbackRef.current) requestCameraFrame();
        });
        return;
      }
      const fallbackVideo: HTMLVideoElement = video;
      let lastMediaTime = -1;
      const fallbackLoop = () => {
        if (fallbackVideo.currentTime !== lastMediaTime) {
          lastMediaTime = fallbackVideo.currentTime;
          step();
        }
        if (flowRef.current || fallbackRef.current) {
          trackVideoFrame.current = requestAnimationFrame(fallbackLoop);
        }
      };
      trackVideoFrame.current = requestAnimationFrame(fallbackLoop);
    };


    const abortArming = () => {
      const engineFailed = opencvStatus() === "failed" && !fallbackRef.current;
      stopTracking();
      frozenMotifFrameRef.current = null;
      lockPhaseRef.current = "idle";
      setLockPhase("idle");
      setLockCoach(null);
      setLocked(false);
      setLockToast(
        engineFailed
          ? "Tracking engine could not load — check your connection and tap Lock again."
          : "Need more texture — aim at skin with pores or a hair, or move into better light.",
      );
      setTimeout(() => setLockToast(null), 3600);
    };

    requestCameraFrame();
    trackRaf.current = requestAnimationFrame(renderLoop);
  }, [applyTrackedTransform, lockRegion, haptic, reanchorLock, stopTracking]);

  reanchorLockRef.current = reanchorLock;

  const releaseLock = useCallback(() => {
    const latest = { ...transformRef.current };
    stopTracking();
    frozenMotifFrameRef.current = null;
    lockPhaseRef.current = "idle";
    setTransform(latest);
    setLocked(false);
    setLockPhase("idle");
    setLockedWidthCm(null);
    setLockCoach(null);
    setLockToast("Unlocked — drag, pinch, and rotate again");
    setTimeout(() => setLockToast(null), 1800);
  }, [stopTracking]);


  const toggleLock = useCallback(() => {
    if (lockPhaseRef.current === "arming") {
      // A second tap while arming just cancels it.
      stopTracking();
      frozenMotifFrameRef.current = null;
      lockPhaseRef.current = "idle";
      setLockPhase("idle");
      setLockCoach(null);
      return;
    }
    if (locked) {
      releaseLock();
      return;
    }
    startLock();
  }, [locked, releaseLock, startLock, stopTracking]);

  useEffect(() => stopTracking, [stopTracking]);
  // Flipping the camera keeps the placement, the wrap and the lock — only the
  // tracked skin patch is relearned on the new feed (see flipCamera).

  // --- Keep centimetres true while the camera distance changes --------------
  const distMonitorRef = useRef<ReturnType<typeof createDistanceMonitor> | null>(
    null,
  );
  const distRafRef = useRef<number | null>(null);
  const appliedRelRef = useRef(1);

  const stopDistance = useCallback(() => {
    if (distRafRef.current != null) cancelAnimationFrame(distRafRef.current);
    distRafRef.current = null;
    distMonitorRef.current = null;
    appliedRelRef.current = 1;
    setDistRel(1);
  }, []);

  /** Re-learns the reference patch under the design at the current distance. */
  const anchorDistance = useCallback(() => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage || !video.videoWidth) return false;
    const rect = stage.getBoundingClientRect();
    const center = {
      x: rect.width / 2 + transformRef.current.x,
      y: rect.height / 2 + transformRef.current.y,
    };
    const sizePx = Math.max(
      140,
      BASE_WIDTH_PX * transformRef.current.scale * 1.9,
    );
    const region = screenRegionToVideo(
      video,
      rect,
      center,
      sizePx,
      facingRef.current === "user",
    );
    if (!region) return false;
    const existing = distMonitorRef.current;
    if (existing) return existing.reanchor(region, false);
    const monitor = createDistanceMonitor(video, region);
    if (!monitor.ok) return false;
    distMonitorRef.current = monitor;
    appliedRelRef.current = 1;
    setDistRel(1);
    return true;
  }, []);

  /**
   * Re-anchors without losing accuracy: whatever distance change we have
   * already applied is baked into px/cm, so centimetres stay exactly where the
   * user calibrated them even though the reference patch is relearned.
   */
  const rebaseline = useCallback(() => {
    const rel = appliedRelRef.current;
    if (rel !== 1 && Number.isFinite(rel) && rel > 0) {
      setPxPerCm(pxPerCmRef.current * rel);
    }
    appliedRelRef.current = 1;
    setDistRel(1);
    return anchorDistance();
  }, [anchorDistance]);

  // The monitor only runs while the size hold is on and the design is not
  // locked to the skin (the lock tracker already does its own scaling).
  useEffect(() => {
    if (!scaleHold || locked || !cameraReady) return;
    if (!distMonitorRef.current && !anchorDistance()) return;
    let last = 0;
    const loop = (t: number) => {
      distRafRef.current = requestAnimationFrame(loop);
      if (t - last < 66) return; // ~15 Hz is plenty for distance
      last = t;
      const monitor = distMonitorRef.current;
      if (!monitor) return;
      if (monitor.stale) {
        // Tracking lost (hand moved, occlusion, zoom jump): relearn silently.
        rebaseline();
        return;
      }
      const s = monitor.update();
      if (!s || s.confidence < 0.34) return;
      const rel = s.rel;
      if (Math.abs(rel - appliedRelRef.current) < 0.008) return;
      if (pointers.current.size > 0) return;
      appliedRelRef.current = rel;
      // Only the centimetre read-out follows the distance. The design itself
      // is never moved or resized behind the user's back.
      setDistRel(rel);
    };
    distRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (distRafRef.current != null) cancelAnimationFrame(distRafRef.current);
      distRafRef.current = null;
    };
  }, [scaleHold, locked, cameraReady, anchorDistance, rebaseline]);

  // After a drag / pinch the design sits somewhere else, so the reference patch
  // no longer covers it — relearn it (keeping centimetres) once fingers lift.
  const reanchorTimer = useRef<number | null>(null);
  const queueReanchor = useCallback(() => {
    if (!scaleHoldRef.current || lockedRef.current) return;
    if (reanchorTimer.current) window.clearTimeout(reanchorTimer.current);
    reanchorTimer.current = window.setTimeout(() => {
      reanchorTimer.current = null;
      if (pointers.current.size === 0) rebaseline();
    }, 260);
  }, [rebaseline]);
  queueReanchorRef.current = queueReanchor;


  // A camera swap invalidates the reference frame entirely.
  useEffect(() => {
    stopDistance();
    setScaleHold(false);
  }, [facing, stopDistance]);

  const applyCalibration = useCallback(
    (nextPxPerCm: number) => {
      if (!(nextPxPerCm > 0)) return;
      // Keep the design's physical size across the calibration change.
      const prev = pxPerCm * appliedRelRef.current;
      setPxPerCm(nextPxPerCm);
      appliedRelRef.current = 1;
      setDistRel(1);
      distMonitorRef.current = null;
      setTransform((t) => ({ ...t, scale: (t.scale * nextPxPerCm) / prev }));
      setCalibOpen(false);
      const ok = anchorDistance();
      setScaleHold(ok);
      setCalibToast(
        ok
          ? "Scale calibrated — centimetres now follow the camera distance"
          : "Scale calibrated — aim at more textured skin to hold it while you move",
      );
      setTimeout(() => setCalibToast(null), 2600);
    },
    [anchorDistance, pxPerCm],
  );



  /**
   * The single painter used by both photo and video capture. It mirrors the
   * live DOM layout exactly: a BASE_WIDTH_PX * scale box with object-contain,
   * multiply blending and the skin-tone filter.
   */
  const paintMotif = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    tr: { x: number; y: number; rotation: number; scale: number },
    style: { filter: string; opacity: number },
    bmp: { src: CanvasImageSource; w: number; h: number },
  ) => {
    ctx.save();
    ctx.translate(cx + tr.x, cy + tr.y);
    ctx.rotate((tr.rotation * Math.PI) / 180);
    // Match the live view: lay the design down on the measured surface.
    const pose = surfaceRef.current;
    if (pose.axisDeg || pose.tilt) {
      ctx.rotate((pose.axisDeg * Math.PI) / 180);
      ctx.scale(1, Math.cos((pose.tilt * 22 * Math.PI) / 180));
    }

    const box = BASE_WIDTH_PX * tr.scale;
    const fit = Math.min(box / (bmp.w || 1), box / (bmp.h || 1));
    const dw = bmp.w * fit;
    const dh = bmp.h * fit;
    const layers = inkRenderStyle(skinToneRef.current, lightRef.current);
    ctx.globalCompositeOperation = "multiply";
    // Dermal bleed first, so the core ink lands inside its own soft halo.
    ctx.globalAlpha = layers.bleed.opacity;
    ctx.filter = layers.bleed.filter;
    ctx.drawImage(bmp.src, -dw / 2, -dh / 2, dw, dh);
    ctx.globalAlpha = style.opacity;
    ctx.filter = style.filter;
    // Colour the pigment the same way the live view does, so a saved photo
    // keeps the blue-black/warm gradient instead of falling back to flat black.
    const tinted = tintMotifCanvas(bmp.src, dw, dh, layers);
    ctx.drawImage(tinted ?? bmp.src, -dw / 2, -dh / 2, dw, dh);
    ctx.filter = "none";
    ctx.restore();
  };

  /** Paints the camera frame with the same cover fit + mirroring as the DOM. */
  const paintVideoFrame = (
    ctx: CanvasRenderingContext2D,
    source: HTMLVideoElement | ImageBitmap,
    w: number,
    h: number,
  ) => {
    const vw = source instanceof HTMLVideoElement ? source.videoWidth : source.width;
    const vh = source instanceof HTMLVideoElement ? source.videoHeight : source.height;
    if (!vw || !vh) {
      ctx.fillStyle = "#121212";
      ctx.fillRect(0, 0, w, h);
      return;
    }
    const s = Math.max(w / vw, h / vh);
    ctx.save();
    if (facingRef.current === "user") {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(source, (w - vw * s) / 2, (h - vh * s) / 2, vw * s, vh * s);
    ctx.restore();
  };

  /**
   * Freezes a real camera frame before the capture sheet covers the video.
   * Some mobile browsers return a black frame when a live <video> is painted
   * directly into a canvas during the same tick that the UI changes.
   */
  const freezeVideoFrame = async (
    video: HTMLVideoElement,
  ): Promise<ImageBitmap | null> => {
    if (!video.videoWidth || !video.videoHeight) return null;

    if ("requestVideoFrameCallback" in video) {
      await new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        const timer = window.setTimeout(finish, 180);
        video.requestVideoFrameCallback(() => {
          window.clearTimeout(timer);
          finish();
        });
      });
    }

    if (typeof createImageBitmap !== "function") return null;
    try {
      return await createImageBitmap(video);
    } catch {
      return null;
    }
  };

  /**
   * Resolves the bitmap currently on screen. When the curvature bake has not
   * landed yet the wrap is produced on the spot, so a capture never falls back
   * to the flat motif while the preview shows a wrapped one.
   */
  const motifBitmap = async (): Promise<{
    src: CanvasImageSource;
    w: number;
    h: number;
  } | null> => {
    if (wrapActive) {
      let c = wrappedFrameKeyRef.current === frameKey ? wrappedCanvasRef.current : null;
      if (!c) {
        c = await wrapSourceToCanvas(motifFrame.src, {
          curve: activeShape.curve,
          taper: activeShape.taper,
          tilt: activeShape.tilt,
          tiltDir: activeShape.tiltDir,
          bendDeg: activeShape.bendDeg,
          visibleFraction: activeShape.visibleFraction,
          occlusion: motifFrame.occlusion,
          light: { x: 0, y: -0.35, strength: 0.35 },
        });
        // Capture the calculated frame but never publish it into the live
        // preview: only the decoded bake may replace the visible bitmap.
      }
      if (c) return { src: c, w: c.width, h: c.height };
    }
    const img = await new Promise<HTMLImageElement | null>((resolve) => {
      const el = new Image();
      try {
        const sourceUrl = new URL(motifFrame.src, window.location.href);
        if (sourceUrl.origin !== window.location.origin) {
          el.crossOrigin = "anonymous";
        }
      } catch {
        // Data and blob URLs are already local to this document.
      }
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = motifFrame.src;
    });
    if (!img) return null;
    return { src: img, w: img.naturalWidth, h: img.naturalHeight };
  };

  const composeStill = async (): Promise<{
    dataUrl: string;
    previewUrl: string;
    baseDataUrl?: string;
  } | null> => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage) return null;
    const frozenFrame = await freezeVideoFrame(video);
    const rect = stage.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.scale(dpr, dpr);
    paintVideoFrame(
      ctx,
      frozenFrame ?? video,
      rect.width,
      rect.height,
    );
    frozenFrame?.close();
    // Same shot without the design, for the studio (save-only, no tracking).
    let baseDataUrl: string | undefined;
    try {
      baseDataUrl = canvas.toDataURL("image/jpeg", 0.9);
    } catch {
      baseDataUrl = undefined;
    }

    const bmp = await motifBitmap();
    if (bmp) {
      paintMotif(
        ctx,
        rect.width / 2,
        rect.height / 2,
        transformRef.current,
        skinStyle,
        bmp,
      );
    }
    const dataUrl = canvas.toDataURL("image/png");
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    // Safari can return null from toBlob for a valid canvas under memory
    // pressure. The PNG data URL is slower but remains a reliable fallback.
    return {
      dataUrl,
      previewUrl: blob ? URL.createObjectURL(blob) : dataUrl,
      baseDataUrl,
    };
  };

  const capture = async () => {
    let still: { dataUrl: string; previewUrl: string; baseDataUrl?: string } | null = null;
    try {
      still = await composeStillQueued();
    } catch (e) {
      console.warn("capture failed", e);
    }
    if (!still) {
      toast.error("Could not take the photo", {
        description: "The camera frame was not ready. Try again in a second.",
      });
      return;
    }
    void import("@/lib/shutterSound").then((m) => m.playShutter());
    haptic(10);
    // Use a Blob URL made directly from the capture canvas for display. This
    // avoids Mobile Safari's unreliable rendering of multi-megabyte data URLs.
    const previous = capturedRef.current;
    capturedRef.current = still;
    setCaptured(still);
    if (
      previous?.previewUrl.startsWith("blob:") &&
      previous.previewUrl !== still.previewUrl
    ) {
      window.setTimeout(() => URL.revokeObjectURL(previous.previewUrl), 0);
    }

    // A finished shot is the natural high-satisfaction moment to offer install.
    void import("@/lib/installPrompt").then((m) => m.markTryOnSuccess());
    if (user) {
      void saveTryon({
        userId: user.id,
        motifId: motifId ?? (customImage ? undefined : activeTattoo.id),
        motifName: displayName,
        widthCm: Number(widthCm),
        rotation: transform.rotation,
        transform,
        sessionId: sessionIdRef.current,
        previewDataUrl: still.dataUrl,
      }).catch((e) => console.warn("tryon save failed", e));
    }
  };


  // --- Video recording: composite camera + motif onto a canvas stream ---
  // The live ref carries the *current* wrapped canvas, so curvature, occlusion
  // and light changes made while recording show up in the clip too.
  const liveRef = useRef<{
    transform: typeof transform;
    skinStyle: typeof skinStyle;
    bitmap: { src: CanvasImageSource; w: number; h: number } | null;
  }>({ transform, skinStyle, bitmap: null });
  liveRef.current.transform = lockedRef.current
    ? trackedLiveTransformRef.current
    : transform;
  liveRef.current.skinStyle = skinStyle;
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recRafRef = useRef<number | null>(null);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopRecording = useCallback(() => {
    if (recRafRef.current != null) cancelAnimationFrame(recRafRef.current);
    recRafRef.current = null;
    if (recTimerRef.current) clearInterval(recTimerRef.current);
    recTimerRef.current = null;
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
    recorderRef.current = null;
    setRecording(false);
  }, []);

  const startRecording = async () => {
    const video = videoRef.current;
    const stage = stageRef.current;
    if (!video || !stage || recording) return;
    if (typeof MediaRecorder === "undefined") {
      setCameraError("Video recording is not supported in this browser.");
      return;
    }
    const rect = stage.getBoundingClientRect();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(rect.width);
    canvas.height = Math.round(rect.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resolve the on-screen bitmap once up front; the wrapped canvas is
    // updated in place by the bake, so later frames pick up changes for free.
    liveRef.current.bitmap = await motifBitmap();
    const mark = await loadWatermark();

    const draw = () => {
      const { skinStyle: ss, bitmap } = liveRef.current;
      const tr = lockedRef.current
        ? trackedLiveTransformRef.current
        : liveRef.current.transform;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      paintVideoFrame(ctx, video, canvas.width, canvas.height);
      const canvasFrame = wrappedFrameKeyRef.current === frameKey ? wrappedCanvasRef.current : null;
      const live = canvasFrame
        ? {
            src: canvasFrame,
            w: canvasFrame.width,
            h: canvasFrame.height,
          }
        : bitmap;
      if (live) {
        paintMotif(
          ctx,
          canvas.width / 2,
          canvas.height / 2,
          tr,
          ss,
          live,
        );
      }

      drawWatermark(ctx, canvas.width, canvas.height, mark);

      recRafRef.current = requestAnimationFrame(draw);
    };
    draw();

    const mimeCandidates = [
      "video/mp4;codecs=avc1",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = mimeCandidates.find((m) =>
      MediaRecorder.isTypeSupported?.(m),
    );
    const stream = canvas.captureStream(30);
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setCameraError("Video recording is not supported in this browser.");
      if (recRafRef.current != null) cancelAnimationFrame(recRafRef.current);
      recRafRef.current = null;
      return;
    }
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const type = rec.mimeType || mimeType || "video/webm";
      const blob = new Blob(chunks, { type });
      if (!blob.size) return;
      setCapturedVideo({
        url: URL.createObjectURL(blob),
        blob,
        ext: type.includes("mp4") ? "mp4" : "webm",
      });
    };
    recorderRef.current = rec;
    rec.start();
    setRecording(true);
    setRecSeconds(0);
    recTimerRef.current = setInterval(() => {
      setRecSeconds((s) => {
        if (s >= 29) stopRecording();
        return s + 1;
      });
    }, 1000);
  };

  // Cleanup recorder + object URLs on unmount
  useEffect(() => {
    return () => {
      if (recRafRef.current != null) cancelAnimationFrame(recRafRef.current);
      if (recTimerRef.current) clearInterval(recTimerRef.current);
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") rec.stop();
    };
  }, []);

  const mirrored = facing === "user";

  const onShutter = () => {
    if (mode === "photo") void capture();
    else if (recording) stopRecording();
    else void startRecording();
  };



  return (
    <div className="relative w-full h-[100dvh] bg-slate overflow-hidden">
      {/* Camera video */}
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover"
        style={mirrored ? { transform: "scaleX(-1)" } : undefined}
      />

      {!started && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-ink p-6">
          <TryOnStartMenu
            showLogo
            onTryDesign={() => setStarted(true)}
            onUpload={() => {
              setStarted(true);
              setShowCustomHelp(true);
              window.setTimeout(() => uploadInputRef.current?.click(), 400);
            }}
            onText={() => {
              setStarted(true);
              setShowCustomHelp(true);
              setTextOpen(true);
            }}
          />
        </div>
      )}

      {started && !cameraReady && !cameraError && (
        <div className="absolute inset-0 grid place-items-center bg-slate text-muted-foreground text-[12px] uppercase tracking-widest">
          Starting camera…
        </div>
      )}
      {cameraError && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-slate p-8 text-center">
          <div className="max-w-xs space-y-3">
            <div className="text-mono-caps text-accent text-[11px]">
              No camera here
            </div>
            <p className="text-[13px] text-foreground/80">{cameraError}</p>
            <TroubleshootNote kind="camera" className="text-left" />

            <Link
              to="/photo-tryon"
              search={{ motif: motifId ?? selectedId }}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-[12px] font-bold uppercase tracking-widest text-ink"
            >
              Paste tattoo on a picture
            </Link>
            <p className="text-[12px] text-muted-foreground">
              Works without a camera — use any photo from your phone.
            </p>
          </div>
        </div>
      )}

      {/* Subtle top/bottom fades only so UI chrome stays legible — camera view stays bright */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink/60 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-ink/70 to-transparent" />

      {cvDebug && (
        <CVDebugOverlay
          videoRef={videoRef}
          stageRef={stageRef}
          flowRef={flowRef}
          mirrored={facing === "user"}
          transform={transform}
          curve={curve}
          curveConf={curveConf}
          designWidthPx={BASE_WIDTH_PX}
          locked={locked}
        />
      )}

      {/* AR interaction stage */}
      <div
        ref={stageRef}
        className="absolute inset-0 z-10 touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div
          ref={overlayRef}
          className="absolute left-1/2 top-1/2"
          style={{
            // React may render for light, skin or UI changes between sparse
            // pose snapshots. Never rewind the live overlay to that stale pose.
            transform: (() => {
              const pose = lockedRef.current ? trackedLiveTransformRef.current : transform;
              return `translate3d(-50%, -50%, 0) translate3d(${pose.x}px, ${pose.y}px, 0) rotate(${pose.rotation}deg) scale(${pose.scale})`;
            })(),
            // Never put a CSS transition on top of the rAF tracker. That was a
            // third smoothing stage and made the overlay lag behind the skin.
            transition:
              pointers.current.size || lockPhase !== "idle"
                ? "opacity 140ms ease-out"
                : "transform 120ms ease-out, opacity 140ms ease-out",
            // Tracking lost: fade the design right down instead of leaving a
            // solid tattoo floating on whatever is now in frame.
            opacity: lockPhase === "lost" ? 0.12 : 1,
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}
        >

          <div className="relative group">
            {/* Scale indicator — replaced by the locked pill while tracking */}
            {!locked && (
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-ink/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 whitespace-nowrap">
                <span className="text-[10px] font-bold text-accent tracking-tighter">
                  {widthCm} CM
                </span>
                <div className="w-px h-3 bg-white/20" />
                <span className="text-[10px] uppercase opacity-50">
                  {curve > 0.2 ? "Wrapped" : "Scale 1:1"}
                </span>
              </div>
            )}
            <div
              style={{
                transform: motifFrame.surfacePose,
                transformStyle: "preserve-3d",
                transition: locked ? "none" : "transform 180ms ease-out",
                willChange: "transform",
              }}
            >
              <div className="relative w-[200px] h-[200px]">
                {/* Dermal bleed — the soft halo real pigment has under skin */}
                <img
                  src={renderSrc}
                  alt=""
                  aria-hidden
                  draggable={false}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-contain mix-blend-multiply pointer-events-none"
                  style={{
                    filter: inkStyle.bleed.filter,
                    opacity: inkStyle.bleed.opacity,
                  }}
                />
                <img
                  src={renderSrc}
                  alt={activeTattoo.name}
                  draggable={false}
                  decoding="async"
                  loading="eager"
                  className="relative w-full h-full object-contain mix-blend-multiply transition-[filter,opacity]"
                  style={{
                    filter: inkStyle.base.filter,
                    opacity: inkStyle.base.opacity,
                    willChange: "filter",
                  }}
                />
                {/* Pigment colour: real ink is blue-black in the dense areas
                    and warm where it thins, never a flat black cut-out. */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none mix-blend-color"
                  style={{
                    backgroundImage: inkStyle.pigment,
                    opacity: inkStyle.pigmentOpacity,
                    WebkitMaskImage: `url(${renderSrc})`,
                    maskImage: `url(${renderSrc})`,
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
                {/* Healed fade — the lit side of the design loses density,
                    which is what stops the ink from reading as a decal. */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none mix-blend-screen"
                  style={{
                    backgroundImage: inkStyle.fade,
                    opacity: inkStyle.fadeOpacity,
                    WebkitMaskImage: `url(${renderSrc})`,
                    maskImage: `url(${renderSrc})`,
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
                {/* Skin sheen + grain re-asserted on top of the pigment, so
                    the design sits under the surface instead of on it. */}
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none mix-blend-soft-light"
                  style={{
                    backgroundImage: inkStyle.sheen,
                    opacity: inkStyle.sheenOpacity,
                    WebkitMaskImage: `url(${renderSrc})`,
                    maskImage: `url(${renderSrc})`,
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
                <div
                  aria-hidden
                  className="absolute inset-0 pointer-events-none mix-blend-overlay"
                  style={{
                    backgroundImage: inkStyle.grain,
                    opacity: inkStyle.grainOpacity,
                    WebkitMaskImage: `url(${renderSrc})`,
                    maskImage: `url(${renderSrc})`,
                    WebkitMaskSize: "contain",
                    maskSize: "contain",
                    WebkitMaskRepeat: "no-repeat",
                    maskRepeat: "no-repeat",
                    WebkitMaskPosition: "center",
                    maskPosition: "center",
                  }}
                />
              </div>

            </div>

            {/* Corner handles — hidden once locked so the skin reads clean */}
            {!locked && (
              <div className="absolute -inset-4 border border-accent/30 rounded-lg pointer-events-none">
                {(
                  [
                    ["-top-1 -left-1 border-t-2 border-l-2", "nwse-resize"],
                    ["-top-1 -right-1 border-t-2 border-r-2", "nesw-resize"],
                    ["-bottom-1 -left-1 border-b-2 border-l-2", "nesw-resize"],
                    ["-bottom-1 -right-1 border-b-2 border-r-2", "nwse-resize"],
                  ] as const
                ).map(([cls, cursor]) => (
                  <span
                    key={cls}
                    role="presentation"
                    onPointerDown={onResizePointerDown}
                    onPointerMove={onResizePointerMove}
                    onPointerUp={onResizePointerUp}
                    onPointerCancel={onResizePointerUp}
                    style={{ cursor }}
                    className={`absolute ${cls} size-3 border-accent pointer-events-auto touch-none after:absolute after:-inset-4 after:content-['']`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top controls — flip + menu only. Everything else lives in the menu. */}
      <div
        className={`absolute inset-x-0 top-0 z-20 flex items-start justify-between p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] transition-opacity duration-200 ${
          recording || darkroom ? "pointer-events-none opacity-0" : "opacity-100"

        }`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={flipCamera}
            className="size-11 rounded-full glass grid place-items-center active:scale-95 transition"
            aria-label="Flip camera"
            title={
              facing === "environment"
                ? "Switch to the front camera (selfie)"
                : "Switch to the rear camera"
            }
          >
            <SwitchCamera className="size-4" />
          </button>
          {/* Surface scan lives in the menu so the camera stays clean. */}

        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={`size-11 rounded-full grid place-items-center border transition ${
              menuOpen ? "border-accent bg-accent/15 text-accent" : "glass border-transparent"
            }`}
            aria-label="Menu"
            aria-expanded={menuOpen}
          >
            <MoreVertical className="size-4" />
          </button>
          {menuOpen && (
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          )}
          {menuOpen && (
            <div className="absolute right-0 z-20 mt-2 w-60 max-h-[calc(100dvh-14rem)] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-ink/95 backdrop-blur-xl shadow-2xl">

              <button
                type="button"
                onClick={onBadgeTap}
                className="w-full px-3 py-2.5 text-left text-[11px] uppercase tracking-widest text-muted-foreground"
              >
                {displayName}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setCalibOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                {scaleHold ? (
                  <Check className="size-4 text-accent" />
                ) : (
                  <Ruler className="size-4 text-accent" />
                )}
                Calibrate 1:1
                <span className="ml-auto text-[10px] font-normal tabular-nums text-muted-foreground">
                  {scaleHold ? "held" : pxPerCm && pxPerCm !== 16 ? "set" : "not set"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  dismissCurveCoach();
                  if (lockPhaseRef.current !== "idle") return;
                  setCurveOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <Waves className="size-4 text-accent" />
                Wrap around the body
                <span className="ml-auto text-[10px] font-normal tabular-nums text-muted-foreground">
                  {Math.round(curve * 100)}%
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (lockPhaseRef.current !== "idle") return;
                  setScanOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <ScanLine className="size-4 text-accent" />
                Scan surface
                <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                  {profile ? formatScannedAt(profile.scannedAt) : "beta"}
                </span>
              </button>


              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  sampleSkin();
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                {skinTone ? (
                  <span
                    className="size-4 rounded-full border border-white/40"
                    style={{ background: skinTone.hex }}
                  />
                ) : (
                  <Sparkles className="size-4 text-accent" />
                )}
                Match skin tone
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  if (locked) {
                    if (reanchorLock()) {
                      setLockPhase("locked");
                      setLockToast("Re-anchored on the skin");
                      setTimeout(() => setLockToast(null), 1600);
                    }
                    return;
                  }
                  setTransform(defaultTransform());
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <RotateCcw className="size-4 text-accent" />
                {locked ? "Re-anchor here" : "Reset placement"}
              </button>

              {undoStack.length > 0 && !locked && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setUndoStack((st) => {
                      const prev = st[st.length - 1];
                      if (prev) {
                        stopSmoothing(false);
                        smoothRef.current = prev;
                        setTransform(prev);
                      }
                      return st.slice(0, -1);
                    });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
                >
                  <Undo2 className="size-4 text-accent" />
                  Undo last change
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setShareOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <Share2 className="size-4 text-accent" />
                Share design
              </button>

              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setMatchingOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <HeartHandshake className="size-4 text-accent" />
                Matching tattoo
                <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                  couples
                </span>
              </button>


              <button
                type="button"
                role="switch"
                aria-checked={shutterSound}
                onClick={() => {
                  const next = !shutterSound;
                  setShutterSound(next);
                  void import("@/lib/shutterSound").then((m) => {
                    m.setShutterSoundEnabled(next);
                    if (next) m.playShutter();
                  });
                }}
                className="w-full flex items-center gap-2 px-3 py-3 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <Volume2 className={`size-4 ${shutterSound ? "text-accent" : "text-muted-foreground"}`} />
                Shutter sound
                <span
                  className={`ml-auto h-5 w-9 rounded-full transition-colors ${shutterSound ? "bg-accent" : "bg-white/15"} relative`}
                >
                  <span
                    className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${shutterSound ? "translate-x-4" : "translate-x-0.5"}`}
                  />
                </span>
              </button>
              <Link
                to="/mode3d"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <Box className="size-4 text-accent" />
                3D mode
              </Link>
              <Link
                to="/library"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 text-[12px] font-bold border-t border-white/10 hover:bg-white/5"
              >
                <Layers className="size-4 text-accent" />
                Library
              </Link>
            </div>
          )}
        </div>
      </div>

      {curveCoach && !recording && (
        <div className="absolute left-1/2 top-24 z-30 w-60 -translate-x-1/2 rounded-2xl border border-accent/40 bg-ink/95 backdrop-blur-xl p-3 shadow-2xl">
          <p className="text-[12px] leading-snug">
            Looks like a sticker? Wrap it around the arm.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={dismissCurveCoach}
              className="flex-1 min-h-10 rounded-xl border border-white/10 text-[11px] font-bold hover:bg-white/5"
            >
              Not now
            </button>
            <button
              onClick={() => {
                dismissCurveCoach();
                setCurveOpen(true);
              }}
              className="flex-1 min-h-10 rounded-xl bg-accent text-ink text-[11px] font-bold"
            >
              Wrap it
            </button>
          </div>
        </div>
      )}

      {/* WRAP — half-screen sheet. Bending metal, not tweaking a filter. */}
      {curveOpen && (
        <div className="absolute inset-0 z-40 flex items-end" onClick={() => setCurveOpen(false)}>
          <div className="absolute inset-0 bg-ink/40" />
          <div
            className="relative w-full rounded-t-3xl border-t border-white/10 bg-ink/95 backdrop-blur-xl p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-5 max-h-[62vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.25em] font-bold text-accent">
                Wrap
              </span>
              <span className="text-2xl font-bold tabular-nums tracking-tight">
                {Math.round(curve * 100)}
                <span className="text-sm opacity-50">%</span>
              </span>
              <button
                type="button"
                onClick={() => setCurveOpen(false)}
                aria-label="Close wrap"
                className="ml-auto grid size-10 place-items-center rounded-full border border-white/10"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1 rounded-2xl border border-white/10 p-1">
              {(
                [
                  ["Flat", CURVE_PRESETS.flat],
                  ["Arm", CURVE_PRESETS.arm],
                  ["Wrist", CURVE_PRESETS.wrist],
                  ["Leg", CURVE_PRESETS.leg],
                ] as const
              ).map(([label, v]) => (
                <button
                  key={label}
                  onClick={() => {
                    if (lockPhaseRef.current !== "idle") return;
                    setAutoCurve(false);
                    setCurve(v);
                  }}
                  className={`min-h-12 rounded-xl text-[13px] font-bold transition ${
                    !autoCurve && Math.abs(curve - v) < 0.02
                      ? "bg-accent text-ink"
                      : "hover:bg-white/5"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(curve * 100)}
              onChange={(e) => {
                if (lockPhaseRef.current !== "idle") return;
                setAutoCurve(false);
                setCurve(Number(e.target.value) / 100);
              }}
              className="w-full h-3 accent-accent disabled:opacity-40"
              disabled={autoCurve || lockPhase !== "idle"}
              aria-label="Body curvature amount"
            />

            <button
              onClick={() => { if (lockPhaseRef.current === "idle") setAutoCurve((v) => !v); }}
              className={`w-full flex items-center justify-between rounded-2xl px-4 min-h-12 border text-[13px] font-bold transition ${
                autoCurve
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-white/10 hover:bg-white/5"
              }`}
              aria-pressed={autoCurve}
            >
              <span>Auto — read the limb from the camera</span>
              <span className="opacity-70">{autoCurve ? "On" : "Off"}</span>
            </button>
            {autoCurve && (
              <p className="text-[11px] text-muted-foreground">
                {curveHint
                  ? "Show both sides of the arm for a better wrap"
                  : curveConf < 0.35
                    ? "Aim at the arm or leg with both edges in frame…"
                    : `Detected ${
                        curve > 0.6 ? "a thin limb" : curve > 0.25 ? "an arm/leg" : "a flat area"
                      } · ${Math.round(curveConf * 100)}% certainty`}
              </p>
            )}

            <div className="space-y-2 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">
                  Edge occlusion
                </span>
                <span className="text-[11px] font-bold tabular-nums opacity-70">
                  {Math.round(occlusion * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(occlusion * 100)}
                onChange={(e) => { if (lockPhaseRef.current === "idle") setOcclusion(Number(e.target.value) / 100); }}
                disabled={lockPhase !== "idle"}
                className="w-full accent-accent"
                aria-label="Edge occlusion amount"
              />
              <button
                onClick={() => setAutoLight((v) => !v)}
                className={`w-full flex items-center justify-between rounded-2xl px-4 min-h-12 border text-[13px] font-bold transition ${
                  autoLight
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-white/10 hover:bg-white/5"
                }`}
                aria-pressed={autoLight}
              >
                <span className="flex items-center gap-2">
                  <Sun className="size-4" /> Match room light
                </span>
                <span className="opacity-70">{autoLight ? "On" : "Off"}</span>
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Skin-tone toast */}
      {skinToast && (
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 z-30 glass px-4 py-2 rounded-full flex items-center gap-2 border border-accent/40">
          <Check className="size-3.5 text-accent" />
          <span
            className="size-4 rounded-full border border-white/40"
            style={{ background: skinTone?.hex ?? "transparent" }}
          />
          <span className="text-[11px] font-bold">
            Skin tone matched
            <span className="ml-1 font-normal opacity-70">
              · sampled from your skin
            </span>
          </span>
        </div>
      )}

      {calibOpen && (
        <ScaleCalibrator
          video={videoRef.current}
          stage={stageRef.current}
          mirrored={facing === "user"}
          onConfirm={(next) => applyCalibration(next)}
          onClose={() => setCalibOpen(false)}
        />
      )}

      <SurfaceScanSheet
        open={scanOpen}
        scanning={scanning}
        coverage={scanCoverage}
        samples={scanSamples}
        hint={scanHint}
        quality={scanQuality}
        angles={scanAngles}
        targetAngles={scanTargetAngles}
        usable={scanUsable}
        result={scanResult}
        onStart={startSurfaceScan}
        onFinish={finishSurfaceScan}
        onCancel={cancelSurfaceScan}

        onApply={() => {
          if (!scanResult || lockPhaseRef.current !== "idle") return;
          applyProfile(scanResult);
          saveSurfaceProfile(scanResult, user?.id ?? null);
          setScanOpen(false);
          toast.success("Surface profile applied");
        }}
        onClose={() => setScanOpen(false)}
      />

      {/* Scanned-surface chip: shows the profile is driving the placement. */}
      {profile && !scanOpen && !recording && !darkroom && (
        <button
          type="button"
          onClick={() => {
            if (lockPhaseRef.current !== "idle") return;
            clearSurfaceProfile(user?.id ?? null);
            setProfile(null);
            toast("Surface profile turned off");
          }}
          className="absolute left-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-30 glass rounded-full px-3 py-1.5 flex items-center gap-1.5 border border-accent/40"
          title="Tap to stop using the scanned surface"
        >
          <ScanLine className="size-3.5 text-accent" />
          <span className="text-[10px] font-bold uppercase tracking-widest">
            Scanned surface
          </span>
        </button>
      )}
      {calibToast && (
        <div className="pointer-events-none absolute left-1/2 top-24 -translate-x-1/2 z-30 glass px-4 py-2 rounded-full flex items-center gap-2 border border-accent/40 max-w-[85%]">
          <Ruler className="size-3.5 text-accent" />
          <span className="text-[11px] font-bold text-center">{calibToast}</span>
        </div>
      )}


      {/* Lock toast + status */}
      {lockToast && (
        <div className="pointer-events-none absolute left-1/2 top-36 -translate-x-1/2 z-30 glass px-4 py-2 rounded-full flex items-center gap-2 border border-accent/40 max-w-[80%]">
          <Lock className="size-3.5 text-accent" />
          <span className="text-[11px] font-bold text-center">{lockToast}</span>
        </div>
      )}
      {lockCoach && (
        <div className="pointer-events-none absolute left-1/2 top-36 -translate-x-1/2 z-30 glass px-4 py-2 rounded-full flex items-center gap-2 border border-accent/40 max-w-[80%]">
          <span className="size-2 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] font-bold text-center">{lockCoach}</span>
        </div>
      )}
      {tooClose && lockPhase === "locked" && !recording && !darkroom && (
        <div className="pointer-events-none absolute left-1/2 top-36 -translate-x-1/2 z-30 glass px-4 py-2 rounded-full flex items-center gap-2 border border-amber-400/60 max-w-[80%]">
          <ScanLine className="size-3.5 shrink-0 text-amber-400" />
          <span className="text-[11px] font-bold text-center">
            Too close — back up a little
          </span>
        </div>
      )}
      {locked && !recording && !darkroom && (
        <div
          className={`absolute left-1/2 bottom-[calc(13rem+env(safe-area-inset-bottom))] -translate-x-1/2 z-30 rounded-full pl-3 pr-1 py-1 flex items-center gap-2 ${
            lockPhase === "lost"
              ? "bg-amber-400 text-ink"
              : "bg-accent text-ink"
          }`}
          onClick={() => {
            // Three quick taps on the pill = darkroom: skin and ink only.
            const now = Date.now();
            if (now - pillTapRef.current.at > 600) pillTapRef.current.n = 0;
            pillTapRef.current = { n: pillTapRef.current.n + 1, at: now };
            if (pillTapRef.current.n >= 3) {
              pillTapRef.current = { n: 0, at: 0 };
              setDarkroom(true);
            }
          }}
        >
          <Lock className="size-3 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-widest tabular-nums">
            {lockPhase === "lost"
              ? "Tracking lost — same angle, or tap Unlock"
              : `Locked · ${widthCm} cm · following`}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              releaseLock();
            }}
            className="size-11 -my-2 rounded-full grid place-items-center text-ink/80 active:scale-95"
            aria-label="Unlock to move"
            title="Unlock to move"
          >
            <Unlock className="size-4" />
          </button>
        </div>
      )}

      {/* Darkroom — everything gone but the skin and the ink. */}
      {darkroom && (
        <button
          type="button"
          onClick={() => setDarkroom(false)}
          className="absolute inset-0 z-30"
          aria-label="Leave darkroom view"
        >
          <span className="absolute bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-ink/50 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/50">
            Tap to exit
          </span>
        </button>
      )}

      {/* The centre marker used to sit on top of every photo and clip, so it
          is gone: the design itself is the reference point. */}




      {/* Bottom controls */}
      <div
        className={`absolute inset-x-0 bottom-0 z-20 px-6 pb-[calc(3.5rem+env(safe-area-inset-bottom))] pt-4 transition-opacity duration-200 ${
          darkroom || menuOpen
            ? "pointer-events-none opacity-0"
            : recording
              ? "bg-transparent"
              : "bg-gradient-to-t from-ink via-ink/70 to-transparent"
        }`}
      >

        {/* Photo / video mode switch */}
        <div
          className={`mb-3 flex justify-center transition-opacity duration-200 ${
            recording ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
        >

          <div className="inline-flex rounded-full border border-white/10 bg-ink/70 p-1">
            {(
              [
                { id: "photo", label: "Photo", Icon: Camera },
                { id: "video", label: "Video", Icon: Video },
              ] as const
            ).map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => {
                  if (recording) return;
                  if (id === "video" && !locked) {
                    setVideoGate(true);
                    return;
                  }
                  setMode(id);
                }}
                className={`px-4 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-widest flex items-center gap-1.5 transition ${
                  mode === id ? "bg-accent text-ink" : "text-muted-foreground"
                }`}
                aria-pressed={id === mode}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>


        <div className="flex items-center justify-between">
          <div className="w-16 flex flex-col items-start justify-center">
            {recording ? (
              <span className="text-[11px] font-bold text-red-400 flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-red-500 animate-pulse" />
                0:{String(recSeconds).padStart(2, "0")}
              </span>
            ) : showTech ? (
              <>
                <span className="text-[10px] opacity-40 font-display tracking-widest">
                  ISO 400
                </span>
                <span className="text-[10px] opacity-40 font-display tracking-widest">
                  F 1.8
                </span>
              </>
            ) : null}
          </div>

          <button
            onClick={onShutter}
            className="relative group active:scale-95 transition-transform"
            aria-label={
              mode === "photo"
                ? "Take photo"
                : recording
                  ? "Stop recording"
                  : "Record video"
            }
            style={
              recording ? undefined : { animation: "shutter-glow 2.4s infinite" }
            }
          >
            <div
              className={`relative size-[72px] rounded-full border-4 p-1 bg-transparent ${
                mode === "video" ? "border-red-500" : "border-white"
              }`}
            >
              {recording ? (
                <div className="w-full h-full bg-red-500 rounded-md grid place-items-center">
                  <Square className="size-4 fill-white text-white" />
                </div>
              ) : (
                <div
                  className={`w-full h-full rounded-full ${
                    mode === "video" ? "bg-red-500" : "bg-white"
                  }`}
                />
              )}
            </div>
          </button>

          <div
            className={`flex w-16 flex-col items-end gap-1.5 transition-opacity duration-200 ${
              recording ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <button
              onClick={toggleLock}
              className={`size-14 rounded-full grid place-items-center border-2 transition active:scale-95 ${
                lockPhase === "arming"
                  ? "border-accent bg-accent/25 text-accent animate-pulse"
                  : lockPhase === "lost"
                    ? "border-amber-400 bg-amber-400 text-ink"
                    : locked
                      ? "border-accent bg-accent text-ink shadow-[inset_0_3px_8px_rgba(0,0,0,0.35)] scale-95"
                      : "border-white/25 bg-ink/60 text-foreground"
              }`}
              aria-pressed={locked}
              aria-label={locked ? "Unlock the design" : "Lock the design"}
              title={
                locked
                  ? "Unlocked mode: drag, pinch, and rotate"
                  : "Lock size and placement — the design follows distance while filming"
              }
            >
              {locked ? <Lock className="size-5" /> : <Unlock className="size-5" />}
            </button>
            <span className="text-[11px] uppercase font-bold tracking-widest text-accent leading-none">
              {lockPhase === "arming"
                ? "Locking"
                : lockPhase === "lost"
                  ? "Lost"
                  : locked
                    ? "Locked"
                    : "Lock"}
            </span>
          </div>
        </div>

        {/* Motif strip — hidden once the placement is locked */}
        {!locked && !menuOpen && (
          <div
            className={`transition-opacity duration-200 ${
              recording ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
          >
            <button
              type="button"
              onClick={() => setGalleryOpen((open) => !open)}
              onTouchStart={(e) => {
                galleryTouchY.current = e.touches[0]?.clientY ?? null;
              }}
              onTouchEnd={(e) => {
                const startY = galleryTouchY.current;
                galleryTouchY.current = null;
                if (startY == null) return;
                const endY = e.changedTouches[0]?.clientY ?? startY;
                if (startY - endY > 40) setGalleryOpen(true);
              }}
              aria-label={galleryOpen ? "Close design gallery" : "Open design gallery"}
              aria-expanded={galleryOpen}
              className="relative mx-auto mb-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-t-2xl border border-accent/20 bg-slate/90 px-4 text-[11px] text-foreground shadow-lg backdrop-blur-xl active:scale-[0.98] before:absolute before:left-1/2 before:top-1 before:h-1 before:w-10 before:-translate-x-1/2 before:rounded-full before:bg-accent"
            >
              All designs
              <span className="text-muted-foreground">Swipe up</span>
              <ChevronUp className="size-4 text-accent" aria-hidden="true" />
            </button>
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleStripUpload}
            />
          </div>
        )}


        {showCustomHelp && !locked && (
          <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
            <span className="text-accent font-bold">Custom design:</span> upload
            a sketch or write text — the white background is made transparent
            automatically so only the lines end up on the skin.
          </p>
        )}


      </div>
      {/* Gallery sheet — AI creator, text creator and the design grid */}
      {galleryOpen && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <button
            className="absolute inset-0 bg-ink/70 backdrop-blur-sm"
            onClick={() => setGalleryOpen(false)}
            aria-label="Close gallery"
          />
          <div
            className="reference-gallery relative flex h-[76%] flex-col rounded-t-3xl border border-accent/30 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur-2xl shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setGalleryOpen(false)}
              className="mx-auto mb-2 flex min-h-11 w-20 items-center justify-center"
              aria-label="Close design gallery"
            >
              <span className="h-1 w-9 rounded-full bg-accent" />
            </button>
            <div className="flex shrink-0 items-start justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold uppercase leading-none">
                  Choose a design
                </h2>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Tap a motif to try it. Your camera stays open.
                </p>
              </div>
              <button
                onClick={() => setGalleryOpen(false)}
                aria-label="Close"
                className="grid size-11 place-items-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-5" />
              </button>
            </div>

            <label className="mt-2 flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 focus-within:border-accent">
              <Search className="size-4 text-muted-foreground" />
              <input
                value={galleryQuery}
                onChange={(event) => setGalleryQuery(event.target.value)}
                placeholder="Search designs…"
                aria-label="Search gallery designs"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
              />
              {galleryQuery && (
                <button
                  type="button"
                  onClick={() => setGalleryQuery("")}
                  aria-label="Clear gallery search"
                  className="grid size-11 -mr-3 place-items-center text-muted-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </label>

            <div className="mt-2 flex min-h-11 shrink-0 items-center gap-2 overflow-x-auto no-scrollbar">
              {(["All", ...STYLES] as (TattooStyle | "All")[]).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => setGalleryStyle(style)}
                  className={`min-h-11 shrink-0 rounded-full border px-4 text-[10px] font-bold uppercase ${
                    galleryStyle === style
                      ? "border-accent bg-accent text-ink"
                      : "border-white/15 bg-white/[0.04] text-muted-foreground"
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            <div className="mt-3 flex shrink-0 items-center justify-between text-[11px]">
              <span className="text-muted-foreground">
                {filteredGalleryTattoos.length} designs
              </span>
              <span className="font-bold text-accent">Free to try</span>
            </div>

            <div className="-mx-4 mt-2 flex-1 overflow-y-auto overscroll-contain px-4 no-scrollbar">
              {filteredGalleryTattoos.length ? (
                <div className="grid grid-cols-2 gap-3 pb-2">
                  {filteredGalleryTattoos.map((tattoo) => {
                    const active = tattoo.id === selectedId && !customImage;
                    return (
                      <div key={tattoo.id} className="group relative">
                        <button
                          onClick={() => {
                            pickTattoo(tattoo);
                            setGalleryOpen(false);
                          }}
                          className={`relative block aspect-square w-full overflow-hidden rounded-xl bg-artwork transition ${
                            active ? "ring-2 ring-accent" : "ring-1 ring-white/10 hover:ring-white/25"
                          }`}
                          aria-label={`Try ${tattoo.name}`}
                          aria-pressed={active}
                        >
                          <img
                            src={tattoo.src}
                            alt={tattoo.name}
                            loading="lazy"
                            className="h-full w-full object-contain p-3"
                          />
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-2 right-2 grid size-6 place-items-center rounded-full bg-accent text-ink"
                            >
                              <Check className="size-4" />
                            </span>
                          )}
                        </button>
                        <div className="mt-1.5 px-0.5">
                          <div className="truncate text-[13px] font-semibold">{tattoo.name}</div>
                          <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
                            {tattoo.style}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="grid min-h-40 place-items-center text-center">
                  <div>
                    <p className="text-sm font-bold text-foreground">No designs found</p>
                    <button
                      type="button"
                      onClick={() => {
                        setGalleryQuery("");
                        setGalleryStyle("All");
                      }}
                      className="mt-3 min-h-11 rounded-full border border-accent px-4 text-[11px] font-bold uppercase text-accent"
                    >
                      Clear search & filters
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {textOpen && (
        <TextTattooTool
          onCancel={() => setTextOpen(false)}
          onDone={(url, label) => {
            setCustomImage(url);
            setCustomLabel(label);
            setTextOpen(false);
            setTransform(defaultTransform());
            try {
              saveMyMotif({ name: label || "Text", src: url, source: "text" });
              toast.success("Text saved to your library");
            } catch {
              /* ignore */
            }
          }}
        />

      )}

      {captured && (
        <CaptureSheet
          image={captured.dataUrl}
          baseImage={captured.baseDataUrl}
          previewSrc={captured.previewUrl}
          widthCm={widthCm}
          rotation={transform.rotation}
          tattooId={activeTattoo.id}
          tattooName={displayName}
          user={user}
          onRequireAuth={() => navigate({ to: "/auth" })}
          onSendToArtist={(projectId) =>
            navigate({ to: "/artists/search", search: { project: projectId } })
          }
          onClose={() => {
            if (captured.previewUrl.startsWith("blob:")) {
              URL.revokeObjectURL(captured.previewUrl);
            }
            capturedRef.current = null;
            setCaptured(null);
          }}
        />
      )}

      {capturedVideo && (
        <VideoSheet
          video={capturedVideo}
          rotation={transform.rotation}
          widthCm={widthCm}
          tattooId={activeTattoo.id}
          tattooName={displayName}
          onClose={() => {
            URL.revokeObjectURL(capturedVideo.url);
            setCapturedVideo(null);
          }}
        />
      )}

      {/* Buy-in-AR CTA */}
      {onBuy && motifId && motifPriceOre != null && (
        <div className="absolute inset-x-0 top-24 z-20 flex justify-center pointer-events-none">
          <button
            onClick={onBuy}
            className="pointer-events-auto h-11 px-5 rounded-full bg-accent text-ink font-bold text-sm shadow-lg flex items-center gap-2"
          >
            Buy this design · SEK {(motifPriceOre / 100).toFixed(0)}
          </button>
        </div>
      )}
    </div>
  );
}

const PRESETS = [
  { hex: "#FFFFFF", label: "White", note: "Recommended" },
  { hex: "#000000", label: "Black", note: "Dark background" },
  { hex: "#FF00FF", label: "Magenta", note: "Alt. background" },
  { hex: "#00FF00", label: "Lime", note: "Alt. background" },
] as const;

function TransparencyTool({
  src,
  onCancel,
  onDone,
}: {
  src: string;
  onCancel: () => void;
  onDone: (url: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string>(src);
  const [tolerance, setTolerance] = useState(48);
  const [softEdges, setSoftEdges] = useState(true);
  const [edgesOnly, setEdgesOnly] = useState(false);
  const [pickedHex, setPickedHex] = useState<string>("#FFFFFF");
  const originalData = useRef<ImageData | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;
      const max = 900;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      setDims({ w, h });
      const c = canvasRef.current;
      if (!c) return;
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      originalData.current = ctx.getImageData(0, 0, w, h);
      setReady(true);
    };
    img.onerror = () => {
      if (!cancelled) setLoadError("Could not read the image. Try a different file.");
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  const applyRemoval = useCallback(
    (hex: string, tol: number, soft: boolean, edges: boolean) => {
      const c = canvasRef.current;
      const orig = originalData.current;
      if (!c || !orig) return;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      const result = removeColor(orig, {
        color: hexToRgb(hex),
        tolerance: tol,
        feather: soft ? Math.max(14, tol * 0.7) : 1,
        edgesOnly: edges,
      });
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.putImageData(result, 0, 0);
      setPreview(c.toDataURL("image/png"));
    },
    [],
  );

  // Auto-apply white removal as soon as the image is decoded, and whenever
  // any setting changes.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(
      () => applyRemoval(pickedHex, tolerance, softEdges, edgesOnly),
      40,
    );
    return () => clearTimeout(t);
  }, [ready, pickedHex, tolerance, softEdges, edgesOnly, applyRemoval]);

  const pickPreset = (hex: string) => setPickedHex(hex);

  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    const orig = originalData.current;
    if (!c || !orig) return;
    const rect = c.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * c.width);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * c.height);
    if (x < 0 || y < 0 || x >= c.width || y >= c.height) return;
    const idx = (y * orig.width + x) * 4;
    setPickedHex(rgbToHex(orig.data[idx], orig.data[idx + 1], orig.data[idx + 2]));
  };

  const onToleranceChange = (v: number) => setTolerance(v);

  const reset = () => {
    setPickedHex("#FFFFFF");
    setTolerance(48);
    setSoftEdges(true);
    setEdgesOnly(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-lg flex flex-col p-5 pt-[calc(1.25rem+env(safe-area-inset-top))] overflow-y-auto">
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="size-10 rounded-full glass grid place-items-center shrink-0"
            aria-label="Back to camera"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <div className="text-mono-caps text-accent text-[10px]">Upload · Step 2</div>
            <h2 className="font-display font-bold text-lg">Remove background</h2>
          </div>
        </div>
        <button
          onClick={onCancel}
          className="size-11 rounded-full glass grid place-items-center"
          aria-label="Cancel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 mb-3">
        <div className="flex items-start gap-2.5">
          <div
            className="size-8 rounded-lg flex-none border border-white/20"
            style={{ background: "#FFFFFF" }}
          />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground">
              White <span className="font-mono text-accent">#FFFFFF</span> is preselected
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
              Upload a sketch on white paper or a white background — it is
              removed automatically. Tap the image to pick a different color,
              or use one of the presets below.
            </p>
          </div>
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 mb-3 text-xs text-red-200">
          {loadError}
        </div>
      )}

      <div
        className="relative rounded-2xl overflow-hidden border border-white/10 flex-1 min-h-[240px] grid place-items-center"
        style={{
          backgroundImage:
            "linear-gradient(45deg, #1a1a1a 25%, transparent 25%), linear-gradient(-45deg, #1a1a1a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1a1a1a 75%), linear-gradient(-45deg, transparent 75%, #1a1a1a 75%)",
          backgroundSize: "16px 16px",
          backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0",
          backgroundColor: "#0a0a0a",
        }}
      >
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          className="max-w-full max-h-full cursor-crosshair"
          style={{
            width: dims.w ? Math.min(dims.w, 480) : undefined,
            height: "auto",
          }}
        />
        <div className="pointer-events-none absolute top-2 left-2 glass px-2 py-1 rounded-md text-[9px] uppercase tracking-widest text-accent">
          Tap to pick a color
        </div>
      </div>

      <div className="mt-3">
        <div className="text-mono-caps text-[9px] text-muted-foreground mb-1.5">
          Presets
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const selected = pickedHex.toUpperCase() === p.hex;
            return (
              <button
                key={p.hex}
                onClick={() => pickPreset(p.hex)}
                className={`rounded-xl p-2 border transition text-left ${
                  selected
                    ? "border-accent ring-2 ring-accent/30 bg-accent/5"
                    : "border-white/10 bg-slate/60"
                }`}
              >
                <div
                  className="w-full h-6 rounded-md border border-white/15"
                  style={{ background: p.hex }}
                />
                <div className="mt-1.5 text-[10px] font-bold leading-tight">
                  {p.label}
                </div>
                <div className="text-[9px] text-muted-foreground leading-tight">
                  {p.note}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-slate/60 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-mono-caps text-[10px] text-muted-foreground">
            Selected color
          </span>
          <div className="flex items-center gap-2">
            <span
              className="size-5 rounded border border-white/20"
              style={{ background: pickedHex }}
            />
            <span className="font-mono text-[11px]">{pickedHex}</span>
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
            <span>Tolerance</span>
            <span>{tolerance}</span>
          </div>
          <input
            type="range"
            min={0}
            max={140}
            value={tolerance}
            onChange={(e) => onToleranceChange(Number(e.target.value))}
            className="w-full accent-[color:var(--accent)]"
          />
          <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
            <span>Exact</span>
            <span>Wider selection</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSoftEdges((s) => !s)}
            className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-widest transition ${
              softEdges
                ? "border-accent bg-accent/10 text-accent"
                : "border-white/10 text-muted-foreground"
            }`}
          >
            Soft edges
          </button>
          <button
            onClick={() => setEdgesOnly((s) => !s)}
            className={`rounded-lg border px-2 py-2 text-[10px] font-bold uppercase tracking-widest transition ${
              edgesOnly
                ? "border-accent bg-accent/10 text-accent"
                : "border-white/10 text-muted-foreground"
            }`}
          >
            Keep inner white
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground leading-snug">
          Soft edges removes the gray fringe around the lines. "Keep inner
          white" only removes the background around the design.
        </p>
        <button
          onClick={reset}
          className="text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          ↺ Reset
        </button>
      </div>


      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => onDone(src)}
          className="py-4 rounded-xl border border-white/15 bg-slate text-sm font-bold"
        >
          Skip
        </button>
        <button
          onClick={() => onDone(preview)}
          className="py-4 rounded-xl bg-accent text-ink text-sm font-bold"
        >
          Use
        </button>
      </div>
    </div>
  );
}

function CaptureSheet({
  image,
  previewSrc,
  widthCm,
  rotation,
  tattooId,
  tattooName,
  user,
  onRequireAuth,
  onSendToArtist,
  onClose,
  baseImage,
}: {
  image: string;
  /** Same shot without the design. */
  baseImage?: string;
  /** Blob URL of the same shot — large data URLs can fail to paint on mobile. */
  previewSrc?: string | null;
  widthCm: string;
  rotation?: number;
  tattooId: string;

  tattooName: string;
  user: { id: string } | null;
  onRequireAuth: () => void;
  onSendToArtist: (projectId: string) => void;
  onClose: () => void;
}) {

  const [name, setName] = useState(tattooName);
  const [bodyPart, setBodyPart] = useState("");
  const [displaySrc, setDisplaySrc] = useState(previewSrc ?? image);
  const previewImgRef = useRef<HTMLImageElement>(null);
  const [previewState, setPreviewState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  useEffect(() => {
    setDisplaySrc(previewSrc ?? image);
    setPreviewState("loading");
  }, [image, previewSrc]);
  useEffect(() => {
    const img = previewImgRef.current;
    if (!img) return;

    // Mobile Safari can finish painting a freshly-created blob URL without
    // reliably dispatching React's load event. Never keep a valid image hidden
    // behind loading opacity, and verify the decoded pixels directly instead.
    const markReady = () => {
      if (img.complete && img.naturalWidth > 0) setPreviewState("ready");
    };
    markReady();
    void img.decode?.().then(markReady).catch(markReady);

    // If iOS has not decoded the blob URL promptly, retry the preserved PNG
    // data URL. Android normally stays on the smaller blob URL.
    const fallbackTimer = window.setTimeout(() => {
      if (img.naturalWidth > 0) {
        setPreviewState("ready");
      } else if (displaySrc !== image) {
        setDisplaySrc(image);
        setPreviewState("loading");
      } else {
        setPreviewState("error");
      }
    }, 1200);
    return () => window.clearTimeout(fallbackTimer);
  }, [displaySrc, image]);
  const [busy, setBusy] = useState<
    null | "share" | "save" | "roll" | PostTarget
  >(null);
  const [hubCfg, setHubCfg] = useState<{
    tab: "image" | "vote" | "reaction";
    reaction: boolean;
  } | null>(null);
  const [status, setStatus] = useState<null | { ok: boolean; text: string }>(
    null,
  );
  // Branded image as a Blob so Instagram/TikTok can save it and open the app.
  const [imgBlob, setImgBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let live = true;
    void composeShareImage(image)
      .then(dataUrlToBlob)
      .then((b) => {
        if (live) setImgBlob(b);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [image]);

  const share = async () => {
    setBusy("share");
    try {
      const composed = await composeShareImage(image);
      const blob = await dataUrlToBlob(composed);
      const result = await shareFile(blob, `inksimulator-${Date.now()}.png`);
      if (result !== "cancelled") {
        setStatus({
          ok: true,
          text: result === "shared" ? "Shared!" : "Saved to device",
        });
      }
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : "Could not share",
      });
    } finally {
      setBusy(null);
    }
  };

  const saveToRoll = async () => {
    setBusy("roll");
    try {
      const composed = await composeShareImage(image);
      const blob = await dataUrlToBlob(composed);
      const result = await saveToCameraRoll(blob, `inksimulator-${Date.now()}.png`);
      if (result !== "cancelled") {
        setStatus({
          ok: true,
          text:
            result === "shared"
              ? "Choose \u201cSave Image\u201d for the camera roll"
              : "Saved to camera roll",
        });
      }
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : "Could not save",
      });
    } finally {
      setBusy(null);
    }
  };


  const save = async () => {
    if (!user) {
      await stashPendingTryOn({
        intent: "save",
        name: name.trim() || tattooName,
        bodyPart: bodyPart.trim() || undefined,
        tattooId,
        tattooName,
        widthCm: Number(widthCm),
        previewDataUrl: image,
        basePhotoDataUrl: baseImage,
      });
      onRequireAuth();
      return;
    }
    setBusy("save");
    try {
      await saveProject({
        userId: user.id,
        name: name.trim() || tattooName,
        bodyPart: bodyPart.trim() || undefined,
        tattooId,
        tattooName,
        widthCm: Number(widthCm),
        previewDataUrl: image,
        basePhotoDataUrl: baseImage,
      });
      setStatus({ ok: true, text: "Saved to your projects" });
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : "Could not save",
      });
    } finally {
      setBusy(null);
    }
  };

  const sendToArtist = async () => {
    if (!user) {
      await stashPendingTryOn({
        intent: "send",
        name: name.trim() || tattooName,
        bodyPart: bodyPart.trim() || undefined,
        tattooId,
        tattooName,
        widthCm: Number(widthCm),
        previewDataUrl: image,
        basePhotoDataUrl: baseImage,
      });
      onRequireAuth();
      return;
    }
    setBusy("save");
    try {
      const project = await saveProject({
        userId: user.id,
        name: name.trim() || tattooName,
        bodyPart: bodyPart.trim() || undefined,
        tattooId,
        tattooName,
        widthCm: Number(widthCm),
        previewDataUrl: image,
        basePhotoDataUrl: baseImage,
      });
      sessionStorage.setItem("inkvision.booking-handoff", JSON.stringify({
        sourceProjectId: project.id,
        placement: bodyPart.trim(),
        sizeCm: widthCm,
        description: `${tattooName} tested in InkSimulator AR`,
      }));
      onSendToArtist(project.id);
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "Could not prepare the request" });
    } finally {
      setBusy(null);
    }
  };

  /** Saves the shot and opens the chosen app so it can be posted right away. */
  const postTo = async (target: PostTarget) => {
    setBusy(target);
    try {
      const composed = await composeShareImage(image, {
        format: target === "instagram" ? "1:1" : "9:16",
      });
      const blob = await dataUrlToBlob(composed);
      const result = await postToApp(target, blob, `inksimulator-${Date.now()}.png`);
      if (result !== "cancelled") {
        setStatus({
          ok: true,
          text: "Saved — pick the shot in the app to post it",
        });
      }
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : "Could not open that app",
      });
    } finally {
      setBusy(null);
    }
  };



  return (
    <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-lg flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-mono-caps text-accent text-[10px]">
            AR placement
          </div>
          <h2 className="font-display font-bold text-lg">Perfect size</h2>
        </div>
        <button
          onClick={onClose}
          className="size-11 rounded-full glass grid place-items-center"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="relative grid min-h-[38dvh] max-h-[52dvh] place-items-center overflow-hidden rounded-2xl border border-white/10 bg-slate">
        {previewState === "loading" && (
          <div className="absolute inset-0 z-10 grid place-items-center pointer-events-none" role="status">
            <Loader2 className="size-6 animate-spin text-accent" />
            <span className="sr-only">Loading photo preview</span>
          </div>
        )}
        {previewState === "error" && (
          <p className="px-6 text-center text-sm text-muted-foreground" role="alert">
            The photo could not be displayed. Close this view and take it again.
          </p>
        )}
        <img
          ref={previewImgRef}
          key={displaySrc}
          src={displaySrc}
          alt="Preview of your AR tattoo photo"
          onLoad={() => setPreviewState("ready")}
          onError={(e) => {
            if (displaySrc !== image) {
              setPreviewState("loading");
              setDisplaySrc(image);
              return;
            }
            e.currentTarget.removeAttribute("src");
            setPreviewState("error");
          }}
          decoding="sync"
          className="relative min-h-[38dvh] max-h-[52dvh] w-full object-contain"
        />
      </div>


      {/* Social targets sit directly under the shot — one tap from capture. */}
      <div className="mt-3 grid grid-cols-5 gap-2">
        <button
          onClick={() => void share()}
          disabled={busy !== null}
          className="rounded-2xl bg-accent text-ink py-2.5 flex flex-col items-center gap-1 text-[10px] font-bold disabled:opacity-60"
        >
          {busy === "share" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Share2 className="size-4" />
          )}
          Share
        </button>
        {POST_TARGETS.map((t) => (
          <button
            key={t.id}
            onClick={() => void postTo(t.id)}
            disabled={busy !== null}
            className="rounded-2xl border border-white/10 bg-slate py-2.5 flex flex-col items-center gap-1 text-[10px] font-bold disabled:opacity-60"
          >
            {busy === t.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <SocialIcon
                platform={t.id === "instagram-story" ? "instagram" : t.id}
                className="size-4"
              />
            )}
            {t.label}
          </button>
        ))}
      </div>




      <div className="mt-4 rounded-xl border border-white/10 bg-slate/50 p-4">
        <div className="flex items-baseline justify-between">
          <span className="text-mono-caps text-[10px] text-muted-foreground">
            Print size
          </span>
          <span className="text-2xl font-display font-bold text-accent">
            {widthCm} cm
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          The design is {widthCm} cm wide — skin tone and scale match your camera.
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <label className="block">
          <span className="text-mono-caps text-[10px] text-muted-foreground">
            Project name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm outline-none focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="text-mono-caps text-[10px] text-muted-foreground">
            Body part (e.g. forearm)
          </span>
          <input
            value={bodyPart}
            onChange={(e) => setBodyPart(e.target.value)}
            placeholder="Forearm, collarbone, calf …"
            className="mt-1 w-full h-11 rounded-xl bg-slate border border-white/10 px-3 text-sm placeholder:text-muted-foreground outline-none focus:border-accent"
          />
        </label>
      </div>

      {status && (
        <p
          className={`mt-3 text-[11px] ${
            status.ok ? "text-accent" : "text-destructive"
          }`}
        >
          {status.text}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={save}
          disabled={busy !== null}
          className="py-4 rounded-xl border border-white/15 bg-slate flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-60"
        >
          {busy === "save" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save project
        </button>
        <button
          onClick={share}
          disabled={busy !== null}
          className="py-4 rounded-xl bg-accent text-ink flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-60"
        >
          {busy === "share" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Share2 className="size-4" />
          )}
          Share preview
        </button>
      </div>
      <button
        type="button"
        onClick={() => void sendToArtist()}
        disabled={busy !== null}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-accent/50 bg-accent/10 py-4 text-sm font-bold text-accent disabled:opacity-60"
      >
        <Send className="size-4" /> Send to tattoo artist
      </button>

      {/* Vote & prank — the fun sharing features, impossible to miss */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => setHubCfg({ tab: "vote", reaction: false })}
          className="rounded-2xl bg-accent text-ink p-3.5 text-left"
        >
          <ThumbsUp className="size-5" />
          <div className="mt-2 text-sm font-bold leading-tight">
            Let friends vote
          </div>
          <div className="mt-0.5 text-[11px] opacity-80 leading-snug">
            Send a link — they vote yes or no on your tattoo
          </div>
        </button>
        <button
          onClick={() => setHubCfg({ tab: "reaction", reaction: true })}
          className="rounded-2xl border border-accent/50 bg-accent/10 text-accent p-3.5 text-left"
        >
          <Video className="size-5" />
          <div className="mt-2 text-sm font-bold leading-tight">
            Prank reaction cam
          </div>
          <div className="mt-0.5 text-[11px] opacity-80 leading-snug">
            They vote — you get a video of their face back
          </div>
        </button>
      </div>

      <button
        onClick={() => setHubCfg({ tab: "image", reaction: false })}
        className="mt-3 w-full h-11 rounded-xl border border-white/10 bg-slate/50 text-xs font-bold flex items-center justify-center gap-2"
      >
        <Sparkles className="size-4 text-accent" />
        More ways to share
      </button>

      {hubCfg && (
        <ShareHub
          image={image}
          defaultCaption="Should I get this tattoo?"
          canCreateLink={!!user}
          onRequireAuth={onRequireAuth}
          initialTab={hubCfg.tab}
          initialReactionCam={hubCfg.reaction}
          onClose={() => setHubCfg(null)}
        />
      )}

      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={saveToRoll}
          disabled={busy !== null}
          className="py-3 rounded-xl border border-white/10 bg-slate/50 flex items-center justify-center gap-2 text-xs font-bold disabled:opacity-60"
        >
          {busy === "roll" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ImageDown className="size-3.5" />
          )}
          Save to camera roll
        </button>
        <Link
          to="/bookings"
          className="py-3 rounded-xl border border-white/10 bg-slate/50 flex items-center justify-center gap-2 text-xs font-bold"
        >
          <Send className="size-3.5" /> Send to artist
        </Link>
      </div>

      <SocialShareRow
        motifId={tattooId}
        widthCm={widthCm}
        rotation={rotation}
        label="Share the design with friends"
        text={`Check out "${tattooName}" in InkSimulator AR`}
        media={imgBlob}
        mediaName={`inksimulator-${Date.now()}.png`}
      />

      <a
        href={image}
        download={`inksimulator-${Date.now()}.png`}
        className="mt-3 py-3 rounded-xl border border-white/10 bg-slate/50 flex items-center justify-center gap-2 text-xs font-bold"
      >
        <Download className="size-3.5" /> Download original
      </a>
    </div>
  );
}

/** Share the AR link to a motif on messaging/social apps. */
function SocialShareRow({
  motifId,
  label,
  text,
  widthCm,
  rotation,
  media,
  mediaName,
}: {
  motifId: string;
  label: string;
  text: string;
  widthCm?: string;
  rotation?: number;
  /** Photo or clip to save before opening Instagram/TikTok. */
  media?: Blob | null;
  mediaName?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    setUrl(arMotifShareUrl(motifId, { widthCm, rotation }));
  }, [motifId, widthCm, rotation]);
  const targets = url ? socialLinkTargets(url, text) : [];

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-slate/40 p-3">
      <div className="flex items-center justify-between">
        <span className="text-mono-caps text-[10px] text-muted-foreground">
          {label}
        </span>
        <button
          onClick={async () => {
            const ok = await copyToClipboard(url);
            trackMotifShare(motifId, "copy");
            setCopied(ok);
            setTimeout(() => setCopied(false), 1800);
          }}
          className="text-[10px] font-bold uppercase text-accent flex items-center gap-1"
        >
          <Link2 className="size-3" /> {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={async () => {
            trackMotifShare(motifId, "native");
            // Send the actual photo/clip when we have one — a picture of the
            // motif says more than a bare link. Link share stays as fallback.
            if (media) {
              await shareFile(media, mediaName ?? `inksimulator-${Date.now()}.png`, {
                text: `${text} — try it yourself: ${url}`,
              });
            } else {
              void shareLink(url, text);
            }
          }}
          className="px-3 py-2 rounded-lg bg-accent text-ink text-[11px] font-bold flex items-center gap-1.5"
        >
          <Share2 className="size-3" /> {media ? "Share image" : "Share"}
        </button>
        {targets
          .filter((t) => t.href)
          .map((t) => (
            <a
              key={t.id}
              href={t.href!}
              onClick={() => trackMotifShare(motifId, t.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg border border-white/10 bg-slate text-[11px] font-bold"
            >
              {t.label}
            </a>
          ))}
        {targets
          .filter((t) => !t.href)
          .map((t) => (
            <button
              key={t.id}
              onClick={async () => {
                trackMotifShare(motifId, t.id);
                const name = mediaName ?? `inksimulator-${Date.now()}.png`;
                // Mobile: the OS share sheet lists Instagram/TikTok as direct
                // targets — that is the only way to hand them media from web.
                if (media) {
                  const file = new File([media], name, { type: media.type });
                  if (canShareFiles(file)) {
                    const outcome = await shareFile(media, name, {
                      text: `${text} — try it yourself: ${url}`,
                    });
                    if (outcome !== "downloaded") return;
                  }
                  await saveToCameraRoll(media, name);
                } else {
                  await copyToClipboard(url);
                }
                window.open(
                  t.id === "tiktok"
                    ? "https://www.tiktok.com/upload"
                    : "https://www.instagram.com/",
                  "_blank",
                  "noopener",
                );
              }}
              className="px-3 py-2 rounded-lg border border-white/10 bg-slate text-[11px] font-bold flex items-center gap-1.5"
            >
              <SocialIcon
                platform={t.id === "tiktok" ? "tiktok" : "instagram"}
                className="size-3.5"
              />
              {t.label}
            </button>
          ))}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        Instagram and TikTok: save the file first, then open the app and post
        it to your story.
      </p>
    </div>
  );
}

/** Preview, save and share a recorded AR video. */
function VideoSheet({
  video,
  tattooId,
  tattooName,
  widthCm,
  rotation,
  onClose,
}: {
  video: { url: string; blob: Blob; ext: string };
  tattooId: string;
  tattooName: string;
  widthCm?: string;
  rotation?: number;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState<null | "share" | "roll">(null);
  const [status, setStatus] = useState<null | { ok: boolean; text: string }>(
    null,
  );
  const filename = `inksimulator-${Date.now()}.${video.ext}`;
  const [hubOpen, setHubOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const run = async (kind: "share" | "roll") => {
    setBusy(kind);
    try {
      const result =
        kind === "share"
          ? await shareFile(video.blob, filename, {
              title: "My InkSimulator video",
              text: "Check out my tattoo in AR — made with InkSimulator.",
            })
          : await saveToCameraRoll(video.blob, filename);
      if (result !== "cancelled") {
        setStatus({
          ok: true,
          text:
            result === "shared"
              ? "Shared! Choose \u201cSave Video\u201d for the camera roll"
              : "Saved to device",
        });
      }
    } catch (e) {
      setStatus({
        ok: false,
        text: e instanceof Error ? e.message : "Could not share the video",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-lg flex flex-col p-6 pt-[calc(1.5rem+env(safe-area-inset-top))] overflow-y-auto">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-mono-caps text-accent text-[10px]">AR video</div>
          <h2 className="font-display font-bold text-lg">{tattooName}</h2>
        </div>
        <button
          onClick={onClose}
          className="size-11 rounded-full glass grid place-items-center"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      <video
        src={video.url}
        controls
        autoPlay
        muted
        playsInline
        loop
        className="w-full max-h-[52dvh] rounded-2xl border border-white/10 bg-slate object-contain"
      />

      {status && (
        <p
          className={`mt-3 text-[11px] ${
            status.ok ? "text-accent" : "text-destructive"
          }`}
        >
          {status.text}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          onClick={() => void run("roll")}
          disabled={busy !== null}
          className="py-4 rounded-xl border border-white/15 bg-slate flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-60"
        >
          {busy === "roll" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImageDown className="size-4" />
          )}
          Camera roll
        </button>
        <button
          onClick={() => void run("share")}
          disabled={busy !== null}
          className="py-4 rounded-xl bg-accent text-ink flex items-center justify-center gap-2 text-sm font-bold disabled:opacity-60"
        >
          {busy === "share" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Share2 className="size-4" />
          )}
          Share video
        </button>
      </div>

      <a
        href={video.url}
        download={filename}
        className="mt-3 py-3 rounded-xl border border-white/10 bg-slate/50 flex items-center justify-center gap-2 text-xs font-bold"
      >
        <Download className="size-3.5" /> Download
      </a>

      <button
        onClick={() => setHubOpen(true)}
        className="mt-3 h-12 rounded-xl border border-accent/40 bg-accent/10 text-accent text-sm font-bold flex items-center justify-center gap-2"
      >
        <Sparkles className="size-4" />
        More ways to share · vote & reaction cam
      </button>

      {hubOpen && (
        <ShareHub
          image=""
          video={video}
          defaultCaption="Should I get this tattoo?"
          canCreateLink={!!user}
          onRequireAuth={() => navigate({ to: "/auth" })}
          onClose={() => setHubOpen(false)}
        />
      )}

      <SocialShareRow
        motifId={tattooId}
        widthCm={widthCm}
        rotation={rotation}
        media={video.blob}
        mediaName={filename}
        label="Share the design with friends"
        text={`Check out "${tattooName}" in InkSimulator AR`}
      />
    </div>
  );
}



// Route-side helper: read ?motif=id from search
export function useMotifSearch() {
  const search = useSearch({ strict: false }) as { motif?: string };
  return search.motif;
}

/** Route-side helper: read a shared AR link's size/rotation (?w=&r=). */
export function useArShareSearch() {
  const search = useSearch({ strict: false }) as { w?: string; r?: string };
  const w = Number(search.w);
  const r = Number(search.r);
  return {
    widthCm: Number.isFinite(w) && w > 0 ? w : undefined,
    rotation: Number.isFinite(r) ? r : undefined,
  };
}
