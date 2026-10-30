import { BRUSHES } from "./brushes";
import { History } from "./history";
import { StrokeRenderer } from "./stroke";
import { Viewport } from "./viewport";
import { BLEND_OPS, CanvasPool, compositeNodes, type CompositeEnv } from "./composite";
import {
  buildSelection,
  buildSelectionFromMask,
  drawMarchingAnts,
  intersectRect,
  selectionPath,
  type Point,
  type SelectionShape,
  type SelectionState,
} from "./selection";
import { magicWandMask } from "./wand";
import {
  applyDrag,
  corners,
  contentBounds,
  drawTransformFrame,
  eraseLifted,
  hitTest,
  matrixOf,
  transformedBounds,
  unionRect,
  type DragState,
  type TransformHandle,
  type TransformState,
} from "./transform";
import {
  applyWarpDrag,
  createWarp,
  drawWarpFrame,
  setWarpDensity,
  drawWarped,
  warpBounds,
  warpHitTest,
  type TransformMode,
  type WarpDrag,
  type WarpMode,
  type WarpState,
} from "./warp";
import {
  collectImageLayers,
  contains,
  findContext,
  findImageLayer,
  findNode,
  flattenDisplay,
  isEffectivelyVisible,
} from "./layerTree";
import {
  DEFAULT_MM_PER_PIXEL,
  actualSizeScale,
  mmPerPixelForDpi,
  physicalSize,
  pixelsForMm,
  type PhysicalSize,
} from "./document";

import { defaultTextSpec, renderTextSpec, type TextSpec } from "./text";
import { detectShape, fitShape, resampleShape, type ShapeFit, type ShapeKind } from "./shapes";
import { NO_ADJUST, drawAdjusted, isNeutral, type AdjustSettings } from "./adjust";
import { DEFAULT_GUIDES, drawGuides, symmetryPoints, type GuideSettings } from "./guides";
import {
  DEFAULT_LINE_VIEW,
  drawLineView,
  renderLineViewCanvas,
  type LineViewSettings,
} from "./lineView";
import { DEFAULT_EDGES, autoSensitivity, despeckle, detectEdges, type EdgeSettings } from "./edges";
import { HIT_ALPHA, alphaAt, drawObjectFrame, insideRect, padRect } from "./objectPick";

import { PROJECT_FORMAT, deserializeNodes, serializeNodes, type ProjectFile } from "./project";

import type {
  AdjustLayerKind,
  AdjustmentLayer,
  BlendMode,
  BrushSettings,
  ImageLayer,
  Layer,
  LayerGroup,
  LayerInfo,
  LayerNode,
  Rect,
  RGB,
} from "./types";

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function ctxOf(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  return ctx;
}

let nodeCounter = 0;

export interface EngineOptions {
  width?: number;
  height?: number;
  historyLimit?: number;
  /** Millimetres per document pixel (physical document scale). */
  mmPerPixel?: number;
}

/**
 * The paint engine: one offscreen canvas per pixel layer, arranged in a tree of
 * groups and composited in z-order onto the visible canvas every frame.
 *
 * Extension points that later stages plug into without rewriting this class:
 *  - `blendMode` / `clipped` are carried per node and applied in the compositor.
 *  - Every pixel mutation goes through `commitPixels`, so a selection mask can
 *    clip commits in one place.
 *  - History is command-based, so structural and pixel edits share one stack.
 */
export class PaintEngine {
  /** Document size in pixels. Changes only through `setDocumentSize`. */
  width: number;
  height: number;
  /** Physical scale: millimetres covered by one document pixel. */
  mmPerPixel: number;
  readonly viewport = new Viewport();

  /** Root sibling list, bottom-first. */
  private root: LayerNode[] = [];
  private activeId = "";
  private view: HTMLCanvasElement | null = null;
  private viewCtx: CanvasRenderingContext2D | null = null;
  private viewW = 0;
  private viewH = 0;
  private dpr = 1;

  private strokeBuffer: HTMLCanvasElement;
  private strokeCtx: CanvasRenderingContext2D;
  private scratch: HTMLCanvasElement;
  private scratchCtx: CanvasRenderingContext2D;
  private clipBuffer: HTMLCanvasElement;
  private clipBufferCtx: CanvasRenderingContext2D;
  private pool: CanvasPool;
  private env: CompositeEnv;

  private stroke: StrokeRenderer | null = null;
  private strokeSettings: BrushSettings | null = null;
  private strokeLayerId = "";

  /** Committed selection, or null when everything is selectable. */
  private selection: SelectionState | null = null;
  /** In-progress lasso/rect drag, drawn as a live outline. */
  private draft: { shape: SelectionShape; points: Point[] } | null = null;

  /** Live transform session; the layer itself is untouched until it is applied. */
  private transform: TransformState | null = null;
  private transformDrag: DragState | null = null;
  /** Warp/perspective mesh; null while the plain affine frame is in charge. */
  private warp: WarpState | null = null;
  private warpDrag: WarpDrag | null = null;
  private transformBuffer: HTMLCanvasElement | null = null;
  private transformCtx: CanvasRenderingContext2D | null = null;

  /** Stencil view: display-only mode showing just the line layers. */
  private lineView = false;
  private lineViewSettings: LineViewSettings = { ...DEFAULT_LINE_VIEW };
  /** Live "Trace to lines" preview: the pending line-art layer. */
  private lineArt: {
    layerId: string;
    sourceId: string;
    previousActive: string;
    settings: EdgeSettings;
    cleanup: boolean;
  } | null = null;

  /** Arrow tool: the picked object and its live drag, if any. */
  private objectId: string | null = null;
  private objectDrag: {
    layerId: string;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    before: HTMLCanvasElement;
    text: TextSpec | null;
  } | null = null;

  private frame = 0;
  private listeners = new Set<() => void>();
  readonly history: History;

  constructor(options: EngineOptions = {}) {
    this.width = options.width ?? 2048;
    this.height = options.height ?? 2048;
    this.mmPerPixel = options.mmPerPixel ?? DEFAULT_MM_PER_PIXEL;

    this.strokeBuffer = createCanvas(this.width, this.height);
    this.strokeCtx = ctxOf(this.strokeBuffer);
    this.scratch = createCanvas(this.width, this.height);
    this.scratchCtx = ctxOf(this.scratch);
    this.clipBuffer = createCanvas(this.width, this.height);
    this.clipBufferCtx = ctxOf(this.clipBuffer);
    this.pool = new CanvasPool(this.width, this.height);
    this.env = {
      pool: this.pool,
      canvasFor: (layer) => {
        const t = this.transform;
        if (t && layer.id === t.layerId) return this.transformPreview(t);
        return this.stroke !== null && layer.id === this.strokeLayerId
          ? this.previewLayer(layer)
          : layer.canvas;
      },
    };
    this.history = new History(options.historyLimit ?? 40, () => this.emit());
    this.addLayer("Layer 1", { silent: true });
  }

  /* ---------------------------------------------------------------- state */

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  /**
   * Flat panel view of the tree, bottom-first. A group is listed directly below
   * its children, so reversing the array gives Procreate's top-first order.
   */
  getLayers(): LayerInfo[] {
    return flattenDisplay(this.root).map(({ node, depth, parent, hasSiblingBelow }) => {
      const siblings = parent ? parent.children : this.root;
      const index = siblings.indexOf(node);
      const below = index > 0 ? siblings[index - 1] : null;
      const above = siblings[index + 1] ?? null;
      const adjacentGroup =
        below?.kind === "group" ? below : above?.kind === "group" ? above : null;
      return {
        id: node.id,
        name: node.name,
        kind: node.kind,
        visible: node.visible,
        opacity: node.opacity,
        blendMode: node.blendMode,
        alphaLocked: node.kind === "layer" ? node.alphaLocked : false,
        clipped: node.clipped,
        locked: node.kind === "layer" ? node.locked === true : false,
        isBackground: node.kind === "layer" ? node.isBackground === true : false,
        isText: node.kind === "layer" ? node.text !== undefined : false,
        isLine: node.kind === "layer" ? node.isLine === true : false,

        ...(node.kind === "adjust"
          ? { adjustKind: node.adjustKind, adjustSettings: { ...node.settings } }
          : {}),

        expanded: node.kind === "group" ? node.expanded : false,
        depth,
        parentId: parent ? parent.id : null,
        hasSiblingBelow,
        canMergeDown:
          node.kind === "layer" &&
          node.locked !== true &&
          below?.kind === "layer" &&
          below.locked !== true,
        adjacentGroupId: adjacentGroup ? adjacentGroup.id : null,
      };
    });
  }

  get activeLayerId() {
    return this.activeId;
  }

  setActiveLayer(id: string) {
    if (findNode(this.root, id)) {
      this.activeId = id;
      this.emit();
    }
  }

  private layerById(id: string): ImageLayer | null {
    return findImageLayer(this.root, id);
  }

  private imageLayerCount() {
    return collectImageLayers(this.root).length;
  }

  /* --------------------------------------------------------------- layers */

  addLayer(name?: string, options: { silent?: boolean } = {}): string {
    const canvas = createCanvas(this.width, this.height);
    const layer: ImageLayer = {
      kind: "layer",
      id: `layer-${++nodeCounter}`,
      name: name ?? `Layer ${this.imageLayerCount() + 1}`,
      canvas,
      ctx: ctxOf(canvas),
      visible: true,
      opacity: 1,
      blendMode: "normal",
      alphaLocked: false,
      clipped: false,
    };

    // New layers land right above the active node, in the same sibling list.
    const activeCtx = findContext(this.root, this.activeId);
    const list = activeCtx ? activeCtx.list : this.root;
    const insertAt = activeCtx ? activeCtx.index + 1 : list.length;
    list.splice(insertAt, 0, layer);
    const previousActive = this.activeId;
    this.activeId = layer.id;

    if (!options.silent) {
      this.history.push({
        label: "New layer",
        undo: () => {
          const at = list.indexOf(layer);
          if (at >= 0) list.splice(at, 1);
          this.activeId = previousActive;
          this.invalidate();
          this.emit();
        },
        redo: () => {
          list.splice(Math.min(insertAt, list.length), 0, layer);
          this.activeId = layer.id;
          this.invalidate();
          this.emit();
        },
      });
    }
    this.invalidate();
    this.emit();
    return layer.id;
  }

