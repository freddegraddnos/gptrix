/**
 * "Infinite Decal": body-following surface + DecalGeometry projection for the MediaPipe engine.
 * Works in the pixel-space ortho scene from mpScene.ts (x right, y down, +z toward camera).
 */
import * as THREE from "three";
import { DecalGeometry } from "three/examples/jsm/geometries/DecalGeometry.js";
import type { MpFrame, MpLandmark } from "./mpEngine";

class OneEuro {
  private x: number | null = null; private dx = 0; private t = 0;
  constructor(private minCutoff = 1.0, private beta = 0.01, private dCutoff = 1.0) {}
  private a(c: number, dt: number) { const r = 2 * Math.PI * c * dt; return r / (r + 1); }
  filter(v: number, now: number) {
    if (this.x === null) { this.x = v; this.t = now; return v; }
    const dt = Math.max((now - this.t) / 1000, 1e-3); this.t = now;
    const d = (v - this.x) / dt;
    this.dx += this.a(this.dCutoff, dt) * (d - this.dx);
    const c = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += this.a(c, dt) * (v - this.x);
    return this.x;
  }
}

const VERT = /* glsl */ `
varying vec2 vUv; varying float vFacing;
void main(){
  vUv = uv;
  vec3 n = normalize(normalMatrix * normal);
  vFacing = abs(n.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
}`;
const FRAG = /* glsl */ `
uniform sampler2D uMotif; uniform sampler2D uMask; uniform sampler2D uSkin; uniform vec2 uRes; uniform float uColorMix;
varying vec2 vUv; varying float vFacing;
void main(){
  vec2 p = gl_FragCoord.xy / uRes;
  vec4 m0 = texture2D(uMask, p);
  if (m0.r * m0.a < 0.05) discard;             // hard mask: never outside the silhouette
  // edge feathering: average the mask around the pixel
  float acc = 0.0; vec2 o = 6.0 / uRes;
  for (int k = 0; k < 8; k++) {
    float an = float(k) * 0.785398;
    vec4 mk = texture2D(uMask, p + vec2(cos(an), sin(an)) * o);
    acc += mk.r * mk.a;
  }
  float edge = smoothstep(0.35, 0.95, (acc / 8.0 + m0.r * m0.a) * 0.5);
  vec4 c = texture2D(uMotif, vUv);
  float fade = smoothstep(0.08, 0.45, vFacing); // fold behind the limb
  float a = c.a * fade * edge;
  if (a < 0.01) discard;
  vec3 skin = texture2D(uSkin, p).rgb;
  vec3 mul = skin * c.rgb;                      // multiply (black ink)
  vec3 ovl = mix(2.0 * skin * c.rgb, 1.0 - 2.0 * (1.0 - skin) * (1.0 - c.rgb), step(0.5, skin));
  gl_FragColor = vec4(mix(mul, ovl, uColorMix), a);
}`;

const ARM_SEGS: [number, number][] = [[11, 13], [13, 15], [12, 14], [14, 16]];

export type MpControls = { scale: number; rotation: number; along: number; around: number };

export type MpProjection = {
  update: (f: MpFrame) => void;
  setDebug: (on: boolean) => void;
  setMotif: (src: string) => void;
  curvatureScore: () => number;
  setControls: (c: Partial<MpControls>) => void;
  controls: () => MpControls;
  frame: () => { ux: number; uy: number; len: number; halfW: number; thetaMax: number };
  dispose: () => void;
};

