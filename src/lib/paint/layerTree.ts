/**
 * Pure tree helpers for the layer stack. All sibling lists are bottom-first,
 * exactly like the root stack, so composite order is just array order.
 */
import type { ImageLayer, LayerGroup, LayerNode } from "./types";

export interface NodeContext {
  node: LayerNode;
  /** The sibling list the node lives in. */
  list: LayerNode[];
  index: number;
  parent: LayerGroup | null;
}

export function findContext(
  nodes: LayerNode[],
  id: string,
  parent: LayerGroup | null = null,
): NodeContext | null {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.id === id) return { node, list: nodes, index: i, parent };
    if (node.kind === "group") {
      const found = findContext(node.children, id, node);
      if (found) return found;
    }
  }
  return null;
}

export function findNode(nodes: LayerNode[], id: string): LayerNode | null {
  return findContext(nodes, id)?.node ?? null;
}

export function findImageLayer(nodes: LayerNode[], id: string): ImageLayer | null {
  const node = findNode(nodes, id);
  return node && node.kind === "layer" ? node : null;
}

/** Every pixel layer in composite order (bottom-first). */
export function collectImageLayers(nodes: LayerNode[], out: ImageLayer[] = []): ImageLayer[] {
  for (const node of nodes) {
    if (node.kind === "layer") out.push(node);
    else if (node.kind === "group") collectImageLayers(node.children, out);
  }
  return out;
}

/** All nodes, including collapsed group children. */
export function collectNodes(nodes: LayerNode[], out: LayerNode[] = []): LayerNode[] {
  for (const node of nodes) {
    out.push(node);
    if (node.kind === "group") collectNodes(node.children, out);
  }
  return out;
}

export interface DisplayEntry {
  node: LayerNode;
  depth: number;
  parent: LayerGroup | null;
  hasSiblingBelow: boolean;
}

/** Bottom-first flat list for the panel; collapsed groups hide their children. */
export function flattenDisplay(
  nodes: LayerNode[],
  depth = 0,
  parent: LayerGroup | null = null,
  out: DisplayEntry[] = [],
): DisplayEntry[] {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    out.push({ node, depth, parent, hasSiblingBelow: i > 0 });
    if (node.kind === "group" && node.expanded) {
      flattenDisplay(node.children, depth + 1, node, out);
    }
  }
  return out;
}

/** True when the node and every ancestor is visible with non-zero opacity. */
export function isEffectivelyVisible(nodes: LayerNode[], id: string): boolean {
  const ctx = findContext(nodes, id);
  if (!ctx) return false;
  if (!ctx.node.visible || ctx.node.opacity === 0) return false;
  return ctx.parent ? isEffectivelyVisible(nodes, ctx.parent.id) : true;
}

/** Guards against dropping a group inside itself. */
export function contains(node: LayerNode, id: string): boolean {
  if (node.id === id) return true;
  if (node.kind !== "group") return false;
  return node.children.some((child) => contains(child, id));
}
