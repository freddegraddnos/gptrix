import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Circle,
  Loader2,
  RotateCcw,
  Share2,
  Download,
  SwitchCamera,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BODY_PARTS, SELF_FILM_TIP, type BodyPart } from "@/lib/bodyParts";
import { getScanPlan, type ScanPlan } from "@/lib/scanGuide";
import { detectCard, type CardDetection } from "@/lib/cardDetect";
import {
  downloadBlob,
  drawWatermark,
  extFor,
  loadWatermark,
  pickMimeType,
  recorderSupported,
  shareSupported,
} from "@/lib/videoRecording";
import { calibrateFromRecording, type CalibrationResult } from "@/lib/cardCalibration";
import { createScan, pollScan, startScan } from "@/lib/scan3d.functions";
import { createScanShare } from "@/lib/scanShare.functions";
import { updateScanScale } from "@/lib/scans.functions";
import {
  formatCalibratedAt,
  loadCalibration,
  saveCalibration,
  type StoredCalibration,
} from "@/lib/scanCalibrationStore";

import Model3DViewer from "@/components/Model3DViewer";
import { supabase } from "@/integrations/supabase/client";


type Phase = "select" | "intro" | "live" | "review";
type ScanStage = "calibration" | "handoff" | "main";
type ScanState = "idle" | "calibrating" | "uploading" | "processing" | "ready" | "failed";

const CHECKLIST = [
  "Card detected clearly",
  "Even lighting",
  "No shaky movement",
  "The whole body part was covered",
];

