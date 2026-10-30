import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Camera, Check, ChevronUp, Lock, PenTool, Search, Square, SwitchCamera, Type, Unlock, Upload, Video, X } from "lucide-react";
import { TextTattooTool } from "@/components/TextTattooTool";
import { DEEPAR_ROOT, getDeepArKey } from "@/lib/deepar";
import { OneEuroFilter } from "@/lib/oneEuro";
import { PersonSegmenter } from "@/lib/personSegmentation";
import { halfWidthAt, inkOnly, pseudoDepth } from "@/lib/pseudoDepth";
import { STYLES, TATTOOS, type TattooStyle } from "@/lib/tattoos";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

/** Pose landmark pairs that describe a body segment the motif can sit on. */
const SEGMENTS: [number, number][] = [
  [15, 19], [16, 20], // back of hand (wrist -> index knuckle)
  [13, 15], [14, 16], // forearms
  [11, 13], [12, 14], // upper arms
  [23, 25], [24, 26], // thighs
  [25, 27], [26, 28], // calves
];

type Lm = { x: number; y: number; visibility?: number };

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
const FRAG = `
precision highp float;
uniform sampler2D motif; uniform sampler2D depth;
uniform vec2 res; uniform vec2 center; uniform vec2 axis;
uniform vec2 motifHalf; uniform float limbHalf; uniform float limbHalfB; uniform float wrap;
uniform vec4 depthMap; // scale.xy, offset.xy : screen px -> depth uv
uniform float mirror;
void main(){
  vec2 px = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  vec2 d = px - center;
  vec2 nrm = vec2(-axis.y, axis.x);
  float along = dot(d, axis);
  float across = dot(d, nrm);
  float tAlong = clamp(along / max(2.0 * motifHalf.y, 1.0) + 0.5, 0.0, 1.0);
  float lh = max(mix(limbHalf, limbHalfB, tAlong), 1.0);
  float q = across / lh;
  if (abs(q) >= 1.0) { gl_FragColor = vec4(1.0); return; }
  vec2 duv = px * depthMap.xy + depthMap.zw;
  if (mirror > 0.5) duv.x = 1.0 - duv.x;
  float dep = clamp(texture2D(depth, duv).r, 0.0, 1.0);
  // Bend grows toward the silhouette edge (low pseudo-depth).
  float k = 1.0 - dep;
  // Arc length on a cylinder: ink stretches/compresses toward the silhouette.
  float arc = asin(q) * lh;
  float s = mix(across, arc, clamp(wrap + k * 0.5, 0.0, 1.0));
  vec2 uv = vec2(s / motifHalf.x, along / motifHalf.y) * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(1.0); return; }
  vec4 t = texture2D(motif, uv);
  // Ink thins out as the surface turns away near the edge.
  float facing = sqrt(max(0.0, 1.0 - q * q));
  float a = t.a * 0.92 * smoothstep(1.0, 0.82, abs(q)) * mix(0.55, 1.0, facing);
  gl_FragColor = vec4(mix(vec3(1.0), t.rgb, a), 1.0);
}`;

