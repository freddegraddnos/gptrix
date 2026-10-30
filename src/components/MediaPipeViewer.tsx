import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Lock, PenTool, Square, SwitchCamera, Type, Unlock, Upload, Video } from "lucide-react";
import { TextTattooTool } from "@/components/TextTattooTool";
import { STYLES, TATTOOS, type TattooStyle } from "@/lib/tattoos";

/** MediaPipe engine: camera feed + Three.js overlay with the body-following decal. */
export default function MediaPipeViewer({
  onFail,
  initialTattooId,
  customImageUrl,
}: {
  onFail: (reason: string) => void;
  initialTattooId?: string;
  customImageUrl?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projRef = useRef<import("@/lib/mpProjection").MpProjection | null>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const uploadRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const [debug, setDebug] = useState(false);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [status, setStatus] = useState<string | null>("Starting camera…");
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  lockedRef.current = locked;
  const [picked, setPicked] = useState<string | null>(null);
  const [style, setStyle] = useState<TattooStyle | "All">("All");
  const [textOpen, setTextOpen] = useState(false);
  const [recording, setRecording] = useState(false);

  const src = picked ?? customImageUrl ?? (TATTOOS.find((t) => t.id === initialTattooId) ?? TATTOOS[0]).src;
  const srcRef = useRef(src);
  srcRef.current = src;
  const mirror = facing === "user";

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    setStatus("Starting camera…");
    (async () => {
      try {
        const [{ createMpEngine }, { createMpScene }, { createMpProjection }] = await Promise.all([
          import("@/lib/mpEngine"),
          import("@/lib/mpScene"),
          import("@/lib/mpProjection"),
        ]);
        const box = boxRef.current, video = videoRef.current, canvas = canvasRef.current;
        if (!box || !video || !canvas || cancelled) return;
        const view = createMpScene(canvas, box);
        view.camera.position.z = 500;
        view.camera.updateProjectionMatrix();
        const proj = createMpProjection(view.scene, srcRef.current, video);
        projRef.current = proj;
        let lw = 0, lh = 0;
        const engine = await createMpEngine((f) => {
          if (f.width !== lw || f.height !== lh) { lw = f.width; lh = f.height; view.resize(lw, lh); }
          if (!lockedRef.current) proj.update(f);
          view.render();
        });
        if (cancelled) { engine.stop(); proj.dispose(); view.dispose(); return; }
        cleanup = () => { engine.stop(); proj.dispose(); view.dispose(); projRef.current = null; };
        await engine.start(video, facing);
        if (!cancelled) setStatus(null);
      } catch (e) {
        if (!cancelled) onFail(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => { cancelled = true; cleanup(); };
  }, [onFail, facing]);

  useEffect(() => { projRef.current?.setMotif(src); setLocked(false); }, [src]);
  useEffect(() => { projRef.current?.setDebug(debug); }, [debug]);

  const snap = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return null;
    const out = document.createElement("canvas");
    out.width = video.videoWidth; out.height = video.videoHeight;
    const c = out.getContext("2d")!;
    if (mirror) { c.translate(out.width, 0); c.scale(-1, 1); }
    c.drawImage(video, 0, 0, out.width, out.height);
    c.drawImage(canvas, 0, 0, out.width, out.height);
    return out;
  };

  // Classic-style gestures: drag = move, pinch = size, two-finger twist = rotate.
  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onMove = (e: React.PointerEvent) => {
    const map = ptrs.current, prev = map.get(e.pointerId), proj = projRef.current, canvas = canvasRef.current;
    if (!prev || !proj || !canvas) return;
    const cur = { x: e.clientX, y: e.clientY };
    const c = proj.controls(), g = proj.frame();
    const k = canvas.width / (canvas.getBoundingClientRect().width || 1);
    const sx = mirror ? -1 : 1;
    if (map.size === 1) {
      const dx = (cur.x - prev.x) * k * sx, dy = (cur.y - prev.y) * k;
      const alongPx = dx * g.ux + dy * g.uy, acrossPx = -dx * g.uy + dy * g.ux;
      proj.setControls({ along: c.along + alongPx / g.len, around: c.around + acrossPx / Math.max(g.halfW, 1) });
    } else if (map.size === 2) {
      const other = [...map.entries()].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y), d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
        const a0 = Math.atan2(prev.y - other.y, prev.x - other.x), a1 = Math.atan2(cur.y - other.y, cur.x - other.x);
        proj.setControls({ scale: c.scale * (d0 > 0 ? d1 / d0 : 1), rotation: c.rotation + sx * Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) });
      }
    }
    map.set(e.pointerId, cur);
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); };
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  const btn = "rounded-full border-2 border-foreground bg-background/80 p-2 text-foreground";
  const tile = "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-foreground bg-background/80 font-mono text-[9px] uppercase text-foreground";

  return (
    <div
      ref={boxRef}
      className="relative h-[100dvh] w-full touch-none overflow-hidden bg-ink"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className="absolute inset-0" style={mirror ? { transform: "scaleX(-1)" } : undefined}>
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
        <canvas ref={canvasRef} className="pointer-events-none" />
      </div>

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-2 p-3" onPointerDown={stop}>
        <Link to="/" aria-label="Back" className={btn}><ArrowLeft className="h-5 w-5" /></Link>
        <span className="font-mono text-xs uppercase text-foreground drop-shadow">Live AR · MediaPipe</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDebug((d) => !d)}
            aria-pressed={debug}
            className="rounded-sm border border-border bg-background/70 px-2 py-1 font-mono text-[10px] uppercase text-foreground"
          >
            Debug {debug ? "on" : "off"}
          </button>
          <button aria-label="Switch camera" onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))} className={btn}>
            <SwitchCamera className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-[11.5rem] z-10 flex items-center justify-center gap-6" onPointerDown={stop}>
        <button
          aria-label={locked ? "Unlock motif" : "Lock motif to skin"}
          onClick={() => setLocked((l) => !l)}
          className={`flex items-center gap-2 rounded-full border-2 border-foreground px-4 py-2 font-mono text-xs uppercase ${locked ? "bg-primary text-primary-foreground" : "bg-background/80 text-foreground"}`}
        >
          {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          {locked ? "Locked" : "Lock"}
        </button>
        <button
          aria-label="Take photo"
          onClick={() => {
            const c = snap();
            if (!c) return;
            const a = document.createElement("a");
            a.href = c.toDataURL("image/jpeg", 0.92);
            a.download = "inksimulator-tryon.jpg";
            a.click();
          }}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-foreground bg-background/80 text-foreground"
        >
          <Camera className="h-6 w-6" />
        </button>
        <button
          aria-label={recording ? "Stop video" : "Record video"}
          onClick={() => {
            if (recording) { recRef.current?.stop(); return; }
            const first = snap();
            if (!first || typeof MediaRecorder === "undefined") return;
            const out = document.createElement("canvas");
            out.width = first.width; out.height = first.height;
            const ctx = out.getContext("2d")!;
            let live = true;
            const tick = () => { if (!live) return; const c = snap(); if (c) ctx.drawImage(c, 0, 0); requestAnimationFrame(tick); };
            tick();
            const mime = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find((m) => MediaRecorder.isTypeSupported?.(m));
            const rec = new MediaRecorder(out.captureStream(30), mime ? { mimeType: mime } : undefined);
            const chunks: Blob[] = [];
            rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
            rec.onstop = () => {
              live = false;
              setRecording(false);
              const type = rec.mimeType || "video/webm";
              const a = document.createElement("a");
              a.href = URL.createObjectURL(new Blob(chunks, { type }));
              a.download = `inksimulator-tryon.${type.includes("mp4") ? "mp4" : "webm"}`;
              a.click();
            };
            rec.start();
            recRef.current = rec;
            setRecording(true);
          }}
          className={`flex items-center gap-2 rounded-full border-2 border-foreground px-4 py-2 font-mono text-xs uppercase ${recording ? "bg-destructive text-destructive-foreground" : "bg-background/80 text-foreground"}`}
        >
          {recording ? <Square className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          {recording ? "Stop" : "Video"}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-24 z-10 space-y-2 px-3" onPointerDown={stop}>
        <div className="flex gap-2 overflow-x-auto">
          {(["All", ...STYLES] as (TattooStyle | "All")[]).map((st) => (
            <button
              key={st}
              onClick={() => setStyle(st)}
              className={`shrink-0 rounded-full border-2 border-foreground px-3 py-1 font-mono text-[10px] uppercase ${style === st ? "bg-foreground text-background" : "bg-background/80 text-foreground"}`}
            >
              {st}
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <button onClick={() => uploadRef.current?.click()} className={tile}><Upload className="h-4 w-4" />Upload</button>
          <Link to="/rita" className={tile}><PenTool className="h-4 w-4" />Draw</Link>
          <button onClick={() => setTextOpen(true)} className={tile}><Type className="h-4 w-4" />Text</button>
          {TATTOOS.filter((t) => style === "All" || t.style === style).map((t) => (
            <button
              key={t.id}
              aria-label={t.name}
              onClick={() => setPicked(t.src)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-background ${src === t.src ? "border-primary" : "border-foreground"}`}
            >
              <img src={t.src} alt="" loading="lazy" className="h-full w-full object-contain" />
            </button>
          ))}
        </div>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const r = new FileReader();
            r.onload = () => setPicked(String(r.result));
            r.readAsDataURL(file);
            e.target.value = "";
          }}
        />
      </div>

      {textOpen && (
        <div className="absolute inset-0 z-50" onPointerDown={stop}>
          <TextTattooTool onCancel={() => setTextOpen(false)} onDone={(url) => { setPicked(url); setTextOpen(false); }} />
        </div>
      )}

      {status && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-sm text-foreground">
          {status}
        </div>
      )}
    </div>
  );
}
