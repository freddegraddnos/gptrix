import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, RotateCcw, ShieldCheck, Video } from "lucide-react";
import { submitReaction } from "@/lib/reactions.functions";
import { getDeviceId } from "@/lib/voteShare";
import { loadWatermark, drawWatermark } from "@/lib/videoRecording";

const MAX_MS = 8000;

function pickMime(): string | undefined {
  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((m) => MediaRecorder.isTypeSupported?.(m));
}

/**
 * Films the recipient's face while they react to a shared tattoo, then sends
 * the clip back to whoever shared the link.
 */
export function ReactionRecorder({
  slug,
  choice,
  reactorName,
}: {
  slug: string;
  choice?: string | null;
  reactorName?: string | null;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [phase, setPhase] = useState<
    "consent" | "idle" | "ready" | "recording" | "review" | "sending" | "sent"
  >("consent");
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declined, setDeclined] = useState(false);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);
  const [left, setLeft] = useState(MAX_MS / 1000);

  useEffect(
    () => () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (clip) URL.revokeObjectURL(clip.url);
    },
    [clip],
  );

  const enable = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setPhase("ready");
    } catch {
      setError("Camera access was blocked. Allow it in your browser settings.");
    }
  };

  const start = async () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return;
    chunks.current = [];
    const mimeType = pickMime();

    // Composite the webcam onto a canvas so every shared clip is watermarked.
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    const mark = await loadWatermark();
    let raf = 0;
    if (ctx) {
      const draw = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        drawWatermark(ctx, canvas.width, canvas.height, mark);
        raf = requestAnimationFrame(draw);
      };
      draw();
    }
    const recStream = ctx ? canvas.captureStream(30) : stream;
    if (ctx) {
      stream.getAudioTracks().forEach((t) => recStream.addTrack(t));
    }

    const rec = new MediaRecorder(recStream, mimeType ? { mimeType } : undefined);
    recorderRef.current = rec;
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data);
    rec.onstop = () => {
      if (raf) cancelAnimationFrame(raf);
      const blob = new Blob(chunks.current, {
        type: rec.mimeType || "video/webm",
      });
      setClip({ blob, url: URL.createObjectURL(blob) });
      setPhase("review");
    };
    rec.start();
    setPhase("recording");
    setLeft(MAX_MS / 1000);
    const started = Date.now();
    const tick = setInterval(() => {
      const remaining = Math.max(0, MAX_MS - (Date.now() - started));
      setLeft(Math.ceil(remaining / 1000));
      if (remaining <= 0) {
        clearInterval(tick);
        if (rec.state !== "inactive") rec.stop();
      }
    }, 200);
  };

  const stop = () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const send = async () => {
    if (!clip) return;
    setPhase("sending");
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(new Error("Could not read the recording"));
        fr.readAsDataURL(clip.blob);
      });
      await submitReaction({
        data: {
          slug,
          dataUrl,
          choice: (choice as "yes" | "no" | "a" | "b" | null) ?? null,
          reactorName: reactorName || null,
          deviceId: getDeviceId() || null,
        },
      });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setPhase("sent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the reaction.");
      setPhase("review");
    }
  };

  if (declined) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate p-3 text-center text-[11px] text-muted-foreground">
        No reaction recorded — your vote still counts.
        <button
          onClick={() => setDeclined(false)}
          className="ml-1 underline text-accent"
        >
          Changed your mind?
        </button>
      </div>
    );
  }

  if (phase === "sent") {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/10 p-4 text-center">
        <CheckCircle2 className="size-6 mx-auto text-accent" />
        <p className="mt-2 text-sm font-bold">Reaction sent!</p>
        <p className="text-[11px] text-muted-foreground">
          They'll see your face when they open their results.
        </p>
      </div>
    );
  }

  if (phase === "consent") {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate p-4">
        <div className="flex items-center gap-2">
          <Video className="size-4 text-accent" />
          <div className="text-sm font-bold">Film your reaction? (optional)</div>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          The sender asked for a reaction clip. Before anything is recorded,
          here is exactly what happens:
        </p>
        <ul className="mt-2 space-y-1.5 text-[11px] text-muted-foreground">
          <li>• Your camera and microphone turn on only after you agree.</li>
          <li>• You record up to 8 seconds and can watch it before sending.</li>
          <li>• Nothing is uploaded until you press “Send it”.</li>
          <li>• Only the person who shared this link can see the clip; they can delete it.</li>
          <li>• It is never posted publicly and never used for anything else.</li>
        </ul>
        <label className="mt-3 flex items-start gap-2.5 rounded-xl border border-white/10 bg-ink/40 p-3">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            className="mt-0.5 size-4"
          />
          <span className="text-[11px]">
            I agree to record myself and send the clip to the person who shared
            this link.
          </span>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            onClick={() => setDeclined(true)}
            className="h-11 rounded-xl border border-white/10 bg-slate text-xs font-bold"
          >
            No thanks
          </button>
          <button
            onClick={() => setPhase("idle")}
            disabled={!consented}
            className="h-11 rounded-xl bg-accent text-ink text-xs font-bold disabled:opacity-40"
          >
            I agree — continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate p-3">
      <div className="flex items-center gap-2">
        <Video className="size-4 text-accent" />
        <div className="text-sm font-bold">Film your reaction</div>
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Up to 8 seconds of your face — sent straight back to the sender. Nothing
        is uploaded until you press Send.
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
        <ShieldCheck className="size-3 text-accent" /> You agreed to this and can
        stop at any time.
      </p>

      <div className="mt-3 relative rounded-xl overflow-hidden bg-ink aspect-[3/4] max-h-72 mx-auto">
        {phase === "review" && clip ? (
          <video
            src={clip.url}
            controls
            playsInline
            loop
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            muted
            playsInline
            className="w-full h-full object-cover -scale-x-100"
          />
        )}
        {phase === "recording" && (
          <div className="absolute top-2 left-2 px-2 h-6 rounded-full bg-destructive text-[10px] font-bold flex items-center gap-1">
            <span className="size-2 rounded-full bg-white animate-pulse" /> {left}s
          </div>
        )}
      </div>

      {error && <p className="mt-2 text-[11px] text-destructive">{error}</p>}

      <div className="mt-3 grid grid-cols-2 gap-2">
        {phase === "idle" && (
          <button
            onClick={enable}
            className="col-span-2 h-11 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2"
          >
            <Camera className="size-4" /> Turn on camera
          </button>
        )}
        {phase === "ready" && (
          <button
            onClick={() => void start()}
            className="col-span-2 h-11 rounded-xl bg-accent text-ink font-bold text-sm"
          >
            Start recording
          </button>
        )}
        {phase === "recording" && (
          <button
            onClick={stop}
            className="col-span-2 h-11 rounded-xl bg-destructive font-bold text-sm"
          >
            Stop
          </button>
        )}
        {(phase === "review" || phase === "sending") && (
          <>
            <button
              onClick={() => {
                setClip(null);
                setPhase("ready");
              }}
              disabled={phase === "sending"}
              className="h-11 rounded-xl border border-white/15 bg-slate font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <RotateCcw className="size-4" /> Retake
            </button>
            <button
              onClick={send}
              disabled={phase === "sending"}
              className="h-11 rounded-xl bg-accent text-ink font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {phase === "sending" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
              Send it
            </button>
          </>
        )}
      </div>
    </div>
  );
}