  /**
   * Adds a non-destructive adjustment layer above the active node. It filters
   * everything below it in the same sibling list; the original pixels are never
   * modified, and the settings stay editable for the layer's whole lifetime.
   */
  addAdjustmentLayer(kind: AdjustLayerKind): string {
    const node: AdjustmentLayer = {
      kind: "adjust",
      id: `adjust-${++nodeCounter}`,
      name: kind === "hueSat" ? "Hue/Saturation" : "Brightness/Contrast",
      adjustKind: kind,
      settings: { ...NO_ADJUST },
      visible: true,
      opacity: 1,
      blendMode: "normal",
      clipped: false,
    };

    const activeCtx = findContext(this.root, this.activeId);
    const list = activeCtx ? activeCtx.list : this.root;
    const insertAt = activeCtx ? activeCtx.index + 1 : list.length;
    list.splice(insertAt, 0, node);
    const previousActive = this.activeId;
    this.activeId = node.id;

    this.history.push({
      label: "Adjustment layer",
      undo: () => {
        const at = list.indexOf(node);
        if (at >= 0) list.splice(at, 1);
        this.activeId = previousActive;
        this.invalidate();
        this.emit();
      },
      redo: () => {
        list.splice(Math.min(insertAt, list.length), 0, node);
        this.activeId = node.id;
        this.invalidate();
        this.emit();
      },
    });
    this.invalidate();
    this.emit();
    return node.id;
  }

  /** Live, re-editable settings of an adjustment layer. */
  adjustmentLayer(id: string): AdjustmentLayer | null {
    const node = findNode(this.root, id);
    return node && node.kind === "adjust" ? node : null;
  }

  /** Updates an adjustment layer's sliders; non-destructive, so no history. */
  setAdjustmentSettings(id: string, patch: Partial<AdjustSettings>) {
    const node = this.adjustmentLayer(id);
    if (!node) return;
    node.settings = { ...node.settings, ...patch };
    this.invalidate();
    this.emit();
  }

  /** Wraps the given node (default: the active one) in a new group. */
  addGroup(id?: string): string | null {
    const targetId = id ?? this.activeId;
    const ctx = findContext(this.root, targetId);
    if (!ctx) return null;
    const { list, node } = ctx;

    const group: LayerGroup = {
      kind: "group",
      id: `group-${++nodeCounter}`,
      name: "Grupp",
      visible: true,
      opacity: 1,
      blendMode: "normal",
      clipped: node.clipped,
      expanded: true,
      children: [],
    };
    const previousClipped = node.clipped;
    const previousActive = this.activeId;

    const apply = () => {
      const at = list.indexOf(node);
      if (at < 0) return;
      list.splice(at, 1, group);
      node.clipped = false;
      group.children = [node];
      this.activeId = group.id;
      this.invalidate();
      this.emit();
    };
    apply();

    this.history.push({
      label: "New group",
      undo: () => {
        const at = list.indexOf(group);
        if (at < 0) return;
        list.splice(at, 1, node);
        node.clipped = previousClipped;
        group.children = [];
        this.activeId = previousActive;
        this.invalidate();
        this.emit();
      },
      redo: apply,
    });
    return group.id;
  }

  /** Dissolves a group, leaving its children in its place. */
  ungroup(id: string): boolean {
    const ctx = findContext(this.root, id);
    if (!ctx || ctx.node.kind !== "group") return false;
    const group = ctx.node;
    const { list } = ctx;
    const children = [...group.children];
    if (children.length === 0) return false;
    const previousActive = this.activeId;
    const previousClipped = children.map((c) => c.clipped);

    const apply = () => {
      const at = list.indexOf(group);
      if (at < 0) return;
      const first = children[0];
      if (first) first.clipped = group.clipped;
      list.splice(at, 1, ...children);
      group.children = [];
      this.activeId = children.at(-1)?.id ?? previousActive;
      this.invalidate();
      this.emit();
    };
    apply();

    this.history.push({
      label: "Ungroup",
      undo: () => {
        const at = list.indexOf(children[0]!);
        if (at < 0) return;
        list.splice(at, children.length, group);
        children.forEach((c, i) => {
          c.clipped = previousClipped[i] ?? false;
        });
        group.children = children;
        this.activeId = previousActive;
        this.invalidate();
        this.emit();
      },
      redo: apply,
    });
    return true;
  }

  setGroupExpanded(id: string, expanded: boolean) {
    const node = findNode(this.root, id);
    if (!node || node.kind !== "group") return;
    node.expanded = expanded;
    this.emit();
  }

  deleteLayer(id: string) {
    const ctx = findContext(this.root, id);
    if (!ctx) return;
    if (ctx.node.kind === "layer" && ctx.node.locked) return;

    // Never let the document end up without a pixel layer.
    const removing = collectImageLayers([ctx.node]).length;
    if (this.imageLayerCount() - removing < 1) return;

    const { list, index, node } = ctx;
    const previousActive = this.activeId;

    const apply = () => {
      const at = list.indexOf(node);
      if (at < 0) return;
      list.splice(at, 1);
      if (!findNode(this.root, this.activeId)) {
        const fallback = list[Math.min(at, list.length - 1)] ?? this.root.at(-1);
        this.activeId = fallback ? fallback.id : "";
      }
      this.invalidate();
      this.emit();
    };
    apply();

    this.history.push({
      label: "Delete layer",
      undo: () => {
        list.splice(Math.min(index, list.length), 0, node);
        this.activeId = previousActive;
        this.invalidate();
        this.emit();
      },
      redo: apply,
    });
  }

  /* ----------------------------------------------------------- reordering */

  /** Low-level move used by both drag & drop and the in/out-of-group buttons. */
  private moveNode(
    id: string,
    targetList: LayerNode[],
    targetIndex: number,
    label = "Flytta lager",
  ) {
    const ctx = findContext(this.root, id);
    if (!ctx) return;
    const { node, list: fromList, index: fromIndex } = ctx;
    // The background reference stays pinned at the bottom of the root stack,
    // and nothing may slide underneath it.
    if (node.kind === "layer" && node.locked) return;
    if (targetList === this.root && targetIndex === 0 && this.backgroundLayer()) {
      targetIndex = 1;
    }
    if (fromList === targetList && (targetIndex === fromIndex || targetIndex === fromIndex + 1)) {
      return;
    }
    const wasClipped = node.clipped;

    /** `rawIndex` is a slot measured before the node is pulled out. */
    const place = (list: LayerNode[], rawIndex: number, clipped: boolean) => {
      const current = findContext(this.root, id);
      if (!current) return;
      const sameList = current.list === list;
      current.list.splice(current.index, 1);
      let index = sameList && current.index < rawIndex ? rawIndex - 1 : rawIndex;
      index = Math.max(0, Math.min(index, list.length));
      list.splice(index, 0, node);
      // Landing at the bottom of a stack leaves nothing to clip to.
      node.clipped = index === 0 ? false : clipped;
      this.invalidate();
      this.emit();
    };

    place(targetList, targetIndex, wasClipped);

    this.history.push({
      label,
      undo: () => place(fromList, fromIndex, wasClipped),
      redo: () => place(targetList, targetIndex, wasClipped),
    });
  }

  /**
   * Drag & drop target resolution. `displayIndex` is a slot in the bottom-first
   * panel list: the node ends up directly above whatever sits below the slot,
   * which is how a layer gets dragged into an expanded group.
   */
  moveLayer(id: string, displayIndex: number) {
    const dragged = findNode(this.root, id);
    if (!dragged) return;
    const entries = flattenDisplay(this.root).filter(({ node }) => !contains(dragged, node.id));
    const slot = Math.max(0, Math.min(entries.length, displayIndex));

    if (slot === 0) {
      this.moveNode(id, this.root, 0);
      return;
    }
    const anchor = entries[slot - 1]!;
    if (anchor.node.kind === "group" && anchor.node.expanded) {
      this.moveNode(id, anchor.node.children, 0);
      return;
    }
    const list = anchor.parent ? anchor.parent.children : this.root;
    this.moveNode(id, list, list.indexOf(anchor.node) + 1);
  }

  /** Moves a node into the nearest sibling group (the one below, else above). */
  moveIntoGroupBelow(id: string): boolean {
    const ctx = findContext(this.root, id);
    if (!ctx) return false;
    const below = ctx.index > 0 ? ctx.list[ctx.index - 1] : null;
    const above = ctx.list[ctx.index + 1] ?? null;
    if (below && below.kind === "group") {
      below.expanded = true;
      this.moveNode(id, below.children, below.children.length, "Flytta in i grupp");
      return true;
    }
    if (above && above.kind === "group") {
      above.expanded = true;
      this.moveNode(id, above.children, 0, "Flytta in i grupp");
      return true;
    }
    return false;
  }

  /** Moves a node out of its group, landing directly above it. */
  moveOutOfGroup(id: string): boolean {
    const ctx = findContext(this.root, id);
    if (!ctx || !ctx.parent) return false;
    const parentCtx = findContext(this.root, ctx.parent.id);
    if (!parentCtx) return false;
    this.moveNode(id, parentCtx.list, parentCtx.index + 1, "Flytta ut ur grupp");
    return true;
  }

  /* ------------------------------------------------------- node properties */

  setLayerVisible(id: string, visible: boolean) {
    const node = findNode(this.root, id);
    if (!node) return;
    node.visible = visible;
    this.invalidate();
    this.emit();
  }

  setLayerOpacity(id: string, opacity: number) {
    const node = findNode(this.root, id);
    if (!node) return;
    node.opacity = Math.max(0, Math.min(1, opacity));
    this.invalidate();
    this.emit();
  }

  setLayerBlendMode(id: string, blendMode: BlendMode) {
    const node = findNode(this.root, id);
    if (!node || node.blendMode === blendMode) return;
    const previous = node.blendMode;
    const apply = (mode: BlendMode) => {
      node.blendMode = mode;
      this.invalidate();
      this.emit();
    };
    apply(blendMode);
    this.history.push({
      label: "Blend mode",
      undo: () => apply(previous),
      redo: () => apply(blendMode),
    });
  }

  setLayerAlphaLock(id: string, locked: boolean) {
    const layer = this.layerById(id);
    if (!layer || layer.locked) return;
    layer.alphaLocked = locked;

    this.emit();
  }

  /** Clips a node to the alpha of the sibling directly below it. */
  setLayerClipped(id: string, clipped: boolean) {
    const ctx = findContext(this.root, id);
    if (!ctx) return;
    if (ctx.node.kind === "layer" && ctx.node.locked) return;
    if (clipped && ctx.index === 0) return; // nothing below to clip to

    const node = ctx.node;
    if (node.clipped === clipped) return;
    const apply = (value: boolean) => {
      node.clipped = value;
      this.invalidate();
      this.emit();
    };
    apply(clipped);
    this.history.push({
      label: "Clipping mask",
      undo: () => apply(!clipped),
      redo: () => apply(clipped),
    });
  }

