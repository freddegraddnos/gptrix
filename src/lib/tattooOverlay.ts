/**
 * Three.js overlay that places the tattoo motif on top of the video canvas.
 *
 * Two modes:
 *  - "joint"   → mesh that bends with the joint angle and rotates with the limb
 *                (forearm, upper arm, calf, thigh, hand/finger, wrist)
 *  - "surface" → simpler, nearly flat surface that follows a stable
 *                reference area (shoulder, chest, back, neck, "other")
 *
 * When tracking is lost, the last known transform is frozen for 0.5 s before
 * the overlay fades out, so the motif doesn't jump.
 */
import * as THREE from "three";
import type { Placement, PlacementKind } from "@/lib/livePlacement";
import {
  radiusAt,
  radiusAtDistance,
  type LimbCylinder,
  type SegmentedLimb,
} from "@/lib/limbCylinder";

export type OverlayMode = "joint" | "surface";

export type ManualAdjust = {
  /** Multiplier on the automatic size. */
  scale: number;
  /** Extra rotation in radians. */
  rotation: number;
  /** Extra offset in pixels (canvas coordinates). */
  offsetX: number;
  offsetY: number;
};

export const DEFAULT_ADJUST: ManualAdjust = {
  scale: 1,
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
};

/** How long the last position freezes before fade-out (ms). */
export const FREEZE_MS = 500;
/** Fade-out time after the freeze (ms). */
export const FADE_MS = 350;

/** Half of the front-facing arc the decal may wrap onto (~140° total). */
const HALF_ARC_DEG = 70;
/** How much the wrap darkens toward the silhouette edges. */
const EDGE_SHADE = 0.55;

const SEG_X = 28;
const SEG_Y = 14;

const TATTOO_VERT = /* glsl */ `
  attribute vec3 color;
  varying vec2 vUv;
  varying vec3 vShade;
  varying vec2 vScreen;
  void main() {
    vUv = uv;
    vShade = color;
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    vScreen = clip.xy / clip.w * 0.5 + 0.5;
    gl_Position = clip;
  }
`;