export default function DeepARViewer({
  initialTattooId,
  customImageUrl,
  motifName,
  onFail,
  onUseClassic,
}: {
  initialTattooId?: string;
  customImageUrl?: string;
  motifName?: string;
  onFail: (reason: string) => void;
  onUseClassic: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const deepCanvasRef = useRef<HTMLCanvasElement>(null);
  const glCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [status, setStatus] = useState("Starting camera…");
  const ctl = useRef({ size: 1, rot: 0, pos: 0.5 });
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  lockedRef.current = locked;
  const [picked, setPicked] = useState<string | null>(null);
  const [style, setStyle] = useState<TattooStyle | "All">("All");
  const [textOpen, setTextOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryQuery, setGalleryQuery] = useState("");
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const loadMotifRef = useRef<(src: string) => void>(() => {});
  const snapRef = useRef<() => HTMLCanvasElement | null>(() => null);
  const uploadRef = useRef<HTMLInputElement>(null);
  const galleryTouchY = useRef<number | null>(null);

  const galleryTattoos = useMemo(() => {
    const query = galleryQuery.trim().toLowerCase();
    return TATTOOS.filter((tattoo) => style === "All" || tattoo.style === style).filter(
      (tattoo) => !query || `${tattoo.name} ${tattoo.style} ${tattoo.type}`.toLowerCase().includes(query),
    );
  }, [galleryQuery, style]);

  const motifSrc =
    picked ??
    customImageUrl ??
    (TATTOOS.find((t) => t.id === initialTattooId) ?? TATTOOS[0]).src;
  const motifSrcRef = useRef(motifSrc);
  motifSrcRef.current = motifSrc;
  useEffect(() => {
    loadMotifRef.current(motifSrc);
    setLocked(false);
  }, [motifSrc]);

  useEffect(() => {
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let deepAR: { shutdown: () => void; setVideoElement: (v: HTMLVideoElement, m: boolean) => void } | null = null;
    const seg = new PersonSegmenter();
    let pose: { detectForVideo: (v: HTMLVideoElement, t: number) => { landmarks?: Lm[][] }; close?: () => void } | null = null;
    const mirror = facing === "user";

    (async () => {
      const video = videoRef.current!;
      const canvas = deepCanvasRef.current!;
      const glc = glCanvasRef.current!;
      try {
        stream = await navigator.mediaDevices
          .getUserMedia({
            video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
          .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: false }));
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream;
        await video.play().catch((e: Error) => { if (e.name !== "AbortError") throw e; });
      } catch (e) {
        if (stopped) return;
        console.warn("DeepAR camera error", e);
        onFail("camera");
        return;
      }
      if (stopped) return;

      // DeepAR renders the live camera; we feed it our own video element.
      const key = getDeepArKey(window.location.hostname);
      if (!key) { onFail("no-key"); return; }
      const origAlert = window.alert;
      let licenseBad = false;
      window.alert = (msg?: unknown) => {
        if (/licen/i.test(String(msg))) { licenseBad = true; return; }
        origAlert.call(window, msg as string);
      };
      try {
        const host = hostRef.current!;
        canvas.width = host.clientWidth * Math.min(2, devicePixelRatio);
        canvas.height = host.clientHeight * Math.min(2, devicePixelRatio);
        const sdk = await import("deepar");
        deepAR = (await sdk.initialize({
          licenseKey: key,
          canvas,
          rootPath: DEEPAR_ROOT,
          additionalOptions: { cameraConfig: { disableDefaultCamera: true } },
        })) as unknown as typeof deepAR;
        deepAR!.setVideoElement(video, mirror);
      } catch (e) {
        console.warn("DeepAR init failed", e);
        if (!stopped) onFail("deepar");
        return;
      } finally {
        setTimeout(() => { window.alert = origAlert; }, 5000);
      }
      if (stopped) return;
      if (licenseBad) { onFail("license"); return; }
      // Watchdog: if no alert-free frame within 3 s (license alert may arrive late), fall back.
      setTimeout(() => { if (!stopped && licenseBad) onFail("license"); }, 3000);
      if (stopped) return;
      setStatus("Loading body tracking…");

      try {
        const vision = await import("@mediapipe/tasks-vision");
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
        pose = (await vision.PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
          runningMode: "VIDEO",
          numPoses: 1,
        })) as unknown as typeof pose;
        await seg.ensure(WASM);
      } catch {
        /* tracking optional — motif stays centred */
      }
      if (stopped) return;

      // ---- WebGL overlay (multiplied onto the DeepAR canvas via CSS) ----
      const gl = glc.getContext("webgl", { premultipliedAlpha: false, antialias: true, preserveDrawingBuffer: true })!;
      const sh = (type: number, src: string) => {
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        return s;
      };
      const prog = gl.createProgram()!;
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      gl.useProgram(prog);
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, "p");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      const U = (n: string) => gl.getUniformLocation(prog, n);
      const mkTex = (unit: number) => {
        const t = gl.createTexture()!;
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        return t;
      };
      const motifTex = mkTex(0);
      const depthTex = mkTex(1);
      gl.uniform1i(U("motif"), 0);
      gl.uniform1i(U("depth"), 1);
      gl.uniform1f(U("mirror"), mirror ? 1 : 0);

      let aspect = 1;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const w = Math.min(1024, img.naturalWidth || 512);
        const h = Math.round((w * (img.naturalHeight || 512)) / (img.naturalWidth || 512));
        aspect = h / w;
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, motifTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, inkOnly(img, w, h));
      };
      img.src = motifSrcRef.current;
      loadMotifRef.current = (src: string) => { img.src = src; };
      snapRef.current = () => {
        const out = document.createElement("canvas");
        out.width = glc.width; out.height = glc.height;
        const c = out.getContext("2d")!;
        const vw = video.videoWidth || 1280, vh = video.videoHeight || 720;
        const sc = Math.max(out.width / vw, out.height / vh);
        c.save();
        if (mirror) { c.translate(out.width, 0); c.scale(-1, 1); }
        c.drawImage(video, (out.width - vw * sc) / 2, (out.height - vh * sc) / 2, vw * sc, vh * sc);
        c.restore();
        c.globalCompositeOperation = "multiply";
        c.drawImage(glc, 0, 0);
        return out;
      };

      const f = {
        x: new OneEuroFilter({ minCutoff: 1.0, beta: 0.01 }),
        y: new OneEuroFilter({ minCutoff: 1.0, beta: 0.01 }),
        a: new OneEuroFilter({ minCutoff: 1.0, beta: 0.01 }),
        len: new OneEuroFilter({ minCutoff: 1.0, beta: 0.01 }),
        limb: new OneEuroFilter({ minCutoff: 1.0, beta: 0.01 }),
      };
      let lastAngle = 0;
      let segIdx = -1; // latched body segment
      let frozen: { half: number; limbA: number; limbB: number; t: number; dAng: number } | null = null;
      // Last confident measurement — reused when tracking drops out, so the
      // motif freezes in place instead of jumping back to screen centre.
      let lastPose: { cx: number; cy: number; ang: number; len: number; limb: number; top: number; bot: number } | null = null;
      let depthBuf: Float32Array | undefined;
      let depthBytes = new Uint8Array(0);
      let last = performance.now();
      setStatus("");

      const loop = () => {
        if (stopped) return;
        raf = requestAnimationFrame(loop);
        const now = performance.now();
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        const W = (glc.width = glc.clientWidth);
        const H = (glc.height = glc.clientHeight);
        const vw = video.videoWidth || 1280;
        const vh = video.videoHeight || 720;
        const s = Math.max(W / vw, H / vh);
        const ox = (W - vw * s) / 2;
        const oy = (H - vh * s) / 2;
        const toScreen = (l: Lm) => ({
          x: (mirror ? 1 - l.x : l.x) * vw * s + ox,
          y: l.y * vh * s + oy,
        });

        // Default: keep the last confident pose; fall back to centred on first frames.
        let cx = lastPose?.cx ?? W / 2, cy = lastPose?.cy ?? H / 2;
        let ang = lastPose?.ang ?? Math.PI / 2, len = lastPose?.len ?? Math.min(W, H) * 0.5;
        let limbHalfPx = lastPose?.limb ?? Math.min(W, H) * 0.18;
        let limbTop = lastPose?.top ?? limbHalfPx, limbBot = lastPose?.bot ?? limbHalfPx;

        const lms = pose?.detectForVideo(video, now).landmarks?.[0];
        const mask = seg.segment(video, now);
        if (lms) {
          type Pick = { a: Lm; b: Lm; d: number; k: number };
          let best = null as Pick | null;
          let cur = null as Pick | null;
          SEGMENTS.forEach(([i, j], k) => {
            const a = lms[i], b = lms[j];
            if (!a || !b || (a.visibility ?? 0) < 0.6 || (b.visibility ?? 0) < 0.6) return;
            const A = toScreen(a), B = toScreen(b);
            const d = Math.hypot((A.x + B.x) / 2 - W / 2, (A.y + B.y) / 2 - H / 2);
            if (k === segIdx) cur = { a, b, d, k };
            if (!best || d < best.d) best = { a, b, d, k };
          });
          // Latch: stay on the current segment unless another is clearly closer (or locked).
          if (cur && (lockedRef.current || !best || (best as { d: number }).d > (cur as { d: number }).d * 0.6)) best = cur;
          if (lockedRef.current && !cur) best = null;
          if (best) segIdx = (best as { k: number }).k;
          if (best) {
            const A = toScreen(best.a), B = toScreen(best.b);
            const t = ctl.current.pos;
            cx = A.x + (B.x - A.x) * t;
            cy = A.y + (B.y - A.y) * t;
            ang = Math.atan2(B.y - A.y, B.x - A.x);
            len = Math.hypot(B.x - A.x, B.y - A.y);
            if (mask) {
              const mx = ((mirror ? 1 - (cx - ox) / (vw * s) : (cx - ox) / (vw * s))) * mask.width;
              const my = ((cy - oy) / (vh * s)) * mask.height;
              const nx = -Math.sin(ang) * (mirror ? -1 : 1), ny = Math.cos(ang);
              const hw = halfWidthAt(mask.data, mask.width, mask.height, (v) => v !== 0, mx, my, nx, ny);
              limbHalfPx = hw * (vw * s) / mask.width;
            } else {
              limbHalfPx = len * 0.22;
            }
            limbTop = limbBot = limbHalfPx;
            if (mask) {
              const sx = (vw * s) / mask.width;
              const hh = (limbHalfPx * 0.9 * aspect);
              const m = (px: number, py: number) => [
                (mirror ? 1 - (px - ox) / (vw * s) : (px - ox) / (vw * s)) * mask.width,
                ((py - oy) / (vh * s)) * mask.height,
              ];
              const nx = -Math.sin(ang) * (mirror ? -1 : 1), ny = Math.cos(ang);
              const [ax, ay] = m(cx - Math.cos(ang) * hh, cy - Math.sin(ang) * hh);
              const [bx, by] = m(cx + Math.cos(ang) * hh, cy + Math.sin(ang) * hh);
              limbTop = halfWidthAt(mask.data, mask.width, mask.height, (v) => v !== 0, ax, ay, nx, ny) * sx;
              limbBot = halfWidthAt(mask.data, mask.width, mask.height, (v) => v !== 0, bx, by, nx, ny) * sx;
            }
            lastPose = { cx, cy, ang, len, limb: limbHalfPx, top: limbTop, bot: limbBot };
          }
        }

        // Unwrap the angle so the filter never sees a 2π jump.
        while (ang - lastAngle > Math.PI) ang -= 2 * Math.PI;
        while (ang - lastAngle < -Math.PI) ang += 2 * Math.PI;
        lastAngle = ang;
        cx = f.x.filter(cx, dt);
        cy = f.y.filter(cy, dt);
        const fa = f.a.filter(ang, dt) + (ctl.current.rot * Math.PI) / 180;
        len = f.len.filter(len, dt);
        limbHalfPx = Math.max(8, f.limb.filter(limbHalfPx, dt));
        const clampL = (v: number) => Math.max(limbHalfPx * 0.6, Math.min(limbHalfPx * 1.4, v || limbHalfPx));
        let lA = clampL(limbTop), lB = clampL(limbBot);
        let halfW = limbHalfPx * 0.9 * ctl.current.size;
        // Lock: freeze size, wrap and taper; only the tracked pose moves it.
        if (lockedRef.current) {
          if (!frozen) frozen = { half: halfW, limbA: lA, limbB: lB, t: 0, dAng: 0 };
          halfW = frozen.half; lA = frozen.limbA; lB = frozen.limbB;
        } else frozen = null;
        const limbMid = (lA + lB) / 2;

        // Pseudo-depth texture, normalised to the limb's half-width.
        if (mask && !lockedRef.current) {
          const { depth } = pseudoDepth(mask.data, mask.width, mask.height, (v) => v !== 0, depthBuf);
          depthBuf = depth;
          const halfMask = Math.max(1, (limbHalfPx * mask.width) / (vw * s));
          if (depthBytes.length !== depth.length) depthBytes = new Uint8Array(depth.length);
          for (let i = 0; i < depth.length; i++) depthBytes[i] = Math.min(255, (depth[i] / halfMask) * 255);
          gl.activeTexture(gl.TEXTURE1);
          gl.bindTexture(gl.TEXTURE_2D, depthTex);
          gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, mask.width, mask.height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, depthBytes);
        }

        gl.viewport(0, 0, W, H);
        gl.uniform2f(U("res"), W, H);
        gl.uniform2f(U("center"), cx, cy);
        // Motif's "up" runs along the limb; across spans its width.
        gl.uniform2f(U("axis"), Math.cos(fa), Math.sin(fa));
        gl.uniform2f(U("motifHalf"), halfW, halfW * aspect);
        gl.uniform1f(U("limbHalf"), lA);
        gl.uniform1f(U("limbHalfB"), lB);
        gl.uniform1f(U("wrap"), Math.min(0.95, 0.55 + 0.4 * Math.min(1, halfW / limbMid)));
        gl.uniform4f(U("depthMap"), 1 / (vw * s), 1 / (vh * s), -ox / (vw * s), -oy / (vh * s));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      loop();
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
      try { deepAR?.shutdown(); } catch { /* ignore */ }
      pose?.close?.();
      seg.close();
    };
  }, [facing, onFail]);

  return (
    <div ref={hostRef} className="relative h-[100dvh] w-full overflow-hidden bg-ink">
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={deepCanvasRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={glCanvasRef}
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ mixBlendMode: "multiply" }}
      />

      <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
        <Link to="/" aria-label="Back" className="rounded-full border-2 border-foreground bg-background/80 p-2 text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <span className="font-mono text-xs uppercase text-foreground drop-shadow">
          {motifName ?? "Live AR"} · DeepAR
        </span>
        <button
          aria-label="Switch camera"
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          className="rounded-full border-2 border-foreground bg-background/80 p-2 text-foreground"
        >
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      {/* Lock + capture */}
      <div className="absolute inset-x-0 bottom-[9rem] flex items-center justify-center gap-6">
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
            const c = snapRef.current();
            if (!c) return;
            try { navigator.vibrate?.(40); } catch { /* ignore */ }
            const flash = document.createElement("div");
            flash.style.cssText = "position:fixed;inset:0;background:#fff;opacity:.8;z-index:9999;pointer-events:none;transition:opacity 250ms";
            document.body.appendChild(flash);
            requestAnimationFrame(() => { flash.style.opacity = "0"; });
            setTimeout(() => flash.remove(), 300);
            c.toBlob(async (blob) => {
              if (!blob) return;
              const name = "inksimulator-tryon.jpg";
              const file = new File([blob], name, { type: "image/jpeg" });
              const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
              if (/Android|iPhone|iPad/i.test(navigator.userAgent) && nav.canShare?.({ files: [file] })) {
                try { await nav.share({ files: [file], title: "InkSimulator" }); return; } catch (e) {
                  if ((e as Error)?.name === "AbortError") return;
                }
              }
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = name; a.style.display = "none";
              document.body.appendChild(a); a.click(); a.remove();
              setTimeout(() => URL.revokeObjectURL(url), 10000);
            }, "image/jpeg", 0.92);
          }}
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-foreground bg-background/80 text-foreground"
        >
          <Camera className="h-6 w-6" />
        </button>
        <button
          aria-label={recording ? "Stop video" : "Record video"}
          onClick={() => {
            if (recording) { recRef.current?.stop(); return; }
            const out = document.createElement("canvas");
            const first = snapRef.current();
            if (!first) return;
            out.width = first.width; out.height = first.height;
            const ctx = out.getContext("2d")!;
            let live = true;
            const tick = () => { if (!live) return; const c = snapRef.current(); if (c) ctx.drawImage(c, 0, 0); requestAnimationFrame(tick); };
            tick();
            const rec = new MediaRecorder(out.captureStream(30));
            const chunks: Blob[] = [];
            rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
            rec.onstop = () => {
              live = false;
              setRecording(false);
              const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `inksimulator-tryon.${(rec.mimeType || "").includes("mp4") ? "mp4" : "webm"}`;
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

      {/* Motif strip + tools */}
      <div className="absolute inset-x-0 bottom-[3.5rem] space-y-2 px-3">
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          onTouchStart={(event) => { galleryTouchY.current = event.touches[0]?.clientY ?? null; }}
          onTouchEnd={(event) => {
            const start = galleryTouchY.current;
            galleryTouchY.current = null;
            if (start != null && start - (event.changedTouches[0]?.clientY ?? start) > 36) setGalleryOpen(true);
          }}
          className="relative flex min-h-[48px] w-full items-center justify-center gap-2 rounded-t-2xl border border-accent/25 bg-slate/90 font-mono text-[11px] text-foreground backdrop-blur-xl before:absolute before:left-1/2 before:top-1 before:h-1 before:w-10 before:-translate-x-1/2 before:rounded-full before:bg-accent"
          aria-label="Open design gallery"
        >
          All designs <span className="text-muted-foreground">Swipe up</span><ChevronUp className="size-4 text-accent" />
        </button>
        <div className="flex gap-2 overflow-x-auto">
          {(["All", "Fineline", "Blackwork", "Botanical"] as (TattooStyle | "All")[]).map((st) => (
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
          <button onClick={() => uploadRef.current?.click()} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-foreground bg-background/80 font-mono text-[9px] uppercase text-foreground">
            <Upload className="h-4 w-4" />Upload
          </button>
          <Link to="/rita" className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-foreground bg-background/80 font-mono text-[9px] uppercase text-foreground">
            <PenTool className="h-4 w-4" />Draw
          </Link>
          <button onClick={() => setTextOpen(true)} className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-foreground bg-background/80 font-mono text-[9px] uppercase text-foreground">
            <Type className="h-4 w-4" />Text
          </button>
          {TATTOOS.filter((t) => style === "All" || t.style === style).map((t) => (
            <button
              key={t.id}
              aria-label={t.name}
              onClick={() => setPicked(t.src)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-background ${motifSrc === t.src ? "border-primary" : "border-foreground"}`}
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

      {galleryOpen && (
        <div className="absolute inset-0 z-40 flex flex-col justify-end">
          <button type="button" className="absolute inset-0 bg-ink/65 backdrop-blur-sm" onClick={() => setGalleryOpen(false)} aria-label="Close design gallery" />
          <div className="reference-gallery relative flex h-[76%] flex-col rounded-t-3xl border border-accent/30 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl backdrop-blur-2xl">
            <button type="button" onClick={() => setGalleryOpen(false)} className="mx-auto mb-2 flex min-h-11 w-20 items-center justify-center" aria-label="Close design gallery">
              <span className="h-1 w-9 rounded-full bg-accent" />
            </button>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-[28px] leading-none" style={{ textShadow: "none" }}>Choose a design</h2>
                <p className="mt-3 text-[11px] text-muted-foreground">Tap a motif to try it. Your camera stays open.</p>
              </div>
              <button type="button" onClick={() => setGalleryOpen(false)} aria-label="Close" className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <label className="mt-4 flex min-h-[52px] shrink-0 items-center gap-3 rounded-xl border border-accent/25 bg-slate/75 px-3 focus-within:border-accent">
              <Search className="size-4 text-accent" />
              <input value={galleryQuery} onChange={(event) => setGalleryQuery(event.target.value)} placeholder="Search designs…" aria-label="Search gallery designs" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            </label>
            <div className="mt-3 flex min-h-11 shrink-0 gap-2 overflow-x-auto no-scrollbar">
              {(["All", "Fineline", "Blackwork", "Botanical"] as (TattooStyle | "All")[]).map((st) => (
                <button key={st} type="button" onClick={() => setStyle(st)} className={`min-h-11 shrink-0 rounded-full border px-4 text-xs ${style === st ? "border-accent bg-accent text-ink" : "border-white/15 text-muted-foreground"}`}>{st}</button>
              ))}
            </div>
            <div className="mt-3 flex shrink-0 items-center justify-between text-[11px] text-muted-foreground"><span>{galleryTattoos.length} designs</span><span>Free to try</span></div>
            <div className="-mx-1 mt-3 flex-1 overflow-y-auto px-1 no-scrollbar">
              <div className="grid grid-cols-2 gap-3 pb-3">
                {galleryTattoos.map((tattoo) => {
                  const active = motifSrc === tattoo.src;
                  return (
                    <button key={tattoo.id} type="button" onClick={() => { setPicked(tattoo.src); setGalleryOpen(false); }} className="overflow-hidden rounded-xl border border-white/10 bg-slate text-left" aria-label={`Try ${tattoo.name}`}>
                      <span className="relative block aspect-square bg-artwork p-3">
                        <img src={tattoo.src} alt="" className="h-full w-full object-contain" />
                        {active && <span className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-full bg-accent text-ink"><Check className="size-4" /></span>}
                      </span>
                      <span className="block px-2 pb-2 pt-2"><span className="block truncate text-xs text-foreground">{tattoo.name}</span><span className="mt-1 block truncate text-[9px] text-muted-foreground">{tattoo.style}</span></span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {textOpen && (
        <div className="absolute inset-0 z-50">
          <TextTattooTool onCancel={() => setTextOpen(false)} onDone={(url) => { setPicked(url); setTextOpen(false); }} />
        </div>
      )}

      {status && (
        <div className="absolute inset-0 flex items-center justify-center font-mono text-sm text-foreground">
          {status}
        </div>
      )}

    </div>
  );
}