  /**
   * Flattens a pixel layer into the pixel layer below it (same sibling list) as
   * a single undoable step. Groups are never merged implicitly.
   */
  mergeDown(id: string): boolean {
    const ctx = findContext(this.root, id);
    if (!ctx || ctx.node.kind !== "layer") return false;
    const layer = ctx.node;
    if (layer.locked) return false;
    const below = ctx.list[ctx.index - 1];
    if (!below || below.kind !== "layer" || below.locked) return false;

    const { list, index } = ctx;

    // Snapshot the target's pixels so undo can restore them exactly.
    const backup = createCanvas(this.width, this.height);
    ctxOf(backup).drawImage(below.canvas, 0, 0);

    const previousActive = this.activeId;
    const previousVisible = below.visible;
    const previousClipped = below.clipped;
    // Merging bakes pixels, so the target stops being editable text.
    const previousText = below.text ? { ...below.text } : undefined;

    const apply = () => {
      const at = list.indexOf(layer);
      if (at < 0) return;
      const ctx2 = below.ctx;
      ctx2.save();
      ctx2.globalAlpha = layer.visible ? layer.opacity : 0;
      ctx2.globalCompositeOperation = BLEND_OPS[layer.blendMode];
      ctx2.drawImage(layer.canvas, 0, 0);
      ctx2.restore();
      below.visible = previousVisible || layer.visible;
      below.text = undefined;
      list.splice(at, 1);
      this.activeId = below.id;
      this.invalidate();
      this.emit();
    };
    apply();

    this.history.push({
      label: "Merge layers",
      undo: () => {
        below.ctx.save();
        below.ctx.setTransform(1, 0, 0, 1, 0, 0);
        below.ctx.globalAlpha = 1;
        below.ctx.globalCompositeOperation = "copy";
        below.ctx.drawImage(backup, 0, 0);
        below.ctx.restore();
        below.visible = previousVisible;
        below.clipped = previousClipped;
        below.text = previousText;
        list.splice(Math.min(index, list.length), 0, layer);
        this.activeId = previousActive;
        this.invalidate();
        this.emit();
      },
      redo: apply,
    });
    return true;
  }

  /* ------------------------------------------- background + document scale */

  /** The locked reference photo at the bottom of the root stack, if any. */
  private backgroundLayer(): ImageLayer | null {
    const first = this.root[0];
    return first && first.kind === "layer" && first.isBackground ? first : null;
  }

  get hasBackground() {
    return this.backgroundLayer() !== null;
  }

  get backgroundLayerId(): string | null {
    return this.backgroundLayer()?.id ?? null;
  }

  /** True when the active layer cannot be painted on (background reference). */
  get activeLayerLocked(): boolean {
    const layer = this.layerById(this.activeId);
    return layer?.locked === true;
  }

  /** Physical document size derived from `mmPerPixel`. */
  get physical(): PhysicalSize {
    return physicalSize(this.width, this.height, this.mmPerPixel);
  }

  /** Sets the physical scale from a desired document width in millimetres. */
  setPhysicalWidthMm(widthMm: number) {
    if (!(widthMm > 0)) return;
    this.mmPerPixel = widthMm / this.width;
    this.emit();
  }

  setMmPerPixel(value: number) {
    if (!(value > 0)) return;
    this.mmPerPixel = value;
    this.emit();
  }

  /**
   * Renders the document at true physical size: 1 mm of artwork covers 1 mm of
   * screen (using the CSS reference pixel), so the same sketch looks equally
   * large on a tablet, a phone and a desktop display.
   */
  viewActualSize() {
    const scale = actualSizeScale(this.mmPerPixel);
    this.viewport.scale = 1;
    this.viewport.zoomTo(scale, this.viewW / 2, this.viewH / 2);
    this.viewport.x = (this.viewW - this.width * this.viewport.scale) / 2;
    this.viewport.y = (this.viewH - this.height * this.viewport.scale) / 2;
    this.invalidate();
    this.emit();
  }

  /**
   * Resizes the document. Layer artwork keeps its pixel position (top-left
   * anchored) and history is cleared, because undo commands hold rectangles
   * measured against the old sheet.
   */
  setDocumentSize(width: number, height: number) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;

    for (const layer of collectImageLayers(this.root)) {
      const copy = createCanvas(layer.canvas.width, layer.canvas.height);
      ctxOf(copy).drawImage(layer.canvas, 0, 0);
      layer.canvas.width = w;
      layer.canvas.height = h;
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.clearRect(0, 0, w, h);
      layer.ctx.drawImage(copy, 0, 0);
    }

    this.strokeBuffer = createCanvas(w, h);
    this.strokeCtx = ctxOf(this.strokeBuffer);
    this.scratch = createCanvas(w, h);
    this.scratchCtx = ctxOf(this.scratch);
    this.clipBuffer = createCanvas(w, h);
    this.clipBufferCtx = ctxOf(this.clipBuffer);
    this.pool = new CanvasPool(w, h);
    this.env.pool = this.pool;
    this.transformBuffer = null;
    this.transformCtx = null;
    this.transform = null;
    this.transformDrag = null;
    this.warp = null;
    this.warpDrag = null;

