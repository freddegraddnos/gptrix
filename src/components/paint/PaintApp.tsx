import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  Circle,
  Download,
  Frame,
  Grid2x2,
  Grid3x3,
  Hexagon,
  FolderOpen,
  ImagePlus,
  Layers,
  Minus,
  Move,
  PaintBucket,
  Plus,
  Printer,
  Ruler,
  Save,
  Search,
  SlidersHorizontal,
  Square,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PaintEngine } from "@/lib/paint/engine";
import { DEFAULT_FEEL, StrokeShaper, type FeelSettings } from "@/lib/paint/feel";
import { rgbToHex } from "@/lib/paint/color";
import { pushColorHistory } from "@/lib/paint/palettes";
import { DEFAULT_GUIDES, type GuideSettings } from "@/lib/paint/guides";
import { SHAPE_LABELS, type ShapeKind } from "@/lib/paint/shapes";
import type { AdjustSettings } from "@/lib/paint/adjust";
import type { BrushPreset } from "@/lib/paint/brushLibrary";
import type { BrushId, LayerInfo, RGB } from "@/lib/paint/types";
import { DEFAULT_DPI, DEFAULT_MM_PER_PIXEL, formatMm } from "@/lib/paint/document";
import { ensureTextFontsLoaded, type TextSpec } from "@/lib/paint/text";
import { printAtActualSize, type Orientation, type PaperId } from "@/lib/paint/print";
import { WARP_GRID_MAX, WARP_GRID_MIN, type TransformMode } from "@/lib/paint/warp";
import { inkBounds, makeStencil, stencilPreview, type StencilOptions } from "@/lib/paint/stencil";
import {
  DEFAULT_LINE_VIEW,
  LINE_THICKNESS_MAX,
  LINE_THICKNESS_MIN,
  type LineViewSettings,
} from "@/lib/paint/lineView";
import {
  DEFAULT_EDGES,
  EDGE_SENSITIVITY_MAX,
  EDGE_THRESHOLD_MAX,
  EDGE_THRESHOLD_MIN,
  EDGE_SENSITIVITY_MIN,
  type EdgeSettings,
} from "@/lib/paint/edges";
import { WAND_TOLERANCE_DEFAULT, WAND_TOLERANCE_MAX, WAND_TOLERANCE_MIN } from "@/lib/paint/wand";
import { Slider } from "@/components/ui/slider";
import { AdjustPanelBody } from "./AdjustPanelBody";
import { CanvasPanelBody } from "./CanvasPanelBody";
import { GuidesPanelBody } from "./GuidesPanelBody";
import { ColorPopover } from "./ColorPopover";
import { ExportPanelBody, type ExportScope } from "./ExportPopover";
import { exportTrueScale, extensionFor, type ExportFormat } from "@/lib/paint/exportScale";

import { LayersPanel } from "./LayersPanel";
import { NewSketchDialog } from "./NewSketchDialog";
import {
  clearPaintSaveTarget,
  getPaintReturnTo,
  getPaintSaveTarget,
  takePaintPrefill,
  takePaintMotifLibraryRequest,
  takePaintStencilRequest,
  type PaintSaveTarget,
} from "@/lib/paintHandoff";
import { ExitStudioMenu } from "./ExitStudioMenu";
import { StencilMode } from "./StencilMode";
import { saveArtworkToBooking } from "@/lib/paintBookingSave";
import { saveMyMotif } from "@/lib/myMotifs";

import { OpenImageDialog, type ImagePlacement } from "./OpenImageDialog";
import { MotifLibraryDialog } from "./MotifLibraryDialog";
import { PrintPanelBody } from "./PrintPanelBody";
import { StencilPanelBody } from "./StencilPanelBody";
import { ResponsivePanel } from "./ResponsivePanel";
import type { SizeDraft } from "./SizeFields";
import { loadBodyTemplateImage, type BodyTemplate } from "@/lib/paint/bodyTemplates";
import { TextPanel } from "./TextPanel";
import { ToolRail, type Tool } from "./ToolRail";
import { MobilePaintMenu, useMobilePaintLayout } from "./MobilePaintMenu";
import { BrushPopoverBody } from "./BrushPopover";
import { useUiLang, tx } from "@/lib/uiLang";
import { ProjectsDialog } from "./ProjectsDialog";
import { useAuth } from "@/hooks/useAuth";
import { useArtistMode } from "@/hooks/useArtistMode";
import { getVersion, listProjects, saveVersion } from "@/lib/paint/projectStore";

const SELECT_TOOLS = new Set<Tool>(["lasso", "rect"]);

/** Hold the pen still at the end of a stroke this long to snap it to a shape. */
const QUICKSHAPE_HOLD_MS = 550;
/** Press and hold without drawing this long to pick the colour underneath. */
const PIPETTE_HOLD_MS = 650;
/** Movement below this (screen px) still counts as "held still". */
const HOLD_SLOP_PX = 8;
/** Two-finger twist must pass this angle before the view starts rotating. */
const ROTATE_DEADZONE_RAD = 0.12;

/** QuickShape alternatives, in the order Procreate lists them. */
const SHAPE_OPTIONS: { id: ShapeKind; icon: typeof Move }[] = [
  { id: "line", icon: Minus },
  { id: "ellipse", icon: Circle },
  { id: "rect", icon: Square },
  { id: "polygon", icon: Hexagon },
];

/** Touch is ignored this long after a stylus sample (palm rejection). */
const PEN_LOCKOUT_MS = 1500;
/** Contact wider than this is treated as a palm, never a fingertip. */
const PALM_CONTACT_PX = 40;
/** Multi-finger tap must finish inside this window to count as undo/redo. */
const TAP_MAX_MS = 320;
const TAP_SLOP_PX = 12;

/** Cursor per transform handle, so the frame reads like Procreate's. */
const HANDLE_CURSOR: Record<string, string> = {
  nw: "nwse-resize",
  se: "nwse-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  rotate: "grab",
  move: "move",
};

/** Transform sub-modes, in the order Procreate lists them. */
const TRANSFORM_MODES: { id: TransformMode; label: string; icon: typeof Move }[] = [
  { id: "affine", label: "Free", icon: Move },
  { id: "grid", label: "Warp", icon: Grid3x3 },
  { id: "perspective", label: "Perspective", icon: Frame },
];

const TRANSFORM_HINT: Record<TransformMode, string> = {
  affine: "Drag the corners to scale, the handle above to rotate",
  grid: "Drag corner, edge and midpoints to bend",
  perspective: "Drag the four corners freely",
};

interface PointerState {
  x: number;
  y: number;
}