export function createMpProjection(scene: THREE.Scene, initialSrc: string, video: HTMLVideoElement): MpProjection {
  const skinTex = new THREE.VideoTexture(video);
  skinTex.colorSpace = THREE.SRGBColorSpace;
  const ctl: MpControls = { scale: 1, rotation: 0, along: 0, around: 0 };
  const geo = { ux: 0, uy: 1, len: 1, halfW: 1, thetaMax: 0.05 };
  const maskCanvas = document.createElement("canvas");
  const mctx = maskCanvas.getContext("2d", { willReadFrequently: true })!;
  const maskTex = new THREE.CanvasTexture(maskCanvas);
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin("anonymous");
  let motifTex: THREE.Texture = new THREE.Texture();
  let motifAspect = 1;
  const loadMotif = (src: string) => {
    loader.load(src, (raw) => {
      const img = raw.image as HTMLImageElement;
      motifAspect = img.height / img.width || 1;
      let tex: THREE.Texture = raw; let colorMix = 0;
      try {
        // ink dispersion: 0.5px blur
        const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
        const cx = cv.getContext("2d", { willReadFrequently: true })!;
        cx.filter = "blur(0.5px)"; cx.drawImage(img, 0, 0);
        // colourfulness: mean saturation of opaque pixels (downsampled)
        const sc = document.createElement("canvas"); sc.width = 64; sc.height = Math.max(1, Math.round(64 * motifAspect));
        const sctx = sc.getContext("2d", { willReadFrequently: true })!; sctx.drawImage(img, 0, 0, sc.width, sc.height);
        const d = sctx.getImageData(0, 0, sc.width, sc.height).data;
        let sum = 0, n = 0;
        for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128) { sum += (Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2])) / 255; n++; }
        colorMix = n && sum / n > 0.15 ? 0.5 : 0;
        tex = new THREE.CanvasTexture(cv);
      } catch { /* cross-origin image: keep unblurred, treat as black ink */ }
      tex.colorSpace = THREE.SRGBColorSpace;
      const old = motifTex; motifTex = tex; old.dispose();
      decalMat.uniforms.uMotif.value = tex; decalMat.uniforms.uColorMix.value = colorMix;
    });
  };

  const decalMat = new THREE.ShaderMaterial({
    uniforms: { uMotif: { value: motifTex }, uMask: { value: maskTex }, uSkin: { value: skinTex }, uColorMix: { value: 0 }, uRes: { value: new THREE.Vector2(1, 1) } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthTest: false, side: THREE.DoubleSide,
  });
  const surfMat = new THREE.MeshBasicMaterial({ color: 0x8a5bf2, wireframe: true, transparent: true, opacity: 0.25 });
  surfMat.visible = false;
  const surface = new THREE.Mesh(new THREE.BufferGeometry(), surfMat);
  const decal = new THREE.Mesh(new THREE.BufferGeometry(), decalMat);
  decal.renderOrder = 2;
  scene.add(surface, decal);
  loadMotif(initialSrc);

  const f = { ax: new OneEuro(), ay: new OneEuro(), bx: new OneEuro(), by: new OneEuro(), w: new OneEuro(0.5, 0.005), s: new OneEuro(0.3, 0.001), dw: new OneEuro(0.5, 0.005), ang: new OneEuro(0.8, 0.01) };
  let lastAng: number | null = null;
  let score = 0;

  const vis = (l?: MpLandmark) => l?.visibility ?? 0;
  const maskAt = (x: number, y: number, sx: number) => {
    const px = Math.round(x * sx), py = Math.round(y * sx);
    if (px < 0 || py < 0 || px >= maskCanvas.width || py >= maskCanvas.height) return false;
    const d = mctx.getImageData(px, py, 1, 1).data;
    return (d[0] / 255) * (d[3] / 255) > 0.5;
  };

  function update(fr: MpFrame) {
    const { pose, mask, width: W, height: H } = fr;
    if (!W || !H) return;
    decalMat.uniforms.uRes.value.set(W, H);
    // mask → small canvas (texture + width measurement)
    const sx = 0.5;
    if (maskCanvas.width !== Math.round(W * sx)) { maskCanvas.width = Math.round(W * sx); maskCanvas.height = Math.round(H * sx); }
    if (mask) { mctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height); mctx.drawImage(mask, 0, 0, maskCanvas.width, maskCanvas.height); maskTex.needsUpdate = true; }
    if (!pose) return; // keep last placement

    // choose segment: best-tracked arm segment, or torso
    let best: [number, number] | null = null, bv = 0;
    for (const s of ARM_SEGS) { const v = Math.min(vis(pose[s[0]]), vis(pose[s[1]])); if (v > bv) { bv = v; best = s; } }
    let A: { x: number; y: number }, B: { x: number; y: number };
    const torsoV = Math.min(vis(pose[11]), vis(pose[12]), vis(pose[23]), vis(pose[24]));
    if (bv < 0.6 && torsoV > 0.6) {
      A = { x: (pose[11].x + pose[12].x) / 2 * W, y: (pose[11].y + pose[12].y) / 2 * H };
      B = { x: (pose[23].x + pose[24].x) / 2 * W, y: (pose[23].y + pose[24].y) / 2 * H };
    } else if (best && bv > 0.4) {
      A = { x: pose[best[0]].x * W, y: pose[best[0]].y * H };
      B = { x: pose[best[1]].x * W, y: pose[best[1]].y * H };
    } else return;
    const now = performance.now();
    A = { x: f.ax.filter(A.x, now), y: f.ay.filter(A.y, now) };
    B = { x: f.bx.filter(B.x, now), y: f.by.filter(B.y, now) };

    const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy);
    if (len < 20) return;
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    // body width across the segment midpoint, from the segmentation mask
    let l = 0, r = 0; const step = 3, maxR = len * 1.5;
    while (l < maxR && maskAt(mx - nx * l, my - ny * l, sx)) l += step;
    while (r < maxR && maskAt(mx + nx * r, my + ny * r, sx)) r += step;
    const halfW = Math.max(f.w.filter((l + r) / 2 || len * 0.2, now), 10);
    const cx = mx + nx * (r - l) / 2, cy = my + ny * (r - l) / 2;

    // Curvature Score: narrow (arm) → 1 = wrap, wide (torso) → 0 = flat
    const ratio = (2 * halfW) / len;
    score = THREE.MathUtils.clamp(f.s.filter(1 - (ratio - 0.35) / 0.65, now), 0, 1);
    const thetaMax = THREE.MathUtils.lerp(0.05, Math.PI / 2 * 0.98, score);
    const R = halfW / Math.sin(thetaMax);

    // surface: partial cylinder in local frame (x across, y along axis, z toward camera)
    const segU = 24, segV = 8, pos: number[] = [], idx: number[] = [];
    for (let j = 0; j <= segV; j++) {
      const y = -len / 2 + (len * j) / segV;
      for (let i = 0; i <= segU; i++) {
        const th = -thetaMax + (2 * thetaMax * i) / segU;
        pos.push(R * Math.sin(th), y, R * Math.cos(th) - R);
      }
    }
    for (let j = 0; j < segV; j++) for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i, b = a + segU + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    surface.geometry.dispose(); surface.geometry = g;
    const angle = Math.atan2(uy, ux) - Math.PI / 2;
    surface.position.set(cx, cy, 0);
    surface.rotation.set(0, 0, angle);
    surface.updateMatrixWorld(true);

    Object.assign(geo, { ux, uy, len, halfW, thetaMax });
    // decal projector moved in 3D relative to the body surface (controls)
    const phi = THREE.MathUtils.clamp(ctl.around, -1, 1) * thetaMax;
    const local = new THREE.Vector3(R * Math.sin(phi), THREE.MathUtils.clamp(ctl.along, -0.5, 0.5) * len, R * Math.cos(phi) - R);
    const at = surface.localToWorld(local.clone());
    let a0 = angle; if (lastAng !== null) a0 = lastAng + Math.atan2(Math.sin(angle - lastAng), Math.cos(angle - lastAng));
    const sAng = f.ang.filter(a0, now); lastAng = sAng;
    const rot = new THREE.Matrix4().makeRotationZ(sAng).multiply(new THREE.Matrix4().makeRotationY(phi)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI + ctl.rotation));
    const dw = f.dw.filter(Math.min(len * 0.55, halfW * 2 * 1.6), now) * ctl.scale;
    const dg = new DecalGeometry(surface, at, new THREE.Euler().setFromRotationMatrix(rot), new THREE.Vector3(dw, dw * motifAspect, R * 2 + 20));
    decal.geometry.dispose(); decal.geometry = dg;
  }

  return {
    update,
    setDebug: (on) => { surfMat.visible = on; },
    setMotif: loadMotif,
    setControls: (c) => { Object.assign(ctl, c); ctl.scale = THREE.MathUtils.clamp(ctl.scale, 0.2, 4); ctl.along = THREE.MathUtils.clamp(ctl.along, -0.5, 0.5); ctl.around = THREE.MathUtils.clamp(ctl.around, -1, 1); },
    controls: () => ({ ...ctl }),
    frame: () => ({ ...geo }),
    curvatureScore: () => score,
    dispose: () => { scene.remove(surface, decal); surface.geometry.dispose(); decal.geometry.dispose(); surfMat.dispose(); decalMat.dispose(); maskTex.dispose(); motifTex.dispose(); skinTex.dispose(); },
  };
}
