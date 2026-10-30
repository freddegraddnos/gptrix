import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CreditCard,
  Loader2,
  MapPin,
  Ruler,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { computeLimbCenterline } from "@/lib/limbCenterline";
import { applyCylindricalUv } from "@/lib/limbCylindricalUv";
import { cn } from "@/lib/utils";
import { tx, useUiLang } from "@/lib/uiLang";

export type ScanAnnotation = {
  id: string;
  body: string;
  authorName?: string | null;
  x: number;
  y: number;
  z: number;
  createdAt?: string;
};

export type Model3DViewerProps = {
  /** Signed URL to the .glb file. Null while processing is in progress. */
  modelUrl: string | null;
  /** cm per model unit. Null = no calibration available. */
  scaleFactor?: number | null;
  calibrated?: boolean;
  /** true while process-3d-scan is working. */
  processing?: boolean;
  processingLabel?: string;
  error?: string | null;
  onShare?: () => void;
  shareLabel?: string;
  sharing?: boolean;
  /** Saves a new cm-per-unit factor from the calibration guide. */
  onCalibrate?: (scaleFactor: number) => Promise<void> | void;
  /** Notes pinned to points on the model. */
  annotations?: ScanAnnotation[];
  onAddAnnotation?: (point: { x: number; y: number; z: number }, body: string) => Promise<void> | void;
  onDeleteAnnotation?: (id: string) => Promise<void> | void;
  /** Full-sleeve design wrapped onto the scan with cylindrical UVs. */
  sleeveDesignUrl?: string | null;
  className?: string;
};

type Point = { x: number; y: number; z: number };
type Mode = "none" | "measure" | "annotate";

/** Sleeve placement controls, in user units. */
type Sleeve = {
  /** Where along the arm the design starts, 0-100 %. */
  start: number;
  /** Where the seam sits, 0-360°. */
  rotation: number;
  /** How many degrees around the limb the design covers, 30-360°. */
  coverage: number;
};

const DEFAULT_SLEEVE: Sleeve = { start: 0, rotation: 0, coverage: 360 };


/** Known real-world reference objects used by the calibration guide. */
const REFERENCES = [
  { id: "card", label: "Bank card long edge", cm: 8.56 },
  { id: "card-short", label: "Bank card short edge", cm: 5.4 },
  { id: "coin10", label: "10 kr coin (diameter)", cm: 2.05 },
  { id: "a4", label: "A4 paper short edge", cm: 21 },
  { id: "custom", label: "Something else I measured", cm: 0 },
];

/**
 * Displays a .glb with Three.js GLTFLoader, touch-driven rotation/zoom, a
 * measuring tool in real cm, a guided calibration flow and pinned notes.
 */