export default function ScanMyBody() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const rafRef = useRef<number | null>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const okSinceRef = useRef<number | null>(null);
  const stageRef = useRef<ScanStage>("calibration");
  const startedAtRef = useRef<number>(0);
  const detectionRef = useRef<CardDetection | null>(null);
  const lastDetectRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("select");
  const [part, setPart] = useState<BodyPart | null>(null);
  const [plan, setPlan] = useState<ScanPlan | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stage, setStage] = useState<ScanStage>("calibration");
  const [detection, setDetection] = useState<CardDetection | null>(null);
  const [cardShot, setCardShot] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [notice, setNotice] = useState<string | null>(null);
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [scanError, setScanError] = useState<string | null>(null);
  const [calibration, setCalibration] = useState<CalibrationResult | null>(null);
  const [modelUrl, setModelUrl] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [sketchFile, setSketchFile] = useState<File | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const sketchInputRef = useRef<HTMLInputElement>(null);
  /** 0-based position in the guide → scan → calibrate walkthrough. */
  const [introStep, setIntroStep] = useState(0);
  /** Set when the camera preview stays black or the stream disappears. */
  const [streamError, setStreamError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [lastCalibration, setLastCalibration] = useState<StoredCalibration | null>(null);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const uid = data.user?.id ?? null;
      setProfileId(uid);
      setLastCalibration(loadCalibration(uid));
    });
    return () => {
      active = false;
    };
  }, []);


  const stopStream = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => () => stopStream(), [stopStream]);

  /* ---------------- camera ---------------- */
  const startCamera = useCallback(async () => {
    setError(null);
    setStreamError(null);

    setStarting(true);
    try {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("no-api");
      }
      if (
        typeof window !== "undefined" &&
        window.location.protocol !== "https:" &&
        !["localhost", "127.0.0.1"].includes(window.location.hostname)
      ) {
        throw new Error("insecure");
      }
      stopStream();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      logoRef.current = await loadWatermark();
      // The <video> element only exists in the live view, so attach the stream
      // in an effect once that view has mounted (otherwise the canvas stays black).
      setPhase("live");

    } catch (e) {
      const err = e as Error & { name?: string };
      if (err.message === "insecure") {
        setError(
          "Camera requires HTTPS. Open the page via a secure https address (especially on iOS Safari).",
        );
      } else if (err.name === "NotAllowedError") {
        setError(
          "Camera permission denied. Allow the camera in your browser settings and tap Start again.",
        );
      } else if (err.name === "NotFoundError") {
        setError("No camera found on this device.");
      } else {
        setError("Could not start the camera. Try again.");
      }
    } finally {
      setStarting(false);
    }
  }, [facing, stopStream]);

  /* Restart the stream when the user flips the camera while live. */
  const facingRef = useRef(facing);
  useEffect(() => {
    if (facingRef.current === facing) return;
    facingRef.current = facing;
    if (phase === "live") void startCamera();
  }, [facing, phase, startCamera]);

  /* Attach the stream once the live view (and its <video>) is mounted. */
  useEffect(() => {
    if (phase !== "live") return;
    const v = videoRef.current;
    const stream = streamRef.current;
    if (!v || !stream) {
      setStreamError("The camera stream was lost. Restart the camera to continue.");
      return;
    }
    v.srcObject = stream;
    v.setAttribute("playsinline", "true");
    v.muted = true;
    let cancelled = false;
    v.play().catch(() => {
      if (!cancelled) {
        setStreamError("Could not start the camera preview. Restart the camera and try again.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [phase]);

  /**
   * Watchdog for the classic "black camera": the stream is live but no frames
   * arrive, or every frame is pitch black. Surfaces a recoverable error
   * instead of leaving the user staring at a black screen.
   */
  useEffect(() => {
    if (phase !== "live" || streamError) return;
    let blackFrames = 0;
    const probe = document.createElement("canvas");
    probe.width = 32;
    probe.height = 32;
    const started = performance.now();

    const id = window.setInterval(() => {
      const v = videoRef.current;
      const track = streamRef.current?.getVideoTracks()[0];
      if (!v || !streamRef.current || !track || track.readyState === "ended") {
        setStreamError("The camera stream stopped. Restart the camera to continue the guide.");
        return;
      }
      if (!v.videoWidth) {
        if (performance.now() - started > 6000) {
          setStreamError("No image is coming from the camera. Restart the camera to continue.");
        }
        return;
      }
      const ctx = probe.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, probe.width, probe.height);
      const { data } = ctx.getImageData(0, 0, probe.width, probe.height);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
      const avg = sum / (data.length / 4) / 3;
      blackFrames = avg < 6 ? blackFrames + 1 : 0;
      if (blackFrames >= 4) {
        setStreamError(
          "The camera preview is completely black. Check that no other app uses the camera, then restart it.",
        );
      }
    }, 700);

    return () => window.clearInterval(id);
  }, [phase, streamError]);

  useEffect(() => {
    if (!streamError) return;
    toast.error("Camera problem", { description: streamError });
  }, [streamError]);

  /** Recovers from a black/missing stream without losing the guide progress. */
  const retryCamera = useCallback(async () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
    stopStream();
    setStreamError(null);
    await startCamera();
  }, [startCamera, stopStream]);



  /* ---------------- render loop ---------------- */
  useEffect(() => {
    if (phase !== "live") return;
    if (!workRef.current) workRef.current = document.createElement("canvas");

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || !v.videoWidth) return;
      if (c.width !== v.videoWidth) {
        c.width = v.videoWidth;
        c.height = v.videoHeight;
      }
      const ctx = c.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);

      const now = performance.now();
      if (stageRef.current === "calibration" && now - lastDetectRef.current > 120) {
        lastDetectRef.current = now;
        const det = detectCard(v, workRef.current!);
        detectionRef.current = det;
        setDetection(det);
        if (det.status === "ok") {
          okSinceRef.current = okSinceRef.current ?? now;
          if (now - (okSinceRef.current ?? now) >= 1000 && recorderRef.current) {
            stageRef.current = "handoff";
            setStage("handoff");
            setTimeout(() => {
              if (stageRef.current === "handoff") {
                stageRef.current = "main";
                setStage("main");
              }
            }, 3000);
          }
        } else {
          okSinceRef.current = null;
        }
      }

      // draw detection frame
      const det = detectionRef.current;
      if (stageRef.current === "calibration" && det?.box) {
        const color =
          det.status === "ok" ? "#22c55e" : det.status === "glare" ? "#facc15" : "#ef4444";
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(3, c.width * 0.006);
        ctx.strokeRect(det.box.x * c.width, det.box.y * c.height, det.box.w * c.width, det.box.h * c.height);
        ctx.restore();
      }

      drawWatermark(ctx, c.width, c.height, logoRef.current);

      if (recording) {
        setElapsed((performance.now() - startedAtRef.current) / 1000);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, recording]);

  /* ---------------- recording ---------------- */
  const captureCardStill = useCallback(() => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return null;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", 0.92);
    setCardShot(url);
    return url;
  }, []);

  const stopRecording = useCallback(() => {
    recorderRef.current?.state === "recording" && recorderRef.current.stop();
  }, []);

  const startRecording = useCallback(() => {
    if (!plan) return;
    if (!recorderSupported()) {
      setNotice("Your browser does not support video recording of canvas.");
      return;
    }
    const mime = pickMimeType();
    if (!mime) {
      setNotice("Your browser lacks support for the video formats we can record in.");
      return;
    }
    const c = canvasRef.current;
    if (!c) return;

    // Still image of the card right before recording starts
    captureCardStill();

    const stream = c.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime });
    chunksRef.current = [];
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const b = new Blob(chunksRef.current, { type: mime });
      setBlob(b);
      setVideoUrl((old) => {
        if (old) URL.revokeObjectURL(old);
        return URL.createObjectURL(b);
      });
      setRecording(false);
      setPhase("review");
    };
    recorderRef.current = rec;
    okSinceRef.current = null;
    stageRef.current = "calibration";
    setStage("calibration");
    setChecked(CHECKLIST.map(() => false));
    startedAtRef.current = performance.now();
    setElapsed(0);
    rec.start(200);
    setRecording(true);
  }, [captureCardStill, plan]);

  // max length
  useEffect(() => {
    if (!recording || !plan) return;
    if (elapsed >= plan.maxSeconds) stopRecording();
  }, [elapsed, recording, plan, stopRecording]);

  const restart = useCallback(() => {
    setBlob(null);
    setVideoUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setPhase("live");
  }, []);

  const allChecked = checked.every(Boolean);

  const share = useCallback(async () => {
    if (!blob) return;
    const file = new File([blob], `inksimulator-scan.${extFor(blob.type)}`, { type: blob.type });
    if (shareSupported(file)) {
      try {
        await navigator.share({ files: [file] });
      } catch {
        /* sharing cancelled */
      }
    } else {
      setNotice("Sharing is not supported here – the file will be downloaded instead.");
      downloadBlob(blob, file.name);
    }
  }, [blob]);

  /* ---------------- 3D processing ---------------- */
  const build3d = useCallback(async () => {
    if (!blob) return;
    setScanError(null);
    setScanState("calibrating");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) {
        setScanState("idle");
        setScanError("Log in to create a 3D model of the scan.");
        return;
      }

      const cal = await calibrateFromRecording(blob, cardShot, plan?.calibrationSeconds ?? 5);
      setCalibration(cal);
      if (cal.scaleFactor && cal.confidence >= 0.5) {
        const stored = saveCalibration(
          { scaleFactor: cal.scaleFactor, bodyPart: part?.id ?? null, source: "card" },
          profileId,
        );
        if (stored) setLastCalibration(stored);
      }


      setScanState("uploading");
      const stamp = Date.now();
      const videoPath = `${uid}/${stamp}/scan.${extFor(blob.type)}`;
      const up = await supabase.storage.from("scans").upload(videoPath, blob, {
        contentType: blob.type,
        upsert: true,
      });
      if (up.error) throw new Error(up.error.message);

      let stillPath: string | null = null;
      if (cardShot) {
        const stillBlob = await (await fetch(cardShot)).blob();
        stillPath = `${uid}/${stamp}/card.jpg`;
        await supabase.storage
          .from("scans")
          .upload(stillPath, stillBlob, { contentType: "image/jpeg", upsert: true });
      }

      const created = await createScan({
        data: {
          bodyPart: part?.id ?? null,
          videoPath,
          stillPath,
          scaleFactor: cal.scaleFactor,
          scaleConfidence: cal.confidence,
        },
      });
      setScanId(created.id);


      setScanState("processing");
      let res = await startScan({ data: { scanId: created.id } });
      const deadline = Date.now() + 15 * 60 * 1000;
      while (res.status === "processing" && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 8000));
        res = await pollScan({ data: { scanId: created.id } });
      }
      if (res.status === "ready" && res.modelUrl) {
        setModelUrl(res.modelUrl);
        setScanState("ready");
      } else {
        setScanState("failed");
        setScanError(
          res.error ??
            "The 3D model was not ready in time. Try scanning again with steadier movement.",
        );
      }
    } catch (e) {
      console.error(e);
      setScanState("failed");
      setScanError("Something went wrong during 3D processing. Try scanning again.");
    }
  }, [blob, cardShot, part, plan, profileId]);


  /* ---------------- Manual size calibration on the finished model ---------------- */
  const saveManualCalibration = useCallback(
    async (scaleFactor: number) => {
      setCalibration((prev) => ({
        scaleFactor,
        confidence: 1,
        mmPerPixel: prev?.mmPerPixel ?? null,
        cardWidthPx: prev?.cardWidthPx ?? null,
        source: prev?.source ?? null,
      }));
      const stored = saveCalibration(
        { scaleFactor, bodyPart: part?.id ?? null, source: "manual" },
        profileId,
      );
      if (stored) setLastCalibration(stored);
      if (scanId) {
        try {
          await updateScanScale({ data: { scanId, scaleFactor } });
        } catch (e) {
          console.error(e);
          setScanError("The calibration was applied here, but could not be saved to your scan.");
        }
      }
      toast.success("Calibration saved", {
        description: "We reuse this size the next time you scan.",
      });
    },
    [part, profileId, scanId],
  );

  /** Applies the remembered size again without re-measuring the model. */
  const reuseLastCalibration = useCallback(() => {
    if (!lastCalibration) return;
    void saveManualCalibration(lastCalibration.scaleFactor);
  }, [lastCalibration, saveManualCalibration]);


  /* ---------------- Share with tattoo artist ---------------- */

  const createShareLink = useCallback(async () => {
    if (!scanId) return;
    setSharing(true);
    setScanError(null);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("not_authenticated");

      let sketchPath: string | null = null;
      if (sketchFile) {
        const ext = sketchFile.name.split(".").pop()?.toLowerCase() ?? "png";
        sketchPath = `${uid}/${scanId}/sketch.${ext}`;
        const up = await supabase.storage.from("scans").upload(sketchPath, sketchFile, {
          contentType: sketchFile.type || "image/png",
          upsert: true,
        });
        if (up.error) throw new Error(up.error.message);
      }

      const { token } = await createScanShare({
        data: { scanId, days: 30, sketchPath, sketchBucket: sketchPath ? "scans" : null },
      });
      const url = `${window.location.origin}/s/${token}`;
      setShareUrl(url);
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "Min 3D-scan i InkSimulator", url });
        } catch {
          /* user cancelled */
        }
      } else {
        await navigator.clipboard?.writeText(url).catch(() => undefined);
      }
    } catch (e) {
      console.error(e);
      setScanError("Could not create the share link. Log in and try again.");
    } finally {
      setSharing(false);
    }
  }, [scanId, sketchFile]);


  /* ---------------- views ---------------- */
  if (phase === "select") {
    return (
      <div className="min-h-[100dvh] bg-background px-5 py-8">
        <Link to="/ar"
            search={{} as never} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <h1 className="text-2xl font-semibold text-foreground">Scan My Body</h1>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          One continuous video scan: first calibration against a bank card, then guided
          scanning of the body part – all in the same recording.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {BODY_PARTS.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setPart(p);
                setPlan(getScanPlan(p));
                setIntroStep(0);
                setPhase("intro");

              }}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary"
            >
              <span className="block font-medium text-foreground">{p.label}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{p.hint}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (phase === "intro" && part && plan) {
    return (
      <div className="min-h-[100dvh] bg-background px-5 py-8">
        <button
          onClick={() => setPhase("select")}
          className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Change body part
        </button>
        <h1 className="text-2xl font-semibold text-foreground">{part.label} – quick guide</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Three steps: guide, scan, then calibrate to exact size.
        </p>

        {/* progress indicator */}
        <div className="mt-6 flex items-center gap-2" aria-label={`Step ${introStep + 1} of 3`}>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i <= introStep ? "bg-primary" : "bg-border"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs font-medium text-muted-foreground">Step {introStep + 1} of 3</p>

        <div className="mt-4 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {introStep === 0 && (
            <>
              <span className="block font-medium text-foreground">1 – Card calibration (3–5 s)</span>
              <p className="mt-2">
                Hold or tape a bank card/bus card flat against the skin near the body part. Film
                it for 3–5 seconds, then remove the card{" "}
                <strong>without stopping the recording</strong> and continue directly to the next
                step.
              </p>
            </>
          )}
          {introStep === 1 && (
            <>
              <span className="block font-medium text-foreground">2 – Scan: {plan.label}</span>
              <p className="mt-2">{plan.instruction}</p>
              <p className="mt-2 text-xs">Total max length: about {plan.maxSeconds} seconds.</p>
            </>
          )}
          {introStep === 2 && (
            <>
              <span className="block font-medium text-foreground">3 – Calibrate the exact size</span>
              <p className="mt-2">
                When the 3D model is ready you measure a known object in it (for example the long
                edge of a bank card, 8.56 cm) and confirm — every measurement after that is in real
                centimeters.
              </p>
              {lastCalibration && (
                <p className="mt-3 rounded-lg border border-primary/40 bg-primary/10 p-3 text-xs text-foreground">
                  Last calibrated {formatCalibratedAt(lastCalibration.savedAt)} – we reuse that
                  size automatically.
                </p>
              )}
            </>
          )}
        </div>

        {part.hardToSelfFilm && introStep === 1 && (
          <p className="mt-4 rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm text-foreground">
            {SELF_FILM_TIP}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-foreground">
            {error}
          </p>
        )}

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1"
            onClick={() => (introStep === 0 ? setPhase("select") : setIntroStep((s) => s - 1))}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>
          {introStep < 2 ? (
            <Button size="lg" className="flex-1" onClick={() => setIntroStep((s) => s + 1)}>
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" className="flex-1" onClick={startCamera} disabled={starting}>
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="mr-2 h-4 w-4" />
              )}
              Start camera
            </Button>
          )}
        </div>

      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="min-h-[100dvh] bg-background px-5 py-8">
        <h1 className="text-xl font-semibold text-foreground">Review the scan</h1>
        {videoUrl && (
          <video
            src={videoUrl}
            controls
            playsInline
            className="mt-4 w-full rounded-xl border border-border bg-black"
          />
        )}
        {cardShot && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">Reference image of the card (without motion blur)</p>
            <img src={cardShot} alt="Reference image of the bank card against the skin" className="mt-2 w-40 rounded-lg border border-border" />
          </div>
        )}

        <div className="mt-6 space-y-2">
          {CHECKLIST.map((item, i) => (
            <button
              key={item}
              onClick={() => setChecked((c) => c.map((v, j) => (i === j ? !v : v)))}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-sm text-foreground"
            >
              {checked[i] ? (
                <CheckCircle2 className="h-5 w-5 text-primary" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              {item}
            </button>
          ))}
        </div>

        {notice && <p className="mt-4 text-sm text-muted-foreground">{notice}</p>}

        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <p className="font-medium text-foreground">3D-modell</p>
          <p className="mt-1 text-xs text-muted-foreground">
            We read the four corners of the card during the calibration phase and the still image, choose the
            sharpest frame, and scale the entire model to real-world centimeters.
          </p>

          {calibration && (
            <p className="mt-3 text-xs text-muted-foreground">
              Calibration: {calibration.scaleFactor ? "successful" : "failed"} · confidence{" "}
              {(calibration.confidence * 100).toFixed(0)} % · source{" "}
              {calibration.source === "still" ? "still image" : "video"}
              {calibration.confidence < 0.5 && " – low confidence, consider scanning again."}
            </p>
          )}

          {lastCalibration && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Last calibrated:</span>{" "}
                {formatCalibratedAt(lastCalibration.savedAt)} ·{" "}
                {lastCalibration.source === "manual" ? "manual measurement" : "bank card"}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={reuseLastCalibration}
                disabled={calibration?.scaleFactor === lastCalibration.scaleFactor}
              >
                Reuse this size
              </Button>
            </div>
          )}


          {scanError && <p className="mt-3 text-sm text-destructive">{scanError}</p>}

          {(scanState === "processing" || scanState === "uploading" || scanState === "ready") && (
            <Model3DViewer
              className="mt-4"
              modelUrl={scanState === "ready" ? modelUrl : null}
              scaleFactor={calibration?.scaleFactor ?? null}
              calibrated={Boolean(calibration?.scaleFactor) && (calibration?.confidence ?? 0) >= 0.5}
              processing={scanState !== "ready"}
              processingLabel="This can take a minute… we are building the model and scaling it against the bank card. You can leave the page open."
              onShare={scanState === "ready" ? createShareLink : undefined}
              sharing={sharing}
              onCalibrate={scanState === "ready" ? saveManualCalibration : undefined}

            />
          )}

          {scanState === "ready" && (
            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-border bg-background/60 p-3">
                <p className="text-sm font-medium text-foreground">Attach a tattoo sketch</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The sketch is shown next to the 3D model on the shared page, so the tattoo artist sees both at once.
                </p>
                <input
                  ref={sketchInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setSketchFile(e.target.files?.[0] ?? null)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => sketchInputRef.current?.click()}
                >
                  {sketchFile ? `Selected: ${sketchFile.name}` : "Choose sketch"}
                </Button>
              </div>

              {shareUrl && (
                <div className="rounded-xl border border-primary/40 bg-primary/5 p-3">
                  <p className="text-sm text-foreground">The link is valid for 30 days:</p>
                  <p className="mt-1 break-all text-xs text-primary">{shareUrl}</p>
                </div>
              )}

              <a
                href={modelUrl ?? "#"}
                className="inline-flex items-center gap-2 text-sm font-medium text-primary"
                download
              >
                <Download className="h-4 w-4" /> Download the 3D model (.glb)
              </a>
            </div>
          )}

          {scanState !== "ready" && (
            <Button
              className="mt-4 w-full"
              disabled={!allChecked || !blob || ["calibrating", "uploading", "processing"].includes(scanState)}
              onClick={build3d}
            >
              {["calibrating", "uploading", "processing"].includes(scanState) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {scanState === "calibrating"
                ? "Analyzing calibration…"
                : scanState === "uploading"
                  ? "Uploading the scan…"
                  : scanState === "processing"
                    ? "Building 3D model…"
                    : scanState === "failed"
                      ? "Try again"
                      : "Create 3D model"}
            </Button>
          )}
          {scanState === "failed" && (
            <Button variant="outline" className="mt-2 w-full" onClick={restart}>
              <RotateCcw className="mr-2 h-4 w-4" /> Scan again
            </Button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={restart}>
            <RotateCcw className="mr-2 h-4 w-4" /> Record again
          </Button>
          <Button
            disabled={!allChecked || !blob}
            onClick={() => blob && downloadBlob(blob, `inksimulator-scan.${extFor(blob.type)}`)}
          >
            <Download className="mr-2 h-4 w-4" /> Save
          </Button>
          <Button variant="secondary" className="col-span-2" disabled={!allChecked} onClick={share}>
            <Share2 className="mr-2 h-4 w-4" /> Share the scan
          </Button>
        </div>
      </div>
    );
  }

  /* live view */
  const remaining = plan ? Math.max(0, plan.maxSeconds - elapsed) : 0;
  const mainProgress =
    plan && recording
      ? Math.min(1, Math.max(0, (elapsed - plan.calibrationSeconds) / (plan.maxSeconds - plan.calibrationSeconds)))
      : 0;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="h-full w-full object-cover" />

      {streamError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <p className="text-base font-semibold text-white">The camera image is missing</p>
            <p className="mt-2 max-w-xs text-sm text-white/80">{streamError}</p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button size="lg" onClick={retryCamera} disabled={starting}>
              {starting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Restart camera
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => {
                stopStream();
                setStreamError(null);
                setPhase("intro");
              }}
            >
              Back to the guide
            </Button>
          </div>
        </div>
      )}


      {/* top bar */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
        <button
          onClick={() => {
            stopRecording();
            stopStream();
            setPhase("intro");
          }}
          className="rounded-full bg-black/50 p-2 text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        {recording && (
          <span className="flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> REC {remaining.toFixed(0)}s
          </span>
        )}
        <button
          onClick={() => {
            setFacing((f) => (f === "environment" ? "user" : "environment"));
            
          }}
          className="rounded-full bg-black/50 p-2 text-white"
          aria-label="Flip camera"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      {/* guide overlay */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        {recording && stage === "calibration" && (
          <div className="rounded-xl bg-black/60 px-4 py-2 text-center text-sm text-white">
            Phase 1 – {detection?.message ?? "Point the camera at the card"}
          </div>
        )}
        {recording && stage === "handoff" && (
          <div className="rounded-2xl bg-primary px-6 py-4 text-center text-lg font-semibold text-primary-foreground">
            Remove the card now and keep filming
          </div>
        )}
        {recording && stage === "main" && plan && (
          <div className="flex flex-col items-center gap-4">
            {plan.pattern === "orbit" ? (
              <div className="h-44 w-44 animate-spin rounded-full border-4 border-dashed border-primary/80 [animation-duration:6s]" />
            ) : (
              <div className="flex w-56 flex-col gap-3">
                {Array.from({ length: plan.rows }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-2 rounded-full ${
                      mainProgress > (i + 1) / plan.rows ? "bg-primary" : "bg-white/30"
                    }`}
                  />
                ))}
              </div>
            )}
            <p className="max-w-xs rounded-xl bg-black/60 px-4 py-2 text-center text-sm text-white">
              Phase 2 – {plan.instruction}
            </p>
          </div>
        )}
      </div>

      {/* bottom */}
      <div className="absolute inset-x-0 bottom-0 space-y-3 p-6 pb-10">
        {recording && plan && (
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full bg-primary transition-[width]"
              style={{ width: `${Math.min(100, (elapsed / plan.maxSeconds) * 100)}%` }}
            />
          </div>
        )}
        {notice && <p className="text-center text-xs text-white/80">{notice}</p>}
        <div className="flex justify-center">
          <button
            onClick={recording ? stopRecording : startRecording}
            className={`flex h-20 w-20 items-center justify-center rounded-full border-4 border-white ${
              recording ? "bg-red-600" : "bg-white/20"
            }`}
            aria-label={recording ? "Stop recording" : "Start recording"}
          >
            <Video className="h-8 w-8 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