export function PaintApp() {
  const navigate = useNavigate();
  const mobile = useMobilePaintLayout();
  useUiLang();
  const [mobilePanelHeight, setMobilePanelHeight] = useState(0);
  const [localSaveStatus, setLocalSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveRevision = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PaintEngine | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const [tool, setTool] = useState<Tool>("brush");
  const [brushId, setBrushId] = useState<BrushId>("round");
  const [size, setSize] = useState(24);
  const [opacity, setOpacity] = useState(1);
  const [color, setColor] = useState<RGB>({ r: 22, g: 24, b: 28 });
  const [feel, setFeel] = useState<FeelSettings>(DEFAULT_FEEL);
  const [guides, setGuidesState] = useState<GuideSettings>(DEFAULT_GUIDES);
  const [rotationDeg, setRotationDeg] = useState(0);
  /** Set while the last QuickShape can still be swapped for another shape. */
  const [shapeEdit, setShapeEdit] = useState<ShapeKind | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  /** Size-first setup: shown once so the sketch starts with a real mm size. */
  const [setupOpen, setSetupOpen] = useState(true);

  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [activeLayerId, setActiveLayerId] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("pdf");
  const [exportPaper, setExportPaper] = useState<PaperId>("a4");

  const [hasSelection, setHasSelection] = useState(false);
  const [transforming, setTransforming] = useState(false);
  const [transformMode, setTransformModeState] = useState<TransformMode>("affine");
  const [warpDensity, setWarpDensity] = useState<number | null>(null);
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  /** Magic wand sensitivity, plus the last tap so the slider can re-select. */
  const [wandTolerance, setWandTolerance] = useState(WAND_TOLERANCE_DEFAULT);
  const wandToleranceRef = useRef(WAND_TOLERANCE_DEFAULT);
  const wandSeed = useRef<{ x: number; y: number } | null>(null);
  const [textSpec, setTextSpec] = useState<TextSpec | null>(null);
  /** Stencil view (display only) + its thickness slider. */
  const [lineView, setLineView] = useState(false);
  const [lineViewSettings, setLineViewSettings] = useState<LineViewSettings>({
    ...DEFAULT_LINE_VIEW,
  });
  /** "Clean to lines": live edge-detection preview on a new layer. */
  const [lineArt, setLineArt] = useState(false);
  const [edgeSettings, setEdgeSettings] = useState<EdgeSettings>({ ...DEFAULT_EDGES });
  const [edgeBusy, setEdgeBusy] = useState(false);
  /** "Open image": the picked file waits until the artist chooses placement. */
  const openImageInput = useRef<HTMLInputElement>(null);
  const [pickedImage, setPickedImage] = useState<File | null>(null);
  const [motifOpen, setMotifOpen] = useState(false);
  const [stencilModeOpen, setStencilModeOpenRaw] = useState(false);
  const [stencilSeed, setStencilSeed] = useState<{ src: string; widthMm: number } | null>(null);
  // Opening Stencil maker hands the current drawing over (blank canvas → upload step).
  const setStencilModeOpen = (open: boolean) => {
    if (open) {
      const e = engineRef.current;
      try {
        setStencilSeed(e ? { src: e.toArtworkPNG(), widthMm: e.width * e.mmPerPixel } : null);
      } catch { setStencilSeed(null); }
    }
    setStencilModeOpenRaw(open);
  };
  /** Stencil maker is a studio tool; customers never see it. */
  const { user: stencilUser } = useAuth();
  const { artist: stencilStudio } = useArtistMode(stencilUser?.id);
  const isStudio = !!stencilStudio;
  /** Local sketch library: the project currently open, if any. */
  const [projectsOpen, setProjectsOpen] = useState(false);
  /** Where the back button returns to, when the studio was opened from a page. */
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled sketch");
  const [saveTarget, setSaveTarget] = useState<PaintSaveTarget | null>(null);
  const [savingToBooking, setSavingToBooking] = useState(false);

  const [doc, setDoc] = useState({
    width: 2048,
    height: 2048,
    mmPerPixel: DEFAULT_MM_PER_PIXEL,
    hasBackground: false,
    backgroundId: null as string | null,
  });

  // Live values for the pointer handlers, which live outside React's render cycle.
  const settingsRef = useRef({ tool, brushId, size, opacity, color, feel });
  settingsRef.current = { tool, brushId, size, opacity, color, feel };

  const shaper = useMemo(() => new StrokeShaper(), []);
  /** Last time a real stylus was seen — used for palm rejection. */
  const penSeenAt = useRef(0);
  /** Multi-finger tap tracking: two fingers = undo, three = redo. */
  const tap = useRef<{ start: number; maxCount: number; moved: boolean } | null>(null);
  const pointers = useRef(new Map<number, PointerState>());
  const drawingPointer = useRef<number | null>(null);
  const selectPointer = useRef<number | null>(null);
  /** Arrow tool: the pointer currently dragging a picked object. */
  const objectPointer = useRef<number | null>(null);

  const transformPointer = useRef<number | null>(null);
  const lastTransformTap = useRef(0);
  const gesture = useRef<{ dist: number; cx: number; cy: number; angle: number } | null>(null);
  /** Twist accumulated before the rotation deadzone is passed. */
  const twist = useRef(0);
  const smudgePointer = useRef<number | null>(null);
  const pipettePointer = useRef<number | null>(null);
  /** Pending QuickShape / pipette hold. */
  const holdTimer = useRef<number | null>(null);
  /** Screen distance travelled by the live stroke, for the hold heuristics. */
  const strokeMoved = useRef(0);
  const lastDocPoint = useRef<{ x: number; y: number } | null>(null);
  const spaceDown = useRef(false);
  const panPointer = useRef<number | null>(null);

  /* ------------------------------------------------------------ lifecycle */

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const engine = new PaintEngine({ width: 2048, height: 2048, historyLimit: 40 });
    engineRef.current = engine;
    engine.attachView(canvas);

    const syncState = () => {
      saveRevision.current += 1;
      setLocalSaveStatus((current) => current === "saved" ? "idle" : current);
      setLayers(engine.getLayers());
      setActiveLayerId(engine.activeLayerId);
      setCanUndo(engine.history.canUndo);
      setCanRedo(engine.history.canRedo);
      setZoom(engine.viewport.scale);
      setRotationDeg((engine.viewport.rotation * 180) / Math.PI);
      setHasSelection(engine.hasSelection);
      setTransforming(engine.transformActive);
      setTransformModeState(engine.transformMode);
      setWarpDensity(engine.warpDensity);
      setTextSpec(engine.getTextSpec());
      setLineView(engine.lineViewActive);
      setLineViewSettings({ ...engine.lineViewValues });
      setLineArt(engine.lineArtActive);
      setEdgeSettings({ ...engine.lineArtValues });
      setDoc({
        width: engine.width,
        height: engine.height,
        mmPerPixel: engine.mmPerPixel,
        hasBackground: engine.hasBackground,
        backgroundId: engine.backgroundLayerId,
      });
    };

    const unsubscribe = engine.subscribe(syncState);

    // Canvas text falls back to a system face if the web font isn't ready yet.
    void ensureTextFontsLoaded();

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      engine.resizeView(rect.width, rect.height, Math.min(2, window.devicePixelRatio || 1));
      setZoom(engine.viewport.scale);
    };
    applySize();
    syncState();

    const observer = new ResizeObserver(applySize);
    observer.observe(container);

    // React's onWheel is passive, so preventDefault there is ignored.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      engine.viewport.zoomByWheel(
        event.deltaY,
        event.deltaMode,
        event.clientX - rect.left,
        event.clientY - rect.top,
      );
      engine.invalidate();
      setZoom(engine.viewport.scale);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      observer.disconnect();
      unsubscribe();
      engine.destroy();
      engineRef.current = null;
    };
  }, []);

  /**
   * Opened from elsewhere in InkSimulator (a 3D scan, a library motif) with an
   * image to prefill. The canvas takes the image's own pixel size, and the
   * size dialog is skipped since the caller already decided the format.
   */
  /** "Create your own tattoo" enters the studio with the motif library open. */
  useEffect(() => {
    if (takePaintMotifLibraryRequest()) {
      setSetupOpen(false);
      setMotifOpen(true);
    }
    if (takePaintStencilRequest()) {
      setSetupOpen(false);
      setStencilModeOpen(true);
    }
  }, []);

  useEffect(() => {
    const prefill = takePaintPrefill();
    if (!prefill) return;
    let cancelled = false;
    setSetupOpen(false);
    if (prefill.mode === "project") {
      void (async () => {
        try {
          const file = await fetch(prefill.url).then((r) => r.json());
          const e = engineRef.current;
          if (cancelled || !e) return;
          await e.loadProject(file);
          setProjectName(prefill.name.replace(/\.inkproj\.json$/i, ""));
          setZoom(e.viewport.scale);
          toast.success("Artwork reopened with every layer intact");
        } catch {
          if (!cancelled) toast.error("Could not open the saved artwork");
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const e = engineRef.current;
      if (cancelled || !e) return;
      if (prefill.mode === "background") {
        e.setBackgroundImage(image, { name: prefill.name });
        toast.success("Sketch opened as a locked reference — draw on top of it");
      } else {
        e.setDocumentSize(image.naturalWidth, image.naturalHeight);
        e.placeImageAsLayer(image, prefill.name);
        toast.success("Design opened as an editable layer");
      }
      setZoom(e.viewport.scale);
    };
    image.onerror = () => {
      if (!cancelled) toast.error("Could not open the image in the drawing studio");
    };
    image.src = prefill.url;
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setEngineReady(engineRef.current !== null);
  }, [layers.length]);

  /* ------------------------------------------------------------- transform */

  /** Confirms an open transform and returns to the brush, Procreate-style. */
  const confirmTransform = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.transformActive) return;
    engine.commitTransform();
    setTool("brush");
  }, []);

  /** Switches between the plain box, the warp mesh and the perspective quad. */
  const changeTransformMode = useCallback((mode: TransformMode) => {
    const engine = engineRef.current;
    if (!engine?.transformActive) return;
    if (!engine.setTransformMode(mode)) {
      toast.error("Rasterize the text layer first to warp it");
      return;
    }
    setTransformModeState(engine.transformMode);
    setWarpDensity(engine.warpDensity);
  }, []);

  /** Steps the warp grid up or down a density notch, keeping the bend. */
  const changeWarpDensity = useCallback((delta: 1 | -1) => {
    const engine = engineRef.current;
    const current = engine?.warpDensity;
    if (!engine || current == null) return;
    engine.setWarpDensity(current + delta);
    setWarpDensity(engine.warpDensity);
  }, []);

  const cancelTransform = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.transformActive) return;
    engine.cancelTransform();
    setTool("brush");
  }, []);

  /** Four-finger tap: full-screen canvas, the way Procreate hides its UI. */
  const toggleFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      toast.info("Fullscreen is not supported in this browser");
    }
  }, []);

  /** Guides live on the engine (it renders them) and in state (the UI reads them). */
  const changeGuides = useCallback((patch: Partial<GuideSettings>) => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setGuides(patch);
    setGuidesState({ ...engine.guides });
  }, []);

  /** Applies a saved brush preset: shape, size, opacity and feel in one tap. */
  const applyPreset = useCallback((preset: BrushPreset) => {
    setBrushId(preset.brushId);
    setSize(preset.size);
    setOpacity(preset.opacity);
    setFeel(preset.feel);
    toast.success(`Brush: ${preset.name}`);
  }, []);

  /**
   * Edge detection runs on the main thread, so the "arbetar…" flag is painted
   * one frame before the pixels are crunched.
   */
  const runEdges = useCallback((patch: Partial<EdgeSettings>) => {
    const engine = engineRef.current;
    if (!engine) return;
    setEdgeBusy(true);
    window.setTimeout(() => {
      engine.setLineArtSettings(patch);
      setEdgeBusy(false);
    }, 16);
  }, []);

  /**
   * Toolbar action: open (or close) the line-art preview. Opening runs the
   * automatic generation straight away — the artist gets finished lines from
   * the photo without touching the slider, and can still fine-tune after.
   */
  const toggleLineArt = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (engine.lineArtActive) {
      engine.cancelLineArt();
      return;
    }
    if (!engine.canCleanToLines) {
      toast.error("Open an image first (background reference or image layer)");
      return;
    }
    setEdgeBusy(true);
    window.setTimeout(() => {
      engine.autoLineArt();
      setEdgeBusy(false);
    }, 16);
  }, []);

  /** Re-runs the automatic threshold on the current reference photo. */
  const runAutoLineArt = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    setEdgeBusy(true);
    window.setTimeout(() => {
      if (!engine.autoLineArt()) toast.error("No reference image found");
      setEdgeBusy(false);
    }, 16);
  }, []);

  // Changing tool ends the QuickShape edit window.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.clearShapeEdit();
    setShapeEdit(null);
    // The arrow tool owns the object frame: leaving the tool clears it.
    if (tool !== "select") engine.selectObject(null);
  }, [tool]);

  // Picking the transform tool lifts the selection (or the layer's artwork);
  // switching to any other tool applies whatever is open.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (tool === "transform") {
      if (!engine.transformActive && !engine.beginTransform()) {
        toast.error("Nothing to transform on the active layer");
        setTool("brush");
      }
    } else if (engine.transformActive) {
      engine.commitTransform();
    }
  }, [tool]);

  /* ------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;

      if (e.code === "Space") {
        spaceDown.current = true;
        return;
      }
      const meta = e.metaKey || e.ctrlKey;

      // While transforming, the frame owns Enter, Escape and the arrow keys.
      if (engine.transformActive) {
        if (e.key === "Enter") {
          e.preventDefault();
          confirmTransform();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          cancelTransform();
          return;
        }
        const step = e.shiftKey ? 10 : 1;
        const nudges: Record<string, [number, number]> = {
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0],
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
        };
        const nudge = nudges[e.key];
        if (nudge) {
          e.preventDefault();
          engine.nudgeTransform(nudge[0], nudge[1]);
          return;
        }
      }

      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) engine.redo();
        else engine.undo();
      }
      if (e.key.toLowerCase() === "e") setTool("eraser");
      if (e.key.toLowerCase() === "b") setTool("brush");
      if (e.key.toLowerCase() === "s") setTool("lasso");
      if (e.key.toLowerCase() === "t") setTool("transform");
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        engine.deselect();
      }
      if ((e.key === "Delete" || e.key === "Backspace") && engine.hasSelection) {
        e.preventDefault();
        engine.eraseSelection();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") spaceDown.current = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [confirmTransform, cancelTransform]);

  /* -------------------------------------------------------------- drawing */

  const toDoc = useCallback((clientX: number, clientY: number) => {
    const engine = engineRef.current!;
    const rect = canvasRef.current!.getBoundingClientRect();
    return engine.viewport.screenToDoc(clientX - rect.left, clientY - rect.top);
  }, []);

  /** Colour history is persisted, so it survives a reload like Procreate's. */
  const rememberColor = useCallback((c: RGB) => {
    pushColorHistory(c);
  }, []);

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }, []);

  /** Picks the visible colour at a document point. */
  const pickColorAt = useCallback(
    (x: number, y: number) => {
      const engine = engineRef.current;
      const picked = engine?.pickColor(x, y) ?? null;
      if (!picked) {
        toast.info("Nothing to pick here");
        return;
      }
      setColor(picked);
      rememberColor(picked);
    },
    [rememberColor],
  );

  const pinchState = () => {
    const pts = [...pointers.current.values()];
    if (pts.length < 2) return null;
    const [a, b] = pts as [PointerState, PointerState];
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
      angle: Math.atan2(b.y - a.y, b.x - a.x),
    };
  };

  /**
   * Arms the press-and-hold behaviour: a held stroke that has travelled becomes
   * a QuickShape, a held stroke that hasn't becomes the pipette.
   */
  const armHold = useCallback(() => {
    clearHold();
    const held = strokeMoved.current < HOLD_SLOP_PX;
    holdTimer.current = window.setTimeout(
      () => {
        holdTimer.current = null;
        const engine = engineRef.current;
        if (!engine || drawingPointer.current === null || !engine.isStroking) return;

        if (strokeMoved.current < HOLD_SLOP_PX) {
          // Long press: drop the dot that was just started and pick a colour.
          engine.endStroke();
          engine.undo();
          drawingPointer.current = null;
          const p = lastDocPoint.current;
          if (p) pickColorAt(p.x, p.y);
          return;
        }
        // No toast here: the shape bar appears in the same spot and is the feedback.
        engine.snapStrokeToShape();
      },
      held ? PIPETTE_HOLD_MS : QUICKSHAPE_HOLD_MS,
    );
  }, [clearHold, pickColorAt]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    if (e.pointerType === "pen") penSeenAt.current = performance.now();

    // Palm rejection: once a stylus has been used, ignore touch contacts
    // (and any unusually wide contact) so a resting hand can't paint.
    if (e.pointerType === "touch") {
      const penActive = performance.now() - penSeenAt.current < PEN_LOCKOUT_MS;
      const wide = Math.max(e.width || 0, e.height || 0) > PALM_CONTACT_PX;
      if (penActive && (wide || pointers.current.size === 0)) return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (e.pointerType === "touch") {
      const count = pointers.current.size;
      tap.current =
        count === 1
          ? { start: performance.now(), maxCount: 1, moved: false }
          : tap.current
            ? { ...tap.current, maxCount: Math.max(tap.current.maxCount, count) }
            : { start: performance.now(), maxCount: count, moved: false };
    }

    // Two fingers (or more) = navigate, never draw or select.
    if (pointers.current.size >= 2) {
      if (drawingPointer.current !== null) {
        engine.endStroke();
        drawingPointer.current = null;
      }
      if (selectPointer.current !== null) {
        engine.endSelection();
        selectPointer.current = null;
      }
      if (transformPointer.current !== null) {
        engine.transformPointerUp();
        transformPointer.current = null;
      }
      if (smudgePointer.current !== null) {
        engine.endSmudge();
        smudgePointer.current = null;
      }
      if (objectPointer.current !== null) {
        engine.endObjectDrag();
        objectPointer.current = null;
      }
      clearHold();
      gesture.current = pinchState();
      twist.current = 0;
      return;
    }

    // Middle mouse or space+drag pans on desktop.
    if (e.button === 1 || spaceDown.current) {
      panPointer.current = e.pointerId;
      return;
    }
    if (e.button !== 0 && e.pointerType === "mouse") return;

    const { x, y } = toDoc(e.clientX, e.clientY);
    const s = settingsRef.current;

    // Transform: grab a handle, double-tap inside the box to apply, or pan.
    if (engine.transformActive) {
      const handle = engine.transformPointerDown(x, y);
      if (handle) {
        const now = performance.now();
        // Double-tap-to-apply belongs to the box; in warp modes a tap always
        // means "grab this control point".
        if (
          handle === "move" &&
          engine.transformMode === "affine" &&
          now - lastTransformTap.current < 320
        ) {
          lastTransformTap.current = 0;
          engine.transformPointerUp();
          confirmTransform();
          return;
        }
        lastTransformTap.current = now;
        transformPointer.current = e.pointerId;
        return;
      }
      panPointer.current = e.pointerId;
      return;
    }

    // Arrow tool: pick an object (text layer / imported image) and drag it.
    if (s.tool === "select") {
      const hit = engine.objectAt(x, y);
      engine.selectObject(hit);
      if (hit && engine.beginObjectDrag(x, y)) objectPointer.current = e.pointerId;
      return;
    }

    // Trollstav: one tap selects the connected similar-coloured area.
    if (s.tool === "wand") {
      wandSeed.current = { x, y };
      if (!engine.magicWandSelect(x, y, wandToleranceRef.current)) {
        toast.info("Nothing to select there — try a higher threshold");
      }
      return;
    }

    if (SELECT_TOOLS.has(s.tool)) {
      selectPointer.current = e.pointerId;
      engine.beginSelection(s.tool === "rect" ? "rect" : "lasso", x, y);
      return;
    }

    // Pipette: tap (or drag) picks the colour under the pointer.
    if (s.tool === "pipette") {
      pickColorAt(x, y);
      selectPointer.current = null;
      drawingPointer.current = null;
      pipettePointer.current = e.pointerId;
      return;
    }

    // Smudge: pushes existing pixels around, one undo step per drag.
    if (s.tool === "smudge") {
      if (engine.beginSmudge(x, y, s.size, s.opacity)) smudgePointer.current = e.pointerId;
      else toast.info("Smudge only works on an unlocked pixel layer");
      return;
    }

    // Text: a tap drops an editable text layer where the user tapped.
    if (s.tool === "text") {
      engine.addTextLayer({ cx: x, cy: y }, s.color);
      setTool("brush");
      return;
    }

    // Text layers stay editable, so brush strokes would silently do nothing.
    if (engine.activeLayerIsText) {
      toast.info("The text layer is editable", {
        description: "Rasterize it in the text panel if you want to paint on it.",
      });
      return;
    }

    const first = shaper.begin(
      e.clientX,
      e.clientY,
      x,
      y,
      e.pressure,
      e.pointerType,
      s.feel,
      s.size,
    );

    // A new stroke ends the chance to re-shape the previous QuickShape.
    if (shapeEdit) {
      engine.clearShapeEdit();
      setShapeEdit(null);
    }

    drawingPointer.current = e.pointerId;
    strokeMoved.current = 0;
    lastDocPoint.current = { x, y };
    engine.beginStroke(
      first.x,
      first.y,
      first.pressure,
      {
        brushId: s.brushId,
        size: s.size,
        opacity: s.opacity,
        color: s.color,
        // Any brush shape can erase; the eraser tool is just erase mode.
        erase: s.tool === "eraser",
      },
      first.pressureAlpha,
    );
    armHold();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    if (!engine) return;
    const prev = pointers.current.get(e.pointerId);
    if (!prev) {
      // Hover feedback for the transform handles.
      if (engine.transformActive && e.pointerType === "mouse") {
        const { x, y } = toDoc(e.clientX, e.clientY);
        const handle = engine.transformHandleAt(x, y);
        setHoverCursor(handle ? (HANDLE_CURSOR[handle] ?? null) : null);
      } else if (hoverCursor) {
        setHoverCursor(null);
      }
      return;
    }

    if (tap.current && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) > TAP_SLOP_PX) {
      tap.current.moved = true;
    }

    // Pinch zoom + two-finger pan
    if (pointers.current.size >= 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const next = pinchState();
      const start = gesture.current;
      if (next && start) {
        const rect = canvasRef.current!.getBoundingClientRect();
        engine.viewport.panBy(next.cx - start.cx, next.cy - start.cy);
        if (start.dist > 0) {
          engine.viewport.zoomTo(
            engine.viewport.scale * (next.dist / start.dist),
            next.cx - rect.left,
            next.cy - rect.top,
          );
        }
        // Twist to rotate the view. The deadzone keeps a plain pinch from
        // nudging the canvas off-axis.
        let delta = next.angle - start.angle;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        twist.current += delta;
        if (Math.abs(twist.current) > ROTATE_DEADZONE_RAD) {
          engine.viewport.rotateBy(twist.current, next.cx - rect.left, next.cy - rect.top);
          setRotationDeg((engine.viewport.rotation * 180) / Math.PI);
          twist.current = 0;
        }
        gesture.current = next;
        engine.invalidate();
        setZoom(engine.viewport.scale);
      }
      return;
    }

    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (panPointer.current === e.pointerId) {
      engine.viewport.panBy(e.clientX - prev.x, e.clientY - prev.y);
      engine.invalidate();
      return;
    }
    if (transformPointer.current === e.pointerId) {
      const { x, y } = toDoc(e.clientX, e.clientY);
      engine.transformPointerMove(x, y, { uniform: e.shiftKey, snap: e.shiftKey });
      return;
    }
    if (objectPointer.current === e.pointerId) {
      const { x, y } = toDoc(e.clientX, e.clientY);
      engine.extendObjectDrag(x, y);
      return;
    }
    if (selectPointer.current === e.pointerId) {
      const { x, y } = toDoc(e.clientX, e.clientY);
      engine.extendSelection(x, y);
      return;
    }
    if (pipettePointer.current === e.pointerId) {
      const { x, y } = toDoc(e.clientX, e.clientY);
      const picked = engine.pickColor(x, y);
      if (picked) setColor(picked);
      return;
    }
    if (smudgePointer.current === e.pointerId) {
      const { x, y } = toDoc(e.clientX, e.clientY);
      engine.extendSmudge(x, y, e.pressure > 0 ? e.pressure : 0.5);
      return;
    }
    if (drawingPointer.current !== e.pointerId) return;

    const events =
      typeof e.nativeEvent.getCoalescedEvents === "function"
        ? e.nativeEvent.getCoalescedEvents()
        : [];
    const samples = events.length > 0 ? events : [e.nativeEvent];
    strokeMoved.current += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (!engine.shapeSnapped) armHold();
    for (const sample of samples) {
      const doc = toDoc(sample.clientX, sample.clientY);
      const shaped = shaper.move(
        sample.clientX,
        sample.clientY,
        doc.x,
        doc.y,
        sample.pressure,
        e.pointerType,
      );
      lastDocPoint.current = doc;
      for (const point of shaped) {
        engine.extendStroke(point.x, point.y, point.pressure, point.pressureAlpha);
      }
    }
  };

  const finishPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (panPointer.current === e.pointerId) panPointer.current = null;
    if (!engine) return;
    if (transformPointer.current === e.pointerId) {
      engine.transformPointerUp();
      transformPointer.current = null;
      return;
    }
    if (objectPointer.current === e.pointerId) {
      engine.endObjectDrag();
      objectPointer.current = null;
      return;
    }
    if (selectPointer.current === e.pointerId) {
      engine.endSelection();
      selectPointer.current = null;
      return;
    }
    if (pipettePointer.current === e.pointerId) {
      pipettePointer.current = null;
      rememberColor(settingsRef.current.color);
      return;
    }
    if (smudgePointer.current === e.pointerId) {
      engine.endSmudge();
      smudgePointer.current = null;
      return;
    }
    if (drawingPointer.current === e.pointerId) {
      clearHold();
      const snapped = engine.shapeSnapped;
      // Flush the stabiliser's remaining lag with fading pressure: that tail is
      // what makes the stroke end in a point instead of a blunt stop.
      for (const point of shaper.finish()) {
        engine.extendStroke(point.x, point.y, point.pressure, point.pressureAlpha);
      }
      engine.endStroke();
      drawingPointer.current = null;
      // A snapped shape stays editable for a moment, so the guess can be changed.
      setShapeEdit(snapped ? engine.lastShapeKind : null);
      if (settingsRef.current.tool !== "eraser") rememberColor(settingsRef.current.color);
    }
  };

  /** Procreate muscle memory: two-finger tap undoes, three-finger tap redoes. */
  const handleTapGesture = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const engine = engineRef.current;
    const t = tap.current;
    if (!engine || !t || e.pointerType !== "touch") return;
    if (pointers.current.size > 0) return;
    tap.current = null;
    if (t.moved || performance.now() - t.start > TAP_MAX_MS) return;
    if (t.maxCount === 2) engine.undo();
    else if (t.maxCount === 3) engine.redo();
    else if (t.maxCount >= 4) void toggleFullscreen();
  };

  const onPointerFinish = (e: React.PointerEvent<HTMLCanvasElement>) => {
    finishPointer(e);
    handleTapGesture(e);
  };

  /* --------------------------------------------------------------- actions */

  const engine = engineRef.current;

  const download = (dataUrl: string, name: string) => {
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = name;
    link.click();
  };

  /**
   * Export at exact physical scale. PNG and JPEG carry the document's real dpi,
   * PDF places the artwork in a millimetre box on the chosen sheet.
   */
  const runExport = (scope: ExportScope) => {
    const e = engineRef.current;
    if (!e) return;
    const stamp = Date.now();
    let canvas: HTMLCanvasElement | null = null;
    let name = "ritning";
    let transparent = true;

    if (scope === "full") {
      canvas = e.renderFlattened({ includeBackground: false, matte: "#ffffff" });
      transparent = false;
    } else if (scope === "artwork") {
      canvas = e.renderFlattened({ includeBackground: false });
      name = "konstverk";
    } else {
      if (e.lineLayerCount === 0) {
        toast.error("Mark at least one layer as a line layer first.");
        return;
      }
      canvas = e.toLineStencilCanvas(2);
      name = "stencil-linjer";
      transparent = false;
    }
    if (!canvas) return;

    const { widthMm, heightMm } = e.physical;
    const result = exportTrueScale({
      canvas,
      widthMm,
      heightMm,
      format: exportFormat,
      paper: exportPaper,
      transparent,
      filename: `${name}-${stamp}.${extensionFor(exportFormat)}`,
      title: "Tattoo sketch",
    });
    if (!result.ok) {
      toast.error("Export failed — try again.");
      return;
    }
    toast.success(
      exportFormat === "pdf"
        ? `PDF exported at 1:1 on ${exportPaper.toUpperCase()}${result.fits === false ? " — larger than the sheet, parts may be cropped" : ""}`
        : `${exportFormat.toUpperCase()} exported at 1:1 (${Math.round(result.dpi)} dpi)`,
    );
  };

  const handlePrint = (paper: PaperId, orientation: Orientation) => {
    const e = engineRef.current;
    if (!e) return;
    const canvas = e.renderFlattened({
      includeBackground: false,
      // Paper is already white; a matte would only kill the transparency.
      matte: null,
    });
    const { widthMm, heightMm } = e.physical;
    const ok = printAtActualSize({
      dataUrl: canvas.toDataURL("image/png"),
      widthMm,
      heightMm,
      paper,
      orientation,
      title: "Tattoo sketch",
    });
    if (!ok) toast.error("The print window was blocked — allow pop-ups.");
  };

  /* ------------------------------------------------------------- stencil */

  /** Stencils always come from the artwork alone — never the reference photo. */
  const buildStencil = (options: StencilOptions) => {
    const e = engineRef.current;
    if (!e) return null;
    const art = e.renderFlattened({ includeBackground: false, matte: null });
    return makeStencil(art, options);
  };

  const handleStencilPreview = (options: StencilOptions) => {
    const e = engineRef.current;
    const stencil = buildStencil(options);
    if (!e || !stencil) return null;
    const bounds = inkBounds(stencil, options);
    const mm = e.mmPerPixel;
    return {
      url: stencilPreview(stencil),
      inkWidthMm: bounds ? bounds.width * mm : null,
      inkHeightMm: bounds ? bounds.height * mm : null,
    };
  };

  const handleStencilPrint = (options: StencilOptions, paper: PaperId) => {
    const e = engineRef.current;
    const stencil = buildStencil(options);
    if (!e || !stencil) return;
    // mm straight from the document scale: one document pixel = mmPerPixel mm,
    // so the printed stencil measures exactly like the sketch.
    const mm = e.mmPerPixel;
    const ok = printAtActualSize({
      dataUrl: stencil.toDataURL("image/png"),
      widthMm: stencil.width * mm,
      heightMm: stencil.height * mm,
      paper,
      orientation: "auto",
      title: "Stencil",
      showRuler: true,
    });
    if (!ok) toast.error("The print window was blocked — allow pop-ups.");
  };

  const handleStencilExport = (options: StencilOptions, format: ExportFormat, paper: PaperId) => {
    const e = engineRef.current;
    const stencil = buildStencil(options);
    if (!e || !stencil) return;
    const mm = e.mmPerPixel;
    const result = exportTrueScale({
      canvas: stencil,
      widthMm: stencil.width * mm,
      heightMm: stencil.height * mm,
      format,
      paper,
      transparent: !options.opaqueBackground,
      filename: `stencil-${Date.now()}.${extensionFor(format)}`,
      title: "Stencil",
    });
    if (result.ok) toast.success(`Stencil exported at 1:1 (${format.toUpperCase()})`);
  };

  const backgroundOpacity = layers.find((l) => l.id === doc.backgroundId)?.opacity ?? 1;

  /**
   * Imports a reference photo. Its pixel size becomes the document size, and we
   * seed the physical scale from the file's own dpi assumption (96 dpi) so the
   * artist only has to correct the width in millimetres once.
   */
  const handleImportBackground = async (file: File) => {
    const e = engineRef.current;
    if (!e) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.decoding = "sync";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not read the image"));
        image.src = url;
      });
      e.setBackgroundImage(image, { name: file.name });
      toast.success(
        `Reference imported · ${e.width} × ${e.height} px — enter the width in mm for correct scale`,
      );
    } catch {
      toast.error("Could not read the image");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  /**
   * "Open image": places a picked photo either as a new layer or as the locked
   * background reference. The document's size and mm scale stay untouched.
   */
  const placePickedImage = async (file: File, placement: ImagePlacement) => {
    const e = engineRef.current;
    if (!e) return;
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not read the image"));
        image.src = url;
      });
      if (placement === "background") {
        e.setBackgroundReference(image, file.name);
        toast.success("Image placed as background reference");
      } else {
        e.placeImageAsLayer(image, file.name);
        toast.success("Image placed as a new layer");
      }
    } catch {
      toast.error("Could not read the image");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  /**
   * Places a motif from the InkSimulator library as an editable layer so it can be
   * drawn over, recoloured and combined with text into a custom tattoo.
   */
  const placeMotif = async (motif: { src: string; name: string }) => {
    const e = engineRef.current;
    if (!e) return;
    try {
      const image = new Image();
      image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("Could not load the motif"));
        image.src = motif.src;
      });
      e.placeImageAsLayer(image, motif.name);
      toast.success(`${motif.name} added as a layer — draw, scale or add text`);
    } catch {
      toast.error("Could not load that motif");
    }
  };

  /**
   * Applies a document size stated in millimetres. The mm value is the source
   * of truth; pixels follow from the chosen print resolution.
   */
  const applyDocumentSize = (draft: SizeDraft) => {
    const e = engineRef.current;
    if (!e) return;
    e.setDocumentSizeMm(draft.widthMm, draft.heightMm, draft.dpi);
    setZoom(e.viewport.scale);
    toast.success(
      `Canvas ${Math.round(draft.widthMm)} × ${Math.round(draft.heightMm)} mm · ${e.width} × ${e.height} px`,
    );
  };

  const startNewSketch = (draft: SizeDraft) => {
    applyDocumentSize(draft);
    setSetupOpen(false);
  };

  /**
   * Body-part shortcut: sizes the canvas to that part and places its line-art
   * outline as the locked background reference to draw on top of.
   */
  const startFromTemplate = async (template: BodyTemplate) => {
    const e = engineRef.current;
    if (!e) return;
    e.setDocumentSizeMm(template.widthMm, template.heightMm, DEFAULT_DPI);
    setZoom(e.viewport.scale);
    setSetupOpen(false);
    try {
      const image = await loadBodyTemplateImage(template);
      e.setBackgroundReference(image, `${template.label} template`);
      toast.success(`${template.label} template · ${template.widthMm} × ${template.heightMm} mm`);
    } catch {
      toast.error("Could not load the template outline");
    }
  };

  /* --------------------------------------------------- save / load projects */

  /** Writes the whole document as a new version in the local sketch library. */
  const saveProjectVersion = async (name: string) => {
    const e = engineRef.current;
    if (!e) return;
    setLocalSaveStatus("saving");
    const revision = saveRevision.current;
    try {
      const saved = await saveVersion({
        projectId: projectId ?? undefined,
        name,
        thumb: e.thumbnailPNG(),
        file: e.toProject(),
        widthMm: e.width * e.mmPerPixel,
        heightMm: e.height * e.mmPerPixel,
      });
      setProjectId(saved.projectId);

      setProjectName(name.trim() || "Untitled sketch");
      setLocalSaveStatus(saveRevision.current === revision ? "saved" : "idle");
      toast.success("Version saved");
    } catch {
      setLocalSaveStatus("error");
      toast.error("The sketch could not be saved on this device");
    }
  };

  /** A booking asked for artwork; the studio can deliver straight into it. */
  useEffect(() => {
    setSaveTarget(getPaintSaveTarget());
    setReturnTo(getPaintReturnTo());
  }, []);

  /** Delivers the flattened artwork plus the full layer stack to the booking. */
  const saveToBooking = async () => {
    const e = engineRef.current;
    if (!e || !saveTarget) return;
    setSavingToBooking(true);
    try {
      const { version } = await saveArtworkToBooking({
        slotId: saveTarget.slotId,
        role: saveTarget.role,
        name: projectName,
        artworkPng: e.toArtworkPNG(),
        project: e.toProject(),
      });
      toast.success(`Delivered to the booking as v${version}`, {
        description: "Flat artwork and the editable layers are both in the timeline.",
      });
    } catch (err) {
      toast.error("Could not save to the booking", {
        description:
          err instanceof Error && err.message === "not_signed_in"
            ? "Sign in again and retry."
            : "Try again.",
      });
    } finally {
      setSavingToBooking(false);
    }
  };

  /** Keeps the flattened artwork in "My designs" so it can be reopened here. */
  const saveToMyDesigns = () => {
    const e = engineRef.current;
    if (!e) return;
    try {
      saveMyMotif({ name: projectName, src: e.toArtworkPNG(), source: "upload" });
      toast.success("Saved to My designs", {
        description: "Reopen it from the library to keep editing.",
      });
    } catch {
      toast.error("Could not save to My designs");
    }
  };

  /** Saves the sketch as a motif and opens it directly in the AR camera. */
  const tryInAr = () => {
    const e = engineRef.current;
    if (!e) return;
    try {
      const widthCm = Math.max(1, Math.round((e.width * e.mmPerPixel) / 10));
      const motif = saveMyMotif({
        name: projectName,
        src: e.toArtworkPNG(),
        widthCm,
        source: "upload",
      });
      void navigate({ to: "/ar", search: { motif: motif.id } });
    } catch {
      toast.error("Could not open the sketch in AR");
    }
  };

  /** Replaces the canvas with a saved version. */
  const loadProjectVersion = async (versionId: string) => {
    const e = engineRef.current;
    if (!e) return;
    try {
      const version = await getVersion(versionId);
      if (!version) {
        toast.error("The version could not be found");
        return;
      }
      await e.loadProject(version.file);
      setLocalSaveStatus("saved");
      setProjectId(version.projectId);
      const projects = await listProjects();
      setProjectName(projects.find((p) => p.id === version.projectId)?.name ?? "Untitled sketch");
      setSetupOpen(false);
      setZoom(e.viewport.scale);
      toast.success("Version opened");
    } catch {
      toast.error("The version could not be opened");
    }
  };

  const canvasPanelBody = (<CanvasPanelBody
                hasBackground={doc.hasBackground}
                widthPx={doc.width}
                heightPx={doc.height}
                mmPerPixel={doc.mmPerPixel}
                hasArtwork={canUndo}
                backgroundOpacity={backgroundOpacity}
                onApplySize={applyDocumentSize}
                onImport={handleImportBackground}
                onWidthMmChange={(mm) => engineRef.current?.setPhysicalWidthMm(mm)}
                onBackgroundOpacityChange={(value) => {
                  if (doc.backgroundId) engineRef.current?.setLayerOpacity(doc.backgroundId, value);
                }}
                onRemoveBackground={() => {
                  if (engineRef.current?.removeBackgroundImage())
                    toast.success("Background removed");
                }}
                onActualSize={() => {
                  engineRef.current?.viewActualSize();
                  setZoom(engineRef.current?.viewport.scale ?? 1);
                }}
              />);
  const printPanelBody = (<PrintPanelBody
                widthPx={doc.width}
                heightPx={doc.height}
                mmPerPixel={doc.mmPerPixel}
                onPrint={handlePrint}
              />);
  const stencilPanelBody = (<StencilPanelBody
                widthMm={doc.width * doc.mmPerPixel}
                heightMm={doc.height * doc.mmPerPixel}
                buildPreview={handleStencilPreview}
                onPrint={handleStencilPrint}
                onExport={handleStencilExport}
              />);
  const adjustPanelBody = (<AdjustPanelBody
                onBegin={() => engineRef.current?.beginAdjust() ?? false}
                onPreview={(settings: AdjustSettings) => engineRef.current?.previewAdjust(settings)}
                onCommit={() => {
                  if (engineRef.current?.commitAdjust()) toast.success("Adjustment applied");
                }}
                onCancel={() => engineRef.current?.cancelAdjust()}
              />);
  const guidesPanelBody = (<GuidesPanelBody
                guides={guides}
                onChange={changeGuides}
                rotationDeg={rotationDeg}
                onResetRotation={() => {
                  const engine = engineRef.current;
                  if (!engine) return;
                  engine.viewport.resetRotation();
                  engine.invalidate();
                  setRotationDeg(0);
                }}
              />);
  const exportPanelBody = (<ExportPanelBody
                widthPx={doc.width}
                heightPx={doc.height}
                widthMm={doc.width * doc.mmPerPixel}
                heightMm={doc.height * doc.mmPerPixel}
                hasBackground={doc.hasBackground}
                lineLayerCount={layers.filter((l) => l.isLine).length}
                format={exportFormat}
                paper={exportPaper}
                onFormatChange={setExportFormat}
                onPaperChange={setExportPaper}
                onExport={(scope: ExportScope) => runExport(scope)}
              />);
  const textPanel = (textSpec ? (<TextPanel
              spec={textSpec}
              mmPerPixel={doc.mmPerPixel}
              onChange={(patch) => {
                const e = engineRef.current;
                if (e) e.updateTextSpec(e.activeLayerId, patch);
              }}
              onRasterize={() => {
                const e = engineRef.current;
                if (e?.rasterizeText(e.activeLayerId)) toast.success("Text rasterized");
              }}
            />) : null);
  const layersPanel = (<LayersPanel
          open={layersOpen} embedded={mobile}
          onOpenChange={setLayersOpen}
          layers={layers}
          activeId={activeLayerId}
          onSelect={(id) => engineRef.current?.setActiveLayer(id)}
          onAdd={() => engineRef.current?.addLayer()}
          onDelete={(id) => engineRef.current?.deleteLayer(id)}
          onToggleVisible={(id, visible) => engineRef.current?.setLayerVisible(id, visible)}
          onOpacityChange={(id, value) => engineRef.current?.setLayerOpacity(id, value)}
          onReorder={(id, index) => engineRef.current?.moveLayer(id, index)}
          onBlendModeChange={(id, mode) => engineRef.current?.setLayerBlendMode(id, mode)}
          onToggleAlphaLock={(id, locked) => engineRef.current?.setLayerAlphaLock(id, locked)}
          onToggleLineLayer={(id, isLine) => engineRef.current?.setLayerIsLine(id, isLine)}
          onMergeDown={(id) => {
            engineRef.current?.mergeDown(id);
          }}
          onAddGroup={() => {
            engineRef.current?.addGroup();
          }}
          onAddAdjustment={(kind) => {
            engineRef.current?.addAdjustmentLayer(kind);
          }}
          onAdjustChange={(id, patch) => engineRef.current?.setAdjustmentSettings(id, patch)}
          onToggleClip={(id, clipped) => engineRef.current?.setLayerClipped(id, clipped)}
          onToggleExpanded={(id, expanded) => engineRef.current?.setGroupExpanded(id, expanded)}
          onUngroup={(id) => {
            engineRef.current?.ungroup(id);
          }}
          onMoveIntoGroup={(id) => {
            engineRef.current?.moveIntoGroupBelow(id);
          }}
          onMoveOutOfGroup={(id) => {
            engineRef.current?.moveOutOfGroup(id);
          }}
        />);
  const contextPanels = (<>
        {/* Editable text layer */}
        {!mobile && textSpec && !transforming && (
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
            {textPanel}
          </div>
        )}

        {/* Stencil view: thickness affects display + stencil export only */}
        {lineView && (
          <div className="absolute bottom-5 left-1/2 flex w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-panel-border bg-panel/90 p-2 shadow-panel backdrop-blur-xl animate-fade-in">
            <span className="shrink-0 px-1 text-[11px] text-muted-foreground">Line thickness</span>
            <Slider
              min={LINE_THICKNESS_MIN}
              max={LINE_THICKNESS_MAX}
              step={0.5}
              value={[lineViewSettings.thickness]}
              onValueChange={([v]) => engineRef.current?.setLineViewSettings({ thickness: v ?? 0 })}
              className="flex-1"
              aria-label="Line thickness in stencil view"
            />
            <span className="w-12 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {lineViewSettings.thickness > 0 ? "+" : ""}
              {lineViewSettings.thickness}px
            </span>
            <button
              type="button"
              aria-label="Close stencil view"
              onClick={() => engineRef.current?.setLineView(false)}
              className="flex size-9 shrink-0 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Clean to lines: live preview on a new layer, original untouched */}
        {lineArt && (
          <div className="absolute bottom-5 left-1/2 flex w-[min(92vw,28rem)] -translate-x-1/2 flex-col gap-2 rounded-2xl border border-panel-border bg-panel/90 p-3 shadow-panel backdrop-blur-xl animate-fade-in">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-foreground/80">
                Automatic lines from photo
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {edgeBusy ? "arbetar…" : `${Math.round(edgeSettings.sensitivity)}%`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 px-1 text-[11px] text-muted-foreground">Sensitivity</span>
              <Slider
                min={EDGE_SENSITIVITY_MIN}
                max={EDGE_SENSITIVITY_MAX}
                step={1}
                value={[edgeSettings.sensitivity]}
                onValueChange={([v]) => {
                  setEdgeSettings((prev) => ({ ...prev, sensitivity: v ?? prev.sensitivity }));
                  runEdges({ sensitivity: v ?? edgeSettings.sensitivity });
                }}
                className="flex-1"
                aria-label="Sensitivity for edge detection"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="shrink-0 px-1 text-[11px] text-muted-foreground">Threshold</span>
              <Slider
                min={EDGE_THRESHOLD_MIN}
                max={EDGE_THRESHOLD_MAX}
                step={1}
                value={[edgeSettings.threshold]}
                onValueChange={([v]) => {
                  setEdgeSettings((prev) => ({ ...prev, threshold: v ?? prev.threshold }));
                  runEdges({ threshold: v ?? edgeSettings.threshold });
                }}
                className="flex-1"
                aria-label="Threshold for edge detection"
              />
              <span className="w-9 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
                {Math.round(edgeSettings.threshold)}%
              </span>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={runAutoLineArt}
                aria-label="Generate lines automatically again"
                className="mr-auto flex items-center gap-1.5 rounded-xl border border-panel-border px-3 py-1.5 text-[12px] text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <Wand2 size={14} /> Auto
              </button>
              <button
                type="button"
                onClick={() => engineRef.current?.cancelLineArt()}
                className="rounded-xl px-3 py-1.5 text-[12px] text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (engineRef.current?.commitLineArt()) toast.success("Line layer created");
                }}
                className="rounded-xl bg-primary/20 px-3 py-1.5 text-[12px] text-primary transition-colors hover:bg-primary/30"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* QuickShape: change the guessed shape right after snapping */}
        {shapeEdit && !transforming && (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-panel-border bg-panel/90 p-1.5 shadow-panel backdrop-blur-xl animate-fade-in">
            <span className="px-2 text-[11px] text-muted-foreground">Shape</span>
            {SHAPE_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                aria-label={SHAPE_LABELS[o.id]}
                aria-pressed={shapeEdit === o.id}
                onClick={() => {
                  const engine = engineRef.current;
                  if (engine?.reshapeLast(o.id)) setShapeEdit(engine.lastShapeKind);
                }}
                className={`flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[11px] transition-colors ${
                  shapeEdit === o.id
                    ? "bg-primary/20 text-primary"
                    : "text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <o.icon size={14} />
                <span className="hidden sm:inline">{SHAPE_LABELS[o.id]}</span>
              </button>
            ))}
            <span className="mx-1 h-6 w-px bg-panel-border" />
            <button
              type="button"
              aria-label="Klar med formen"
              onClick={() => {
                engineRef.current?.clearShapeEdit();
                setShapeEdit(null);
              }}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-primary transition-colors hover:bg-primary/15"
            >
              <Check size={16} /> Klar
            </button>
          </div>
        )}

        {/* Trollstav: sensitivity slider (re-selects from the last tap) */}
        {tool === "wand" && (
          <div
            className={`absolute left-1/2 flex w-[min(92vw,24rem)] -translate-x-1/2 items-center gap-2 rounded-2xl border border-panel-border bg-panel/90 p-2 shadow-panel backdrop-blur-xl animate-fade-in ${
              hasSelection ? "bottom-20" : "bottom-5"
            }`}
          >
            <span className="shrink-0 px-1 text-[11px] text-muted-foreground">Threshold</span>
            <Slider
              min={WAND_TOLERANCE_MIN}
              max={WAND_TOLERANCE_MAX}
              step={1}
              value={[wandTolerance]}
              onValueChange={([v]) => {
                const next = v ?? WAND_TOLERANCE_DEFAULT;
                setWandTolerance(next);
                wandToleranceRef.current = next;
                const seed = wandSeed.current;
                if (seed) engineRef.current?.magicWandSelect(seed.x, seed.y, next);
              }}
              className="flex-1"
              aria-label="Magic wand threshold"
            />
            <span className="w-10 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {wandTolerance}%
            </span>
          </div>
        )}

        {/* Selection actions (Procreate-style contextual bar) */}
        {hasSelection && (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-panel-border bg-panel/90 p-1.5 shadow-panel backdrop-blur-xl animate-fade-in">
            <button
              type="button"
              aria-label="Fill selection"
              onClick={() => {
                if (engineRef.current?.fillSelection(color)) rememberColor(color);
              }}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <PaintBucket size={16} /> Fill
            </button>
            <button
              type="button"
              aria-label="Delete selection"
              onClick={() => engineRef.current?.eraseSelection()}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Trash2 size={16} /> Delete
            </button>
            <span className="mx-1 h-6 w-px bg-panel-border" />
            <button
              type="button"
              aria-label="Deselect"
              onClick={() => engineRef.current?.deselect()}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X size={16} /> Deselect
            </button>
          </div>
        )}

        {/* Transform actions */}
        {transforming && (
          <div className="absolute bottom-5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-panel-border bg-panel/90 p-1.5 shadow-panel backdrop-blur-xl animate-fade-in">
            <div className="flex items-center gap-0.5 rounded-xl bg-secondary/50 p-0.5">
              {TRANSFORM_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-label={m.label}
                  aria-pressed={transformMode === m.id}
                  onClick={() => changeTransformMode(m.id)}
                  className={`flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] transition-colors ${
                    transformMode === m.id
                      ? "bg-primary/20 text-primary"
                      : "text-foreground/70 hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <m.icon size={14} />
                  <span className="hidden sm:inline">{m.label}</span>
                </button>
              ))}
            </div>
            {transformMode === "grid" && warpDensity !== null && (
              <div
                className="flex items-center gap-0.5 rounded-xl bg-secondary/50 p-0.5"
                role="group"
                aria-label={`Warp density ${warpDensity}×${warpDensity}`}
              >
                <button
                  type="button"
                  aria-label="Fewer warp points"
                  disabled={warpDensity <= WARP_GRID_MIN}
                  onClick={() => changeWarpDensity(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <span className="min-w-9 text-center text-[11px] tabular-nums text-foreground/70">
                  {warpDensity}×{warpDensity}
                </span>
                <button
                  type="button"
                  aria-label="More warp points"
                  disabled={warpDensity >= WARP_GRID_MAX}
                  onClick={() => changeWarpDensity(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </div>
            )}
            <span className="hidden px-2 text-[11px] text-muted-foreground lg:inline">
              {TRANSFORM_HINT[transformMode]}
            </span>
            <span className="mx-1 h-6 w-px bg-panel-border" />
            <button
              type="button"
              aria-label="Confirm transform"
              onClick={confirmTransform}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-primary transition-colors hover:bg-primary/15"
            >
              <Check size={16} /> Confirm
            </button>
            <button
              type="button"
              aria-label="Cancel transform"
              onClick={cancelTransform}
              className="flex h-9 items-center gap-2 rounded-xl px-3 text-xs text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <X size={16} /> Cancel
            </button>
          </div>
        )}

  </>);

  return (
    <TooltipProvider delayDuration={400}>
      <div className={`relative h-[calc(100dvh-var(--studio-bar-h,0px))] w-full overflow-hidden bg-canvas-void select-none ${mobile ? "paint-mobile" : ""}`}>
        {stencilModeOpen && (
          <StencilMode
            onClose={() => setStencilModeOpen(false)}
            initialImage={stencilSeed?.src}
            initialWidthMm={stencilSeed?.widthMm}
          />
        )}
        <div ref={containerRef} className="absolute inset-0" style={mobile ? { top: 104, bottom: `calc(var(--paint-nav-h) + ${mobilePanelHeight}px)` } : undefined}>
          <canvas
            ref={canvasRef}
            className="block h-full w-full"
            style={{
              touchAction: "none",
              cursor: transforming
                ? (hoverCursor ?? "default")
                : tool === "select"
                  ? "default"
                  : tool === "eraser"
                    ? "cell"
                    : tool === "pipette"
                      ? "copy"
                      : tool === "smudge"
                        ? "grab"
                        : "crosshair",
            }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerFinish}
            onPointerCancel={onPointerFinish}
            onPointerLeave={onPointerFinish}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>

        {!mobile && contextPanels}
        {!mobile && <>
        {/* Top bar: document scale, print, export — always reachable */}
        <div className="pointer-events-none absolute top-0 right-0 left-0 flex items-start justify-between gap-1.5 p-2 pr-12 sm:gap-2 sm:p-3 sm:pr-16 lg:p-4 lg:pr-20">
          <div className="pointer-events-auto flex min-w-0 max-w-[calc(100%-3.5rem)] flex-wrap items-center gap-0.5 rounded-2xl border border-panel-border bg-panel/85 p-1 shadow-panel backdrop-blur-xl sm:gap-1 sm:p-1.5 lg:max-w-none lg:flex-nowrap">
            <ExitStudioMenu
              hasUnsavedWork={canUndo}
              returnTo={returnTo}
              bookingLabel={saveTarget?.label ?? (saveTarget ? "booking" : null)}
              onSaveToMyDesigns={saveToMyDesigns}
            />

            <span className="hidden h-6 w-px bg-panel-border lg:block" />

            <ResponsivePanel
              title="Canvas and scale"
              side="bottom"
              align="start"
              width="w-80"
              trigger={
                <button
                  type="button"
                  aria-label="Canvas size and scale"
                  className="flex h-9 min-w-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Ruler size={17} className="shrink-0" />
                  <span className="truncate font-mono text-[11px]">
                    {formatMm(doc.width * doc.mmPerPixel)} × {formatMm(doc.height * doc.mmPerPixel)}
                  </span>
                </button>
              }
            >
              {canvasPanelBody}
            </ResponsivePanel>

            <span className="hidden h-6 w-px bg-panel-border lg:block" />

            {/* Open image: mobile offers camera and photo library here */}
            <input
              ref={openImageInput}
              type="file"
              accept="image/*"
              aria-label="Choose image"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setPickedImage(file);
                event.target.value = "";
              }}
            />
            <button
              type="button"
              aria-label="Open image"
              onClick={() => openImageInput.current?.click()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ImagePlus size={17} />
              <span className="hidden text-[11px] lg:inline">Open image</span>
            </button>

            <button
              type="button"
              aria-label="Add motif from library"
              onClick={() => setMotifOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Search size={17} />
              <span className="hidden text-[11px] lg:inline">Motifs</span>
            </button>

            <span className="hidden h-6 w-px bg-panel-border lg:block" />

            {/* Sketch library: save a version, or reopen an earlier one */}
            <button
              type="button"
              aria-label="Saved sketches"
              onClick={() => setProjectsOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <FolderOpen size={17} />
              <span className="hidden text-[11px] lg:inline">Sketches</span>
            </button>

            <span className="hidden h-6 w-px bg-panel-border lg:block" />

            <button
              type="button"
              aria-label="Save to My designs"
              onClick={saveToMyDesigns}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Save size={17} />
              <span className="hidden text-[11px] lg:inline">My designs</span>
            </button>

            <button
              type="button"
              aria-label="Try this sketch in AR"
              onClick={tryInAr}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-2.5 text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Camera size={17} />
              <span className="text-[11px]">Try in AR</span>
            </button>

            {saveTarget && (
              <>
                <span className="hidden h-6 w-px bg-panel-border lg:block" />
                <button
                  type="button"
                  aria-label="Save to booking"
                  disabled={savingToBooking}
                  onClick={() => void saveToBooking()}
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-primary px-2.5 text-primary-foreground transition-opacity disabled:opacity-60"
                >
                  <Save size={17} />
                  <span className="text-[11px]">
                    {savingToBooking ? "Saving…" : "Save to booking"}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Stop saving to this booking"
                  onClick={() => {
                    clearPaintSaveTarget();
                    setSaveTarget(null);
                  }}
                  className="flex h-9 shrink-0 items-center rounded-xl px-2 text-[11px] text-foreground/60 hover:bg-accent hover:text-accent-foreground"
                  title={saveTarget.label ? `Booking · ${saveTarget.label}` : "Booking"}
                >
                  Detach
                </button>
              </>
            )}

            <span className="hidden h-6 w-px bg-panel-border lg:block" />

            <ResponsivePanel
              title="Print at 1:1 scale"
              side="bottom"
              align="start"
              width="w-72"
              trigger={
                <button
                  type="button"
                  aria-label="Print (A4 or A3)"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Printer size={17} />
                  <span className="hidden text-[11px] lg:inline">A4 / A3</span>
                </button>
              }
            >
              {printPanelBody}
            </ResponsivePanel>

            {isStudio && <button
              type="button"
              aria-label="Stencil"
              onClick={() => setStencilModeOpen(true)}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Wand2 size={17} />
              <span className="hidden text-[11px] lg:inline">Stencil</span>
            </button>}

            <ResponsivePanel
              title="Adjustments"
              side="bottom"
              align="start"
              width="w-72"
              trigger={
                <button
                  type="button"
                  aria-label="Adjustments"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <SlidersHorizontal size={17} />
                  <span className="hidden text-[11px] lg:inline">Adjust</span>
                </button>
              }
            >
              {adjustPanelBody}
            </ResponsivePanel>

            <ResponsivePanel
              title="Drawing guide"
              side="bottom"
              align="start"
              width="w-72"
              trigger={
                <button
                  type="button"
                  aria-label="Drawing guide and symmetry"
                  className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Grid2x2 size={17} />
                  <span className="hidden text-[11px] lg:inline">Guide</span>
                </button>
              }
            >
              {guidesPanelBody}
            </ResponsivePanel>

            <ResponsivePanel
              title="Export PNG"
              side="bottom"
              align="start"
              width="w-64"
              trigger={
                <button
                  type="button"
                  aria-label="Export PNG"
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl text-foreground/75 transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <Download size={17} />
                </button>
              }
            >
              {exportPanelBody}
            </ResponsivePanel>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-2 rounded-2xl border border-panel-border bg-panel/85 p-1.5 shadow-panel backdrop-blur-xl">
            <span className="hidden px-1.5 font-mono text-[11px] text-muted-foreground sm:inline">
              {Math.round(zoom * 100)}%
            </span>
            <ColorPopover
              color={color}
              onChange={(c) => {
                setColor(c);
                if (tool === "eraser") setTool("brush");
              }}
            />
            <button
              type="button"
              aria-label="Layers"
              onClick={() => setLayersOpen(true)}
              className="flex size-9 items-center justify-center rounded-xl text-foreground/70 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Layers size={19} />
            </button>
          </div>
        </div>

        {/* Right rail: tools */}
        <div className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 sm:right-4">
          <ToolRail
            lineViewActive={lineView}
            onToggleLineView={() => engineRef.current?.setLineView(!lineView)}
            canCleanToLines={doc.hasBackground}
            lineArtActive={lineArt}
            onCleanToLines={toggleLineArt}
            tool={tool}
            brushId={brushId}
            size={size}
            opacity={opacity}
            feel={feel}
            canUndo={canUndo}
            canRedo={canRedo}
            onToolChange={setTool}
            onBrushChange={setBrushId}
            onSizeChange={setSize}
            onOpacityChange={setOpacity}
            onFeelChange={(next) => setFeel((prev) => ({ ...prev, ...next }))}
            onUndo={() => engineRef.current?.undo()}
            onRedo={() => engineRef.current?.redo()}
            onFit={() => {
              engineRef.current?.fitToView();
              setZoom(engineRef.current?.viewport.scale ?? 1);
              setRotationDeg(0);
            }}
            onApplyPreset={applyPreset}
          />
        </div>

        </>}

        {!mobile && layersPanel}

        {mobile && <>
          <input ref={openImageInput} type="file" accept="image/*" aria-label="Choose image" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) setPickedImage(file); event.target.value = ""; }} />
          <MobilePaintMenu
            tool={tool} onToolChange={setTool} projectName={projectName}
            saveStatus={localSaveStatus} onSave={() => setProjectsOpen(true)}
            back={<ExitStudioMenu hasUnsavedWork={canUndo} returnTo={returnTo} bookingLabel={saveTarget?.label ?? (saveTarget ? "booking" : null)} onSaveToMyDesigns={saveToMyDesigns} />}
            canUndo={canUndo} canRedo={canRedo} onUndo={() => engineRef.current?.undo()} onRedo={() => engineRef.current?.redo()}
            onFit={() => { engineRef.current?.fitToView(); setZoom(engineRef.current?.viewport.scale ?? 1); setRotationDeg(0); }}
            onZoom={(factor) => { const e = engineRef.current; const canvas = canvasRef.current; if (!e || !canvas) return; e.viewport.zoomByWheel(factor, 0, canvas.clientWidth / 2, canvas.clientHeight / 2); e.invalidate(); setZoom(e.viewport.scale); }}
            zoom={zoom} onPanelHeight={setMobilePanelHeight}
            brush={<BrushPopoverBody brushId={brushId} size={size} opacity={opacity} feel={feel} showBrushList onBrushChange={setBrushId} onSizeChange={setSize} onOpacityChange={setOpacity} onFeelChange={(next) => setFeel((prev) => ({ ...prev, ...next }))} onApplyPreset={applyPreset} />}
            color={<ColorPopover inline color={color} onChange={(c) => { setColor(c); if (tool === "eraser") setTool("brush"); }} />}
            text={textPanel} layers={layersPanel} context={<div className="paint-mobile-context">{contextPanels}</div>}
            contextActive={hasSelection || transforming || lineArt || lineView || !!shapeEdit || tool === "wand"}
            panels={{canvas: canvasPanelBody, guides: guidesPanelBody, adjust: adjustPanelBody, stencil: stencilPanelBody, print: printPanelBody, export: exportPanelBody}}
            onImage={() => openImageInput.current?.click()} onMotif={() => setMotifOpen(true)} onTemplates={() => setSetupOpen(true)} onHistory={() => setProjectsOpen(true)}
            onStencilMode={isStudio ? () => setStencilModeOpen(true) : undefined} lineView={lineView} onLineView={() => engineRef.current?.setLineView(!lineView)} canClean={doc.hasBackground} lineArt={lineArt} onClean={toggleLineArt}
            onMyDesigns={saveToMyDesigns} onAr={tryInAr}
            onFullscreen={() => void toggleFullscreen()}
            onPan={(dx, dy) => { const e = engineRef.current; if (!e) return; e.viewport.panBy(dx, dy); e.invalidate(); }}
            onRotate={() => { const e = engineRef.current; const canvas = canvasRef.current; if (!e || !canvas) return; e.viewport.rotateBy(Math.PI / 12, canvas.clientWidth / 2, canvas.clientHeight / 2); e.invalidate(); setRotationDeg(e.viewport.rotation * 180 / Math.PI); }}
            booking={saveTarget ? { label: saveTarget.label ?? "Booking", busy: savingToBooking, onSave: () => void saveToBooking(), onDetach: () => { clearPaintSaveTarget(); setSaveTarget(null); } } : undefined}
          />
        </>}

        <NewSketchDialog
          open={setupOpen}
          onOpenChange={setSetupOpen}
          onStart={startNewSketch}
          onImport={(file) => {
            setSetupOpen(false);
            void handleImportBackground(file);
          }}
          onStartTemplate={(template) => {
            void startFromTemplate(template);
          }}
        />

        <ProjectsDialog
          open={projectsOpen}
          onOpenChange={setProjectsOpen}
          currentName={projectName}
          currentProjectId={projectId}
          onSave={saveProjectVersion}
          onLoadVersion={loadProjectVersion}
        />

        <OpenImageDialog
          open={pickedImage !== null}
          fileName={pickedImage?.name}
          onOpenChange={(open) => {
            if (!open) setPickedImage(null);
          }}
          onChoose={(placement) => {
            const file = pickedImage;
            setPickedImage(null);
            if (file) void placePickedImage(file, placement);
          }}
        />

        <MotifLibraryDialog
          open={motifOpen}
          onOpenChange={setMotifOpen}
          onPick={(motif) => {
            setMotifOpen(false);
            void placeMotif(motif);
          }}
        />

        {!engineReady && !engine && (
          <p className="absolute bottom-4 left-4 text-xs text-muted-foreground">Starting…</p>
        )}
      </div>
    </TooltipProvider>
  );
}