export default function Model3DViewer({
  modelUrl,
  scaleFactor = null,
  calibrated = false,
  processing = false,
  processingLabel = "This can take a minute…",
  error = null,
  onShare,
  shareLabel = "Share with artist",
  sharing = false,
  onCalibrate,
  annotations,
  onAddAnnotation,
  onDeleteAnnotation,
  sleeveDesignUrl = null,
  className,
}: Model3DViewerProps) {
  useUiLang();
  const [retry, setRetry] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{
    dispose: () => void;
    setMode: (m: Mode) => void;
    clearPoints: () => void;
    renderAnnotations: (list: ScanAnnotation[]) => void;
    setSleeve: (s: Sleeve) => void;
    turn: (angle: number) => void;
    zoom: (factor: number) => void;
    resetView: () => void;
  } | null>(null);
  const annotationsRef = useRef<ScanAnnotation[]>(annotations ?? []);
  const pickRef = useRef<(p: Point) => void>(() => {});
  const sleeveRef = useRef<Sleeve>(DEFAULT_SLEEVE);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState<Mode>("none");
  const [points, setPoints] = useState<Point[]>([]);

  const [guideOpen, setGuideOpen] = useState(false);
  const [refId, setRefId] = useState("card");
  const [refCm, setRefCm] = useState("8.56");
  const [savingCal, setSavingCal] = useState(false);
  const [calDone, setCalDone] = useState(false);

  const [pending, setPending] = useState<Point | null>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [sleeve, setSleeve] = useState<Sleeve>(DEFAULT_SLEEVE);
  const [sleeveReady, setSleeveReady] = useState(false);
  const [sleeveError, setSleeveError] = useState<string | null>(null);

  const hasScale = calibrated && typeof scaleFactor === "number" && scaleFactor > 0;


  useEffect(() => {
    if (!modelUrl || !hostRef.current) return;
    let cancelled = false;
    let release = () => {};
    const host = hostRef.current;
    setLoading(true);
    setLoadError(null);
    setProgress(0);
    setPoints([]);
    setMode("none");

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");
      if (cancelled) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(host.clientWidth, host.clientHeight);
      host.appendChild(renderer.domElement);
      renderer.domElement.style.touchAction = "none";

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, host.clientWidth / host.clientHeight, 0.01, 5000);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x14161a, 1.6));
      const key = new THREE.DirectionalLight(0xffffff, 1.1);
      key.position.set(2, 4, 3);
      scene.add(key);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.enablePan = true;
      controls.rotateSpeed = 0.9;
      controls.zoomSpeed = 0.9;
      let raf = 0;
      let ro: ResizeObserver | undefined;
      const cleanups: Array<() => void> = [];
      release = () => {
        cancelAnimationFrame(raf);
        ro?.disconnect();
        cleanups.forEach(cleanup => cleanup());
        controls.dispose();
        scene.traverse(object => {
          const mesh = object as import("three").Mesh;
          mesh.geometry?.dispose();
          const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
          for (const material of materials) {
            for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
            material.dispose();
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
      };

      const markerGroup = new THREE.Group();
      const noteGroup = new THREE.Group();
      scene.add(markerGroup);
      scene.add(noteGroup);
      let lineObj: import("three").Line | null = null;

      const loader = new GLTFLoader();
      let modelRoot: import("three").Object3D | null = null;
      let modelSize = 1;

      try {
        const gltf = await loader.loadAsync(modelUrl, (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        });
        if (cancelled) {
          gltf.scene.traverse(object => {
            const mesh = object as import("three").Mesh;
            mesh.geometry?.dispose();
            const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
            for (const material of materials) {
              for (const value of Object.values(material)) if (value instanceof THREE.Texture) value.dispose();
              material.dispose();
            }
          });
          return;
        }
        modelRoot = gltf.scene;
        scene.add(modelRoot);

        const box = new THREE.Box3().setFromObject(modelRoot);
        if (box.isEmpty()) throw new Error("Empty model");
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        modelSize = Math.max(size.x, size.y, size.z) || 1;
        controls.target.copy(center);
        camera.position.set(center.x, center.y + modelSize * 0.2, center.z + modelSize * 2.1);
        camera.near = modelSize / 500;
        camera.far = modelSize * 100;
        camera.updateProjectionMatrix();
        controls.update();
        setLoading(false);
      } catch (e) {
        console.error("glb load failed", e);
        if (!cancelled) {
          setLoading(false);
          setLoadError("The 3D model could not be loaded. Try opening the link again.");
        }
        release();
        return;
      }

      const initialPosition = camera.position.clone();
      const initialTarget = controls.target.clone();

      /* --- Full-sleeve design wrapped with cylindrical UVs --- */
      let sleeveTexture: import("three").Texture | null = null;
      const applySleeveUniforms = (s: Sleeve) => {
        if (!sleeveTexture) return;
        const coverage = Math.min(360, Math.max(30, s.coverage));
        const repeatU = 360 / coverage;
        sleeveTexture.repeat.set(repeatU, 1);
        sleeveTexture.offset.set(-((s.rotation % 360) / 360) * repeatU, -s.start / 100);
        sleeveTexture.needsUpdate = true;
      };

      if (sleeveDesignUrl && modelRoot) {
        try {
          const meshes: import("three").Mesh[] = [];
          modelRoot.traverse((o) => {
            const m = o as import("three").Mesh;
            if (m.isMesh && m.geometry) meshes.push(m);
          });
          let mapped = 0;
          for (const mesh of meshes) {
            const centerline = computeLimbCenterline(mesh.geometry);
            if (!centerline) continue;
            if (applyCylindricalUv(mesh.geometry, centerline) === null) continue;
            mapped += 1;
          }
          if (mapped === 0) throw new Error("no centerline");

          const texture = await new THREE.TextureLoader().loadAsync(sleeveDesignUrl);
          if (cancelled) {
            texture.dispose();
            return;
          }
          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
          sleeveTexture = texture;
          for (const mesh of meshes) {
            const material = new THREE.MeshStandardMaterial({
              map: texture,
              roughness: 0.75,
              metalness: 0,
            });
            mesh.material = material;
          }
          applySleeveUniforms(sleeveRef.current);
          setSleeveReady(true);
          setSleeveError(null);
        } catch (e) {
          console.error("sleeve texture failed", e);
          if (!cancelled) {
            setSleeveReady(false);
            setSleeveError("The design could not be wrapped onto this scan.");
          }
        }
      }

      /* --- Picking: measuring tool and note pins --- */
      const raycaster = new THREE.Raycaster();

      const pointer = new THREE.Vector2();
      const picked: import("three").Vector3[] = [];
      let currentMode: Mode = "none";
      let downAt = { x: 0, y: 0, t: 0 };

      const addMarker = (p: import("three").Vector3) => {
        const dot = new THREE.Mesh(
          new THREE.SphereGeometry(modelSize * 0.012, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0x8a5bf2 }),
        );
        dot.position.copy(p);
        markerGroup.add(dot);
      };

      const clearMarkers = () => {
        picked.length = 0;
        markerGroup.clear();
        if (lineObj) {
          scene.remove(lineObj);
          lineObj = null;
        }
        setPoints([]);
      };

      const renderAnnotations = (list: ScanAnnotation[]) => {
        noteGroup.clear();
        list.forEach((a) => {
          const pin = new THREE.Mesh(
            new THREE.SphereGeometry(modelSize * 0.016, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
          );
          pin.position.set(a.x, a.y, a.z);
          noteGroup.add(pin);
        });
      };
      renderAnnotations(annotationsRef.current);

      const onPointerDown = (ev: PointerEvent) => {
        downAt = { x: ev.clientX, y: ev.clientY, t: performance.now() };
      };

      const onPointerUp = (ev: PointerEvent) => {
        if (currentMode === "none" || !modelRoot) return;
        const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y);
        if (moved > 8 || performance.now() - downAt.t > 700) return; // drag = rotation
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster.intersectObject(modelRoot, true)[0];
        if (!hit) return;

        if (currentMode === "annotate") {
          pickRef.current({ x: hit.point.x, y: hit.point.y, z: hit.point.z });
          markerGroup.clear();
          const dot = new THREE.Mesh(
            new THREE.SphereGeometry(modelSize * 0.016, 16, 16),
            new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
          );
          dot.position.copy(hit.point);
          markerGroup.add(dot);
          return;
        }

        if (picked.length >= 2) clearMarkers();
        picked.push(hit.point.clone());
        addMarker(hit.point);
        if (picked.length === 2) {
          const geom = new THREE.BufferGeometry().setFromPoints(picked);
          lineObj = new THREE.Line(geom, new THREE.LineBasicMaterial({ color: 0x8a5bf2 }));
          scene.add(lineObj);
        }
        setPoints(picked.map((p) => ({ x: p.x, y: p.y, z: p.z })));
      };

      renderer.domElement.addEventListener("pointerdown", onPointerDown);
      renderer.domElement.addEventListener("pointerup", onPointerUp);

      const onResize = () => {
        if (!host.clientWidth || !host.clientHeight) return;
        renderer.setSize(host.clientWidth, host.clientHeight);
        camera.aspect = host.clientWidth / host.clientHeight;
        camera.updateProjectionMatrix();
      };
      ro = new ResizeObserver(onResize);
      ro.observe(host);

      const tick = () => {
        controls.update();
        renderer.render(scene, camera);
        raf = requestAnimationFrame(tick);
      };
      tick();

      cleanups.push(() => {
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
      });
      apiRef.current = {
        setMode: (m: Mode) => {
          currentMode = m;
          controls.enabled = true;
        },
        clearPoints: clearMarkers,
        renderAnnotations,
        setSleeve: applySleeveUniforms,
        turn: (angle) => {
          const spherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
          spherical.theta += angle;
          camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
          controls.update();
        },
        zoom: (factor) => {
          const offset = camera.position.clone().sub(controls.target);
          offset.setLength(Math.min(modelSize * 10, Math.max(modelSize * 0.15, offset.length() * factor)));
          camera.position.copy(controls.target).add(offset);
          controls.update();
        },
        resetView: () => { camera.position.copy(initialPosition); controls.target.copy(initialTarget); controls.update(); },

        dispose: () => release(),
      };
    })().catch(() => {
      release();
      if (!cancelled) {
        setLoading(false);
        setLoadError("The 3D viewer is unavailable on this device. Try another browser or open a different model.");
      }
    });

    return () => {
      cancelled = true;
      release();
      apiRef.current = null;
    };
  }, [modelUrl, sleeveDesignUrl, retry]);

  useEffect(() => {
    sleeveRef.current = sleeve;
    apiRef.current?.setSleeve(sleeve);
  }, [sleeve]);


  useEffect(() => {
    annotationsRef.current = annotations ?? [];
    apiRef.current?.renderAnnotations(annotationsRef.current);
  }, [annotations]);

  useEffect(() => {
    pickRef.current = (p) => setPending(p);
  }, []);

  const switchMode = useCallback((next: Mode) => {
    setMode((prev) => {
      const value = prev === next ? "none" : next;
      apiRef.current?.setMode(value);
      apiRef.current?.clearPoints();
      setPending(null);
      return value;
    });
  }, []);

  const distanceUnits =
    points.length === 2
      ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y, points[0].z - points[1].z)
      : null;
  const distanceCm =
    distanceUnits !== null && hasScale ? distanceUnits * (scaleFactor as number) : null;

  const refCmValue = refId === "custom" ? Number(refCm) : (REFERENCES.find((r) => r.id === refId)?.cm ?? 0);
  const canSaveCalibration =
    !!onCalibrate && distanceUnits !== null && distanceUnits > 0 && refCmValue > 0;

  const saveCalibration = async () => {
    if (!canSaveCalibration || distanceUnits === null) return;
    setSavingCal(true);
    try {
      await onCalibrate!(refCmValue / distanceUnits);
      setCalDone(true);
      setTimeout(() => setCalDone(false), 2500);
      setGuideOpen(false);
      switchMode("none");
    } finally {
      setSavingCal(false);
    }
  };

  const saveNote = async () => {
    if (!onAddAnnotation || !pending || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await onAddAnnotation(pending, noteText.trim());
      setNoteText("");
      setPending(null);
      apiRef.current?.clearPoints();
    } finally {
      setSavingNote(false);
    }
  };

  const notes = annotations ?? [];

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="relative aspect-square w-full bg-gradient-to-b from-muted/40 to-background">
        <div ref={hostRef} className="absolute inset-0" tabIndex={modelUrl && !loading && !error && !loadError ? 0 : -1}
          role="region" aria-label={tx("3D model. Use left and right arrows to rotate, plus and minus to zoom, and Home to reset.")}
          onKeyDown={event => {
            const key = event.key;
            if (!["ArrowLeft", "ArrowRight", "+", "=", "-", "Home"].includes(key)) return;
            event.preventDefault();
            if (key === "ArrowLeft" || key === "ArrowRight") apiRef.current?.turn(key === "ArrowLeft" ? -Math.PI / 12 : Math.PI / 12);
            else if (key === "Home") apiRef.current?.resetView();
            else apiRef.current?.zoom(key === "-" ? 1.2 : 1 / 1.2);
          }} />

        {processing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-medium text-foreground">Building your 3D model</p>
            <p className="max-w-xs text-sm text-muted-foreground">{processingLabel}</p>
            <div className="h-1.5 w-40 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-1/3 animate-[pulse_1.4s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          </div>
        )}

        {!processing && !modelUrl && !error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted-foreground">{tx("No 3D model is available yet.")}</div>}

        {modelUrl && loading && !processing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading model… {progress > 0 ? `${progress} %` : ""}</p>
          </div>
        )}

        {(error || loadError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center">
            <AlertTriangle className="h-7 w-7 text-destructive" />
            <p role="alert" className="text-sm text-destructive">{error ?? tx(loadError ?? "")}</p>
            {loadError && !error && <Button variant="outline" onClick={() => setRetry(value => value + 1)}>{tx("Try again")}</Button>}
          </div>
        )}

        {modelUrl && !loading && !error && !loadError && (
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/70 px-3 py-1 text-[11px] text-muted-foreground backdrop-blur">
            {mode === "annotate"
              ? "Tap a spot on the model to pin a note"
              : mode === "measure"
                ? "Tap two points to measure"
                : "Drag to rotate · pinch to zoom"}
          </p>
        )}
      </div>

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-2" aria-label={tx("Model view controls")}>
          <Button variant="outline" size="sm" disabled={!modelUrl || loading || !!error || !!loadError} onClick={() => apiRef.current?.turn(-Math.PI / 12)}>{tx("Rotate left")}</Button>
          <Button variant="outline" size="sm" disabled={!modelUrl || loading || !!error || !!loadError} onClick={() => apiRef.current?.turn(Math.PI / 12)}>{tx("Rotate right")}</Button>
          <Button variant="outline" size="sm" disabled={!modelUrl || loading || !!error || !!loadError} onClick={() => apiRef.current?.zoom(1 / 1.2)}>{tx("Zoom in")}</Button>
          <Button variant="outline" size="sm" disabled={!modelUrl || loading || !!error || !!loadError} onClick={() => apiRef.current?.zoom(1.2)}>{tx("Zoom out")}</Button>
          <Button variant="outline" size="sm" disabled={!modelUrl || loading || !!error || !!loadError} onClick={() => apiRef.current?.resetView()}>{tx("Reset view")}</Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={mode === "measure" ? "default" : "outline"}
            size="sm"
            onClick={() => switchMode("measure")}
            disabled={!modelUrl || loading || !!error || !!loadError}
          >
            <Ruler className="mr-2 h-4 w-4" />
            {mode === "measure" ? "Measuring tool on" : "Measure distance"}
          </Button>
          {onAddAnnotation && (
            <Button
              variant={mode === "annotate" ? "default" : "outline"}
              size="sm"
              onClick={() => switchMode("annotate")}
              disabled={!modelUrl || loading || !!error || !!loadError}
            >
              <MapPin className="mr-2 h-4 w-4" />
              {mode === "annotate" ? "Pinning note" : "Add note"}
            </Button>
          )}
          {mode !== "none" && points.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => apiRef.current?.clearPoints()}>
              <RotateCcw className="mr-2 h-4 w-4" /> Reset points
            </Button>
          )}
          {onCalibrate && (
            <Button
              variant={guideOpen ? "default" : hasScale ? "outline" : "secondary"}
              size="sm"
              disabled={!modelUrl || loading || !!error || !!loadError}
              onClick={() => {
                const next = !guideOpen;
                setGuideOpen(next);
                if (next) {
                  setMode("measure");
                  apiRef.current?.setMode("measure");
                  apiRef.current?.clearPoints();
                }
              }}
            >
              <CreditCard className="mr-2 h-4 w-4" />
              {hasScale ? "Recalibrate cm" : "Calibrate for cm"}
            </Button>
          )}
          {onShare && (
            <Button variant="secondary" size="sm" onClick={onShare} disabled={!modelUrl || sharing}>
              {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share2 className="mr-2 h-4 w-4" />}
              {shareLabel}
            </Button>
          )}
        </div>

        {sleeveDesignUrl && (
          <div className="space-y-4 rounded-xl border border-border bg-background/60 p-3">
            <p className="text-sm font-semibold text-foreground">Sleeve placement</p>
            {sleeveError && <p className="text-xs text-destructive">{sleeveError}</p>}
            {!sleeveError && !sleeveReady && (
              <p className="text-xs text-muted-foreground">Wrapping the design onto the scan…</p>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Start position</span>
                <span className="font-semibold text-foreground">{Math.round(sleeve.start)} %</span>
              </div>
              <Slider
                value={[sleeve.start]}
                min={0}
                max={100}
                step={1}
                aria-label="Start position along the limb"
                onValueChange={([v]) => setSleeve((s) => ({ ...s, start: v ?? 0 }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Rotation</span>
                <span className="font-semibold text-foreground">{Math.round(sleeve.rotation)}°</span>
              </div>
              <Slider
                value={[sleeve.rotation]}
                min={0}
                max={360}
                step={1}
                aria-label="Rotation around the limb"
                onValueChange={([v]) => setSleeve((s) => ({ ...s, rotation: v ?? 0 }))}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Coverage</span>
                <span className="font-semibold text-foreground">{Math.round(sleeve.coverage)}°</span>
              </div>
              <Slider
                value={[sleeve.coverage]}
                min={30}
                max={360}
                step={5}
                aria-label="Coverage around the limb in degrees"
                onValueChange={([v]) => setSleeve((s) => ({ ...s, coverage: v ?? 360 }))}
              />
            </div>
          </div>
        )}

        {calDone && (

          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <Check className="h-4 w-4" /> Calibration saved — measurements are now in real cm.
          </p>
        )}

        {onCalibrate && !hasScale && !guideOpen && (
          <p className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This scan isn't calibrated yet, so measurements have no real size. Run the calibration
            guide once and every measurement afterwards is in exact centimeters.
          </p>
        )}

        {guideOpen && onCalibrate && (
          <div className="space-y-3 rounded-xl border border-border bg-background/60 p-3">
            <p className="text-sm font-semibold text-foreground">Calibration guide</p>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className={cn(points.length > 0 && "text-foreground")}>
                <span className="font-semibold text-foreground">1.</span> Find something in the scan
                whose real size you know — a bank card lying on the skin works best.
              </li>
              <li className={cn(points.length === 2 && "text-foreground")}>
                <span className="font-semibold text-foreground">2.</span> Tap its two end points on
                the model. {points.length}/2 points picked.
              </li>
              <li>
                <span className="font-semibold text-foreground">3.</span> Tell us how long that
                distance is in real life and save.
              </li>
            </ol>

            <div className="grid gap-2 sm:grid-cols-2">
              <select
                value={refId}
                onChange={(e) => {
                  setRefId(e.target.value);
                  const ref = REFERENCES.find((r) => r.id === e.target.value);
                  if (ref && ref.cm > 0) setRefCm(String(ref.cm));
                }}
                className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                aria-label="Reference object"
              >
                {REFERENCES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0.1"
                value={refCm}
                onChange={(e) => setRefCm(e.target.value)}
                disabled={refId !== "custom"}
                placeholder="Real length in cm"
                aria-label="Real length in cm"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void saveCalibration()} disabled={!canSaveCalibration || savingCal}>
                {savingCal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                Save calibration
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setGuideOpen(false)}>
                Close
              </Button>
              {distanceUnits !== null && refCmValue > 0 && (
                <span className="text-xs text-muted-foreground">
                  1 model unit ≈ {(refCmValue / distanceUnits).toFixed(2)} cm
                </span>
              )}
            </div>
          </div>
        )}

        {mode === "measure" && !guideOpen && (
          <div className="rounded-xl border border-border bg-background/60 p-3">
            {!hasScale && (
              <p className="mb-2 flex gap-2 text-xs text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Measurements aren't calibrated for this scan – proportions are correct but absolute
                measurements are missing.
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {points.length === 0
                ? "Click two points on the model to measure."
                : points.length === 1
                  ? "Choose a second point."
                  : hasScale && distanceCm !== null
                    ? `Distance: ${distanceCm.toFixed(1)} cm`
                    : `Distance: ${distanceUnits?.toFixed(2)} units (not calibrated)`}
            </p>
          </div>
        )}

        {mode === "annotate" && onAddAnnotation && (
          <div className="space-y-2 rounded-xl border border-border bg-background/60 p-3">
            <p className="text-sm text-muted-foreground">
              {pending ? "Describe what you want to point out here." : "Tap the spot on the model you want to comment on."}
            </p>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="e.g. Place the top of the design right here, the skin curves below."
              rows={3}
              disabled={!pending}
            />
            <Button size="sm" onClick={() => void saveNote()} disabled={!pending || !noteText.trim() || savingNote}>
              {savingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MapPin className="mr-2 h-4 w-4" />}
              Save note
            </Button>
          </div>
        )}

        {notes.length > 0 && (
          <ul className="space-y-2">
            {notes.map((n, i) => (
              <li key={n.id} className="flex gap-3 rounded-xl border border-border bg-background/60 p-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-amber-500/20 text-[10px] font-bold text-amber-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {n.authorName || "Studio"}
                    {n.createdAt ? ` · ${new Date(n.createdAt).toLocaleDateString("en-US")}` : ""}
                  </p>
                </div>
                {onDeleteAnnotation && (
                  <button
                    type="button"
                    aria-label="Delete note"
                    onClick={() => void onDeleteAnnotation(n.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