    this.selection = null;
    this.draft = null;
    this.history.clear();
    this.fitToView();
    this.emit();
  }

  /**
   * The size-first path: the artist states the sketch's real size in
   * millimetres and a print resolution, and the pixel canvas is derived from
   * that. `mmPerPixel` is fixed by the dpi, so the sketch keeps the same
   * physical size on a phone, an iPad and a desktop — and prints 1:1.
   */
  setDocumentSizeMm(widthMm: number, heightMm: number, dpi: number) {
    if (!(widthMm > 0) || !(heightMm > 0) || !(dpi > 0)) return;
    this.mmPerPixel = mmPerPixelForDpi(dpi);
    this.setDocumentSize(pixelsForMm(widthMm, dpi), pixelsForMm(heightMm, dpi));
    // setDocumentSize is a no-op when only the scale changed; emit regardless.
    this.emit();
  }

  /**
   * Imports a reference photo: it defines the document's pixel size and its
   * physical scale, and lands as a locked layer at the very bottom that can
   * only be dimmed or hidden — never painted on, moved or transformed.
   */
  setBackgroundImage(
    image: CanvasImageSource & { width: number; height: number },
    options: { widthMm?: number; mmPerPixel?: number; name?: string } = {},
  ): string {
    const w = Math.max(1, Math.round(image.width));
    const h = Math.max(1, Math.round(image.height));

    // Drop a previous reference so importing twice never stacks them.
    const existing = this.backgroundLayer();
    if (existing) this.root.splice(0, 1);

    this.setDocumentSize(w, h);
    if (options.mmPerPixel && options.mmPerPixel > 0) this.mmPerPixel = options.mmPerPixel;
    else if (options.widthMm && options.widthMm > 0) this.mmPerPixel = options.widthMm / w;

    const canvas = createCanvas(w, h);
    const ctx = ctxOf(canvas);
    ctx.drawImage(image, 0, 0, w, h);

    const layer: ImageLayer = {
      kind: "layer",
      id: `background-${++nodeCounter}`,
      name: options.name ?? "Background (reference)",
      canvas,
      ctx,
      visible: true,
      opacity: 1,
      blendMode: "normal",
      alphaLocked: false,
      clipped: false,
      locked: true,
      isBackground: true,
    };
    this.root.unshift(layer);

    // Keep the user on a paintable layer.
    if (this.activeId === "" || this.activeId === existing?.id) {
      const paintable = collectImageLayers(this.root).find((l) => !l.locked);
      this.activeId = paintable ? paintable.id : layer.id;
    }
    this.history.clear();
    this.fitToView();
    this.emit();
    return layer.id;
  }

  /**
   * Draws an image centred and scaled to fit inside the current document,
   * without ever changing the document's pixel size or mm scale.
   */
  private drawContained(
    ctx: CanvasRenderingContext2D,
    image: CanvasImageSource & { width: number; height: number },
  ) {
    const iw = Math.max(1, image.width);
    const ih = Math.max(1, image.height);
    const scale = Math.min(this.width / iw, this.height / ih);
    const w = iw * scale;
    const h = ih * scale;
    ctx.drawImage(image, (this.width - w) / 2, (this.height - h) / 2, w, h);
  }

  /**
   * Imports an image as a new, ordinary paintable layer. The document keeps its
   * size and physical scale; the photo is fitted inside it.
   */
  placeImageAsLayer(
    image: CanvasImageSource & { width: number; height: number },
    name?: string,
  ): string {
    const id = this.addLayer(name ?? "Importerad bild");
    const layer = this.layerById(id)!;
    this.drawContained(layer.ctx, image);
    this.invalidate();
    this.emit();
    return id;
  }

  /**
   * Imports an image as the locked background reference at the very bottom,
   * fitted inside the existing document. Unlike setBackgroundImage this never
   * touches the document size or mmPerPixel.
   */
  setBackgroundReference(
    image: CanvasImageSource & { width: number; height: number },
    name?: string,
  ): string {
    const existing = this.backgroundLayer();
    if (existing) this.root.splice(0, 1);

    const canvas = createCanvas(this.width, this.height);
    const ctx = ctxOf(canvas);
    this.drawContained(ctx, image);

    const layer: ImageLayer = {
      kind: "layer",
      id: `background-${++nodeCounter}`,
      name: name ?? "Background (reference)",
      canvas,
      ctx,
      visible: true,
      opacity: 1,
      blendMode: "normal",
      alphaLocked: false,
      clipped: false,
      locked: true,
      isBackground: true,
    };
    this.root.unshift(layer);

    if (this.activeId === "" || this.activeId === existing?.id) {
      const paintable = collectImageLayers(this.root).find((l) => !l.locked);
      this.activeId = paintable ? paintable.id : layer.id;
    }
    this.invalidate();
    this.emit();
    return layer.id;
  }

  /** Removes the reference photo; the document keeps its size and scale. */
  removeBackgroundImage(): boolean {
    const bg = this.backgroundLayer();
    if (!bg) return false;
    this.root.splice(0, 1);
    if (this.activeId === bg.id) {
      const paintable = collectImageLayers(this.root).find((l) => !l.locked);
      this.activeId = paintable ? paintable.id : "";
    }
    // Root-bottom nodes have nothing to clip to any more.
    const first = this.root[0];
    if (first) first.clipped = false;
    this.invalidate();
    this.emit();
    return true;
  }

  /* ------------------------------------------------------------------ text */

  /**
   * Adds an editable text layer. It behaves like any other pixel layer in the
   * stack (blend mode, opacity, groups, clipping, export), but keeps its spec,
   * so the wording, font, size and colour can be changed again at any time.
   */
  addTextLayer(spec: Partial<TextSpec> = {}, color: RGB = { r: 20, g: 22, b: 26 }): string {
    const id = this.addLayer("Text", { silent: true });
    const layer = this.layerById(id)!;
    layer.text = { ...defaultTextSpec(this.width, this.height, color), ...spec };
    this.renderText(layer);

    const list = findContext(this.root, id)!.list;
    const index = list.indexOf(layer);
    const previousActive = this.activeId;
    const apply = () => {
      list.splice(Math.min(index, list.length), 0, layer);
      this.activeId = layer.id;
      this.invalidate();
      this.emit();
    };
    this.history.push({
      label: "Text layer",
      undo: () => {
        const at = list.indexOf(layer);
        if (at >= 0) list.splice(at, 1);
        this.activeId = previousActive;
        this.invalidate();
        this.emit();
      },
      redo: apply,
    });
    this.invalidate();
    this.emit();
    return id;
  }

  private renderText(layer: ImageLayer) {
    if (!layer.text) return;
    renderTextSpec(layer.ctx, layer.text, this.width, this.height);
  }

  /** The spec of a text layer (defaults to the active layer), or null. */
  getTextSpec(id?: string): TextSpec | null {
    const layer = this.layerById(id ?? this.activeId);
    return layer?.text ? { ...layer.text } : null;
  }

  get activeLayerIsText() {
    return this.getTextSpec() !== null;
  }

  /**
   * Edits a text layer. Every change is one undo step that swaps the spec and
   * re-renders — the pixels are never the source of truth, so nothing is baked.
   */
  updateTextSpec(id: string, patch: Partial<TextSpec>): boolean {
    const layer = this.layerById(id);
    if (!layer?.text || layer.locked) return false;
    const before = { ...layer.text };
    const after = { ...before, ...patch };
    if (
      before.content === after.content &&
      before.fontId === after.fontId &&
      before.fontSize === after.fontSize &&
      before.align === after.align &&
      before.cx === after.cx &&
      before.cy === after.cy &&
      before.angle === after.angle &&
      before.color.r === after.color.r &&
      before.color.g === after.color.g &&
      before.color.b === after.color.b
    ) {
      return false;
    }

    const set = (spec: TextSpec) => {
      layer.text = { ...spec };
      this.renderText(layer);
      this.invalidate();
      this.emit();
    };
    set(after);
    this.history.push({
      label: "Edit text",
      undo: () => set(before),
      redo: () => set(after),
    });
    return true;
  }

  /** Turns a text layer into ordinary pixels so it can be painted on. */
  rasterizeText(id: string): boolean {
    const layer = this.layerById(id);
    if (!layer?.text || layer.locked) return false;
    const spec = layer.text;
    const apply = () => {
      layer.text = undefined;
      this.emit();
    };
    apply();
    this.history.push({
      label: "Rasterize text",
      undo: () => {
        layer.text = { ...spec };
        this.renderText(layer);
        this.invalidate();
        this.emit();
      },
      redo: apply,
    });
    return true;
  }

  renameLayer(id: string, name: string) {
    const node = findNode(this.root, id);
    if (!node) return;
    node.name = name;
    this.emit();
  }

  /* ---------------------------------------------------------------- view */

  attachView(canvas: HTMLCanvasElement) {
    this.view = canvas;
    this.viewCtx = ctxOf(canvas);
    this.invalidate();
  }

  detachView() {
    this.view = null;
    this.viewCtx = null;
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  resizeView(cssWidth: number, cssHeight: number, dpr: number) {
    if (!this.view) return;
    const first = this.viewW === 0;
    this.viewW = cssWidth;
    this.viewH = cssHeight;
    this.dpr = dpr;
    this.view.width = Math.max(1, Math.round(cssWidth * dpr));
    this.view.height = Math.max(1, Math.round(cssHeight * dpr));
    if (first) this.viewport.fit(this.width, this.height, cssWidth, cssHeight);
    this.invalidate();
  }

  fitToView() {
    this.viewport.fit(this.width, this.height, this.viewW, this.viewH);
    this.invalidate();
  }

  resetZoom() {
    this.viewport.zoomTo(1, this.viewW / 2, this.viewH / 2);
    this.invalidate();
  }

  invalidate() {
    if (this.frame || !this.viewCtx) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.render();
    });
  }

  private render() {
    const ctx = this.viewCtx;
    if (!ctx) return;
    const { scale, x, y, rotation } = this.viewport;

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);

    ctx.save();
    ctx.translate(x, y);
    // View rotation happens before scaling, matching Viewport's mapping.
    if (rotation) ctx.rotate(rotation);
    ctx.scale(scale, scale);

    // Paper
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.imageSmoothingEnabled = scale < 3;
    if (this.lineView) {
      drawLineView(ctx, this.lineSources(), this.width, this.height, this.lineViewSettings);
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1 / scale;
      ctx.strokeRect(0, 0, this.width, this.height);
      ctx.restore();
      return;
    }
    const background = this.backgroundLayer();
    if (background) {
      const artwork = this.root
        .slice(1)
        .map((node, index) => (index === 0 && node.clipped ? { ...node, clipped: false } : node));
      compositeNodes(ctx, artwork, this.env);
      ctx.save();
      ctx.globalAlpha = background.visible ? background.opacity : 0;
      ctx.globalCompositeOperation = "source-over";
      ctx.drawImage(background.canvas, 0, 0);
      ctx.restore();
    } else {
      this.composite(ctx);
    }

    // Drawing guides sit above the artwork but below every interactive overlay.
    if (this.guides.grid || this.guides.symmetry !== "off") {
      drawGuides(ctx, this.guides, this.width, this.height, this.mmPerPixel, scale);
    }

    // Selection outline, drawn in document space with screen-constant width.
    const outline = this.draft
      ? selectionPath(this.draft.shape, this.draft.points)
      : (this.selection?.path ?? null);
    if (outline) drawMarchingAnts(ctx, outline, scale, performance.now());

    // Transform frame + handles, also document space / screen-constant.
    if (this.transform) {
      if (this.warp) drawWarpFrame(ctx, this.warp, scale);
      else drawTransformFrame(ctx, this.transform, scale);
    }

    // Arrow tool: frame around the picked object.
    if (!this.transform) {
      const objectRect = this.pickedObjectBounds();
      if (objectRect) drawObjectFrame(ctx, objectRect, scale);
    }

    // Document border, in the same rotated space so it hugs the paper.
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.lineWidth = 1 / scale;
    ctx.strokeRect(0, 0, this.width, this.height);
    ctx.restore();

    // Keep the ants marching.
    if (outline) this.invalidate();
  }

  /** Draws the whole tree (plus the in-progress stroke) into `ctx`. */
  private composite(ctx: CanvasRenderingContext2D) {
    compositeNodes(ctx, this.root, this.env);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  /** Layer + active stroke, flattened, so an eraser only affects its layer. */
  private previewLayer(layer: Layer): HTMLCanvasElement {
    const settings = this.strokeSettings;
    const c = this.scratchCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, this.width, this.height);
    c.drawImage(layer.canvas, 0, 0);
    if (settings) {
      c.globalAlpha = settings.opacity;
      c.globalCompositeOperation = this.strokeComposite(layer, settings);
      c.drawImage(this.clippedStroke(), 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = "source-over";
    }
    return this.scratch;
  }

  /* ------------------------------------------------------------ selection */

  get hasSelection() {
    return this.selection !== null;
  }

  /** The stroke buffer clipped to the selection (or the buffer itself). */
  private clippedStroke(): HTMLCanvasElement {
    const selection = this.selection;
    if (!selection) return this.strokeBuffer;
    const c = this.clipBufferCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, this.width, this.height);
    c.drawImage(this.strokeBuffer, 0, 0);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(selection.mask, 0, 0);
    c.globalCompositeOperation = "source-over";
    return this.clipBuffer;
  }

  beginSelection(shape: SelectionShape, docX: number, docY: number) {
    const start = { x: docX, y: docY };
    this.draft = { shape, points: shape === "rect" ? [start, start] : [start] };
    this.invalidate();
  }

  extendSelection(docX: number, docY: number) {
    const draft = this.draft;
    if (!draft) return;
    if (draft.shape === "rect") {
      draft.points[1] = { x: docX, y: docY };
    } else {
      const last = draft.points.at(-1)!;
      if (Math.hypot(docX - last.x, docY - last.y) >= 1.5) {
        draft.points.push({ x: docX, y: docY });
      }
    }
    this.invalidate();
  }

  /** Commits the drag. A tap (no real area) clears the selection instead. */
  endSelection() {
    const draft = this.draft;
    this.draft = null;
    if (!draft) return;
    this.selection = buildSelection(draft.shape, draft.points, this.width, this.height);
    this.invalidate();
    this.emit();
  }

  /**
   * Magic wand: selects the connected area of similar colour under the tap on
   * the active layer. Produces an ordinary selection (mask + outline), so fill,
   * erase, painting and transform behave exactly as with lasso/rect.
   */
  magicWandSelect(docX: number, docY: number, tolerance: number): boolean {
    const layer = this.layerById(this.activeId);
    if (!layer || !isEffectivelyVisible(this.root, layer.id)) return false;
    const result = magicWandMask(layer.canvas, docX, docY, tolerance);
    if (!result) return false;
    const selection = buildSelectionFromMask(result.mask);
    if (!selection) return false;
    this.draft = null;
    this.selection = selection;
    this.invalidate();
    this.emit();
    return true;
  }

  deselect() {
    if (!this.selection && !this.draft) return;
    this.selection = null;
    this.draft = null;
    this.invalidate();
    this.emit();
  }

  /** Fills the selection (or the whole layer when nothing is selected). */
  fillSelection(color: RGB): boolean {
    return this.paintRegion(true, (ctx, path) => {
      ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
      if (path) ctx.fill(path);
      else ctx.fillRect(0, 0, this.width, this.height);
    });
  }

  /** Erases inside the selection (or clears the layer when nothing is selected). */
  eraseSelection(): boolean {
    return this.paintRegion(false, (ctx, path) => {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "#000000";
      if (path) ctx.fill(path);
      else ctx.fillRect(0, 0, this.width, this.height);
    });
  }

  /**
   * Fill/erase inside the selection. Both go through `commitPixels`, so they are
   * a single undo step, and the path itself does the clipping — no mask blit
   * needed for vector-shaped operations.
   */
  private paintRegion(
    honorAlphaLock: boolean,
    draw: (ctx: CanvasRenderingContext2D, path: Path2D | null) => void,
  ): boolean {
    const layer = this.layerById(this.activeId);
    if (!layer || layer.locked || layer.text || !isEffectivelyVisible(this.root, layer.id))
      return false;

    const selection = this.selection;
    const rect = selection ? selection.bounds : { x: 0, y: 0, w: this.width, h: this.height };
    if (rect.w < 1 || rect.h < 1) return false;
    const path = selection ? selection.path : null;

    this.commitPixels(layer, rect, (ctx) => {
      if (honorAlphaLock && layer.alphaLocked) {
        // Keep the layer's own alpha: build the fill, then clip it to the layer.
        const buffer = this.clipBufferCtx;
        buffer.setTransform(1, 0, 0, 1, 0, 0);
        buffer.globalAlpha = 1;
        buffer.globalCompositeOperation = "source-over";
        buffer.clearRect(0, 0, this.width, this.height);
        draw(buffer, path);
        buffer.globalCompositeOperation = "source-over";
        ctx.globalCompositeOperation = "source-atop";
        ctx.drawImage(this.clipBuffer, 0, 0);
        return;
      }
      draw(ctx, path);
    });
    return true;
  }

  /* ------------------------------------------------------------ transform */

  get transformActive() {
    return this.transform !== null;
  }

  private transformBuffers(): CanvasRenderingContext2D {
    if (!this.transformBuffer || !this.transformCtx) {
      this.transformBuffer = createCanvas(this.width, this.height);
      this.transformCtx = ctxOf(this.transformBuffer);
    }
    return this.transformCtx;
  }

  /** base + the transformed source, i.e. what the layer looks like right now. */
  private transformPreview(t: TransformState): HTMLCanvasElement {
    const c = this.transformBuffers();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, this.width, this.height);
    c.drawImage(t.base, 0, 0);
    if (this.warp) drawWarped(c, t.source, this.warp, this.viewport.scale);
    else this.drawTransformed(c, t);
    return this.transformBuffer!;
  }

  /** Draws the lifted pixels through the current matrix at document resolution. */
  private drawTransformed(ctx: CanvasRenderingContext2D, t: TransformState) {
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const m = matrixOf(t);
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(t.source, 0, 0);
    ctx.restore();
  }

  /**
   * Lifts the selection contents (or the whole layer's artwork) into a floating
   * transform session. Nothing is written to the layer and nothing is pushed to
   * history until `commitTransform` runs, so cancelling is always free.
   */
  beginTransform(): boolean {
    if (this.transform) return true;
    const layer = this.layerById(this.activeId);
    if (!layer || layer.locked || !isEffectivelyVisible(this.root, layer.id)) return false;

    const selection = this.selection;

    // The region to lift: the selection, masked; otherwise the artwork's bbox.
    const lifted = createCanvas(this.width, this.height);
    const liftedCtx = ctxOf(lifted);
    liftedCtx.drawImage(layer.canvas, 0, 0);
    if (selection) {
      liftedCtx.globalCompositeOperation = "destination-in";
      liftedCtx.drawImage(selection.mask, 0, 0);
      liftedCtx.globalCompositeOperation = "source-over";
    }
    const srcRect = contentBounds(lifted);
    if (!srcRect || srcRect.w < 1 || srcRect.h < 1) return false;

    // Crop to the region so scaling maths works on the artwork, not the sheet.
    const source = createCanvas(srcRect.w, srcRect.h);
    ctxOf(source).drawImage(lifted, -srcRect.x, -srcRect.y);

    // The layer minus what we lifted. Outside a selection the whole crop
    // belongs to the lift, so clear it flat instead of erasing through the
    // artwork's soft edges (which would leave a faint halo behind).
    const base = createCanvas(this.width, this.height);
    const baseCtx = ctxOf(base);
    baseCtx.drawImage(layer.canvas, 0, 0);
    const liftMask = selection ? selection.mask : null;
    eraseLifted(baseCtx, srcRect, liftMask);

    this.transform = {
      layerId: layer.id,
      base,
      source,
      srcRect,
      liftMask,
      cx: srcRect.x + srcRect.w / 2,
      cy: srcRect.y + srcRect.h / 2,
      w: srcRect.w,
      h: srcRect.h,
      angle: 0,
    };
    // The old marching ants would fight the transform frame for attention.
    this.selection = null;
    this.draft = null;
    this.invalidate();
    this.emit();
    return true;
  }

  /** Which frame is driving the open session: plain box, warp mesh or perspective. */
  get transformMode(): TransformMode {
    return this.warp ? this.warp.mode : "affine";
  }

  /**
   * Switches the open session between the affine box, the warp mesh and the
   * perspective quad. The new net starts from the current box, so the artwork
   * never jumps; going back to "affine" keeps the box but drops the bend.
   * Text layers are transformed by rewriting their spec, which cannot express a
   * mesh — those must be rasterised first, so this returns false for them.
   */
  setTransformMode(mode: TransformMode): boolean {
    const t = this.transform;
    if (!t) return false;
    if (mode !== "affine") {
      const layer = this.layerById(t.layerId);
      if (layer?.text) return false;
    }
    if (mode === this.transformMode) return true;
    this.warpDrag = null;
    this.warp = mode === "affine" ? null : createWarp(mode as WarpMode, corners(t));
    this.invalidate();
    this.emit();
    return true;
  }

  /** Points-per-side of the warp grid, or null outside warp mode. */
  get warpDensity(): number | null {
    return this.warp && this.warp.mode === "grid" ? this.warp.cols : null;
  }

  /**
   * Changes the warp grid's density (WARP_GRID_MIN..MAX points per side).
   * The new net is sampled off the current surface, so existing deformation
   * carries over. Only valid while the grid warp is active.
   */
  setWarpDensity(n: number): boolean {
    if (!this.warp || this.warp.mode !== "grid") return false;
    const next = setWarpDensity(this.warp, n);
    if (next === this.warp) return true;
    this.warpDrag = null;
    this.warp = next;
    this.invalidate();
    this.emit();
    return true;
  }

  /** Handle under a document point, for hit-testing and cursors. */
  transformHandleAt(docX: number, docY: number): TransformHandle | null {
    if (!this.transform) return null;
    if (this.warp) {
      const i = warpHitTest(this.warp, { x: docX, y: docY }, this.viewport.scale);
      return i === null ? null : "move";
    }
    return hitTest(this.transform, { x: docX, y: docY }, this.viewport.scale);
  }

  /** Starts a handle drag. Returns the grabbed handle, or null when outside. */
  transformPointerDown(docX: number, docY: number): TransformHandle | null {
    const t = this.transform;
    if (!t) return null;
    if (this.warp) {
      const index = warpHitTest(this.warp, { x: docX, y: docY }, this.viewport.scale);
      if (index === null) return null;
      const start = this.warp.points[index]!;
      this.warpDrag = { index, from: { x: docX, y: docY }, start: { ...start } };
      return "move";
    }
    const handle = hitTest(t, { x: docX, y: docY }, this.viewport.scale);
    if (!handle) return null;
    this.transformDrag = {
      handle,
      from: { x: docX, y: docY },
      start: { cx: t.cx, cy: t.cy, w: t.w, h: t.h, angle: t.angle },
    };
    return handle;
  }

  transformPointerMove(
    docX: number,
    docY: number,
    options: { uniform?: boolean; snap?: boolean } = {},
  ) {
    const t = this.transform;
    if (this.warp && this.warpDrag) {
      applyWarpDrag(this.warp, this.warpDrag, { x: docX, y: docY });
      this.invalidate();
      return;
    }
    const drag = this.transformDrag;
    if (!t || !drag) return;
    applyDrag(t, drag, { x: docX, y: docY }, options);
    this.invalidate();
  }

  transformPointerUp() {
    this.transformDrag = null;
    this.warpDrag = null;
  }

  get isTransformDragging() {
    return this.transformDrag !== null || this.warpDrag !== null;
  }

  /** Nudges the box by whole document pixels (arrow keys). */
  nudgeTransform(dx: number, dy: number) {
    const t = this.transform;
    if (!t) return;
    t.cx += dx;
    t.cy += dy;
    if (this.warp) {
      for (const p of this.warp.points) {
        p.x += dx;
        p.y += dy;
      }
    }
    this.invalidate();
  }

  /**
   * Stamps the transform down at document resolution as one undoable step. The
   * dirty rect covers both where the pixels came from and where they landed.
   */
  commitTransform(): boolean {
    const t = this.transform;
    if (!t) return false;
    const layer = this.layerById(t.layerId);
    const warp = this.warp;
    this.transform = null;
    this.transformDrag = null;
    this.warp = null;
    this.warpDrag = null;
    if (!layer) {
      this.invalidate();
      this.emit();
      return false;
    }

    // A text layer is moved, scaled and rotated by rewriting its spec, so the
    // wording stays editable instead of being burnt into pixels. Scaling maps
    // to the font size (uniform: type cannot be stretched on one axis only).
    if (layer.text) {
      const spec = layer.text;
      const sx = t.srcRect.w > 0 ? t.w / t.srcRect.w : 1;
      const sy = t.srcRect.h > 0 ? t.h / t.srcRect.h : 1;
      const scale = Math.max(0.02, (sx + sy) / 2);
      // The frame pivots around the ink bounding box, which is not the text
      // block's own centre, so carry the block centre through the same
      // scale → rotate → translate the frame applied.
      const pivotX = t.srcRect.x + t.srcRect.w / 2;
      const pivotY = t.srcRect.y + t.srcRect.h / 2;
      const rx = (spec.cx - pivotX) * scale;
      const ry = (spec.cy - pivotY) * scale;
      const cos = Math.cos(t.angle);
      const sin = Math.sin(t.angle);
      this.updateTextSpec(layer.id, {
        cx: t.cx + rx * cos - ry * sin,
        cy: t.cy + rx * sin + ry * cos,
        angle: spec.angle + t.angle,
        fontSize: Math.max(4, spec.fontSize * scale),
      });
      // The preview is gone; re-render from the (possibly unchanged) spec.
      this.renderText(layer);
      this.invalidate();
      this.emit();
      return true;
    }

    const rect = unionRect(
      t.srcRect,
      warp
        ? warpBounds(warp, this.width, this.height)
        : transformedBounds(t, this.width, this.height),
      this.width,
      this.height,
    );
    if (rect.w < 1 || rect.h < 1) {
      this.invalidate();
      this.emit();
      return false;
    }

    this.commitPixels(
      layer,
      rect,
      (ctx) => {
        // Remove the lifted pixels, then draw them back through the matrix.
        eraseLifted(ctx, t.srcRect, t.liftMask);
        ctx.globalCompositeOperation = layer.alphaLocked ? "source-atop" : "source-over";
        // Document resolution either way: the mesh is evaluated in document
        // space and `t.source` holds the lifted crop at full resolution.
        if (warp) drawWarped(ctx, t.source, warp);
        else this.drawTransformed(ctx, t);
      },
      warp ? (warp.mode === "perspective" ? "Perspektiv" : "Varp") : "Transform",
    );
    this.emit();
    return true;
  }

  /** Drops the session; the layer was never modified, so there is nothing to undo. */
  cancelTransform() {
    if (!this.transform) return;
    this.transform = null;
    this.transformDrag = null;
    this.warp = null;
    this.warpDrag = null;
    this.invalidate();
    this.emit();
  }

  /* -------------------------------------------------------------- strokes */

  /** Raw samples of the live stroke, kept so QuickShape can re-fit it. */
  private strokePath: Point[] = [];
  /** Symmetry copies; they paint into the same stroke buffer. */
  private mirrors: StrokeRenderer[] = [];
  /** True once QuickShape has taken over: further samples are ignored. */
  private shapeLocked = false;
  /** Last committed QuickShape, so the artist can change their mind. */
  private lastShape: {
    raw: Point[];
    settings: BrushSettings;
    layerId: string;
    kind: ShapeKind;
  } | null = null;

  beginStroke(
    docX: number,
    docY: number,
    pressure: number,
    settings: BrushSettings,
    pressureAlpha?: number,
  ) {
    const layer = this.layerById(this.activeId);
    // Text layers are rendered from their spec, so painting on them would be
    // overwritten on the next edit — rasterise first (the UI offers that).
    if (!layer || layer.locked || layer.text || !isEffectivelyVisible(this.root, layer.id)) return;

    this.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.strokeCtx.globalAlpha = 1;
    this.strokeCtx.globalCompositeOperation = "source-over";
    this.strokeCtx.clearRect(0, 0, this.width, this.height);
    this.strokeSettings = { ...settings };
    this.strokeLayerId = layer.id;
    this.strokePath = [{ x: docX, y: docY }];
    this.shapeLocked = false;
    this.stroke = new StrokeRenderer(
      this.strokeCtx,
      BRUSHES[settings.brushId],
      this.strokeSettings,
    );
    this.stroke.begin({ x: docX, y: docY, pressure, pressureAlpha: pressureAlpha ?? pressure });

    // Symmetry: one extra renderer per mirrored copy, same brush and pressure.
    const mirrored = this.symmetryOf({ x: docX, y: docY });
    this.mirrors = mirrored.map((p) => {
      const r = new StrokeRenderer(this.strokeCtx, BRUSHES[settings.brushId], this.strokeSettings!);
      r.begin({ x: p.x, y: p.y, pressure, pressureAlpha: pressureAlpha ?? pressure });
      return r;
    });
    this.invalidate();
  }

  extendStroke(docX: number, docY: number, pressure: number, pressureAlpha?: number) {
    if (!this.stroke || this.shapeLocked) return;
    this.strokePath.push({ x: docX, y: docY });
    this.stroke.extend({ x: docX, y: docY, pressure, pressureAlpha: pressureAlpha ?? pressure });
    if (this.mirrors.length) {
      const mirrored = this.symmetryOf({ x: docX, y: docY });
      this.mirrors.forEach((r, i) => {
        const p = mirrored[i];
        if (p) r.extend({ x: p.x, y: p.y, pressure, pressureAlpha: pressureAlpha ?? pressure });
      });
    }
    this.invalidate();
  }

  private symmetryOf(p: Point): Point[] {
    const g = this.guides;
    if (g.symmetry === "off") return [];
    return symmetryPoints(p, g.symmetry, this.width, this.height, g.radialSegments);
  }

  endStroke() {
    const stroke = this.stroke;
    const settings = this.strokeSettings;
    const layer = this.layerById(this.strokeLayerId);
    const mirrors = this.mirrors;
    this.stroke = null;
    this.strokeSettings = null;
    this.mirrors = [];
    this.shapeLocked = false;
    if (!stroke || !settings || !layer) {
      this.invalidate();
      return;
    }

    let dirty = stroke.getDirtyRect(this.width, this.height);
    for (const m of mirrors) {
      const r = m.getDirtyRect(this.width, this.height);
      if (r) dirty = dirty ? unionRect(dirty, r, this.width, this.height) : r;
    }
    this.commitStrokeBuffer(layer, settings, dirty);
  }

  /** Stamps whatever is in the stroke buffer onto the layer as one undo step. */
  private commitStrokeBuffer(layer: Layer, settings: BrushSettings, dirty: Rect | null) {
    // Painting is clipped to the selection, so only that part can change.
    const rect = dirty && this.selection ? intersectRect(dirty, this.selection.bounds) : dirty;
    if (!rect) {
      this.strokeCtx.clearRect(0, 0, this.width, this.height);
      this.invalidate();
      return;
    }

    const source = this.clippedStroke();
    this.commitPixels(layer, rect, (ctx) => {
      ctx.globalAlpha = settings.opacity;
      ctx.globalCompositeOperation = this.strokeComposite(layer, settings);
      ctx.drawImage(source, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    });
    this.strokeCtx.clearRect(0, 0, this.width, this.height);
  }

  /* ----------------------------------------------------------- QuickShape */

  /**
   * QuickShape: replaces the live stroke with the shape it was clearly aiming
   * for. Called when the pointer has been held still at the end of the stroke.
   *
   * The shape is re-painted with the same brush, so it looks drawn rather than
   * pasted, and the stroke stays live until the pointer is lifted.
   */
  snapStrokeToShape(kind?: ShapeKind): ShapeKind | null {
    const settings = this.strokeSettings;
    if (!this.stroke || !settings) return null;
    const fit = kind ? fitShape(this.strokePath, kind) : detectShape(this.strokePath);
    if (!fit) return null;
    this.paintShapeIntoBuffer(fit, settings);
    this.shapeLocked = true;
    this.lastShape = {
      raw: [...this.strokePath],
      settings: { ...settings },
      layerId: this.strokeLayerId,
      kind: fit.kind,
    };
    this.invalidate();
    return fit.kind;
  }

  get shapeSnapped() {
    return this.shapeLocked;
  }

  /** The shape kind of the most recent QuickShape, while it is still editable. */
  get lastShapeKind(): ShapeKind | null {
    return this.lastShape?.kind ?? null;
  }

  /**
   * Swaps a just-committed QuickShape for another kind: undo the commit, refit
   * the original freehand path, paint and commit again.
   */
  reshapeLast(kind: ShapeKind): boolean {
    const last = this.lastShape;
    if (!last || this.stroke) return false;
    const layer = this.layerById(last.layerId);
    const fit = fitShape(last.raw, kind);
    if (!layer || !fit) return false;

    this.history.undo();
    const renderer = this.paintShapeIntoBuffer(fit, last.settings);
    this.commitStrokeBuffer(layer, last.settings, renderer.getDirtyRect(this.width, this.height));
    this.lastShape = { ...last, kind: fit.kind };
    this.emit();
    return true;
  }

  /** Forgets the editable QuickShape (a new stroke or tool change ends it). */
  clearShapeEdit() {
    if (!this.lastShape) return;
    this.lastShape = null;
    this.emit();
  }

  /** Re-paints the stroke buffer along a fitted shape at full pressure. */
  private paintShapeIntoBuffer(fit: ShapeFit, settings: BrushSettings): StrokeRenderer {
    const brush = BRUSHES[settings.brushId];
    this.strokeCtx.setTransform(1, 0, 0, 1, 0, 0);
    this.strokeCtx.globalAlpha = 1;
    this.strokeCtx.globalCompositeOperation = "source-over";
    this.strokeCtx.clearRect(0, 0, this.width, this.height);

    const step = Math.max(0.6, settings.size * brush.spacing);
    const points = resampleShape(fit, step);
    const renderer = new StrokeRenderer(this.strokeCtx, brush, settings);
    renderer.begin({ x: points[0]!.x, y: points[0]!.y, pressure: 1, pressureAlpha: 1 });
    for (const p of points.slice(1)) {
      renderer.extend({ x: p.x, y: p.y, pressure: 1, pressureAlpha: 1 });
    }
    return renderer;
  }

  /**
   * Composite op for stamping a finished stroke onto a layer. With alpha lock
   * on, "source-atop" keeps the layer's existing alpha, so paint lands only
   * where there is already content. Erasing stays destination-out.
   */
  private strokeComposite(layer: Layer, settings: BrushSettings): GlobalCompositeOperation {
    const brushOp = settings.erase ? "destination-out" : BRUSHES[settings.brushId].composite;
    if (layer.alphaLocked && brushOp === "source-over") return "source-atop";
    return brushOp;
  }

  get isStroking() {
    return this.stroke !== null;
  }

  /* ---------------------------------------------------------------- smudge */

  private smudge: {
    layerId: string;
    before: HTMLCanvasElement;
    last: Point;
    dirty: Rect | null;
    size: number;
    strength: number;
  } | null = null;
  private smudgeTile: HTMLCanvasElement | null = null;

  /**
   * Smudge pushes existing pixels along the stroke: each step samples a disc at
   * the previous position and stamps it, softly masked, at the current one. The
   * layer is edited live and the whole drag lands as one undo step.
   */
  beginSmudge(docX: number, docY: number, size: number, strength: number): boolean {
    const layer = this.layerById(this.activeId);
    if (!layer || layer.locked || layer.text || !isEffectivelyVisible(this.root, layer.id))
      return false;
    const before = createCanvas(this.width, this.height);
    ctxOf(before).drawImage(layer.canvas, 0, 0);
    this.smudge = {
      layerId: layer.id,
      before,
      last: { x: docX, y: docY },
      dirty: null,
      size,
      strength,
    };
    return true;
  }

  extendSmudge(docX: number, docY: number, pressure: number) {
    const s = this.smudge;
    const layer = s ? this.layerById(s.layerId) : null;
    if (!s || !layer) return;

    const radius = Math.max(1.5, (s.size / 2) * (0.45 + 0.55 * pressure));
    const step = Math.max(1, radius * 0.35);
    const dx = docX - s.last.x;
    const dy = docY - s.last.y;
    const dist = Math.hypot(dx, dy);
    if (dist < step) return;

    const steps = Math.floor(dist / step);
    for (let i = 1; i <= steps; i++) {
      const t = (i * step) / dist;
      const from = { x: s.last.x + dx * (t - step / dist), y: s.last.y + dy * (t - step / dist) };
      const to = { x: s.last.x + dx * t, y: s.last.y + dy * t };
      this.smudgeStep(layer, from, to, radius, s.strength * (0.4 + 0.6 * pressure));
      s.dirty = this.growSmudgeDirty(s.dirty, to, radius);
    }
    s.last = {
      x: s.last.x + dx * ((steps * step) / dist),
      y: s.last.y + dy * ((steps * step) / dist),
    };
    this.invalidate();
  }

  private smudgeStep(layer: Layer, from: Point, to: Point, radius: number, alpha: number) {
    const side = Math.ceil(radius * 2 + 4);
    if (!this.smudgeTile || this.smudgeTile.width < side)
      this.smudgeTile = createCanvas(side, side);
    const tile = this.smudgeTile;
    const tctx = ctxOf(tile);
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = "source-over";
    tctx.globalAlpha = 1;
    tctx.clearRect(0, 0, tile.width, tile.height);
    tctx.drawImage(
      layer.canvas,
      from.x - side / 2,
      from.y - side / 2,
      side,
      side,
      0,
      0,
      side,
      side,
    );

    // Soft round mask so the smear has no visible disc edge.
    const grad = tctx.createRadialGradient(
      side / 2,
      side / 2,
      radius * 0.15,
      side / 2,
      side / 2,
      radius,
    );
    grad.addColorStop(0, "rgba(0,0,0,1)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    tctx.globalCompositeOperation = "destination-in";
    tctx.fillStyle = grad;
    tctx.fillRect(0, 0, tile.width, tile.height);
    tctx.globalCompositeOperation = "source-over";

    const ctx = layer.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.selection) ctx.clip(this.selection.path);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.globalCompositeOperation = layer.alphaLocked ? "source-atop" : "source-over";
    ctx.drawImage(tile, to.x - side / 2, to.y - side / 2);
    ctx.restore();
  }

  private growSmudgeDirty(rect: Rect | null, p: Point, radius: number): Rect {
    const pad = radius + 3;
    const next = { x: p.x - pad, y: p.y - pad, w: pad * 2, h: pad * 2 };
    return rect ? unionRect(rect, next, this.width, this.height) : next;
  }

  /** Ends the smear and records it as a single undoable step. */
  endSmudge() {
    const s = this.smudge;
    this.smudge = null;
    if (!s) return;
    const layer = this.layerById(s.layerId);
    if (!layer || !s.dirty) {
      this.invalidate();
      return;
    }
    const rect = this.clampRect(s.dirty);
    if (!rect) return;
    const beforeCtx = ctxOf(s.before);
    const before = beforeCtx.getImageData(rect.x, rect.y, rect.w, rect.h);
    const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    this.history.push({
      label: "Smudge",
      undo: () => {
        layer.ctx.putImageData(before, rect.x, rect.y);
        this.invalidate();
      },
      redo: () => {
        layer.ctx.putImageData(after, rect.x, rect.y);
        this.invalidate();
      },
    });
    this.invalidate();
  }

  get isSmudging() {
    return this.smudge !== null;
  }

  private clampRect(r: Rect): Rect | null {
    const x = Math.max(0, Math.floor(r.x));
    const y = Math.max(0, Math.floor(r.y));
    const w = Math.min(this.width, Math.ceil(r.x + r.w)) - x;
    const h = Math.min(this.height, Math.ceil(r.y + r.h)) - y;
    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
  }

  /* --------------------------------------------------------------- pipette */

  /**
   * The colour actually visible at a point: the flattened composite, so blend
   * modes, opacity and the reference photo are all accounted for.
   * Returns null on fully transparent pixels (nothing to pick).
   */
  pickColor(docX: number, docY: number): RGB | null {
    const x = Math.round(docX);
    const y = Math.round(docY);
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return null;
    const c = this.scratchCtx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, this.width, this.height);
    compositeNodes(c, this.root, this.env);
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    const [r, g, b, a] = c.getImageData(x, y, 1, 1).data;
    if ((a ?? 0) < 8) return null;
    return { r: r ?? 0, g: g ?? 0, b: b ?? 0 };
  }

  /* ----------------------------------------------------------- adjustments */

  private adjust: { layerId: string; source: HTMLCanvasElement; settings: AdjustSettings } | null =
    null;

  /** Starts a live adjustment on the active layer. Nothing is recorded yet. */
  beginAdjust(): boolean {
    if (this.adjust) return true;
    const layer = this.layerById(this.activeId);
    if (!layer || layer.locked || !isEffectivelyVisible(this.root, layer.id)) return false;
    const source = createCanvas(this.width, this.height);
    ctxOf(source).drawImage(layer.canvas, 0, 0);
    this.adjust = { layerId: layer.id, source, settings: { ...NO_ADJUST } };
    this.emit();
    return true;
  }

  get adjustActive() {
    return this.adjust !== null;
  }

  get adjustSettings(): AdjustSettings | null {
    return this.adjust ? { ...this.adjust.settings } : null;
  }

  /** Re-renders the layer from the untouched copy with the new settings. */
  previewAdjust(settings: AdjustSettings) {
    const a = this.adjust;
    const layer = a ? this.layerById(a.layerId) : null;
    if (!a || !layer) return;
    a.settings = { ...settings };
    drawAdjusted(
      layer.ctx,
      a.source,
      a.settings,
      this.width,
      this.height,
      this.selection?.path ?? null,
    );
    this.invalidate();
  }

  /** Keeps the adjustment and records one undo step. */
  commitAdjust(): boolean {
    const a = this.adjust;
    const layer = a ? this.layerById(a.layerId) : null;
    this.adjust = null;
    if (!a || !layer) {
      this.emit();
      return false;
    }
    if (isNeutral(a.settings)) {
      this.emit();
      return false;
    }
    const rect = this.selection
      ? this.clampRect(this.selection.bounds)
      : { x: 0, y: 0, w: this.width, h: this.height };
    if (!rect) {
      this.emit();
      return false;
    }
    const before = ctxOf(a.source).getImageData(rect.x, rect.y, rect.w, rect.h);
    const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    this.history.push({
      label: "Adjustment",
      undo: () => {
        layer.ctx.putImageData(before, rect.x, rect.y);
        this.invalidate();
      },
      redo: () => {
        layer.ctx.putImageData(after, rect.x, rect.y);
        this.invalidate();
      },
    });
    this.emit();
    return true;
  }

  /** Throws the adjustment away and puts the original pixels back. */
  cancelAdjust() {
    const a = this.adjust;
    this.adjust = null;
    const layer = a ? this.layerById(a.layerId) : null;
    if (a && layer) {
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.globalAlpha = 1;
      layer.ctx.globalCompositeOperation = "source-over";
      layer.ctx.clearRect(0, 0, this.width, this.height);
      layer.ctx.drawImage(a.source, 0, 0);
    }
    this.invalidate();
    this.emit();
  }

  /* ---------------------------------------------------------------- guides */

  guides: GuideSettings = { ...DEFAULT_GUIDES };

  setGuides(patch: Partial<GuideSettings>) {
    this.guides = { ...this.guides, ...patch };
    this.invalidate();
    this.emit();
  }

  /**
   * Single funnel for every pixel mutation: snapshots the dirty rect before and
   * after, and records an undo command. A selection mask would clip here.
   */
  private commitPixels(
    layer: Layer,
    rect: Rect,
    draw: (ctx: CanvasRenderingContext2D) => void,
    label = "Streck",
  ) {
    const before = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
    layer.ctx.save();
    draw(layer.ctx);
    layer.ctx.restore();
    const after = layer.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);

    this.history.push({
      label,
      undo: () => {
        layer.ctx.putImageData(before, rect.x, rect.y);
        this.invalidate();
      },
      redo: () => {
        layer.ctx.putImageData(after, rect.x, rect.y);
        this.invalidate();
      },
    });
    this.invalidate();
  }

  undo() {
    this.history.undo();
  }

  redo() {
    this.history.redo();
  }

  /* ---------------------------------------------------------- stencil view */

  /** Marks/unmarks a pixel layer as a line layer. */
  setLayerIsLine(id: string, isLine: boolean) {
    const layer = this.layerById(id);
    if (!layer || layer.isLine === isLine) return;
    layer.isLine = isLine;
    this.invalidate();
    this.emit();
  }

  get lineViewActive() {
    return this.lineView;
  }

  get lineViewValues() {
    return this.lineViewSettings;
  }

  setLineView(active: boolean) {
    if (this.lineView === active) return;
    this.lineView = active;
    this.invalidate();
    this.emit();
  }

  setLineViewSettings(settings: Partial<LineViewSettings>) {
    this.lineViewSettings = { ...this.lineViewSettings, ...settings };
    if (this.lineView) this.invalidate();
    this.emit();
  }

  /** Visible line layers, bottom-first, as raw pixel canvases. */
  private lineSources(): HTMLCanvasElement[] {
    return collectImageLayers(this.root)
      .filter((l) => l.isLine === true && l.visible && isEffectivelyVisible(this.root, l.id))
      .map((l) => this.env.canvasFor(l));
  }

  get lineLayerCount() {
    return collectImageLayers(this.root).filter((l) => l.isLine === true).length;
  }

  /** "Stencil": high-resolution black-on-white render of the line layers. */
  toLineStencilCanvas(scale = 2): HTMLCanvasElement {
    return renderLineViewCanvas(
      this.lineSources(),
      this.width,
      this.height,
      this.lineViewSettings,
      scale,
    );
  }

  /** "Stencil (PNG)": high-resolution black-on-white render of the line layers. */
  toLineStencilPNG(scale = 2): string {
    return this.toLineStencilCanvas(scale).toDataURL("image/png");
  }

  /* ------------------------------------------------------- clean to lines */

  /**
   * The photo to trace: the locked background reference first, otherwise the
   * active layer when it actually carries pixels (an image opened as a layer).
   */
  private lineArtSource(): ImageLayer | null {
    const background = this.backgroundLayer();
    if (background) return background;
    const active = this.layerById(this.activeId);
    if (active && !active.text && this.layerHasPixels(active)) return active;
    return null;
  }

  /** Cheap emptiness probe: samples the layer on a coarse grid. */
  private layerHasPixels(layer: ImageLayer): boolean {
    const step = Math.max(1, Math.floor(Math.min(this.width, this.height) / 64));
    const data = layer.ctx.getImageData(0, 0, this.width, this.height).data;
    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        if (data[(y * this.width + x) * 4 + 3]! > 8) return true;
      }
    }
    return false;
  }

  /** True when an imported photo exists to trace ("Trace to lines"). */
  get canCleanToLines() {
    return this.lineArtSource() !== null;
  }

  /** Remembered so "Auto" re-tunes sensitivity without losing the threshold. */
  private lineArtLastThreshold = DEFAULT_EDGES.threshold;

  get lineArtActive() {
    return this.lineArt !== null;
  }

  get lineArtValues(): EdgeSettings {
    return this.lineArt ? this.lineArt.settings : { ...DEFAULT_EDGES };
  }

  /**
   * Starts a live line-art preview: a brand new layer above the active one is
   * filled with the edge detection result. The photo itself is never modified.
   */
  beginLineArt(
    settings: EdgeSettings = DEFAULT_EDGES,
    options: { cleanup?: boolean } = {},
  ): boolean {
    if (this.lineArt) return true;
    const source = this.lineArtSource();
    if (!source) return false;
    const previousActive = this.activeId;
    const layerId = this.addLayer("Lines", { silent: true });
    this.lineArt = {
      layerId,
      sourceId: source.id,
      previousActive,
      settings: { ...settings },
      cleanup: options.cleanup ?? false,
    };
    this.renderLineArt();
    return true;
  }

  /**
   * One-tap automatic line layer from the reference photo: the threshold is
   * picked from the image itself and speckles are cleaned away. The result is
   * a normal, editable line layer — the photo is never modified.
   */
  autoLineArt(): boolean {
    if (this.lineArt) this.cancelLineArt();
    const source = this.lineArtSource();
    if (!source) return false;
    const sensitivity = autoSensitivity(source.canvas);
    const threshold = this.lineArtLastThreshold;
    return this.beginLineArt({ sensitivity, threshold }, { cleanup: true });
  }

  setLineArtSettings(settings: Partial<EdgeSettings>) {
    if (!this.lineArt) return;
    if (settings.threshold !== undefined) this.lineArtLastThreshold = settings.threshold;
    this.lineArt.settings = { ...this.lineArt.settings, ...settings };
    this.renderLineArt();
  }

  private renderLineArt() {
    const state = this.lineArt;
    const source = state ? this.layerById(state.sourceId) : null;
    const layer = state ? this.layerById(state.layerId) : null;
    if (!state || !source || !layer) return;
    const edges = detectEdges(source.canvas, state.settings);
    if (state.cleanup) despeckle(edges);
    layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    layer.ctx.globalAlpha = 1;
    layer.ctx.globalCompositeOperation = "source-over";
    layer.ctx.clearRect(0, 0, this.width, this.height);
    layer.ctx.drawImage(edges, 0, 0);
    this.invalidate();
    this.emit();
  }

  /** Keeps the preview layer and makes the step undoable. */
  commitLineArt(): boolean {
    const state = this.lineArt;
    if (!state) return false;
    const ctx = findContext(this.root, state.layerId);
    if (!ctx) {
      this.lineArt = null;
      this.emit();
      return false;
    }
    const { list, node } = ctx;
    const insertAt = ctx.index;
    const previousActive = state.previousActive;
    this.lineArt = null;
    this.history.push({
      label: "Trace to lines",
      undo: () => {
        const at = list.indexOf(node);
        if (at >= 0) list.splice(at, 1);
        this.activeId = previousActive;
        this.invalidate();
        this.emit();
      },
      redo: () => {
        list.splice(Math.min(insertAt, list.length), 0, node);
        this.activeId = node.id;
        this.invalidate();
        this.emit();
      },
    });
    this.emit();
    return true;
  }

  /** Drops the preview layer without leaving a history step. */
  cancelLineArt() {
    const state = this.lineArt;
    if (!state) return;
    this.lineArt = null;
    const ctx = findContext(this.root, state.layerId);
    if (ctx) ctx.list.splice(ctx.index, 1);
    this.activeId = state.previousActive;
    this.invalidate();
    this.emit();
  }

  /* ---------------------------------------------------------- arrow tool */

  /**
   * Objects the arrow tool can grab: editable text layers and imported images
   * (the reference photo). Painted layers are left to the transform tool.
   */
  private objectCandidates(): ImageLayer[] {
    return collectImageLayers(this.root).filter(
      (layer) =>
        (layer.text !== undefined || layer.isBackground === true) &&
        isEffectivelyVisible(this.root, layer.id),
    );
  }

  get pickedObjectId(): string | null {
    return this.objectId;
  }

  /** Frame bounds of the picked object in document space, or null. */
  pickedObjectBounds(): Rect | null {
    if (!this.objectId) return null;
    const layer = this.layerById(this.objectId);
    if (!layer) return null;
    const rect = contentBounds(layer.canvas);
    if (!rect) return null;
    return padRect(rect, 2, this.width, this.height);
  }

  /** Topmost object whose pixels (or frame, when already picked) are hit. */
  objectAt(docX: number, docY: number): string | null {
    const candidates = this.objectCandidates();
    for (let i = candidates.length - 1; i >= 0; i--) {
      const layer = candidates[i]!;
      if (alphaAt(layer.canvas, docX, docY) > HIT_ALPHA) return layer.id;
    }
    // Nothing opaque was hit: fall back to the objects' boxes, so tapping the
    // gap between two letters still grabs the text instead of deselecting.
    for (let i = candidates.length - 1; i >= 0; i--) {
      const layer = candidates[i]!;
      const box = contentBounds(layer.canvas);
      if (box && insideRect(padRect(box, 2, this.width, this.height), docX, docY)) return layer.id;
    }
    return null;
  }

  /** Picks (or clears, with null) the object the frame is drawn around. */
  selectObject(id: string | null) {
    if (this.objectId === id) return;
    this.objectId = id && this.layerById(id) ? id : null;
    if (this.objectId) this.activeId = this.objectId;
    this.invalidate();
    this.emit();
  }

  /** Starts dragging the picked object. Nothing is recorded until the drop. */
  beginObjectDrag(docX: number, docY: number): boolean {
    if (!this.objectId) return false;
    const layer = this.layerById(this.objectId);
    if (!layer) return false;
    const before = createCanvas(this.width, this.height);
    ctxOf(before).drawImage(layer.canvas, 0, 0);
    this.objectDrag = {
      layerId: layer.id,
      startX: docX,
      startY: docY,
      dx: 0,
      dy: 0,
      before,
      text: layer.text ? { ...layer.text } : null,
    };
    return true;
  }

  extendObjectDrag(docX: number, docY: number) {
    const drag = this.objectDrag;
    if (!drag) return;
    const layer = this.layerById(drag.layerId);
    if (!layer) return;
    drag.dx = Math.round(docX - drag.startX);
    drag.dy = Math.round(docY - drag.startY);
    layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
    layer.ctx.globalAlpha = 1;
    layer.ctx.globalCompositeOperation = "source-over";
    layer.ctx.clearRect(0, 0, this.width, this.height);
    layer.ctx.drawImage(drag.before, drag.dx, drag.dy);
    this.invalidate();
  }

  get isDraggingObject() {
    return this.objectDrag !== null;
  }

  /** Drops the object: one undo step, or nothing when it never moved. */
  endObjectDrag(): boolean {
    const drag = this.objectDrag;
    this.objectDrag = null;
    if (!drag) return false;
    const layer = this.layerById(drag.layerId);
    if (!layer) return false;
    if (drag.dx === 0 && drag.dy === 0) {
      // Text keeps its spec as the source of truth, so restore it verbatim.
      this.emit();
      return false;
    }

    const after = createCanvas(this.width, this.height);
    ctxOf(after).drawImage(layer.canvas, 0, 0);
    const textBefore = drag.text;
    const textAfter = textBefore
      ? { ...textBefore, cx: textBefore.cx + drag.dx, cy: textBefore.cy + drag.dy }
      : null;

    const paint = (source: HTMLCanvasElement, text: TextSpec | null) => {
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.globalAlpha = 1;
      layer.ctx.globalCompositeOperation = "source-over";
      layer.ctx.clearRect(0, 0, this.width, this.height);
      layer.ctx.drawImage(source, 0, 0);
      if (layer.text && text) layer.text = { ...text };
      this.invalidate();
      this.emit();
    };
    paint(after, textAfter);
    this.history.push({
      label: "Move object",
      undo: () => paint(drag.before, textBefore),
      redo: () => paint(after, textAfter),
    });
    return true;
  }

  /* -------------------------------------------------------------- projects */

  /**
   * Snapshot of the whole document as plain JSON (layer pixels as PNG data
   * URLs), suitable for storing as a saved version.
   */
  toProject(): ProjectFile {
    return {
      format: PROJECT_FORMAT,
      width: this.width,
      height: this.height,
      mmPerPixel: this.mmPerPixel,
      activeId: this.activeId,
      nodes: serializeNodes(this.root),
    };
  }

  /**
   * Replaces the document with a saved project. Any live session state
   * (selection, transform, line-art preview, history) is dropped, because it
   * describes the document being replaced.
   */
  async loadProject(file: ProjectFile): Promise<void> {
    const nodes = await deserializeNodes(file.nodes, file.width, file.height);
    if (nodes.length === 0) throw new Error("The project contains no layers");

    this.selection = null;
    this.draft = null;
    this.transform = null;
    this.transformDrag = null;
    this.warp = null;
    this.warpDrag = null;
    this.transformBuffer = null;
    this.transformCtx = null;
    this.lineArt = null;
    this.adjust = null;
    this.smudge = null;
    this.stroke = null;
    this.objectId = null;
    this.objectDrag = null;

    this.width = file.width;
    this.height = file.height;
    this.mmPerPixel = file.mmPerPixel;

    this.strokeBuffer = createCanvas(this.width, this.height);
    this.strokeCtx = ctxOf(this.strokeBuffer);
    this.scratch = createCanvas(this.width, this.height);
    this.scratchCtx = ctxOf(this.scratch);
    this.clipBuffer = createCanvas(this.width, this.height);
    this.clipBufferCtx = ctxOf(this.clipBuffer);
    this.pool = new CanvasPool(this.width, this.height);
    this.env.pool = this.pool;

    this.root = nodes;
    this.activeId = findNode(this.root, file.activeId)
      ? file.activeId
      : (collectImageLayers(this.root).at(-1)?.id ?? nodes[nodes.length - 1]!.id);

    this.history.clear();
    this.fitToView();
    this.invalidate();
    this.emit();
  }

  /** Small preview PNG for the project library. */
  thumbnailPNG(maxSize = 320): string {
    const flat = this.renderFlattened({ matte: "#ffffff" });
    const scale = Math.min(1, maxSize / Math.max(flat.width, flat.height));
    const out = createCanvas(
      Math.max(1, Math.round(flat.width * scale)),
      Math.max(1, Math.round(flat.height * scale)),
    );
    const ctx = ctxOf(out);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(flat, 0, 0, out.width, out.height);
    return out.toDataURL("image/jpeg", 0.7);
  }

  /* --------------------------------------------------------------- export */

  /**
   * Flattens the document to a canvas.
   *
   * `includeBackground: false` drops the locked reference photo and keeps the
   * result fully transparent wherever nothing was painted — nothing is matted
   * to white or black, so the alpha channel survives every layer, group,
   * clipping mask and blend mode untouched. The pixel dimensions are always
   * the document's, which equal the reference photo's, so the artwork lands
   * back on the same coordinates in InkSimulator.
   */
  renderFlattened(options: { includeBackground?: boolean; matte?: string | null } = {}) {
    const { includeBackground = true, matte = null } = options;
    const out = createCanvas(this.width, this.height);
    const ctx = ctxOf(out);
    if (matte) {
      ctx.fillStyle = matte;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    let nodes = this.root;
    if (!includeBackground && this.backgroundLayer()) {
      // Anything clipped to the reference photo would re-clip to whatever ends
      // up at the bottom, so release the clip on the new bottom node.
      nodes = this.root
        .slice(1)
        .map((node, i) => (i === 0 && node.clipped ? { ...node, clipped: false } : node));
    }
    compositeNodes(ctx, nodes, this.env);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    return out;
  }

  /** "Hela bilden": flattened document over the reference photo, opaque. */
  toPNG(): string {
    return this.renderFlattened({ matte: "#ffffff" }).toDataURL("image/png");
  }

  /** "Endast konstverk": transparent PNG at the reference photo's dimensions. */
  toArtworkPNG(): string {
    return this.renderFlattened({ includeBackground: false }).toDataURL("image/png");
  }

  destroy() {
    this.detachView();
    this.listeners.clear();
  }
}
