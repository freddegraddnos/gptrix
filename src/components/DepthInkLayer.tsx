import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import {
  DepthEngine,
  depthToBytes,
  type DepthEngineMode,
} from "@/lib/depthBody";
import { PersonSegmenter, type SegMask } from "@/lib/personSegmentation";
import { halfWidthAt } from "@/lib/pseudoDepth";
import type { LightEstimate } from "@/lib/lightEstimate";

const MP_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

export type DepthStatus = "loading" | DepthEngineMode | "failed";

export type DepthPose = { x: number; y: number; scale: number; rotation: number };

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

/**
 * Ported from the proven DeepAR viewer warp, driven by the real body depth
 * map instead of a mask-only pseudo-depth, and extended with surface normals
 * (from the depth gradient) so the ink shades with the body.
 */
const FRAG = `
precision highp float;
uniform sampler2D motif; uniform sampler2D depth;
uniform vec2 res; uniform vec2 center; uniform vec2 axis;
uniform vec2 motifHalf; uniform float limbHalf; uniform float limbHalfB; uniform float wrap;
uniform vec4 depthMap; // scale.xy, offset.xy : screen px -> depth uv
uniform vec2 depthTexel;
uniform float mirror;
uniform vec2 lightDir; uniform float lightStrength;
uniform float debug;
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
  if (mirror > 0.5) duv = vec2(1.0 - duv.x, duv.y);
  float dep = clamp(texture2D(depth, duv).r, 0.0, 1.0);
  // The bend grows toward the silhouette edge (low depth).
  float k = 1.0 - dep;
  // Arc length on the body: ink stretches toward the silhouette.
  float arc = asin(q) * lh;
  float s = mix(across, arc, clamp(wrap + k * 0.5, 0.0, 1.0));
  vec2 uv = vec2(s / motifHalf.x, along / motifHalf.y) * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) { gl_FragColor = vec4(1.0); return; }
  vec4 t = texture2D(motif, uv);
  // Surface normal from the depth gradient — this is what shades the ink.
  float dl = texture2D(depth, duv - vec2(depthTexel.x, 0.0)).r;
  float dr = texture2D(depth, duv + vec2(depthTexel.x, 0.0)).r;
  float duu = texture2D(depth, duv - vec2(0.0, depthTexel.y)).r;
  float ddd = texture2D(depth, duv + vec2(0.0, depthTexel.y)).r;
  vec3 n = normalize(vec3((dl - dr) * 6.0, (duu - ddd) * 6.0, 1.0));
  vec3 L = normalize(vec3(lightDir, 0.85));
  float lambert = max(dot(n, L), 0.0);
  // Ink thins as the surface turns away near the edge of the limb.
  float facing = sqrt(max(0.0, 1.0 - q * q));
  float a = t.a * 0.92 * smoothstep(1.0, 0.82, abs(q)) * mix(0.55, 1.0, facing);
  // And it shades with the body where the room light falls.
  a *= mix(1.0, 0.45 + 0.55 * lambert, lightStrength);
  vec3 rgb = t.rgb * mix(1.0, 0.7 + 0.3 * lambert, lightStrength);
  if (debug > 0.5) {
    gl_FragColor = vec4(mix(vec3(1.0), vec3(0.1, 0.25, 0.9), dep), 1.0);
    return;
  }
  gl_FragColor = vec4(mix(vec3(1.0), rgb, a), 1.0);
}`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn(
      "Depth shader compile failed (type", type, "lost:", gl.isContextLost(), ")",
      gl.getShaderInfoLog(sh),
    );
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

/**
 * The 3D body-shape ink layer for /arv2. Renders the motif warped by the
 * live depth map onto a multiply-blended WebGL canvas above the video. When
 * the depth model is unavailable it draws with the mask-only fallback so the
 * page never breaks; if WebGL itself is missing it reports "failed" and the
 * caller keeps the ordinary CSS pipeline.
 */
