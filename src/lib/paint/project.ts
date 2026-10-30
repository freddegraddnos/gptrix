/**
 * Project serialisation.
 *
 * A project file is plain JSON: document size, physical scale and the layer
 * tree, where every pixel layer's canvas is stored as a PNG data URL. That
 * keeps saved versions self-contained (no external assets) and portable, so a
 * saved sketch can be reopened later — or handed to another app — unchanged.
 */

import type {
  AdjustSettings,
  AdjustLayerKind,
  BlendMode,
  ImageLayer,
  LayerNode,
  TextSpec,
} from "./types";

export const PROJECT_FORMAT = 1;

interface SerializedBase {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  blendMode: BlendMode;
  clipped: boolean;
}

export interface SerializedImageLayer extends SerializedBase {
  kind: "layer";
  /** PNG data URL of the layer's pixels. */
  png: string;
  alphaLocked: boolean;
  locked?: boolean;
  isBackground?: boolean;
  isLine?: boolean;
  text?: TextSpec;
}

export interface SerializedGroup extends SerializedBase {
  kind: "group";
  expanded: boolean;
  children: SerializedNode[];
}

export interface SerializedAdjustLayer extends SerializedBase {
  kind: "adjust";
  adjustKind: AdjustLayerKind;
  settings: AdjustSettings;
}

export type SerializedNode = SerializedImageLayer | SerializedGroup | SerializedAdjustLayer;

export interface ProjectFile {
  format: number;
  width: number;
  height: number;
  mmPerPixel: number;
  activeId: string;
  /** Bottom-first, exactly like the engine's root list. */
  nodes: SerializedNode[];
}

function baseOf(node: LayerNode): SerializedBase {
  return {
    id: node.id,
    name: node.name,
    visible: node.visible,
    opacity: node.opacity,
    blendMode: node.blendMode,
    clipped: node.clipped,
  };
}

export function serializeNodes(nodes: LayerNode[]): SerializedNode[] {
  return nodes.map((node): SerializedNode => {
    if (node.kind === "group") {
      return {
        ...baseOf(node),
        kind: "group",
        expanded: node.expanded,
        children: serializeNodes(node.children),
      };
    }
    if (node.kind === "adjust") {
      return {
        ...baseOf(node),
        kind: "adjust",
        adjustKind: node.adjustKind,
        settings: { ...node.settings },
      };
    }
    return {
      ...baseOf(node),
      kind: "layer",
      png: node.canvas.toDataURL("image/png"),
      alphaLocked: node.alphaLocked,
      ...(node.locked ? { locked: true } : {}),
      ...(node.isBackground ? { isBackground: true } : {}),
      ...(node.isLine ? { isLine: true } : {}),
      ...(node.text ? { text: { ...node.text } } : {}),
    };
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("A layer image could not be read"));
    image.src = src;
  });
}

/**
 * Rebuilds live layer nodes from a project file. Canvases are created at the
 * document size and the stored PNG is drawn at 0,0, so pixel positions survive
 * a round trip exactly.
 */
export async function deserializeNodes(
  nodes: SerializedNode[],
  width: number,
  height: number,
): Promise<LayerNode[]> {
  const out: LayerNode[] = [];
  for (const node of nodes) {
    const base = {
      id: node.id,
      name: node.name,
      visible: node.visible,
      opacity: node.opacity,
      blendMode: node.blendMode,
      clipped: node.clipped,
    };
    if (node.kind === "group") {
      out.push({
        ...base,
        kind: "group",
        expanded: node.expanded,
        children: await deserializeNodes(node.children, width, height),
      });
      continue;
    }
    if (node.kind === "adjust") {
      out.push({
        ...base,
        kind: "adjust",
        adjustKind: node.adjustKind,
        settings: { ...node.settings },
      });
      continue;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    if (node.png) {
      const image = await loadImage(node.png);
      ctx.drawImage(image, 0, 0);
    }
    const layer: ImageLayer = {
      ...base,
      kind: "layer",
      canvas,
      ctx,
      alphaLocked: node.alphaLocked,
      ...(node.locked ? { locked: true } : {}),
      ...(node.isBackground ? { isBackground: true } : {}),
      ...(node.isLine ? { isLine: true } : {}),
      ...(node.text ? { text: { ...node.text } } : {}),
    };
    out.push(layer);
  }
  return out;
}

/** Cheap validation of untrusted JSON before it is handed to the engine. */
export function isProjectFile(value: unknown): value is ProjectFile {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<ProjectFile>;
  return (
    typeof p.width === "number" &&
    typeof p.height === "number" &&
    typeof p.mmPerPixel === "number" &&
    Array.isArray(p.nodes)
  );
}