const TATTOO_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uMap;
  uniform sampler2D uSkin;
  uniform vec3 uTint;
  uniform float uOpacity;
  uniform float uHasSkin;
  uniform float uSkinStrength;
  // Width of the wrap-out-of-view band, as a fraction of the design's width.
  uniform float uEdgeBand;
  // Simplex jitter of the ink edges, in UV units (~1-2 px on screen).
  uniform float uNoiseAmp;
  uniform float uNoiseScale;
  // Joint crease: 0 at full extension, 1 when the joint is fully bent.
  uniform float uJointBend;
  uniform float uJointBand;
  // Position of the joint seam along the design (0..1 in uv space).
  uniform float uJointCenter;
  uniform float uInkContrast;
  // Scene light grade (warm/cool), clamped close to neutral.
  uniform vec3 uGrade;
  varying vec2 vUv;
  varying vec3 vShade;
  varying vec2 vScreen;

  // Per-channel soft light with the skin luminance as the blend layer.
  float softLight(float base, float lum) {
    return lum <= 0.5
      ? base - (1.0 - 2.0 * lum) * base * (1.0 - base)
      : base + (2.0 * lum - 1.0) * (sqrt(base) - base);
  }

  // --- 2D simplex noise (Ashima / Gustavson, MIT) ------------------------
  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                            + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy),
                            dot(x12.zw, x12.zw)), 0.0);
    m = m * m; m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x  = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void main() {
    // Horizontal compression toward the silhouette: the outer band samples a
    // faster-moving UV, so the design squeezes as it wraps out of view.
    float t = vUv.x * 2.0 - 1.0;
    float at = abs(t);
    float band = max(uEdgeBand, 0.001);
    float inner = 1.0 - band;
    float over = max(at - inner, 0.0) / band;
    float squeezed = inner + band * (1.0 - pow(1.0 - over, 1.9));
    // Extra texture travel inside the band => the ink compresses there.
    float warped = mix(at, min(1.0, squeezed + over * band * 0.55), 1.0);
    vec2 uv = vec2(0.5 + sign(t) * warped * 0.5, vUv.y);

    // Joint crease: as the elbow/wrist closes, the skin gathers into the
    // fold. A narrow band centred on the joint samples the texture faster,
    // so the ink compresses into the crease. No effect at full extension.
    float creaseShade = 1.0;
    if (uJointBend > 0.001) {
      float d = uv.y - uJointCenter;
      float ad = abs(d);
      if (ad < uJointBand) {
        float k = ad / uJointBand;
        float kc = pow(k, mix(1.0, 0.5, uJointBend));
        uv.y = uJointCenter + sign(d) * kc * uJointBand;
        // The fold sits in its own shadow.
        creaseShade = 1.0 - 0.28 * uJointBend * (1.0 - k);
      }
    }

    // Tiny bleed: real linework is interrupted by skin texture, never vector
    // smooth. A low-amplitude simplex offset breaks up the hard edges.
    vec2 jitter = vec2(
      snoise(uv * uNoiseScale),
      snoise(uv * uNoiseScale + 37.7)
    ) * uNoiseAmp;
    vec4 ink = texture2D(uMap, clamp(uv + jitter, 0.0, 1.0));
    if (ink.a <= 0.003) discard;
    // Ink contrast, pivoted around mid grey: lower on darker skin so black
    // linework doesn't read harsher than it would in real life.
    vec3 rgb = mix(vec3(0.5), ink.rgb, uInkContrast) * uTint * uGrade * vShade * creaseShade;

    if (uHasSkin > 0.5) {
      // Blurred grayscale of the camera frame underneath this pixel: creases,
      // hair, veins and room shadows modulate brightness only.
      float lum = texture2D(uSkin, vec2(vScreen.x, 1.0 - vScreen.y)).r;
      vec3 shaded = vec3(
        softLight(rgb.r, lum),
        softLight(rgb.g, lum),
        softLight(rgb.b, lum)
      );
      // Multiply keeps black density honest in shadowed skin.
      shaded = mix(shaded, shaded * (0.55 + 0.45 * lum * 2.0), 0.35);
      rgb = mix(rgb, clamp(shaded, 0.0, 1.0), uSkinStrength);
    }

    // Opacity falloff over the same band, so the design turns away from the
    // camera instead of ending in a hard rectangle.
    float fade = 1.0 - smoothstep(inner, 1.0, at) * 0.9;
    // A whisper of the same noise on alpha reads as ink bleed.
    float grain = 1.0 - 0.07 * (snoise(uv * uNoiseScale * 2.0) * 0.5 + 0.5);

    gl_FragColor = vec4(rgb, ink.a * uOpacity * fade * grain);
  }