export function DepthInkLayer({
  videoRef,
  stageRef,
  getPose,
  getOpacity,
  motifSrc,
  mirrored,
  light,
  wrapCurve,
  debug,
  onStatus,
}: {
  videoRef: RefObject<HTMLVideoElement | null>;
  stageRef: RefObject<HTMLDivElement | null>;
  getPose: () => DepthPose;
  getOpacity: () => number;
  motifSrc: string;
  mirrored: boolean;
  light: LightEstimate;
  wrapCurve: number;
  debug: boolean;
  onStatus: (s: DepthStatus) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseRef = useRef(getPose);
  poseRef.current = getPose;
  const opacityRef = useRef(getOpacity);
  opacityRef.current = getOpacity;
  const lightRef = useRef(light);
  lightRef.current = light;
  const mirrorRef = useRef(mirrored);
  mirrorRef.current = mirrored;
  const debugRef = useRef(debug);
  debugRef.current = debug;
  const wrapRef = useRef(wrapCurve);
  wrapRef.current = wrapCurve;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;

  // Motif texture source.
  const motifImgRef = useRef<HTMLImageElement | null>(null);
  const motifSrcRef = useRef(motifSrc);
  motifSrcRef.current = motifSrc;
  useEffect(() => {
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (alive) motifImgRef.current = img;
    };
    img.src = motifSrc;
    return () => {
      alive = false;
    };
  }, [motifSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const seg = new PersonSegmenter();
    const engine = new DepthEngine();
    let stopped = false;
    let raf = 0;
    let depthBytes: Uint8Array | null = null;
    let depthW = 0;
    let depthH = 0;
    let lastDrawnFrame: DepthFrameLike = null;
    let uploadedSrc: string | null = null;
    let setupTries = 0;
    let gl: WebGLRenderingContext | null = null;
    let motifTex: WebGLTexture | null = null;
    let depthTex: WebGLTexture | null = null;
    let U: (name: string) => WebGLUniformLocation | null = () => null;

    type DepthFrameLike = { depth: Float32Array; width: number; height: number } | null;

    // 1 = running, 0 = context lost, retry; -1 = permanent failure.
    // The MediaPipe GPU delegate can knock out our WebGL context while it
    // boots (software rendering, some Androids), so the context is created
    // after the segmenter settles and rebuilt if the browser reports it lost.
    const setupGl = (): 1 | 0 | -1 => {
      gl = canvas.getContext("webgl", {
        premultipliedAlpha: true,
        antialias: true,
      });
      if (!gl) return -1;
      if (gl.isContextLost()) return 0;
      const vs = compile(gl, gl.VERTEX_SHADER, VERT);
      const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
      if (!vs || !fs) {
        return gl.isContextLost() ? 0 : -1;
      }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("Depth program link failed", gl.getProgramInfoLog(prog));
      return gl.isContextLost() ? 0 : -1;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U_ = (name: string) => gl!.getUniformLocation(prog, name);
    U = U_;

    // Motif texture.
    motifTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, motifTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Depth texture.
    depthTex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, depthTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U("motif"), 0);
    gl.uniform1i(U("depth"), 1);
    // 1x1 white until the first depth frame lands (multiply no-op).
    gl.activeTexture(gl.TEXTURE1);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE,
      new Uint8Array([255]),
    );
      return 1;
    };

    const boot = (delay: number) => {
      window.setTimeout(() => {
        if (stopped) return;
        cancelAnimationFrame(raf);
        const r = setupGl();
        if (r === 1) {
          raf = requestAnimationFrame(loop);
        } else if (r === 0 && setupTries < 4) {
          setupTries += 1;
          boot(400);
        } else if (r === -1) {
          statusRef.current("failed");
        }
      }, delay);
    };

    // If the browser drops the context mid-run (GPU memory pressure),
    // rebuild the pipeline instead of leaving a frozen canvas.
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (!stopped && setupTries <= 4) boot(400);
    });

    void seg
      .ensure(MP_WASM)
      .catch(() => false)
      .then(() => new Promise((r) => window.setTimeout(r, 150)))
      .then(() => {
        if (!stopped) boot(0);
      });
    void engine
      .ensure()
      .then((m) => {
        if (!stopped) statusRef.current(m);
      })
      .catch(() => {
        if (!stopped) statusRef.current("pseudo");
      });

    const loop = (now: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(loop);
      const video = videoRef.current;
      const st = stageRef.current;
      if (!video || !st || !video.videoWidth || !video.videoHeight) return;
      const W = st.clientWidth;
      const H = st.clientHeight;
      if (W < 2 || H < 2) return;
      if (!gl || !depthTex) return;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      const mask: SegMask | null = seg.segment(video, now);
      engine.request(video, mask, now);
      const df: DepthFrameLike = engine.latest;

      canvas.style.opacity = String(opacityRef.current());

      if (df && (df.width !== depthW || df.height !== depthH || df.depth !== lastDrawnFrame?.depth)) {
        depthW = df.width;
        depthH = df.height;
        depthBytes = depthToBytes(df.depth, depthBytes ?? undefined);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, depthTex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texImage2D(
          gl.TEXTURE_2D, 0, gl.LUMINANCE, depthW, depthH, 0,
          gl.LUMINANCE, gl.UNSIGNED_BYTE, depthBytes,
        );
        lastDrawnFrame = df;
      }

      // Screen-space pose. The overlay transform is relative to the stage
      // centre; the motif box is BASE 200px wide scaled by pose.scale.
      const p = poseRef.current();
      const cx = W / 2 + p.x;
      const cy = H / 2 + p.y;
      const halfW = Math.max(8, 100 * p.scale);
      const rot = (p.rotation * Math.PI) / 180;
      // CSS rotate: the motif's local "up" maps to (sin r, -cos r) on screen.
      const ax = Math.sin(rot);
      const ay = -Math.cos(rot);
      const nx = -ay;
      const ny = ax;

      // Limb half-width from the person mask, at the centre and both ends.
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const s = Math.max(W / vw, H / vh);
      const ox = (W - vw * s) / 2;
      const oy = (H - vh * s) / 2;
      let lA = halfW * 1.15;
      let lB = halfW * 1.15;
      if (mask) {
        const toMask = (px: number, py: number): [number, number] => {
          let u = (px - ox) / (vw * s);
          const v = (py - oy) / (vh * s);
          if (mirrorRef.current) u = 1 - u;
          return [
            Math.min(mask.width - 1, Math.max(0, Math.round(u * mask.width))),
            Math.min(mask.height - 1, Math.max(0, Math.round(v * mask.height))),
          ];
        };
        const isPerson = (v: number) => v !== 0;
        const [mx, my] = toMask(cx, cy);
        const hwC = halfWidthAt(mask.data, mask.width, mask.height, isPerson, mx, my, nx, ny);
        const [tx, ty] = toMask(cx - ax * halfW * 0.6, cy - ay * halfW * 0.6);
        const [bx, by] = toMask(cx + ax * halfW * 0.6, cy + ay * halfW * 0.6);
        const sxm = (vw * s) / mask.width;
        lA = Math.max(4, hwC * sxm);
        lB = Math.max(
          4,
          ((halfWidthAt(mask.data, mask.width, mask.height, isPerson, tx, ty, nx, ny) +
            halfWidthAt(mask.data, mask.width, mask.height, isPerson, bx, by, nx, ny)) /
            2) * sxm,
        );
      }

      const light = lightRef.current;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U("res"), W, H);
      gl.uniform2f(U("center"), cx, cy);
      gl.uniform2f(U("axis"), ax, ay);
      gl.uniform2f(U("motifHalf"), halfW, halfW);
      gl.uniform1f(U("limbHalf"), lA);
      gl.uniform1f(U("limbHalfB"), lB);
      gl.uniform1f(U("wrap"), Math.max(0.15, Math.min(0.95, 0.25 + wrapRef.current)));
      gl.uniform4f(
        U("depthMap"),
        1 / (vw * s), 1 / (vh * s),
        -ox / (vw * s), -oy / (vh * s),
      );
      gl.uniform2f(U("depthTexel"), 1 / Math.max(1, depthW), 1 / Math.max(1, depthH));
      gl.uniform1f(U("mirror"), mirrorRef.current ? 1 : 0);
      gl.uniform2f(U("lightDir"), light.x, light.y);
      gl.uniform1f(U("lightStrength"), Math.max(0, Math.min(1, light.strength)));
      gl.uniform1f(U("debug"), debugRef.current ? 1 : 0);

      // Motif texture — re-upload only when a new image decoded.
      const img = motifImgRef.current;
      if (img && uploadedSrc !== motifSrcRef.current) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, motifTex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        uploadedSrc = motifSrcRef.current;
      }

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      seg.close();
      engine.dispose();
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
      style={{ mixBlendMode: "multiply" }}
    />
  );
}

