/**
 * Core types for the paint engine.
 *
 * This whole folder is framework-agnostic: no React imports anywhere.
 * UI components talk to the engine through PaintEngine's public API only,
 * which keeps future features (blend modes, selection, transform) additive.
 */

import type { TextSpec } from "./text";
import type { AdjustSettings } from "./adjust";

export type { TextSpec, AdjustSettings };

export type BrushId =
  | "round"
  | "calligraphy"
  | "airbrush"
  | "fineline"
  | "dotwork"
  | "blackwork"
  | "watercolor"
  | "eraser";


export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "add";

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface StrokePoint {
  /** Document-space coordinates. */
  x: number;
  y: number;
  /** 0..1, already normalised (real pen pressure or speed fallback). */
  pressure: number;
  /**
   * Optional separate 0..1 value driving per-stamp opacity, so width and
   * opacity can follow different pressure curves. Falls back to `pressure`.
   */
  pressureAlpha?: number;
}

interface NodeBase {
  id: string;
  name: string;
  visible: boolean;
  /** 0..1 */
  opacity: number;
  blendMode: BlendMode;
  /** Clipped to the alpha of the sibling directly below. */
  clipped: boolean;
}

export interface ImageLayer extends NodeBase {
  kind: "layer";
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** When true, painting is clipped to the pixels the layer already has. */
  alphaLocked: boolean;
  /** Fully locked: no painting, transforming, merging or reordering. */
  locked?: boolean;
  /** The imported reference photo pinned at the bottom of the stack. */
  isBackground?: boolean;
  /** Marked as a line layer: the only layers shown in stencil view. */
  isLine?: boolean;
  /**
   * Present on text layers: the canvas is a render of this spec, so the text
   * can be re-edited until the layer is explicitly rasterised.
   */
  text?: TextSpec | undefined;
}



export interface LayerGroup extends NodeBase {
  kind: "group";
  expanded: boolean;
  /** Bottom-first, like the root stack. */
  children: LayerNode[];
}

/** The two adjustment-layer flavours, Procreate style. */
export type AdjustLayerKind = "hueSat" | "brightContrast";

/**
 * Non-destructive adjustment layer: it filters everything rendered below it in
 * its own sibling list, without ever touching those pixels. The settings stay
 * editable for as long as the layer exists.
 */
export interface AdjustmentLayer extends NodeBase {
  kind: "adjust";
  adjustKind: AdjustLayerKind;
  settings: AdjustSettings;
}

export type LayerNode = ImageLayer | LayerGroup | AdjustmentLayer;

/** Back-compat alias: "a layer" in the engine means a pixel layer. */
export type Layer = ImageLayer;

/** Serialisable view of a node for the UI (no canvas references). */
export interface LayerInfo {
  id: string;
  name: string;
  kind: "layer" | "group" | "adjust";
  /** Adjustment layers only. */
  adjustKind?: AdjustLayerKind;
  /** Adjustment layers only: the live, re-editable settings. */
  adjustSettings?: AdjustSettings;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  alphaLocked: boolean;
  clipped: boolean;
  /** Fully locked (the background reference): no paint, no move, no delete. */
  locked: boolean;
  /** True for the imported reference photo. */
  isBackground: boolean;
  /** True while the layer is still an editable text layer. */
  isText: boolean;
  /** True when the layer is marked as a line layer (stencil view). */
  isLine: boolean;

  /** Groups only. */
  expanded: boolean;
  /** Nesting level, 0 at the root. */
  depth: number;

  parentId: string | null;
  /** True when a sibling exists directly below (clip target). */
  hasSiblingBelow: boolean;
  /** The sibling below is a pixel layer, so merge down is possible. */
  canMergeDown: boolean;
  /** Nearest sibling group (below first, then above) to move into, if any. */
  adjacentGroupId: string | null;
}

export interface BrushSettings {
  brushId: BrushId;
  /** px in document space, 1..200 */
  size: number;
  /** 0..1 */
  opacity: number;
  color: RGB;
  /**
   * Erase mode: the stroke is stamped with destination-out, so any brush shape
   * can be used as an eraser without a separate brush definition.
   */
  erase?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