`;


export function modeForKind(kind: PlacementKind): OverlayMode {
  return kind === "surface" || kind === "free" ? "surface" : "joint";
}

export class TattooOverlay {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.OrthographicCamera(0, 1, 0, 1, -100, 100);
  private geometry = new THREE.PlaneGeometry(1, 1, SEG_X, SEG_Y);
  private basePos: Float32Array;
  private material: THREE.ShaderMaterial;
  private skinTexture: THREE.CanvasTexture | null = null;
  private mesh: THREE.Mesh;
  private texture: THREE.Texture | null = null;
  private aspect = 1;

  private mode: OverlayMode = "joint";
  private adjust: ManualAdjust = { ...DEFAULT_ADJUST };

  private last: Placement | null = null;
  private lostAt: number | null = null;
  private smooth: { x: number; y: number; rot: number; span: number } | null =
    null;
  private bend = 180;
  /** Tapered-cylinder model of the limb, refreshed every frame. */
  private cylinder: LimbCylinder | null = null;
  private smoothRadii: number[] | null = null;
  /** Chain of per-segment cylinders when the design crosses a joint. */
  private segments: SegmentedLimb | null = null;
  /** Where the design's centre sits along that chain, in pixels. */
  private segCenter = 0;
  private realismOpacity = 0.92;
  private multiply = false;


  constructor(
    canvas: HTMLCanvasElement,
    opts: { preserveDrawingBuffer?: boolean } = {},
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    });

    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(1);

    this.basePos = Float32Array.from(
      this.geometry.getAttribute("position").array as Float32Array,
    );

    // Vertex colours carry the wrap shading (darker toward the silhouette).
    const count = this.geometry.getAttribute("position").count;
    this.geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3),
    );

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uMap: { value: null },
        uTint: { value: new THREE.Color(0xffffff) },
        uOpacity: { value: 0 },
        uSkin: { value: null },
        uHasSkin: { value: 0 },
        uSkinStrength: { value: 0.85 },
        uEdgeBand: { value: 0.17 },
        uNoiseAmp: { value: 0.0015 },
        uNoiseScale: { value: 260 },
        uJointBend: { value: 0 },
        uJointBand: { value: 0.18 },
        uJointCenter: { value: 0.5 },
        uInkContrast: { value: 1 },
        uGrade: { value: new THREE.Vector3(1, 1, 1) },
      },
      vertexShader: TATTOO_VERT,
      fragmentShader: TATTOO_FRAG,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }


  setSize(width: number, height: number) {
    this.renderer.setSize(width, height, false);
    this.camera.left = -width / 2;
    this.camera.right = width / 2;
    this.camera.top = height / 2;
    this.camera.bottom = -height / 2;
    this.camera.updateProjectionMatrix();
  }

  setMode(mode: OverlayMode) {
    this.mode = mode;
  }

  /**
   * Feeds the per-frame limb measurement. Radii are in canvas pixels and run
   * from the start of the placement axis to its end, so the mesh can taper.
   */
  setCylinder(cyl: LimbCylinder | null, frozen = false) {
    if (!cyl) {
      this.cylinder = null;
      this.smoothRadii = null;
      return;
    }
    if (frozen && this.smoothRadii) {
      this.cylinder = { radii: this.smoothRadii, measured: cyl.measured };
      return;
    }
    if (!this.smoothRadii || this.smoothRadii.length !== cyl.radii.length) {
      this.smoothRadii = [...cyl.radii];
    } else {
      const k = 0.3;
      this.smoothRadii = this.smoothRadii.map(
        (r, i) => r + (cyl.radii[i] - r) * k,
      );
    }
    this.cylinder = { radii: this.smoothRadii, measured: cyl.measured };
  }

  /**
   * Feeds a multi-segment fit (e.g. upper arm + forearm) for designs that span
   * more than one limb segment. `centerOffsetPx` is where the motif's centre
   * falls along the chain, measured from its start.
   */
  setSegments(seg: SegmentedLimb | null, centerOffsetPx = 0) {
    this.segments = seg;
    this.segCenter = centerOffsetPx;
  }

  setAdjust(adjust: ManualAdjust) {
    this.adjust = adjust;
  }

  async setTexture(url: string): Promise<void> {
    const tex = await new THREE.TextureLoader().loadAsync(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    this.texture?.dispose();
    this.texture = tex;
    this.aspect = (tex.image?.width || 1) / (tex.image?.height || 1);
    this.material.uniforms.uMap.value = tex;
    this.material.needsUpdate = true;
  }

  /**
   * Supplies the blurred grayscale luminance map of the live camera frame the
   * tattoo is blended through. Pass null to fall back to plain compositing.
   */
  setSkinLuminance(map: HTMLCanvasElement | null, strength = 0.85) {
    if (!map) {
      this.material.uniforms.uHasSkin.value = 0;
      return;
    }
    if (!this.skinTexture || this.skinTexture.image !== map) {
      this.skinTexture?.dispose();
      this.skinTexture = new THREE.CanvasTexture(map);
      this.skinTexture.colorSpace = THREE.NoColorSpace;
      this.skinTexture.minFilter = THREE.LinearFilter;
      this.skinTexture.magFilter = THREE.LinearFilter;
      this.skinTexture.wrapS = THREE.ClampToEdgeWrapping;
      this.skinTexture.wrapT = THREE.ClampToEdgeWrapping;
      this.material.uniforms.uSkin.value = this.skinTexture;
    }
    this.skinTexture.needsUpdate = true;
    this.material.uniforms.uHasSkin.value = 1;
    this.material.uniforms.uSkinStrength.value = Math.max(
      0,
      Math.min(1, strength),
    );
  }

  clearTexture() {
    this.material.uniforms.uMap.value = null;
    this.material.needsUpdate = true;
    this.mesh.visible = false;
  }

  /**
   * Realism: tint (skin tone matching), opacity (hair/age), and blend mode.
   */
  setRealism(style: {
    tint: string;
    opacity: number;
    multiply: boolean;
    contrast?: number;
    grade?: { r: number; g: number; b: number };
  }) {
    this.material.uniforms.uTint.value.set(style.tint);
    this.material.uniforms.uInkContrast.value = Math.max(
      0.82,
      Math.min(1, style.contrast ?? 1),
    );
    const g = style.grade ?? { r: 1, g: 1, b: 1 };
    const clampG = (v: number) => Math.max(0.95, Math.min(1.05, v));
    (this.material.uniforms.uGrade.value as THREE.Vector3).set(
      clampG(g.r),
      clampG(g.g),
      clampG(g.b),
    );
    this.realismOpacity = Math.max(0, Math.min(1, style.opacity));
    if (style.multiply !== this.multiply) {
      this.multiply = style.multiply;
      if (style.multiply) {
        this.material.blending = THREE.CustomBlending;
        this.material.blendSrc = THREE.DstColorFactor;
        this.material.blendDst = THREE.OneMinusSrcAlphaFactor;
      } else {
        this.material.blending = THREE.NormalBlending;
      }
      this.material.needsUpdate = true;
    }
  }

  /** Current transform in canvas pixels, e.g. for locking/saving. */
  getTransform() {
    return this.smooth ? { ...this.smooth, bend: this.bend } : null;
  }


  /**
   * Updates the overlay for a frame.
   * @param placement latest tracking result, or null when the reference is lost
   */
  update(placement: Placement | null, width: number, height: number, frozenShape = false) {
    const now = performance.now();

    if (placement) {
      this.last = placement;
      this.lostAt = null;
    } else if (this.last && this.lostAt === null) {
      this.lostAt = now;
    }

    const source = placement ?? this.last;
    if (!source || !this.material.uniforms.uMap.value) {
      this.mesh.visible = false;
      this.renderer.render(this.scene, this.camera);
      return;
    }

    // Fade-out: full opacity during the freeze, then a smooth fade-out.
    let opacity = 1;
    if (this.lostAt !== null) {
      const lost = now - this.lostAt;
      if (lost > FREEZE_MS + FADE_MS) {
        this.mesh.visible = false;
        this.renderer.render(this.scene, this.camera);
        return;
      }
      opacity = lost <= FREEZE_MS ? 1 : 1 - (lost - FREEZE_MS) / FADE_MS;
    }

    // Smooth following (freeze the last values when tracking is lost).
    const target = {
      x: source.x * width,
      y: source.y * height,
      rot: source.rotation,
      span: Math.max(source.span * width, 40),
    };
    if (!this.smooth || placement === null) {
      this.smooth = this.smooth ?? target;
    }
    if (placement) {
      const k = 0.35;
      const prev = this.smooth!;
      let d = target.rot - prev.rot;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.smooth = {
        x: prev.x + (target.x - prev.x) * k,
        y: prev.y + (target.y - prev.y) * k,
        rot: prev.rot + d * k,
        span: prev.span + (target.span - prev.span) * k,
      };
      const targetBend = source.bendDeg ?? 180;
      if (!frozenShape) this.bend += (targetBend - this.bend) * 0.25;
    }

    const s = this.smooth!;
    const widthPx =
      s.span * (this.mode === "joint" ? 0.75 : 0.55) * this.adjust.scale;
    const heightPx = widthPx / (this.aspect || 1);

    this.deform(widthPx, heightPx);

    // Ortho camera: y up, canvas y down → mirror on y.
    this.mesh.position.set(
      s.x - width / 2 + this.adjust.offsetX,
      -(s.y - height / 2) - this.adjust.offsetY,
      0,
    );
    // The motif stands upright against the limb's direction.
    const auto = this.mode === "joint" ? -(s.rot + Math.PI / 2) : -s.rot;
    this.mesh.rotation.set(0, 0, auto + this.adjust.rotation);
    this.mesh.visible = true;
    this.material.uniforms.uOpacity.value = opacity * this.realismOpacity;
    // Keep the ink jitter at ~1.5 px on screen no matter the design's size,
    // and scale the noise frequency with it so the grain stays skin-sized.
    const jitterPx = 1.5;
    this.material.uniforms.uNoiseAmp.value = Math.min(
      0.01,
      jitterPx / Math.max(widthPx, 1),
    );
    this.material.uniforms.uNoiseScale.value = Math.max(
      60,
      Math.min(600, widthPx * 1.6),
    );

    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Shapes the mesh: in joint mode it bends with the joint angle and is
   * compressed slightly across (the skin's curvature). In surface mode a
   * very subtle curvature is used.
   */
  private deform(widthPx: number, heightPx: number) {
    const attr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const colAttr = this.geometry.getAttribute("color") as THREE.BufferAttribute;
    const col = colAttr.array as Float32Array;

    // Bend strength: 180° = straight limb, smaller angle = stronger bend.
    const bendAmount =
      this.mode === "joint"
        ? Math.min(1, Math.max(0, (180 - this.bend) / 110))
        : 0.12;

    // Multi-segment fit: find the joint seam the design actually crosses and
    // express it in the mesh's own coordinates (-0.5 .. 0.5 along the design).
    const seg = this.mode === "joint" ? this.segments : null;
    let seamV: number | null = null;
    if (seg && seg.seams.length && heightPx > 1) {
      for (const seam of seg.seams) {
        const sv = (seam - this.segCenter) / heightPx;
        if (Math.abs(sv) < 0.42 && (seamV === null || Math.abs(sv) < Math.abs(seamV))) {
          seamV = sv;
        }
      }
    }
    // Blend zone across the seam: it widens as the joint closes, so the two
    // segments' wraps merge instead of breaking at the crease.
    const blendPx = heightPx * (0.06 + 0.14 * bendAmount);

    // Feed the crease UV compression only when the placement actually
    // crosses a joint; at full extension this is 0 and has no effect.
    this.material.uniforms.uJointBend.value =
      this.mode === "joint" ? bendAmount : 0;
    this.material.uniforms.uJointCenter.value = 0.5 + (seamV ?? 0);

    const cyl = this.cylinder;
    // Front-facing arc of the cylinder that the decal may occupy.
    const maxTheta = (HALF_ARC_DEG * Math.PI) / 180;

    for (let i = 0, c = 0; i < this.basePos.length; i += 3, c += 3) {
      const u = this.basePos[i]; // -0.5..0.5 (across the limb)
      const v = this.basePos[i + 1]; // -0.5..0.5 (along the limb)

      // Distance from the joint seam (the design's centre when there is none).
      const vc = v - (seamV ?? 0);
      // Arc shape along the limb (joint bend).
      const arc = bendAmount * (0.5 - vc * vc * 2) * 0.5;
      const crease = Math.exp(-(vc * vc) / 0.045);
      const squeeze = 1 - bendAmount * 0.28 * crease;
      const bulge = 1 + bendAmount * 0.12 * crease;

      let x: number;
      let shade = 1;

      if (seg) {
        // One tapered cylinder per limb segment, cross-faded at the seam so
        // radius — and the shading derived from it — stays continuous.
        const r = radiusAtDistance(seg, this.segCenter + v * heightPx, blendPx);
        // Wrap the design around the surface: the arc length it covers is its
        // real width, so the angle it spans depends on how thick the limb is.
        const theta = Math.max(
          -maxTheta,
          Math.min(maxTheta, (u * widthPx) / r),
        );
        // Orthographic projection of the surface point → horizontal
        // compression that grows toward the edges of a rounded limb.
        x = r * Math.sin(theta) * bulge;
        // Lambert-ish falloff around the cylinder, so edges darken like a
        // real decal curving away from the viewer.
        shade = 1 - (1 - Math.cos(theta)) * EDGE_SHADE;
      } else if (cyl) {
        // Single tapered cylinder: the radius at this height along the axis.
        // v = -0.5 is the axis start, v = +0.5 its end.
        const r = Math.max(1, radiusAt(cyl, v + 0.5));
        const theta = Math.max(
          -maxTheta,
          Math.min(maxTheta, (u * widthPx) / r),
        );
        x = r * Math.sin(theta) * bulge;
        shade = 1 - (1 - Math.cos(theta)) * EDGE_SHADE;
      } else {
        // No measurement (flat surface placement): keep the subtle rounding.
        const round = 1 - Math.pow(Math.abs(u) * 2, 2) * 0.18;
        x = u * widthPx * round * bulge;
        shade = 1 - Math.pow(Math.abs(u) * 2, 2) * 0.08;
      }

      arr[i] = x;
      arr[i + 1] =
        ((seamV ?? 0) + vc * squeeze + arc * Math.sign(vc || 1) * 0.35) *
        heightPx;
      arr[i + 2] = 0;

      col[c] = shade;
      col[c + 1] = shade;
      col[c + 2] = shade;
    }
    attr.needsUpdate = true;
    colAttr.needsUpdate = true;
  }

  dispose() {
    this.texture?.dispose();
    this.geometry.dispose();
    this.skinTexture?.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
